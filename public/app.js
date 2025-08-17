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
  scores: { trump: 50, putin: 50 },
  batna: { trump: 60, putin: 60 },
  userAccepted: false,
  oppAccepted: false,
  concluded: false,
  yourUsedTriggerKeys: []
};

const chatEl = document.getElementById('chat');
const judgeEl = document.getElementById('judge');
const personaEl = document.getElementById('persona');
const resetBtn = document.getElementById('resetBtn');
const inputEl = document.getElementById('message');
const sendBtn = document.getElementById('send');

const btnRequestAgree = document.getElementById('btn-request-agree');
const btnConclude = document.getElementById('btn-conclude');

const yourAvailableEl = document.getElementById('your-available');
const yourConfirmedClausesEl = document.getElementById('your-confirmed-clauses');
const oppConfirmedClausesEl = document.getElementById('opp-confirmed-clauses');
const oppPendingClauseEl = document.getElementById('opp-pending-clause');

const barTrumpCur = document.getElementById('bar-trump-current');
const barPutinCur = document.getElementById('bar-putin-current');
const barPieCur = document.getElementById('bar-pie-current');
const barTrumpProj = document.getElementById('bar-trump-projected');
const barPutinProj = document.getElementById('bar-putin-projected');
const barPieProj = document.getElementById('bar-pie-projected');

const scoreTrump = document.getElementById('score-trump');
const scorePutin = document.getElementById('score-putin');
const scorePie = document.getElementById('score-pie');

const batnaTrumpEl = document.getElementById('batna-trump');
const batnaPutinEl = document.getElementById('batna-putin');

const partyYouEl = document.getElementById('party-you');
const partyOppEl = document.getElementById('party-opp');
const dateEl = document.getElementById('hoa-date');

const sigYouLine = document.getElementById('sig-you-line');
const sigYouName = document.getElementById('sig-you-name');
const sigYouDate = document.getElementById('sig-you-date');
const sigOppLine = document.getElementById('sig-opp-line');
const sigOppName = document.getElementById('sig-opp-name');
const sigOppDate = document.getElementById('sig-opp-date');

// Onboarding
let obStep = 1;
const obOverlay = document.getElementById('onboarding');
const obStepLabel = document.getElementById('ob-step');
const obPrev = document.getElementById('ob-prev');
const obNext = document.getElementById('ob-next');
const obStart = document.getElementById('ob-start');
const obSkip = document.getElementById('ob-skip');

function showOnboarding(step) {
  obStep = Math.max(1, Math.min(5, step));
  obStepLabel.textContent = String(obStep);
  for (let i = 1; i <= 5; i += 1) {
    const slide = document.getElementById(`ob-slide-${i}`);
    if (!slide) continue;
    slide.classList.toggle('hidden', i !== obStep);
  }
  obPrev.disabled = obStep === 1;
  obNext.classList.toggle('hidden', obStep === 5);
  obStart.classList.toggle('hidden', obStep !== 5);
  obOverlay.classList.remove('hidden');
  // Animate demo bars a bit on each show
  if (obStep === 1) {
    const tProj = document.getElementById('ob-t-proj');
    const pProj = document.getElementById('ob-p-proj');
    const pieProj = document.getElementById('ob-pie-proj');
    if (tProj) { tProj.style.width = '72%'; setTimeout(() => { tProj.style.width = '68%'; }, 700); }
    if (pProj) { pProj.style.width = '67%'; setTimeout(() => { pProj.style.width = '63%'; }, 700); }
    if (pieProj) { pieProj.style.width = '82%'; setTimeout(() => { pieProj.style.width = '78%'; }, 700); }
  }
}

function hideOnboarding() {
  obOverlay.classList.add('hidden');
  localStorage.setItem('nrp_seen_onboarding', '1');
}

if (!localStorage.getItem('nrp_seen_onboarding')) {
  // delay slightly to allow page to render first
  setTimeout(() => showOnboarding(1), 200);
}

obPrev?.addEventListener('click', () => showOnboarding(obStep - 1));
obNext?.addEventListener('click', () => showOnboarding(obStep + 1));
obStart?.addEventListener('click', hideOnboarding);
obSkip?.addEventListener('click', hideOnboarding);

function formatDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function partyLabel(id) {
  return id === 'trump' ? 'United States of America' : 'Russian Federation';
}

function leaderName(id) {
  return id === 'trump' ? 'Donald J. Trump' : 'Vladimir V. Putin';
}

function renderAvailable() {
  const youAvail = state.yourAvailable.filter(c => !state.yourConfirmed.find(x => x.key === c.key));
  yourAvailableEl.innerHTML = youAvail.map(c => {
    const lossBalls = Array.from({ length: c.makerCost }).map(() => '<span class="ball user-hollow"></span>').join('');
    const gainBalls = Array.from({ length: c.receiverGain }).map(() => '<span class="ball opp-full"></span>').join('');
    const tip = `Cost to you: ${c.makerCost} • Benefit to them: ${c.receiverGain}. Hollow teal = your loss. Solid blue = their gain.`;
    const tipId = `tip-${state.persona}-${c.key}`;
    return `
      <li class="concession-item">
        <div class="ci-grid">
          <div class="ci-title">${c.label}</div>
          <div class="ci-metrics with-tooltip" aria-describedby="${tipId}">
            <div class="balls">${lossBalls}<span class="ball-divider"></span>${gainBalls}</div>
            <div class="tooltip" id="${tipId}" role="tooltip">${tip}</div>
          </div>
        </div>
      </li>
    `;
  }).join('');
}

function writeClauseText(side, c) {
  if (side === 'trump') {
    return `The United States shall ${c.label.toLowerCase()}.`;
  } else {
    return `The Russian Federation shall ${c.label.toLowerCase()}.`;
  }
}

function renderClauses() {
  yourConfirmedClausesEl.innerHTML = state.yourConfirmed.map(c => `<li class="user-clause">${writeClauseText(state.persona, c)}</li>`).join('');
  oppConfirmedClausesEl.innerHTML = state.oppConfirmed.map(c => `<li class="opp-clause">${writeClauseText(state.opponent, c)}</li>`).join('');
  oppPendingClauseEl.textContent = state.oppPending ? writeClauseText(state.opponent, state.oppPending) : '—';
}

function clamp(x) { return Math.max(2, Math.min(100, x)); }

function applyBars(curT, curP, projT, projP) {
  const curPie = curT + curP;
  const projPie = projT + projP;
  scoreTrump.textContent = String(Math.round(curT));
  scorePutin.textContent = String(Math.round(curP));
  scorePie.textContent = String(Math.round(curPie));
  barTrumpCur.style.width = clamp(curT) + '%';
  barPutinCur.style.width = clamp(curP) + '%';
  barPieCur.style.width = clamp(curPie / 2) + '%';
  barTrumpProj.style.width = clamp(projT) + '%';
  barPutinProj.style.width = clamp(projP) + '%';
  barPieProj.style.width = clamp(projPie / 2) + '%';
}

function computeProjection() {
  let projT = state.scores.trump;
  let projP = state.scores.putin;
  if (state.oppPending) {
    if (state.opponent === 'trump') {
      projT = projT - state.oppPending.makerCost;
      projP = projP + state.oppPending.receiverGain;
    } else {
      projP = projP - state.oppPending.makerCost;
      projT = projT + state.oppPending.receiverGain;
    }
  }
  return { projT, projP };
}

function renderScores() {
  const { projT, projP } = computeProjection();
  applyBars(state.scores.trump, state.scores.putin, projT, projP);
  batnaTrumpEl.textContent = `(BATNA ≥ ${state.batna.trump})`;
  batnaPutinEl.textContent = `(BATNA ≥ ${state.batna.putin})`;
}

function renderSignatures() {
  if (state.concluded) {
    sigYouName.textContent = leaderName(state.persona);
    sigOppName.textContent = leaderName(state.opponent);
    const today = formatDate();
    sigYouDate.textContent = today;
    sigOppDate.textContent = today;
  } else {
    sigYouName.textContent = '';
    sigOppName.textContent = '';
    sigYouDate.textContent = '';
    sigOppDate.textContent = '';
  }
}

function setUiEnabled(enabled) {
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled;
  btnRequestAgree.disabled = !enabled;
  btnConclude.disabled = !enabled;
}

function addMessage(who, text) {
  const div = document.createElement('div');
  div.className = `message ${who}`;
  div.innerHTML = `<div class="who">${who === 'user' ? 'You' : 'Opponent'}</div><div>${text}</div>`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message opp';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="who">Opponent</div><div class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeTypingIndicator() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

function enableEnterToSend() {
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

// hook enter-to-send once
enableEnterToSend();

// augment existing send handler: wrap server respond section to include typing animation and delay
const originalSendHandler = sendBtn.onclick;
sendBtn.onclick = null;

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
  // Default BATNA can be adjusted here per persona/opponent if desired
  state.batna = { trump: 60, putin: 60 };
  state.userAccepted = false;
  state.oppAccepted = false;
  state.concluded = false;
  state.yourUsedTriggerKeys = [];

  chatEl.innerHTML = '';
  judgeEl.innerHTML = '';

  partyYouEl.textContent = partyLabel(state.persona);
  partyOppEl.textContent = partyLabel(state.opponent);
  dateEl.textContent = formatDate();

  addMessage('opp', `You are ${state.persona.toUpperCase()}. I am ${state.opponent.toUpperCase()}. Begin when ready.`);
  renderAvailable();
  renderClauses();
  renderScores();
  renderSignatures();
  setUiEnabled(true);
}

personaEl.addEventListener('change', () => { init(); });
resetBtn.addEventListener('click', () => { init(); });

btnRequestAgree.addEventListener('click', () => {
  if (state.concluded) return;
  const myScore = state.persona === 'trump' ? state.scores.trump : state.scores.putin;
  const myBatna = state.batna[state.persona];
  if (myScore < myBatna) {
    addMessage('opp', `You cannot proceed to agreement yet. Your BATNA requires ≥ ${myBatna}, current is ${Math.round(myScore)}.`);
    return;
  }

  // User is willing and meets BATNA
  state.userAccepted = true;
  addMessage('user', 'We propose to proceed to agreement.');

  const oppScore = state.opponent === 'trump' ? state.scores.trump : state.scores.putin;
  const oppBatna = state.batna[state.opponent];
  if (oppScore >= oppBatna) {
    state.oppAccepted = true;
    addMessage('opp', 'We agree to proceed to conclusion.');
  } else {
    state.oppAccepted = false;
    addMessage('opp', `We are not ready to agree. Our BATNA requires ≥ ${oppBatna}, current is ${Math.round(oppScore)}.`);
  }
});

btnConclude.addEventListener('click', () => {
  if (state.concluded) return;
  // Both sides must have accepted and both must meet BATNA
  const myScore = state.persona === 'trump' ? state.scores.trump : state.scores.putin;
  const oppScore = state.opponent === 'trump' ? state.scores.trump : state.scores.putin;
  const myBatna = state.batna[state.persona];
  const oppBatna = state.batna[state.opponent];

  if (!state.userAccepted) {
    addMessage('opp', 'You have not indicated readiness to agree.');
    return;
  }
  if (!state.oppAccepted) {
    addMessage('opp', 'We have not yet indicated readiness to agree.');
    return;
  }
  if (myScore < myBatna) {
    addMessage('opp', `Your BATNA (≥ ${myBatna}) is not satisfied. Current: ${Math.round(myScore)}.`);
    return;
  }
  if (oppScore < oppBatna) {
    addMessage('opp', `Our BATNA (≥ ${oppBatna}) is not satisfied. Current: ${Math.round(oppScore)}.`);
    return;
  }

  // Conclude
  state.concluded = true;
  addMessage('user', 'We request that the parties execute this Heads of Agreement.');
  addMessage('opp', 'Agreed. We execute and sign.');
  renderSignatures();
  setUiEnabled(false);
});

sendBtn.addEventListener('click', async () => {
  if (state.concluded) return;
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  addMessage('user', text);
  state.conversation.push({ role: 'user', content: text });

  const concessionResp = await fetch('/api/check-concession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastUserMessage: text, player: state.persona }) }).then(r => r.json());

  let judgeResp = { ok: true, result: { outcome: 'no_unfollowed', reason: 'Skipped due to concession or neutral message.' } };
  if (!(concessionResp.ok && concessionResp.result.matched)) {
    judgeResp = await fetch('/api/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: state.conversation, lastUserMessage: text }) }).then(r => r.json());
  }

  let judgeText = '';
  if (judgeResp.ok) {
    const r = judgeResp.result;
    if (r.outcome === 'yes') judgeText = `Yes — followed rule: ${r.ruleFollowed}. ${r.reason || ''}`;
    else if (r.outcome === 'no_breached') judgeText = `No — breached rule: ${r.ruleBreached}. ${r.reason || ''}`;
    else judgeText = `No rule followed. ${r.reason || ''}`;
  } else judgeText = 'Judge failed.';
  judgeEl.textContent = judgeText;

  let userConcessionKey = null;
  if (concessionResp.ok && concessionResp.result.matched) {
    const key = concessionResp.result.concessionKey;
    userConcessionKey = key;
    const meList = state.concessions[state.persona];
    const found = meList.find(c => c.key === key);
    // Treat as a trigger only: adjust scores once, do not add to HOA
    const alreadyUsed = state.yourUsedTriggerKeys.includes(key);
    if (found && !alreadyUsed) {
      state.yourUsedTriggerKeys.push(key);
      if (state.persona === 'trump') { state.scores.trump -= found.makerCost; state.scores.putin += found.receiverGain; }
      else { state.scores.putin -= found.makerCost; state.scores.trump += found.receiverGain; }
    }
  }

  renderClauses();
  renderScores();

  const mode = (judgeResp.ok && judgeResp.result.outcome === 'yes') ? 'opportunity' : 'unconstructive';

  // Show typing indicator during response latency with a natural delay
  addTypingIndicator();
  const naturalDelayMs = 400 + Math.floor(Math.random() * 500); // 400-900ms
  const respondPromise = fetch('/api/respond', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation: state.conversation, mode, opponent: state.opponent, userConcessionKey, pendingOppKey: state.oppPending?.key || null })
  }).then(r => r.json());

  await new Promise(res => setTimeout(res, naturalDelayMs));
  const resp = await respondPromise;
  removeTypingIndicator();

  if (resp.ok && resp.result) {
    const replyText = resp.result.replyText || '[no text]';
    addMessage('opp', replyText);
    state.conversation.push({ role: 'assistant', content: replyText });

    if (resp.result.accepted === true && state.oppPending) {
      state.oppConfirmed.push(state.oppPending);
      if (state.opponent === 'trump') { state.scores.trump -= state.oppPending.makerCost; state.scores.putin += state.oppPending.receiverGain; }
      else { state.scores.putin -= state.oppPending.makerCost; state.scores.trump += state.oppPending.receiverGain; }
      state.oppPending = null;
    } else if (resp.result.pendingOppConcessionKey) {
      const oppList = state.concessions[state.opponent];
      const pending = oppList.find(c => c.key === resp.result.pendingOppConcessionKey);
      if (pending) state.oppPending = pending;
    }
  } else {
    addMessage('opp', '[response failed]');
  }

  renderAvailable();
  renderClauses();
  renderScores();
});

const helpBtn = document.getElementById('helpBtn');
helpBtn?.addEventListener('click', () => {
  showOnboarding(1);
});

init();
