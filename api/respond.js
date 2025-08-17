import { createOpenAI, safeJsonParse, mockRespond, CONCESSIONS } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const { conversation = [], mode = 'opportunity', opponent = 'putin', userConcessionKey = null, pendingOppKey = null } = req.body || {};

    if (userConcessionKey && pendingOppKey) {
      const oppList = CONCESSIONS[opponent];
      const userList = CONCESSIONS[opponent === 'trump' ? 'putin' : 'trump'];
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

    const { client, model, mock } = createOpenAI();
    if (mock) return res.json({ ok: true, result: mockRespond(conversation, mode, opponent) });

    const oppKeyList = CONCESSIONS[opponent].map(c => c.key).join(', ');
    const systemForOpportunity = `You play ${opponent.toUpperCase()} in a tough but pragmatic diplomatic negotiation. Generate a helpful, opportunity-creating reply aligned with principled negotiation. Offer ONE pending concession from this fixed set: [${oppKeyList}]. Return ONLY strict JSON: { replyText: string, pendingOppConcessionKey: string }. Keep reply under 120 words.`;
    const systemForUnconstructive = `You play ${opponent.toUpperCase()} in a negotiation. The user's message did NOT follow principled rules. Generate a firm, non-escalatory reply that does not propose concessions. Return ONLY strict JSON: { replyText: string }.`;

    const messages = [
      { role: 'system', content: mode === 'opportunity' ? systemForOpportunity : systemForUnconstructive },
      { role: 'user', content: `Conversation so far: ${JSON.stringify(conversation).slice(0, 8000)}` }
    ];

    const completion = await client.chat.completions.create({ model, temperature: 0.4, max_tokens: 300, messages });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(text) || {};
    return res.json({ ok: true, result: parsed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'respond failed' });
  }
}
