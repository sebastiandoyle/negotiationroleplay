import { createOpenAI, safeJsonParse, mockCheckConcession, CONCESSIONS } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const { lastUserMessage = '', player = 'trump' } = req.body || {};

    const { client, model, mock } = createOpenAI();
    if (mock) return res.json({ ok: true, result: mockCheckConcession(lastUserMessage, player) });

    const myConcessions = CONCESSIONS[player];
    const list = myConcessions.map(c => ({ key: c.key, label: c.label }));

    const system = `Detect whether the user's message commits to one of these concessions (keys only): ${JSON.stringify(list)}. Return ONLY strict JSON: { matched: boolean, concessionKey?: string, rationale: string }.`;
    const messages = [ { role: 'system', content: system }, { role: 'user', content: lastUserMessage } ];

    const completion = await client.chat.completions.create({ model, temperature: 0, max_tokens: 200, messages });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || { matched: false, rationale: 'Unparseable' };

    if (parsed.matched && !myConcessions.find(c => c.key === parsed.concessionKey)) { parsed.matched = false; parsed.concessionKey = undefined; }
    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'check failed' });
  }
}
