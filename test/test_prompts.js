/*
Run: npm run dev (in another terminal), then: npm run test:prompts
*/

const BASE = process.env.BASE || 'http://localhost:3000';

async function ensureFetch() {
  if (typeof fetch !== 'function') {
    const mod = await import('node-fetch');
    global.fetch = mod.default;
  }
}

async function testJudge() {
  const body = {
    conversation: [
      { role: 'assistant', content: 'Welcome to the negotiation.' }
    ],
    lastUserMessage: 'Let us focus on underlying interests, like regional stability and trade flows.'
  };
  const res = await fetch(`${BASE}/api/judge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  console.log('JUDGE:', j);
}

async function testRespondOpportunity() {
  const body = {
    conversation: [
      { role: 'user', content: 'We can explore multiple options that benefit both sides.' }
    ],
    mode: 'opportunity',
    opponent: 'putin'
  };
  const res = await fetch(`${BASE}/api/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  console.log('RESPOND (opportunity):', j);
}

async function testRespondUnconstructive() {
  const body = {
    conversation: [
      { role: 'user', content: 'Your position is ridiculous.' }
    ],
    mode: 'unconstructive',
    opponent: 'putin'
  };
  const res = await fetch(`${BASE}/api/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  console.log('RESPOND (unconstructive):', j);
}

async function testCheckConcession() {
  const body = {
    lastUserMessage: 'I am willing to provide limited sanctions easing tied to milestones.',
    player: 'trump'
  };
  const res = await fetch(`${BASE}/api/check-concession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  console.log('CHECK CONCESSION:', j);
}

(async () => {
  await ensureFetch();
  await testJudge();
  await testRespondOpportunity();
  await testRespondUnconstructive();
  await testCheckConcession();
})();
