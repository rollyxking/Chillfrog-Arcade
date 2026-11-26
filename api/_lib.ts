import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (d: string) => createHmac('sha256', process.env.APP_JWT_SECRET!).update(d).digest('base64url');
export const makeToken = (pid: string) => { const p = b64(JSON.stringify({ pid, exp: Date.now() + 7 * 864e5 })); return `${p}.${sign(p)}`; };
export function playerFrom(req: any): string | null {
  const t = (req.headers.authorization || '').replace('Bearer ', ''); const [p, s] = t.split('.');
  if (!p || !s) return null;
  const a = Buffer.from(sign(p)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const j = JSON.parse(Buffer.from(p, 'base64url').toString()); return j.exp > Date.now() ? j.pid : null;
}
