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
  console.error('Missing OPENAI_API_KEY. Set it in your environment or .env file.');
}

const openai = new OpenAI({ apiKey: openaiApiKey || '' });

const PRINCIPLED_RULES = [
  {
    key: 'separate_people_from_problem',
    title: 'Separate people from the problem',
    description: 'Addresses the issue without attacking character; acknowledges emotions and relationships while focusing on the substantive problem.'
  },
  {
    key: 'focus_on_interests',
    title: 'Focus on interests, not positions',
    description: 'Explores underlying motivations and needs, not fixed demands.'
  },
  {
    key: 'invent_options_for_mutual_gain',
    title: 'Invent options for mutual gain',
    description: 'Proposes creative, multiple options that expand the pie for both sides.'
  },
  {
    key: 'use_objective_criteria',
    title: 'Insist on objective criteria',
    description: 'Suggests standards, benchmarks, or independent norms to resolve differences.'
  },
  {
    key: 'consider_batna',
    title: 'Know and improve BATNA',
    description: 'References alternatives and strengthens no-deal options without making threats.'
  }
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

function clampNumber(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

app.post('/api/judge', async (req, res) => {
  try {
    if (!openaiApiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { conversation = [], lastUserMessage = '' } = req.body || {};

    const instructions = `You are a principled negotiation judge. Decide if the user's most recent message follows one of the five rules of principled negotiation. Respond ONLY in strict JSON with fields: { outcome: "yes" | "no_breached" | "no_unfollowed", ruleFollowed?: string, ruleBreached?: string, reason: string }.
Valid rules: ${PRINCIPLED_RULES.map(r => r.key).join(', ')}.`;

    const messages = [
      { role: 'system', content: instructions },
      { role: 'user', content: `Conversation so far: ${JSON.stringify(conversation).slice(0, 8000)}\nLast user message: ${lastUserMessage}` }
    ];

    const completion = await openai.chat.completions.create({
      model: modelFromEnv,
      temperature: 0.1,
      max_tokens: 300,
      messages
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || { outcome: 'no_unfollowed', reason: 'Unparseable response' };

    return res.json({
      ok: true,
      result: parsed
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'judge failed' });
  }
});

app.post('/api/respond', async (req, res) => {
  try {
    if (!openaiApiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { conversation = [], mode = 'opportunity', opponent = 'putin' } = req.body || {};

    const oppKeyList = CONCESSIONS[opponent].map(c => c.key).join(', ');

    const systemForOpportunity = `You play ${opponent.toUpperCase()} in a tough but pragmatic diplomatic negotiation. Generate a helpful, opportunity-creating reply aligned with principled negotiation. Offer ONE pending concession from this fixed set: [${oppKeyList}]. Return ONLY strict JSON: { replyText: string, pendingOppConcessionKey: string }. Keep reply under 120 words.`;

    const systemForUnconstructive = `You play ${opponent.toUpperCase()} in a negotiation. The user's message did NOT follow principled rules. Generate a firm, non-escalatory reply that does not propose concessions. Return ONLY strict JSON: { replyText: string }.`;

    const messages = [
      { role: 'system', content: mode === 'opportunity' ? systemForOpportunity : systemForUnconstructive },
      { role: 'user', content: `Conversation so far: ${JSON.stringify(conversation).slice(0, 8000)}` }
    ];

    const completion = await openai.chat.completions.create({
      model: modelFromEnv,
      temperature: 0.4,
      max_tokens: 300,
      messages
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || {};

    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'respond failed' });
  }
});

app.post('/api/check-concession', async (req, res) => {
  try {
    if (!openaiApiKey) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });
    const { lastUserMessage = '', player = 'trump' } = req.body || {};

    const myConcessions = CONCESSIONS[player];
    const list = myConcessions.map(c => ({ key: c.key, label: c.label }));

    const system = `Detect whether the user's message commits to one of these concessions (keys only): ${JSON.stringify(list)}. Return ONLY strict JSON: { matched: boolean, concessionKey?: string, rationale: string }.`;

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: lastUserMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: modelFromEnv,
      temperature: 0,
      max_tokens: 200,
      messages
    });

    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || { matched: false, rationale: 'Unparseable' };

    if (parsed.matched && !myConcessions.find(c => c.key === parsed.concessionKey)) {
      parsed.matched = false;
      parsed.concessionKey = undefined;
    }

    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'check failed' });
  }
});

app.get('/api/metadata', (req, res) => {
  res.json({
    ok: true,
    rules: PRINCIPLED_RULES,
    concessions: CONCESSIONS
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
