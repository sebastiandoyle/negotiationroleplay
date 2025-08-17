import { PRINCIPLED_RULES, createOpenAI, safeJsonParse, mockJudge } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const { conversation = [], lastUserMessage = '' } = req.body || {};

    if (/(\bconcede\b|\bconcession\b|\bi am willing\b|\bwe are willing\b|\bi will\b|\bwe will\b)/i.test(lastUserMessage)) {
      return res.json({ ok: true, result: { outcome: 'no_unfollowed', reason: 'Concession proposal detected; rule check skipped.' } });
    }

    const { client, model, mock } = createOpenAI();
    if (mock) return res.json({ ok: true, result: mockJudge(lastUserMessage) });

    const instructions = `You are a principled negotiation judge. If the message explicitly declares a concession, do not mark a breach: return outcome \"no_unfollowed\" with a short note. Otherwise, evaluate strictly. Respond ONLY JSON: { outcome: \"yes\"|\"no_breached\"|\"no_unfollowed\", ruleFollowed?: string, ruleBreached?: string, reason: string }. Valid rules: ${PRINCIPLED_RULES.map(r => r.key).join(', ')}`;

    const messages = [
      { role: 'system', content: instructions },
      { role: 'user', content: `Conversation so far: ${JSON.stringify(conversation).slice(0, 8000)}\nLast user message: ${lastUserMessage}` }
    ];

    const completion = await client.chat.completions.create({ model, temperature: 0.1, max_tokens: 300, messages });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || { outcome: 'no_unfollowed', reason: 'Unparseable response' };
    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'judge failed' });
  }
}
