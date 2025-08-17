const state = {
  persona: 'trump',
  opponent: 'putin',
  conversation: [],
  rules: [],
  concessions: { trump: [], putin: [] },
  yourAvailable: [],
  yourConfirmed: [],
  oppPending: null,
  oppConfirmed: [],
  scores: { trump: 50, putin: 50 }
};

const chatEl = document.getElementById('chat');
const judgeEl = document.getElementById('judge');
const personaEl = document.getElementById('persona');
const resetBtn = document.getElementById('resetBtn');
const inputEl = document.getElementById('message');
const sendBtn = document.getElementById('send');

const yourAvailableEl = document.getElementById('your-available');
const yourConfirmedEl = document.getElementById('your-confirmed');
const oppPendingEl = document.getElementById('opp-pending');
const oppConfirmedEl = document.getElementById('opp-confirmed');

const rulesBoxEl = document.getElementById('rulesBox');

const barTrump = document.getElementById('bar-trump');
const barPutin = document.getElementById('bar-putin');
const barPie = document.getElementById('bar-pie');
const scoreTrump = document.getElementById('score-trump');
const scorePutin = document.getElementById('score-putin');
const scorePie = document.getElementById('score-pie');

function renderRules() {
  rulesBoxEl.innerHTML = '<strong>Principled Negotiation Rules:</strong>' +
    '<ol>' + state.rules.map(r => `<li><strong>${r.title}:</strong> ${r.description}</li>`).join('') + '</ol>';
}

function renderHOA() {
  const me = state.persona;
  const youAvail = state.yourAvailable.filter(c => !state.yourConfirmed.find(x => x.key === c.key));

  yourAvailableEl.innerHTML = youAvail.map(c => `<li><span>${c.label}</span><code>${c.key}</code></li>`).join('');
  yourConfirmedEl.innerHTML = state.yourConfirmed.map(c => `<li><span>${c.label}</span><code>${c.key}</code></li>`).join('');
  oppPendingEl.innerHTML = state.oppPending ? `<li><span>${state.oppPending.label}</span><code>${state.oppPending.key}</code></li>` : '';
  oppConfirmedEl.innerHTML = state.oppConfirmed.map(c => `<li><span>${c.label}</span><code>${c.key}</code></li>`).join('');
}

function renderScores() {
  const t = Math.round(state.scores.trump);
  const p = Math.round(state.scores.putin);
  const pie = t + p;
  scoreTrump.textContent = String(t);
  scorePutin.textContent = String(p);
  scorePie.textContent = String(pie);
  barTrump.style.width = Math.max(2, Math.min(100, t)) + '%';
  barPutin.style.width = Math.max(2, Math.min(100, p)) + '%';
  barPie.style.width = Math.max(2, Math.min(100, (pie / 2))) + '%';
}

function addMessage(who, text) {
  const div = document.createElement('div');
  div.className = `message ${who}`;
  div.innerHTML = `<div class="who">${who === 'user' ? 'You' : 'Opponent'}</div><div>${text}</div>`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function init() {
  const meta = await fetch('/api/metadata').then(r => r.json());
  state.rules = meta.rules;
  state.concessions = meta.concessions;
  state.persona = personaEl.value;
  state.opponent = state.persona === 'trump' ? 'putin' : 'trump';
  state.yourAvailable = state.concessions[state.persona];
  state.yourConfirmed = [];
  state.oppPending = null;
  state.oppConfirmed = [];
  state.scores = { trump: 50, putin: 50 };
  chatEl.innerHTML = '';
  judgeEl.innerHTML = '';
  addMessage('opp', `You are ${state.persona.toUpperCase()}. I am ${state.opponent.toUpperCase()}. Begin when ready.`);
  renderRules();
  renderHOA();
  renderScores();
}

personaEl.addEventListener('change', () => {
  init();
});

resetBtn.addEventListener('click', () => {
  init();
});

sendBtn.addEventListener('click', async () => {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  addMessage('user', text);
  state.conversation.push({ role: 'user', content: text });

  const [judgeResp, concessionResp] = await Promise.all([
    fetch('/api/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: state.conversation, lastUserMessage: text }) }).then(r => r.json()),
    fetch('/api/check-concession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastUserMessage: text, player: state.persona }) }).then(r => r.json())
  ]);

  let judgeText = '';
  if (judgeResp.ok) {
    const r = judgeResp.result;
    if (r.outcome === 'yes') {
      judgeText = `Yes — followed rule: ${r.ruleFollowed}. ${r.reason || ''}`;
    } else if (r.outcome === 'no_breached') {
      judgeText = `No — breached rule: ${r.ruleBreached}. ${r.reason || ''}`;
    } else {
      judgeText = `No rule followed. ${r.reason || ''}`;
    }
  } else {
    judgeText = 'Judge failed.';
  }
  judgeEl.textContent = judgeText;

  if (concessionResp.ok && concessionResp.result.matched) {
    const key = concessionResp.result.concessionKey;
    const meList = state.concessions[state.persona];
    const found = meList.find(c => c.key === key);
    if (found && !state.yourConfirmed.find(c => c.key === key)) {
      state.yourConfirmed.push(found);
      if (state.persona === 'trump') {
        state.scores.trump -= found.makerCost;
        state.scores.putin += found.receiverGain;
      } else {
        state.scores.putin -= found.makerCost;
        state.scores.trump += found.receiverGain;
      }
      if (state.oppPending) {
        state.oppConfirmed.push(state.oppPending);
        if (state.opponent === 'trump') {
          state.scores.trump -= state.oppPending.makerCost;
          state.scores.putin += state.oppPending.receiverGain;
        } else {
          state.scores.putin -= state.oppPending.makerCost;
          state.scores.trump += state.oppPending.receiverGain;
        }
        state.oppPending = null;
      }
    }
  }

  let mode = 'unconstructive';
  if (judgeResp.ok && judgeResp.result.outcome === 'yes') mode = 'opportunity';

  const resp = await fetch('/api/respond', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation: state.conversation, mode, opponent: state.opponent })
  }).then(r => r.json());

  if (resp.ok && resp.result) {
    const replyText = resp.result.replyText || '[no text]';
    addMessage('opp', replyText);
    state.conversation.push({ role: 'assistant', content: replyText });
    if (mode === 'opportunity' && resp.result.pendingOppConcessionKey) {
      const oppList = state.concessions[state.opponent];
      const pending = oppList.find(c => c.key === resp.result.pendingOppConcessionKey);
      if (pending) state.oppPending = pending;
    }
  } else {
    addMessage('opp', '[response failed]');
  }

  renderHOA();
  renderScores();
});

init();
