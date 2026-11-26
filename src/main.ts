import { createClient } from '@supabase/supabase-js';
import { startGame, input, setSfx, type Result } from './game';
const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: any) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let token = localStorage.getItem('cf_token'), me: any = JSON.parse(localStorage.getItem('cf_me') || 'null'), game: any = null, sessionId = '';
const api = async (p: string, body?: any) => { const r = await fetch('/api/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error ' + r.status); return j; };
// Router
function route() { const h = (location.hash || '#home').slice(1); document.querySelectorAll('.pg').forEach(e => e.classList.toggle('on', e.id === h)); document.querySelectorAll('#links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + h)); $('links').classList.remove('open'); if (h === 'leaderboard' || h === 'home') loadLb(); if (h === 'profile') loadProfile(); }
addEventListener('hashchange', route); $('burger').onclick = () => $('links').classList.toggle('open');
// Leaderboard + realtime
async function loadLb() {
  const { data } = await sb.from('leaderboard').select('*'); const rows = data || [];
  $('lb').innerHTML = rows.map((r: any, i: number) => `<tr class="${me && r.player_id === me.id ? 'me' : ''}"><td>${i + 1}</td><td>@${esc(r.username)}</td><td>${r.best_score}</td><td>${r.total_coins}</td><td>${r.levels_completed}</td><td>${r.games_played}</td></tr>`).join('') || '<tr><td colspan=6>No scores yet — be first!</td></tr>';
  $('t5').innerHTML = rows.slice(0, 5).map((r: any, i: number) => `<div>${i + 1}. @${esc(r.username)} — ${r.best_score}</div>`).join('');
  if (me) { const { data: s } = await sb.from('player_stats').select('best_score').eq('player_id', me.id).maybeSingle(); if (s?.best_score) { const { count } = await sb.from('player_stats').select('*', { count: 'exact', head: true }).gt('best_score', s.best_score); $('myrank').textContent = `Your rank: #${(count ?? 0) + 1} · best ${s.best_score}`; } else $('myrank').textContent = 'Play a game to get ranked!'; } else $('myrank').textContent = 'Log in to see your rank.';
}
sb.channel('lb').on('postgres_changes', { event: '*', schema: 'public', table: 'player_stats' }, () => { if (['#leaderboard', '', '#home'].includes(location.hash)) loadLb(); }).subscribe();
// Profile + username change
async function loadProfile() {
  if (!me) return void ($('pf').innerHTML = 'Log in with Telegram to see your profile. <br><br><button class="btn s" onclick="document.getElementById(\'play\').click()">Login</button>');
  const { data: p } = await sb.from('player_stats').select('*').eq('player_id', me.id).maybeSingle();
  const next = me.username_changed_at ? new Date(new Date(me.username_changed_at).getTime() + 7 * 864e5) : null; const can = !next || next <= new Date();
  $('pf').innerHTML = `<h3>@${esc(me.username)}</h3><p>Best: ${p?.best_score ?? 0} · Coins: ${p?.total_coins ?? 0} · Levels: ${p?.levels_completed ?? 0} · Games: ${p?.games_played ?? 0}</p>
  <p>${can ? 'You can change your username now.' : 'Next username change: <b>' + next!.toLocaleString() + '</b>'}</p>
  <input type="text" id="nn" placeholder="new_username" ${can ? '' : 'disabled'}> <button class="btn s" id="nb" ${can ? '' : 'disabled'}>Change</button><p class="msg" id="nm"></p>`;
  $('nb').onclick = async () => { try { const r = await api('username', { username: ($('nn') as HTMLInputElement).value }); me.username = r.username; me.username_changed_at = new Date().toISOString(); localStorage.setItem('cf_me', JSON.stringify(me)); loadProfile(); } catch (e: any) { $('nm').textContent = e.message; } };
}
// Telegram login
(window as any).onTg = async (u: any) => { try { const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); token = j.token; me = j.player; localStorage.setItem('cf_token', token!); localStorage.setItem('cf_me', JSON.stringify(me)); $('login').style.display = 'none'; launch(); } catch (e: any) { $('lm').textContent = e.message; } };
function showLogin() { $('login').style.display = 'flex'; if ($('tgw').childElementCount) return; const s = document.createElement('script'); s.async = true; s.src = 'https://telegram.org/js/telegram-widget.js?22'; s.dataset.telegramLogin = import.meta.env.VITE_TELEGRAM_BOT; s.dataset.size = 'large'; s.dataset.onauth = 'onTg(user)'; s.dataset.requestAccess = 'write'; $('tgw').appendChild(s); }
$('lc').onclick = () => ($('login').style.display = 'none');
// Game
async function launch() {
  if (!token || !me) return showLogin();
  try { sessionId = (await api('session')).sessionId; } catch (e: any) { if (/401/.test(e.message)) { token = null; me = null; return showLogin(); } return alert(e.message); }
  $('ov').style.display = 'none'; $('gw').classList.add('on'); document.documentElement.requestFullscreen?.().catch(() => { });
  game?.destroy(true); game = startGame('game', onEnd);
}
async function onEnd(r: Result) {
  let note = 'Submitting score…'; $('ot').textContent = r.won ? '🏆 VICTORY!' : '💀 GAME OVER'; $('os').textContent = `Score ${r.score} · Coins ${r.coins} · Levels ${r.levels}\n${note}`; $('ov').style.display = 'flex';
  try { await api('score', { sessionId, ...r }); $('os').textContent = `Score ${r.score} · Coins ${r.coins} · Levels ${r.levels}\n✔ Verified & submitted`; } catch (e: any) { $('os').textContent = `Score ${r.score}\n⚠ Not recorded: ${e.message}`; }
}
function exit() { game?.destroy(true); game = null; $('gw').classList.remove('on'); document.fullscreenElement && document.exitFullscreen?.(); location.hash = '#leaderboard'; route(); }
$('play').onclick = launch; $('again').onclick = launch; $('ox').onclick = exit; $('x').onclick = exit;
// Touch controls
const isTouch = matchMedia('(pointer:coarse)').matches; const setTouch = (b: boolean) => document.body.classList.toggle('touch', b);
setTouch(isTouch || localStorage.getItem('cf_touch') === '1');
document.querySelectorAll<HTMLButtonElement>('.tc button').forEach(b => { const k = b.dataset.k as keyof typeof input; const on = (e: Event) => { e.preventDefault(); input[k] = true; }, off = (e: Event) => { e.preventDefault(); input[k] = false; };
  b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off)); b.addEventListener('contextmenu', e => e.preventDefault()); });
// Settings
($('sfx') as HTMLInputElement).checked = localStorage.getItem('cf_sfx') !== '0'; setSfx(($('sfx') as HTMLInputElement).checked);
$('sfx').onchange = e => { const v = (e.target as HTMLInputElement).checked; localStorage.setItem('cf_sfx', v ? '1' : '0'); setSfx(v); };
($('tch') as HTMLInputElement).checked = localStorage.getItem('cf_touch') === '1';
$('tch').onchange = e => { const v = (e.target as HTMLInputElement).checked; localStorage.setItem('cf_touch', v ? '1' : '0'); setTouch(v || isTouch); };
$('out').onclick = () => { localStorage.removeItem('cf_token'); localStorage.removeItem('cf_me'); token = null; me = null; route(); };
route();
