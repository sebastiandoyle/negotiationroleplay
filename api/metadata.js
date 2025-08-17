import { PRINCIPLED_RULES, CONCESSIONS } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  return res.json({ ok: true, rules: PRINCIPLED_RULES, concessions: CONCESSIONS });
}
