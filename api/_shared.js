import OpenAI from 'openai';

export const PRINCIPLED_RULES = [
  { key: 'separate_people_from_problem', title: 'Separate people from the problem', description: 'Addresses the issue without attacking character; acknowledges emotions and relationships while focusing on the substantive problem.' },
  { key: 'focus_on_interests', title: 'Focus on interests, not positions', description: 'Explores underlying motivations and needs, not fixed demands.' },
  { key: 'invent_options_for_mutual_gain', title: 'Invent options for mutual gain', description: 'Proposes creative, multiple options that expand the pie for both sides.' },
  { key: 'use_objective_criteria', title: 'Insist on objective criteria', description: 'Suggests standards, benchmarks, or independent norms to resolve differences.' },
  { key: 'consider_batna', title: 'Know and improve BATNA', description: 'References alternatives and strengthens no-deal options without making threats.' }
];

export const CONCESSIONS = {
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

export function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {} }
  return null;
}

export function createOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const mock = !process.env.OPENAI_API_KEY;
  return { client: new OpenAI({ apiKey }), model, mock };
}

// Mock behaviors
export function mockJudge(msg = '') {
  const t = (msg || '').toLowerCase();
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

export function mockRespond(conversation = [], mode = 'opportunity', opponent = 'putin') {
  if (mode === 'unconstructive') return { replyText: 'Let us keep this professional and focus on concrete issues and facts.' };
  const list = CONCESSIONS[opponent];
  const pending = list[0]?.key || null;
  return { replyText: 'Acknowledged. We can tentatively advance if reciprocity is meaningful.', pendingOppConcessionKey: pending };
}

export function mockCheckConcession(lastUserMessage = '', player = 'trump') {
  const text = (lastUserMessage || '').toLowerCase();
  const options = CONCESSIONS[player];
  for (const c of options) {
    const keyHit = text.includes(c.key.replace(/_/g, ' '));
    const labelHit = text.includes(c.label.split(' ')[0].toLowerCase());
    if (keyHit || labelHit) return { matched: true, concessionKey: c.key, rationale: 'Detected a concession declaration.' };
  }
  return { matched: false, rationale: 'No concession keywords detected.' };
}
