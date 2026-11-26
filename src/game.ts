import Phaser from 'phaser';
export type Result = { score: number; coins: number; levels: number; kills: number; bosses: number; won: boolean };
export const input = { left: false, right: false, jump: false, down: false };
const T = 48, W = 960, H = 540;
const THEMES = [
  { n: 'Swamp Jungle', sky: 0x1b8f5a, g: 0x2e7d32, t: 0x6d4c41 }, { n: 'Neon Beach', sky: 0xff9a3c, g: 0xf2d27a, t: 0xc79a4a },
  { n: 'Crystal Cave', sky: 0x2a1b5c, g: 0x5b4b8a, t: 0x3a2d66 }, { n: 'Sunset Ruins', sky: 0xe8534a, g: 0xb5651d, t: 0x7a3e12 },
  { n: 'Volcano Rift', sky: 0x4a0e0e, g: 0x444444, t: 0xd84315 }];
const rng = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let sfxOn = true; export const setSfx = (b: boolean) => (sfxOn = b);
let ac: AudioContext | null = null;
function beep(f: number, d = 0.08) { if (!sfxOn) return; try { ac ??= new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = 'square'; g.gain.value = 0.04; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch { } }

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    const mk = (k: string, w: number, h: number, f: (g: Phaser.GameObjects.Graphics) => void) => { const g = this.add.graphics(); f(g); g.generateTexture(k, w, h); g.destroy(); };
    mk('frog', 36, 48, g => { // green frog, dreads, shades, reggae shirt
      g.fillStyle(0x5a3a22); for (let i = 0; i < 6; i++) g.fillRect(2 + i * 6, 4, 4, 22);
      g.fillStyle(0x7ed321); g.fillRoundedRect(6, 6, 24, 20, 8);
      g.fillStyle(0x111111); g.fillRoundedRect(8, 12, 9, 6, 2); g.fillRoundedRect(19, 12, 9, 6, 2); g.fillRect(16, 14, 4, 2);
      g.fillStyle(0xff5a5a); g.fillRect(14, 21, 8, 2);
      g.fillStyle(0x2ecc40); g.fillRect(6, 26, 24, 7); g.fillStyle(0xffd400); g.fillRect(6, 33, 24, 6); g.fillStyle(0xe53935); g.fillRect(6, 39, 24, 5);
      g.fillStyle(0x7ed321); g.fillRect(8, 44, 8, 4); g.fillRect(20, 44, 8, 4); });
    mk('coin', 20, 20, g => { g.fillStyle(0xffd400); g.fillCircle(10, 10, 9); g.fillStyle(0xffa000); g.fillCircle(10, 10, 5); });
    mk('enemy', 36, 30, g => { g.fillStyle(0x8e24aa); g.fillRoundedRect(0, 4, 36, 26, 10); g.fillStyle(0xffffff); g.fillCircle(11, 14, 5); g.fillCircle(25, 14, 5); g.fillStyle(0); g.fillCircle(12, 15, 2); g.fillCircle(26, 15, 2); });
    mk('boss', 110, 90, g => { g.fillStyle(0xd32f2f); g.fillRoundedRect(0, 10, 110, 80, 26); g.fillStyle(0xffd400); g.fillTriangle(10, 14, 25, -0, 40, 14); g.fillTriangle(70, 14, 85, 0, 100, 14); g.fillStyle(0xffffff); g.fillCircle(32, 40, 13); g.fillCircle(78, 40, 13); g.fillStyle(0); g.fillCircle(34, 42, 6); g.fillCircle(80, 42, 6); g.fillRect(30, 66, 50, 6); });
    mk('spike', T, 24, g => { g.fillStyle(0xeeeeee); for (let i = 0; i < 4; i++) g.fillTriangle(i * 12, 24, i * 12 + 6, 0, i * 12 + 12, 24); });
    mk('flag', 12, 96, g => { g.fillStyle(0xdddddd); g.fillRect(0, 0, 4, 96); g.fillStyle(0x39ff14); g.fillTriangle(4, 2, 12, 12, 4, 22); });
    mk('goal', 20, 140, g => { g.fillStyle(0xffffff); g.fillRect(0, 0, 4, 140); g.fillStyle(0xffd400); g.fillRect(4, 4, 16, 30); g.fillStyle(0xe53935); g.fillRect(4, 14, 16, 8); });
    mk('pipe', 60, 72, g => { g.fillStyle(0x1b5e20); g.fillRect(4, 16, 52, 56); g.fillStyle(0x2e7d32); g.fillRect(0, 0, 60, 18); });
    mk('plat', T * 2, 16, g => { g.fillStyle(0xb0793f); g.fillRoundedRect(0, 0, T * 2, 16, 5); g.fillStyle(0x39ff14); g.fillRect(0, 0, T * 2, 4); });
    this.scene.start('play', { level: 0 });
  }
}

class Play extends Phaser.Scene {
  constructor() { super('play'); }
  st: any; lvl = 0; p!: Phaser.Physics.Arcade.Sprite; ground!: Phaser.Physics.Arcade.StaticGroup; hud!: Phaser.GameObjects.Text;
  enemies!: Phaser.Physics.Arcade.Group; movers!: Phaser.Physics.Arcade.Group; coins!: Phaser.Physics.Arcade.StaticGroup; spikes!: Phaser.Physics.Arcade.StaticGroup;
  boss: any = null; bossHp = 0; goal: any = null; cp = { x: 100, y: 300 }; inv = 0; bonus = false; ret = { x: 0, y: 0 }; worldW = 0; lastGround = 0; buf = 0; done = false; arenaX = 0;
  keys!: any; pipeZone!: Phaser.GameObjects.Zone; exitZone!: Phaser.GameObjects.Zone;
  init(d: any) { this.lvl = d.level ?? 0; this.st = d.st ?? { score: 0, coins: 0, lives: 3, levels: 0, kills: 0, bosses: 0 }; this.done = false; this.bonus = false; this.boss = null; this.goal = null; }
  create() {
    const th = THEMES[this.lvl], R = rng(1337 + this.lvl * 97);
    this.cameras.main.setBackgroundColor(th.sky);
    const mkTile = (k: string) => { if (this.textures.exists(k)) return; const g = this.add.graphics(); g.fillStyle(th.t); g.fillRect(0, 0, T, T); g.fillStyle(th.g); g.fillRect(0, 0, T, 10); g.lineStyle(1, 0, 0.25); g.strokeRect(0, 0, T, T); g.generateTexture(k, T, T); g.destroy(); };
    const tk = 'tile' + this.lvl; mkTile(tk);
    for (let i = 0; i < 14; i++) this.add.circle(R() * 6000, 40 + R() * 200, 30 + R() * 40, 0xffffff, 0.12).setScrollFactor(0.3); // parallax
    this.worldW = 5000 + this.lvl * 1000;
    this.ground = this.physics.add.staticGroup(); this.enemies = this.physics.add.group(); this.movers = this.physics.add.group({ allowGravity: false, immovable: true });
    this.coins = this.physics.add.staticGroup(); this.spikes = this.physics.add.staticGroup();
    const tile = (cx: number, row: number, kk = tk) => this.ground.create(cx * T + T / 2, row * T + T / 2, kk);
    const coin = (x: number, y: number) => this.coins.create(x, y, 'coin');
    const gapT = 2 + Math.min(1, Math.floor(this.lvl / 2)); let col = 0, seg = 0, nextCp = 1800, pipeDone = false;
    const endCol = Math.floor(this.worldW / T) - 16;
    while (col < endCol) {
      const len = 5 + Math.floor(R() * 5); if (seg === 0) { } // safe start
      for (let c = 0; c < len; c++) { tile(col + c, 9); tile(col + c, 10); }
      const x0 = col * T, x1 = (col + len) * T;
      for (let c = 1; c < len - 1; c++) if (R() < 0.6) coin(x0 + c * T + 24, 9 * T - 30);
      if (seg > 0 && R() < 0.3 + 0.08 * this.lvl) { const e = this.enemies.create(x0 + len * T / 2, 9 * T - 20, 'enemy') as any; e.setVelocityX(-60 - this.lvl * 12); e.minX = x0 + 10; e.maxX = x1 - 10; }
      else if (seg > 1 && R() < 0.2 + 0.05 * this.lvl) this.spikes.create(x0 + len * T / 2, 9 * T - 12, 'spike');
      if (R() < 0.5) { const py = (6 + Math.floor(R() * 2)) * T; for (let c = 1; c < 3; c++) tile(col + 1 + c, py / T); for (let c = 0; c < 3; c++) coin(x0 + (2 + c) * T + 24, py - 28); }
      if (!pipeDone && seg === 3) { pipeDone = true; this.add.image(x0 + 3 * T, 9 * T - 36, 'pipe').setAlpha(0.85).setDepth(-1); this.pipeZone = this.add.zone(x0 + 3 * T, 9 * T - 30, 60, 60); this.physics.add.existing(this.pipeZone, true); }
      if (x0 > nextCp) { const f = this.add.image(x0 + 20, 9 * T - 48, 'flag'); (f as any).cpx = x0 + 20; this.physics.add.existing(f, true); (this as any).flags = [...((this as any).flags || []), f]; nextCp += 1800; }
      col += len;
      if (R() < 0.5 && seg > 0) { const m = this.movers.create(col * T + gapT * T / 2, 8 * T, 'plat') as any; m.setImmovable(true); m.body.allowGravity = false; m.setVelocityX(70 + this.lvl * 10); m.minX = col * T + 30; m.maxX = (col + gapT) * T - 30 + T; }
      col += gapT; seg++;
    }
    for (let c = 0; c < 16; c++) { tile(col + c, 9); tile(col + c, 10); } // boss arena
    this.arenaX = col * T;
    this.boss = this.physics.add.sprite(this.arenaX + 11 * T, 9 * T - 50, 'boss'); this.bossHp = 3 + this.lvl; this.boss.setCollideWorldBounds(false); this.boss.dir = -1; this.boss.invT = 0;
    this.add.text(this.arenaX + 4 * T, 70, 'BOSS ARENA', { fontSize: '28px', color: '#fff' }).setAlpha(0.5);
    // Hidden bonus room
    const by = 1100; for (let c = 0; c < 22; c++) { tile(c, by / T | 0); this.add.rectangle(c * T + 24, by + 24, T, T, 0x000000, 0.2); }
    for (let c = 0; c < 16; c++) coin(150 + c * 40, by - 40 - (c % 2) * 40);
    this.exitZone = this.add.zone(21 * T, by - 40, 60, 100); this.physics.add.existing(this.exitZone, true);
    // Player
    this.p = this.physics.add.sprite(this.cp.x, this.cp.y, 'frog'); this.p.setSize(26, 44).setGravityY(0); this.physics.world.gravity.y = 1300; this.p.setDepth(5);
    this.cp = { x: 100, y: 300 }; this.p.setPosition(100, 300);
    this.physics.world.setBounds(0, 0, this.worldW + 1000, 2000);
    this.physics.add.collider(this.p, this.ground); this.physics.add.collider(this.enemies, this.ground); this.physics.add.collider(this.boss, this.ground);
    this.physics.add.collider(this.p, this.movers);
    this.physics.add.overlap(this.p, this.coins, (_p, c: any) => { c.destroy(); this.st.coins++; this.st.score += 10; beep(880); });
    this.physics.add.overlap(this.p, this.spikes, () => this.hurt());
    this.physics.add.overlap(this.p, this.enemies, (_p, e: any) => { if (this.p.body!.velocity.y > 50 && this.p.y < e.y - 10) { e.destroy(); this.p.setVelocityY(-380); this.st.kills++; this.st.score += 100; beep(300); } else this.hurt(); });
    this.physics.add.overlap(this.p, this.boss, () => { const b = this.boss; if (!b.active) return; if (this.p.body!.velocity.y > 50 && this.p.y < b.y - 20) { if (b.invT <= 0) { this.bossHp--; b.invT = 1000; this.p.setVelocityY(-480); beep(200, .15); if (this.bossHp <= 0) { b.destroy(); this.st.bosses++; this.st.score += 500; this.goal = this.physics.add.staticImage(this.arenaX + 14 * T, 9 * T - 70, 'goal'); this.physics.add.overlap(this.p, this.goal, () => this.finishLevel()); } } } else this.hurt(); });
    if (this.pipeZone) this.physics.add.overlap(this.p, this.pipeZone, () => { if ((input.down || this.keys.down.isDown) && !this.bonus) { this.bonus = true; this.ret = { x: this.p.x + 80, y: this.p.y }; this.p.setPosition(100, by - 100); this.cameras.main.setBounds(0, 1000, 1200, H); beep(500, .2); } });
    this.physics.add.overlap(this.p, this.exitZone, () => { if (this.bonus) { this.leaveBonus(); } });
    ((this as any).flags || []).forEach((f: any) => this.physics.add.overlap(this.p, f, () => { if (this.cp.x < f.cpx) { this.cp = { x: f.cpx, y: 300 }; beep(660, .15); } }));
    this.cameras.main.setBounds(0, 0, this.worldW + 1000, H); this.cameras.main.startFollow(this.p, true, 0.12, 0.12);
    this.keys = this.input.keyboard!.addKeys({ left: 'LEFT,A', right: 'RIGHT,D', up: 'UP,W,SPACE', down: 'DOWN,S' } as any);
    this.hud = this.add.text(12, 10, '', { fontSize: '20px', color: '#39ff14', fontFamily: 'monospace', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(20);
    const t = this.add.text(W / 2, 90, `LEVEL ${this.lvl + 1}: ${th.n}`, { fontSize: '36px', color: '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 600 });
  }
  leaveBonus() { this.bonus = false; this.p.setPosition(this.ret.x, this.ret.y - 60); this.cameras.main.setBounds(0, 0, this.worldW + 1000, H); }
  hurt() {
    if (this.time.now < this.inv || this.done) return; this.st.lives--; beep(120, .3); this.inv = this.time.now + 1500;
    if (this.st.lives <= 0) return this.end(false);
    if (this.bonus) this.leaveBonus();
    this.p.setPosition(this.cp.x, this.cp.y).setVelocity(0, 0); this.tweens.add({ targets: this.p, alpha: 0.3, yoyo: true, repeat: 5, duration: 120, onComplete: () => this.p.setAlpha(1) });
  }
  finishLevel() {
    if (this.done) return; this.done = true; this.st.levels++; this.st.score += 1000; beep(1000, .3);
    if (this.lvl >= 4) return this.end(true);
    this.scene.restart({ level: this.lvl + 1, st: this.st });
  }
  end(won: boolean) { this.done = true; (this.game as any).onEnd?.({ score: this.st.score, coins: this.st.coins, levels: this.st.levels, kills: this.st.kills, bosses: this.st.bosses, won }); this.scene.pause(); }
  update(time: number, dt: number) {
    if (this.done) return; const b = this.p.body as Phaser.Physics.Arcade.Body, k = this.keys;
    const L = input.left || k.left.isDown, Rt = input.right || k.right.isDown, J = input.jump || k.up.isDown;
    this.p.setVelocityX(L ? -250 : Rt ? 250 : 0); if (L) this.p.setFlipX(true); else if (Rt) this.p.setFlipX(false);
    if (b.blocked.down || b.touching.down) this.lastGround = time;
    if (J && !this.buf) this.buf = time; if (!J) { if (this.buf && b.velocity.y < -150) this.p.setVelocityY(b.velocity.y * 0.5); this.buf = 0; }
    if (this.buf && time - this.lastGround < 110 && time - this.buf < 140) { this.p.setVelocityY(-560); this.lastGround = -999; this.buf = 0; beep(520, .06); }
    this.enemies.children.each((e: any) => { if (e.x < e.minX) e.setVelocityX(Math.abs(e.body.velocity.x)); else if (e.x > e.maxX) e.setVelocityX(-Math.abs(e.body.velocity.x)); return true; });
    this.movers.children.each((m: any) => { if (m.x < m.minX) m.setVelocityX(Math.abs(m.body.velocity.x)); else if (m.x > m.maxX) m.setVelocityX(-Math.abs(m.body.velocity.x)); return true; });
    const bs = this.boss; if (bs?.active) { bs.invT -= dt; bs.setAlpha(bs.invT > 0 ? 0.5 : 1); if (Math.abs(this.p.x - bs.x) < 500) { bs.setVelocityX(Math.sign(this.p.x - bs.x) * (90 + this.lvl * 18)); if (bs.body.blocked.down && Math.random() < 0.012) bs.setVelocityY(-620); } else bs.setVelocityX(0); }
    if (!this.bonus && this.p.y > H + 80) this.hurt(); if (this.bonus && this.p.y > 1500) this.leaveBonus();
    this.hud.setText(`SCORE ${this.st.score}  COINS ${this.st.coins}  LIVES ${'♥'.repeat(Math.max(0, this.st.lives))}  LV ${this.lvl + 1}/5`);
  }
}
export function startGame(parent: string, onEnd: (r: Result) => void) {
  const g = new Phaser.Game({ type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#000', fps: { target: 60 }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1300 }, debug: false } }, scene: [Boot, Play], input: { activePointers: 3 } });
  (g as any).onEnd = onEnd; return g;
}
