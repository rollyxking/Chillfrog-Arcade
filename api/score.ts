import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, playerFrom } from './_lib';
const clamp = (n: any, max: number) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));
export default async function h(req: VercelRequest, res: VercelResponse) {
  const pid = playerFrom(req); if (!pid) return res.status(401).end();
  const { sessionId, score, coins, levels, kills, bosses } = req.body || {};
  const { data: s } = await db.from('game_sessions').select('started_at,used').eq('id', sessionId).eq('player_id', pid).maybeSingle();
  if (!s || s.used) return res.status(400).json({ error: 'invalid_session' });
  const dur = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000);
  const L = clamp(levels, 5), C = clamp(coins, 600), K = clamp(kills, 200), B = clamp(bosses, 5), S = clamp(score, 100000);
  // Plausibility: score bounded by what the reported events can award; minimum real time per level; coin cap per level.
  const maxScore = C * 10 + K * 100 + B * 500 + L * 3000;
  const playedLevels = Math.min(5, L + 1);
  if (S > maxScore || dur < L * 25 || C > playedLevels * 120 || dur > 6 * 3600 || (dur > 0 && S / dur > 150))
    return res.status(422).json({ error: 'rejected' });
  const { error } = await db.rpc('submit_score', { p_player: pid, p_session: sessionId, p_score: S, p_coins: C, p_levels: L, p_dur: dur });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
}
