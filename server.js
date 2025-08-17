import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const openaiApiKey = process.env.OPENAI_API_KEY;
const modelFromEnv = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!openaiApiKey) {
  console.warn('OPENAI_API_KEY missing. Running in offline mock mode.');
}

const openai = new OpenAI({ apiKey: openaiApiKey || '' });

const PRINCIPLED_RULES = [
  { key: 'separate_people_from_problem', title: 'Separate people from the problem', description: 'Addresses the issue without attacking character; acknowledges emotions and relationships while focusing on the substantive problem.' },
  { key: 'focus_on_interests', title: 'Focus on interests, not positions', description: 'Explores underlying motivations and needs, not fixed demands.' },
  { key: 'invent_options_for_mutual_gain', title: 'Invent options for mutual gain', description: 'Proposes creative, multiple options that expand the pie for both sides.' },
  { key: 'use_objective_criteria', title: 'Insist on objective criteria', description: 'Suggests standards, benchmarks, or independent norms to resolve differences.' },
  { key: 'consider_batna', title: 'Know and improve BATNA', description: 'References alternatives and strengthens no-deal options without making threats.' }
];

const CONCESSIONS = {
  trump: [
    { key: 'tariff_relief', label: 'Tariff relief on specific categories', makerCost: 3, receiverGain: 9 },
    { key: 'sanctions_easing', label: 'Limited sanctions easing tied to milestones', makerCost: 4, receiverGain: 10 },
    { key: 'security_assurances', label: 'Narrow security assurances (non-escalation pledge)', makerCost: 2, receiverGain: 8 },
    { key: 'timeline_extension', label: 'Timeline extension on compliance', makerCost: 2, receiverGain: 7 },
    { key: 'joint_statement', label: 'Joint statement recognizing mutual interests', makerCost: 1, receiverGain: 6 }
  ],
  putin: [
    { key: 'deescalation_steps', label: 'De-escalation steps and troop repositioning', makerCost: 3, receiverGain: 9 },
    { key: 'inspections_access', label: 'Expanded inspections/transparency access', makerCost: 2, receiverGain: 8 },
    { key: 'cyber_restraints', label: 'Cyber restraint commitments', makerCost: 2, receiverGain: 8 },
    { key: 'prisoner_exchange', label: 'Prisoner exchange and humanitarian corridors', makerCost: 3, receiverGain: 9 },
    { key: 'joint_taskforce', label: 'Joint taskforce on mutual concerns', makerCost: 1, receiverGain: 6 }
  ]
};

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {} }
  return null;
}

function mockJudge(msg = '') {
  const t = msg.toLowerCase();
  if (/(concede|concession|i will|we will|i am willing|we are willing)/.test(t)) {
    return { outcome: 'no_unfollowed', reason: 'Concession proposal detected; rule check skipped.' };
  }
  if (/(interest|mutual|win-win)/.test(t)) return { outcome: 'yes', ruleFollowed: 'focus_on_interests', ruleBreached: null, reason: 'Focuses on interests.' };
  if (/(option|multiple solutions|creative)/.test(t)) return { outcome: 'yes', ruleFollowed: 'invent_options_for_mutual_gain', ruleBreached: null, reason: 'Options for mutual gain.' };
  if (/(objective|criteria|benchmark|standard)/.test(t)) return { outcome: 'yes', ruleFollowed: 'use_objective_criteria', ruleBreached: null, reason: 'Objective criteria.' };
  if (/(batna|alternative|walk away)/.test(t)) return { outcome: 'yes', ruleFollowed: 'consider_batna', ruleBreached: null, reason: 'Considers alternatives.' };
  if (/(idiot|stupid|ridiculous|you people)/.test(t)) return { outcome: 'no_breached', ruleBreached: 'separate_people_from_problem', reason: 'Personal attack.' };
  return { outcome: 'no_unfollowed', reason: 'No clear principled rule detected.' };
}

function mockRespond(conversation = [], mode = 'opportunity', opponent = 'putin', userConcessionKey = null) {
  if (mode === 'unconstructive') return { replyText: 'Let us keep this professional and focus on concrete issues and facts.' };
  const oppList = CONCESSIONS[opponent];
  const pending = oppList[0]?.key || null;
  return { replyText: 'Acknowledged. We can tentatively advance if reciprocity is meaningful.', pendingOppConcessionKey: pending };
}

function mockCheckConcession(lastUserMessage = '', player = 'trump') {
  const text = lastUserMessage.toLowerCase();
  const options = CONCESSIONS[player];
  for (const c of options) {
    const keyHit = text.includes(c.key.replace(/_/g, ' '));
    const labelHit = text.includes(c.label.split(' ')[0].toLowerCase());
    if (keyHit || labelHit) return { matched: true, concessionKey: c.key, rationale: 'Detected a concession declaration.' };
  }
  return { matched: false, rationale: 'No concession keywords detected.' };
}

app.post('/api/judge', async (req, res) => {
  try {
    const { conversation = [], lastUserMessage = '' } = req.body || {};

    // If user is proposing a concession, skip breach semantics
    if (/(\bconcede\b|\bconcession\b|\bi am willing\b|\bwe are willing\b|\bi will\b|\bwe will\b)/i.test(lastUserMessage)) {
      return res.json({ ok: true, result: { outcome: 'no_unfollowed', reason: 'Concession proposal detected; rule check skipped.' } });
    }

    if (!openaiApiKey) return res.json({ ok: true, result: mockJudge(lastUserMessage) });

    const instructions = `You are a principled negotiation judge. If the message explicitly declares a concession, do not mark a breach: return outcome \"no_unfollowed\" with a short note. Otherwise, evaluate strictly. Respond ONLY JSON: { outcome: \"yes\"|\"no_breached\"|\"no_unfollowed\", ruleFollowed?: string, ruleBreached?: string, reason: string }.`;

    const messages = [
      { role: 'system', content: instructions },
      { role: 'user', content: `Conversation so far: ${JSON.stringify(conversation).slice(0, 8000)}\nLast user message: ${lastUserMessage}` }
    ];

    const completion = await openai.chat.completions.create({ model: modelFromEnv, temperature: 0.1, max_tokens: 300, messages });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || { outcome: 'no_unfollowed', reason: 'Unparseable response' };
    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'judge failed' });
  }
});

app.post('/api/respond', async (req, res) => {
  try {
    const { conversation = [], mode = 'opportunity', opponent = 'putin', userConcessionKey = null, pendingOppKey = null } = req.body || {};

    // If the user proposed a concession while there is a pending opponent concession,
    // accept only if benefit to opponent >= their pending makerCost. Otherwise explain refusal.
    if (userConcessionKey && pendingOppKey) {
      const oppList = CONCESSIONS[opponent];
      const userList = CONCESSIONS[opponent === 'trump' ? 'putin' : 'trump']; // user is the opposite set
      const oppPending = oppList.find(c => c.key === pendingOppKey);
      const userOffer = userList.find(c => c.key === userConcessionKey);

      if (oppPending && userOffer) {
        const benefitToOpponent = userOffer.receiverGain;
        const oppCost = oppPending.makerCost;
        if (benefitToOpponent >= oppCost) {
          return res.json({ ok: true, result: { replyText: 'We accept your concession; it sufficiently offsets our proposed cost. Let us proceed.', pendingOppConcessionKey: null, accepted: true } });
        }
        return res.json({ ok: true, result: { replyText: `We cannot accept this exchange: our cost (${oppCost}) outweighs the benefit to us (${benefitToOpponent}).`, pendingOppConcessionKey: pendingOppKey, accepted: false } });
      }
    }

    if (!openaiApiKey) return res.json({ ok: true, result: mockRespond(conversation, mode, opponent, userConcessionKey) });

    const oppKeyList = CONCESSIONS[opponent].map(c => c.key).join(', ');

    const systemForOpportunity = `You play ${opponent.toUpperCase()} in a tough but pragmatic diplomatic negotiation. Generate a helpful, opportunity-creating reply aligned with principled negotiation. Offer ONE pending concession from this fixed set: [${oppKeyList}]. Return ONLY strict JSON: { replyText: string, pendingOppConcessionKey: string }. Keep reply under 120 words.`;

    const systemForUnconstructive = `You play ${opponent.toUpperCase()} in a negotiation. The user's message did NOT follow principled rules. Generate a firm, non-escalatory reply that does not propose concessions. Return ONLY strict JSON: { replyText: string }.`;

    const messages = [
      { role: 'system', content: mode === 'opportunity' ? systemForOpportunity : systemForUnconstructive },
      { role: 'user', content: `Conversation so far: ${JSON.stringify(conversation).slice(0, 8000)}` }
    ];

    const completion = await openai.chat.completions.create({ model: modelFromEnv, temperature: 0.4, max_tokens: 300, messages });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || {};
    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'respond failed' });
  }
});

app.post('/api/check-concession', async (req, res) => {
  try {
    const { lastUserMessage = '', player = 'trump' } = req.body || {};

    if (!openaiApiKey) return res.json({ ok: true, result: mockCheckConcession(lastUserMessage, player) });

    const myConcessions = CONCESSIONS[player];
    const list = myConcessions.map(c => ({ key: c.key, label: c.label }));

    const system = `Detect whether the user's message commits to one of these concessions (keys only): ${JSON.stringify(list)}. Return ONLY strict JSON: { matched: boolean, concessionKey?: string, rationale: string }.`;

    const messages = [ { role: 'system', content: system }, { role: 'user', content: lastUserMessage } ];
    const completion = await openai.chat.completions.create({ model: modelFromEnv, temperature: 0, max_tokens: 200, messages });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || { matched: false, rationale: 'Unparseable' };
    if (parsed.matched && !myConcessions.find(c => c.key === parsed.concessionKey)) { parsed.matched = false; parsed.concessionKey = undefined; }
    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'check failed' });
  }
});

app.get('/api/metadata', (req, res) => {
  res.json({ ok: true, rules: PRINCIPLED_RULES, concessions: CONCESSIONS });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server running at http://localhost:${PORT}`); });
