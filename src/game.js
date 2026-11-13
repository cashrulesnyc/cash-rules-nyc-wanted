// ============================================================
//  CASH RULES NYC: WANTED — game loop, rules, UI, audio
// ============================================================
const $ = (id) => document.getElementById(id);
const CAM_AZ = -16 * Math.PI / 180;
// Steeper than the original 60deg: closer to the classic top-down city chase look, so towers
// lean away from the car instead of across it. Buildings always keep full height; when one covers the car, the car shows as a silhouette.
const CAM_PITCH = 66 * Math.PI / 180;
const STAR_HEAT = [1, 16, 40, 80, 140];
const COPS_FOR = [0, 2, 3, 5, 6, 8];
const fmt$ = (n) => '$' + Math.floor(n).toLocaleString('en-US');

// ---------- save ----------
const SAVE_KEY = 'crnyc_wanted_v1';
let SAVE = { bank: 250, owned: ['sedan'], car: 'sedan', color: null, up: { engine: 0, armor: 0 }, best: 0, night: false, sound: true, shadows: true, blur: true, boro: 'MANHATTAN' };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) SAVE = Object.assign(SAVE, s); } catch (e) { }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
SAVE.stats = Object.assign({ cops: 0, cash: 0, airs: 0, nitros: 0, gears: 0, dist: 0, runs: 0 }, SAVE.stats || {});
SAVE.mis = SAVE.mis || {}; SAVE.gift = SAVE.gift || { day: 0, hour: 0 }; SAVE.maxStars = SAVE.maxStars || 0;
window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---------- side missions + gifts ----------
// Each track is a ladder of tiers: hit the target, claim the cash, the next tier unlocks.
const MISSIONS = [
  { k: 'cops', name: 'WRECK COPS', t: [3, 10, 25, 60, 150, 400], r: [400, 1000, 2500, 5000, 10000, 20000] },
  { k: 'cash', name: 'COLLECT CASH', t: [2000, 10000, 40000, 120000, 400000, 1000000], r: [300, 1200, 4000, 10000, 25000, 60000], money: true },
  { k: 'gears', name: 'GRAB REPAIR GEARS', t: [2, 8, 20, 50, 120, 300], r: [300, 900, 2000, 5000, 10000, 20000] },
  { k: 'dist', name: 'DRIVE (KM)', t: [5, 25, 80, 200, 500, 1200], r: [300, 1000, 3000, 7000, 15000, 30000] },
  { k: 'stars', name: 'HIT MAX HEAT', t: [2, 3, 4, 5], r: [500, 1000, 2500, 5000], fmt: (n) => n + '★', val: () => SAVE.maxStars },
  { k: 'survive', name: 'SURVIVE ONE RUN', t: [60, 120, 180, 300, 450, 600], r: [400, 900, 2000, 4000, 8000, 15000], fmt: (n) => mmss(n), val: () => SAVE.best || 0 },
];
const GIFTS = [{ k: 'day', name: 'DAILY GIFT', every: 20 * 3600e3, amt: 1500 }, { k: 'hour', name: 'HOURLY GIFT', every: 3600e3, amt: 150 }];
function misVal(m) { return m.val ? m.val() : SAVE.stats[m.k] || 0; }
function misState(m) { const tier = SAVE.mis[m.k] || 0, done = tier >= m.t.length; return { tier, done, target: done ? m.t[m.t.length - 1] : m.t[tier], reward: done ? 0 : m.r[tier], ready: !done && misVal(m) >= m.t[tier] }; }
function giftLeft(g) { return Math.max(0, (SAVE.gift[g.k] || 0) + g.every - Date.now()); }
function claimable() { let n = 0; for (const m of MISSIONS) if (misState(m).ready) n++; for (const g of GIFTS) if (giftLeft(g) <= 0) n++; return n; }
const MIS_SEEN = new Set();
function stat(k, n) {
  SAVE.stats[k] = (SAVE.stats[k] || 0) + n;
  misCheck();
}
function misCheck() {
  for (const m of MISSIONS) { const st = misState(m), key = m.k + st.tier; if (st.ready && !MIS_SEEN.has(key)) { MIS_SEEN.add(key); if (G.state === 'play') toast('MISSION COMPLETE · ' + m.name + ' · CLAIM ' + fmt$(st.reward)); save(); } }
}
function fmtMis(m, n) { return m.fmt ? m.fmt(n) : m.money ? fmt$(n) : (m.k === 'dist' ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toLocaleString('en-US')); }
function hms(ms) { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
function renderMissions() {
  $('misBank').textContent = fmt$(SAVE.bank);
  let h = '';
  for (const g of GIFTS) {
    const left = giftLeft(g);
    h += `<div class="mrow gift"><div class="mt"><b>${g.name}</b><div class="mbar"><i style="width:${Math.round((1 - left / g.every) * 100)}%"></i></div><span>${left > 0 ? 'READY IN ' + hms(left) : 'READY!'}</span></div>` +
      `<button class="btn mclaim" data-g="${g.k}" ${left > 0 ? 'disabled' : ''}>${fmt$(g.amt)}</button></div>`;
  }
  for (const m of MISSIONS) {
    const st = misState(m), v = misVal(m), k = st.done ? 1 : Math.min(1, v / st.target);
    h += `<div class="mrow${st.ready ? ' ready' : ''}"><div class="mt"><b>${m.name}</b><small>${st.done ? 'ALL TIERS DONE' : 'TIER ' + (st.tier + 1) + '/' + m.t.length}</small><div class="mbar"><i style="width:${Math.round(k * 100)}%"></i></div>` +
      `<span>${fmtMis(m, Math.min(v, st.target))} / ${fmtMis(m, st.target)}</span></div>` +
      `<button class="btn mclaim" data-m="${m.k}" ${st.ready ? '' : 'disabled'}>${st.done ? '✓' : (st.ready ? 'CLAIM ' : '') + fmt$(st.reward)}</button></div>`;
  }
  $('misList').innerHTML = h;
  $('misList').querySelectorAll('button[data-m]').forEach(b => b.onclick = () => {
    const m = MISSIONS.find(q => q.k === b.dataset.m), st = misState(m); if (!st.ready) return;
    SAVE.bank += st.reward; SAVE.mis[m.k] = st.tier + 1; save(); AUD.init(); AUD.cash(); flash('#1fd65f'); renderMissions(); renderTitle();
  });
  $('misList').querySelectorAll('button[data-g]').forEach(b => b.onclick = () => {
    const g = GIFTS.find(q => q.k === b.dataset.g); if (giftLeft(g) > 0) return;
    SAVE.bank += g.amt; SAVE.gift[g.k] = Date.now(); save(); AUD.init(); AUD.cash(); flash('#e8b923'); renderMissions(); renderTitle();
  });
}
let MIS_TIMER = 0;
function openMissions(on) {
  $('missions').classList.toggle('on', on); clearInterval(MIS_TIMER);
  if (on) { renderMissions(); MIS_TIMER = setInterval(renderMissions, 1000); } else renderTitle();
}

// ---------- game state ----------
const G = {
  state: 'boot', t: 0, P: null, cops: [], civs: [], wrecks: [], pickups: [], powerups: [], gears: [], powT: 0, spdT: 0, heat: 0, stars: 0, maxStars: 0, runCash: 0, runTime: 0, wrecked: 0,
  bust: 0, grace: 0, spawnT: 0, civT: 0, pickT: 0, gearT: 0, heli: null, shake: 0, hoodT: 0, hood: '', toastT: 0,
  cam: { x: 0, z: 0, tx: 0, tz: 0, dist: 48, orbit: 0 }, input: { l: false, r: false, b: false, keys: {} }, fountains: [], lastCrash: 0, msgT: 0,
};
const DYN = { data: new Float32Array(INST * 4096), n: 0 };
function dpush(x, y, z, sx, sy, sz, q, col, m) {
  if ((DYN.n + 1) * INST > DYN.data.length) { const nd = new Float32Array(DYN.data.length * 2); nd.set(DYN.data); DYN.data = nd; }
  const o = DYN.n * INST, d = DYN.data;
  d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = sx; d[o + 4] = sy; d[o + 5] = sz; d[o + 6] = q[0]; d[o + 7] = q[1]; d[o + 8] = q[2]; d[o + 9] = q[3];
  d[o + 10] = col[0]; d[o + 11] = col[1]; d[o + 12] = col[2]; d[o + 13] = m || 0; DYN.n++;
}

// ---------- audio ----------
const AUD = {
  ctx: null, on: SAVE.sound,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const A = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = A.createGain(); this.master.gain.value = this.on ? 0.9 : 0; this.master.connect(A.destination);
      this.eng = A.createOscillator(); this.eng.type = 'sawtooth'; this.engF = A.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 500;
      this.engG = A.createGain(); this.engG.gain.value = 0; this.eng.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); this.eng.start();
      this.eng2 = A.createOscillator(); this.eng2.type = 'square'; this.eng2G = A.createGain(); this.eng2G.gain.value = 0; this.eng2.connect(this.engF); this.eng2.connect(this.eng2G); this.eng2G.connect(this.engF); this.eng2.start();
      this.sir = A.createOscillator(); this.sir.type = 'square'; this.sirG = A.createGain(); this.sirG.gain.value = 0; const sf = A.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
      this.sir.connect(sf); sf.connect(this.sirG); this.sirG.connect(this.master); this.sir.start();
      const len = A.sampleRate * 0.6, nb = A.createBuffer(1, len, A.sampleRate), ch = nb.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; this.noise = nb;
    } catch (e) { this.ctx = null; }
  },
  setOn(o) { this.on = o; if (this.master) this.master.gain.value = o ? 0.9 : 0; },
  update(speed, siren, t, running) {
    if (!this.ctx) return; const A = this.ctx, now = A.currentTime;
    this.eng.frequency.setTargetAtTime(38 + speed * 4.2, now, 0.05); this.eng2.frequency.setTargetAtTime(19 + speed * 2.1, now, 0.05);
    this.engF.frequency.setTargetAtTime(300 + speed * 40, now, 0.05);
    this.engG.gain.setTargetAtTime(running ? 0.05 + speed * 0.002 : 0, now, 0.1);
    this.sir.frequency.setTargetAtTime(760 + 420 * Math.abs(Math.sin(t * 5.5)), now, 0.01);
    this.sirG.gain.setTargetAtTime(running ? siren * 0.035 : 0, now, 0.08);
  },
  noiseHit(vol, freq, dur) {
    if (!this.ctx || !this.on) return; const A = this.ctx, s = A.createBufferSource(); s.buffer = this.noise;
    const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = A.createGain(); g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, A.currentTime + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(); s.stop(A.currentTime + dur);
  },
  blip(f0, f1, dur, type, vol) {
    if (!this.ctx || !this.on) return; const A = this.ctx, o = A.createOscillator(), g = A.createGain(); o.type = type || 'square';
    o.frequency.setValueAtTime(f0, A.currentTime); o.frequency.exponentialRampToValueAtTime(f1, A.currentTime + dur);
    g.gain.value = vol || 0.06; g.gain.exponentialRampToValueAtTime(0.001, A.currentTime + dur); o.connect(g); g.connect(this.master); o.start(); o.stop(A.currentTime + dur);
  },
  crash(v) { this.noiseHit(Math.min(0.5, 0.08 + v * 0.02), 900, 0.35); },
  smash() { this.noiseHit(0.12, 2400, 0.18); },
  boom() { this.noiseHit(0.6, 400, 1.2); },
  cash() { this.blip(900, 1800, 0.12, 'square', 0.05); setTimeout(() => this.blip(1300, 2400, 0.1, 'square', 0.04), 70); },
  spray() { this.noiseHit(0.18, 5000, 1.2); },
  star() { this.blip(520, 260, 0.35, 'sawtooth', 0.06); },
};

// ---------- helpers ----------
function starsFor(h) { let s = 0; for (let i = 0; i < STAR_HEAT.length; i++) if (h >= STAR_HEAT[i]) s = i + 1; return s; }
function addHeat(n) { if (G.state !== 'play') return; if (G.grace > 0 && G.stars === 0) return; G.heat = Math.min(240, Math.max(G.heat + n, n > 0 ? 1 : 0)); }
function addCash(n, x, z) { G.runCash += n; SAVE.bank += n; popCash(n); if (n > 0) stat('cash', n); }
function findRoad(x, z, maxR) {
  for (let r = 0; r < maxR; r += 0.8) for (let a = 0; a < 24; a++) {
    const px = x + Math.cos(a / 24 * Math.PI * 2) * r, pz = z + Math.sin(a / 24 * Math.PI * 2) * r;
    if (tileAt(px, pz) === T_ROAD) {
      const g = LASTG, du = Math.abs(LASTU - g.A * Math.round(LASTU / g.A)), dv = Math.abs(LASTV - g.S * Math.round(LASTV / g.S));
      if (du < g.wa / 2 && dv < g.ws / 2 + 1.5) continue;
      if (dv < g.ws / 2 && du < g.wa / 2 + 1.5) continue;
      let h; if (du < g.wa / 2) h = g.th; else h = g.th + Math.PI / 2;
      return { x: px, z: pz, h };
    }
  }
  return { x, z, h: 0 };
}
function nearestCopDist(x, z) { let bd = 1e9; for (const c of G.cops) if (c.alive && !c.wreck && c.sink === 0 && !c.ai.lost) bd = Math.min(bd, Math.hypot(c.x - x, c.z - z)); return bd; }

// ---------- player ----------
function playerStats() {
  const m = MODELS[SAVE.car];
  return { maxV: m.maxV * (1 + SAVE.up.engine * 0.06), hp: Math.round(m.hp * (1 + SAVE.up.armor * 0.22)) };
}
// starter sedan has fixed factory paint (upgrades only, no repaint)
function carColor(k) { return (k === SAVE.car && SAVE.color && !MODELS[k].fixedPaint) ? SAVE.color.slice() : MODELS[k].color.slice(); }
function spawnPlayer(boro) {
  const ll = GEO.SPAWNS[boro] || GEO.SPAWNS.MANHATTAN, p = P(ll[0], ll[1]);
  const r = findRoad(p[0], p[1], 40);
  const v = makeVehicle(SAVE.car, r.x, r.z, r.h, { role: 'player', color: carColor(SAVE.car) });
  const st = playerStats(); v.maxV = st.maxV; v.hp = v.maxHp = st.hp;
  G.P = v; G.cam.x = G.cam.tx = v.x; G.cam.z = G.cam.tz = v.z;
  return v;
}
function resetRun() {
  G.cops = []; G.civs = []; G.wrecks = []; G.pickups = []; G.powerups = []; G.powT = 1.5; G.spdT = 0; PARTS.length = 0; G.heat = 0; G.stars = 0; G.maxStars = 0; G.runCash = 0; G.runTime = 0; G.wrecked = 0;
  G.bust = 0; G.grace = 2; G.heli = null; G.fountains = []; G.gears = []; G.gearT = 3;
}

// ---------- spawning ----------
function spawnCop() {
  const P = G.P; const s = G.stars;
  for (let tries = 0; tries < 14; tries++) {
    const a = Math.random() * Math.PI * 2, r = 44 + Math.random() * 16;
    const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
    if (!WORLD.get(Math.floor(x / CH), Math.floor(z / CH))) continue;
    const t = tileAt(x, z); if (t !== T_ROAD && t !== T_HWY) continue;
    if (WORLD.pointBlocked(x, z, 1.2)) continue;
    const rr = Math.random();
    const kind = s >= 4 && rr < (s >= 5 ? 0.25 : 0.15) ? 'armored' : (s >= 3 && rr < 0.5 ? 'suv' : 'cop');
    const v = makeVehicle(kind, x, z, Math.atan2(P.x - x, -(P.z - z)), { role: 'cop' });
    v.vx = Math.sin(v.h) * 10; v.vz = -Math.cos(v.h) * 10;
    G.cops.push(v); return v;
  }
}
function spawnCiv() {
  const P = G.P;
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 30;
    const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
    if (!WORLD.get(Math.floor(x / CH), Math.floor(z / CH))) continue;
    if (tileAt(x, z) !== T_ROAD) continue;
    const b = boroAt(x, z), rr = Math.random();
    const kind = b === 1 ? (rr < 0.38 ? 'taxi' : rr < 0.5 ? 'bus' : 'sedan') : (rr < 0.1 ? 'taxi' : rr < 0.16 ? 'bus' : rr < 0.25 ? 'truck' : 'sedan');
    const col = kind === 'sedan' ? PAL.car[Math.floor(Math.random() * PAL.car.length)].slice() : kind === 'truck' ? PAL.car[Math.floor(Math.random() * PAL.car.length)].slice() : null;
    const v = makeVehicle(kind, x, z, 0, { role: 'civ', color: col });
    civInit(v);
    if (WORLD.pointBlocked(v.x, v.z, 1)) continue;
    const fx = Math.sin(v.h), fz = -Math.cos(v.h); v.vx = fx * 6; v.vz = fz * 6;
    if (kind === 'bus') { v.maxV = 10; }
    G.civs.push(v); return v;
  }
}
function spawnPickup() {
  const P = G.P;
  for (let tries = 0; tries < 8; tries++) {
    const a = P.h + (Math.random() - 0.5) * 2.6, r = 22 + Math.random() * 40;
    const x = P.x + Math.sin(a) * r, z = P.z - Math.cos(a) * r;
    const t = tileAt(x, z); if (t !== T_ROAD && t !== T_WALK && t !== T_PARK && t !== T_PLAZA && t !== T_PARKING && t !== T_TARMAC && t !== T_MARSH) continue;
    if (WORLD.pointBlocked(x, z, 0.6)) continue;
    const big = Math.random() < 0.1;
    G.pickups.push({ x, z, v: big ? 500 : 50 + Math.floor(Math.random() * 5) * 25, big, t: Math.random() * 6 });
    return;
  }
}
function spawnGear() {
  const P = G.P;
  for (let tries = 0; tries < 10; tries++) {
    const a = P.h + (Math.random() - 0.5) * 2.6, r = 24 + Math.random() * 40;
    const x = P.x + Math.sin(a) * r, z = P.z - Math.cos(a) * r;
    const t = tileAt(x, z); if (t !== T_ROAD && t !== T_HWY && t !== T_PLAZA && t !== T_PARK && t !== T_PARKING && t !== T_TARMAC) continue;
    if (WORLD.pointBlocked(x, z, 0.8)) continue;
    G.gears.push({ x, z, t: Math.random() * 6 }); return;
  }
}
// ---------- damage / events ----------
function damage(v, amt) {
  if (!v.alive) return;
  if (v === G.P && (G.state !== 'play' || G.godT > 0)) return;
  v.hp -= amt;
  if (v.hp <= 0) explode(v);
}
function explode(v) {
  v.alive = false; v.wreck = true; v.hp = 0; v.wreckT = 0;
  puff(v.x, v.y + 0.8, v.z, hex('#ff8a1e'), 14, { size: 0.6, v: 6, vy: 3, life: 0.7, m: 2, g: -1, spread: 1 });
  puff(v.x, v.y + 1, v.z, hex('#ffd23a'), 8, { size: 0.5, v: 8, vy: 4, life: 0.5, m: 2, g: 2, spread: 1 });
  puff(v.x, v.y + 1, v.z, hex('#3a3a3a'), 16, { size: 0.8, v: 3, vy: 2.5, life: 2.2, g: -0.6, grow: 0.6, spread: 1.4 });
  const d = Math.hypot(v.x - G.P.x, v.z - G.P.z);
  if (d < 60) { AUD.boom(); G.shake = Math.max(G.shake, 1.2 * (1 - d / 60)); }
  v.vy = 0; v.spin += (Math.random() - 0.5) * 6;
  if (v.role === 'cop') { G.wrecked++; stat('cops', 1); addHeat(10); addCash(100); toast('COP WRECKED +$100'); }
  if (v === G.P) setTimeout(() => gameOver('wasted'), 900);
}
function onPropHit(v, ch, id, nx, nz, pen) {
  const k = id * PROPF, type = ch.props[k + 3] | 0, mass = ch.props[k + 7];
  const sp = vSpeed(v);
  if (sp > 2.2 || mass < 0.3) {
    const boxes = WORLD.killProp(ch, id);
    spawnDebris(boxes, v.vx, v.vz, sp);
    const slow = Math.max(0.55, 1 - 0.07 * mass * v.m.mass ** -0.5);
    v.vx *= slow; v.vz *= slow;
    if (type === PT.PCAR) { if (v !== G.P) damage(v, 4 / Math.sqrt(v.mass)); puff(ch.props[k], 0.6, ch.props[k + 1], hex('#cfcfcf'), 5, { size: 0.3 }); }
    if (type === PT.HYDRANT) G.fountains.push({ x: ch.props[k], z: ch.props[k + 1], t: 4 });
    if (v === G.P) {
      AUD.smash(); G.shake = Math.max(G.shake, 0.15);
      addHeat(type === PT.PCAR ? 3 : 1.2);
      if (Math.random() < 0.35) addCash(type === PT.PCAR ? 25 : 5);
    }
  } else { v.x += nx * pen; v.z += nz * pen; const vn = v.vx * nx + v.vz * nz; if (vn < 0) { v.vx -= nx * vn; v.vz -= nz * vn; } }
}
function onVehHit(a, b, rv) {
  const P = G.P;
  if (rv > 3.5) {
    const da = (rv - 3.5) * 1.5 * b.mass / a.mass, db = (rv - 3.5) * 1.5 * a.mass / b.mass;
    // the player only takes damage from cops (walls, props, civilians and wrecks don't hurt you)
    if (a !== P || (b.role === 'cop' && !b.wreck)) damage(a, a === P ? da / armorK() : da);
    if (b !== P || (a.role === 'cop' && !a.wreck)) damage(b, b === P ? db / armorK() : db);
    const d = Math.hypot(a.x - P.x, a.z - P.z);
    if (d < 40 && G.t - G.lastCrash > 0.12) { AUD.crash(rv); G.lastCrash = G.t; }
    puff((a.x + b.x) / 2, 0.6, (a.z + b.z) / 2, hex('#ffe08a'), Math.min(8, rv | 0), { size: 0.12, v: 8, vy: 3, life: 0.4, m: 2, g: 12 });
  }
  if (a === P || b === P) {
    const o = a === P ? b : a;
    if (o.role === 'cop' && rv > 3) addHeat(2 + rv * 0.15);
    if (o.role === 'civ' && rv > 3) { addHeat(1.5); o.ai.stun = 2.5; }
    if (rv > 6) G.shake = Math.max(G.shake, Math.min(0.8, rv * 0.04));
  }
}
function armorK() { return 1; }

// ---------- upgrades (bought on the title screen) ----------
function upCost(k) { const lv = SAVE.up[k]; return k === 'engine' ? [700, 1500, 3000][lv] || 0 : [500, 1100, 2400][lv] || 0; }
function buyUpgrade(k) {
  const c = upCost(k); if (SAVE.up[k] >= 3 || SAVE.bank < c) return;
  SAVE.bank -= c; SAVE.up[k]++; save();
  if (G.P) { const st = playerStats(), P = G.P; P.maxV = st.maxV; P.maxHp = P.hp = st.hp; }
  AUD.init(); AUD.blip(300, 900, 0.25, 'square', 0.05); renderTitle(); if (G.state === 'garage') renderGarage();
}

// ---------- outcomes ----------
function gameOver(kind) {
  if (G.state === 'over' || G.state === 'title') return;
  G.state = 'over';
  const t = G.runTime, best = Math.max(SAVE.best, t); const newBest = t > SAVE.best + 0.5; SAVE.best = best;
  let extra = '';
  // Permanent economy (master file §8/§21): no run ending ever takes money. Everything earned is already in the bank.
  extra = `<div class="keep">BANK ${fmt$(SAVE.bank)} · ALL EARNINGS KEPT</div>`;
  save();
  const title = kind === 'busted' ? 'BUSTED' : kind === 'splash' ? 'SLEEPING WITH<br>THE FISHES' : 'WASTED';
  $('overTitle').innerHTML = title; $('overTitle').className = 'ot ' + kind;
  $('overStats').innerHTML = `<div><b>${mmss(t)}</b><span>SURVIVED</span></div><div><b>${fmt$(Math.max(0, G.runCash))}</b><span>CASH</span></div><div><b>${'★'.repeat(G.maxStars) || '—'}</b><span>MAX HEAT</span></div><div><b>${G.wrecked}</b><span>COPS WRECKED</span></div>` +
    extra + `<div class="best">${newBest ? 'NEW BEST ' : 'BEST '} ${mmss(best)}</div>`;
  setTimeout(() => $('over').classList.add('on'), kind === 'splash' ? 600 : 300);
  AUD.update(0, 0, 0, false);
}
function mmss(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

// ---------- UI feedback ----------
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function bigMsg(s, cls) { const el = $('big'); el.innerHTML = s; el.className = 'big on ' + (cls || ''); clearTimeout(bigMsg.t); bigMsg.t = setTimeout(() => el.classList.remove('on'), 1800); }
function flash(c) { const el = $('flash'); el.style.background = c; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
let popAcc = 0, popTimer = 0;
function popCash(n) { popAcc += n; clearTimeout(popTimer); const el = $('cashPop'); el.textContent = (popAcc >= 0 ? '+' : '−') + fmt$(Math.abs(popAcc)); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); popTimer = setTimeout(() => popAcc = 0, 900); if (n > 0) AUD.cash(); }

// ---------- main update ----------
function stepPlay(dt) {
  const P = G.P;
  G.runTime += dt; G.grace = Math.max(0, G.grace - dt); G.godT = Math.max(0, (G.godT || 0) - dt);
  // input
  const I = G.input, kL = I.l || I.keys.ArrowLeft || I.keys.KeyA, kR = I.r || I.keys.ArrowRight || I.keys.KeyD, kB = I.b || I.keys.ArrowDown || I.keys.KeyS || I.keys.Space || (I.l && I.r);
  if (P.alive && P.sink === 0) {
    P.thr = kB ? -1 : 1;
    const st = (kR ? 1 : 0) - (kL ? 1 : 0);
    P.steer += (st - P.steer) * Math.min(1, dt * 14);
    if (I.l && I.r) P.steer = 0;
  }
  // AI
  for (const c of G.cops) copAI(c, P, dt, G.stars);
  for (const c of G.civs) civAI(c, dt);
  // physics
  const all = [P].concat(G.cops, G.civs, G.wrecks);
  for (const v of all) stepVehicle(v, dt);
  for (const v of all) {
    if (v.sink > 0) continue;
    const imp = collideWorld(v, dt, onPropHit);
    if (imp > 5) {
      if (v !== P) damage(v, (imp - 5) * 1.35); // walls/buildings: NPCs only; the player is immune
      if (v === P) { G.shake = Math.max(G.shake, Math.min(0.9, imp * 0.05)); if (G.t - G.lastCrash > 0.15) { AUD.crash(imp); G.lastCrash = G.t; } puff(P.x + Math.sin(P.h) * 1.1, 0.6, P.z - Math.cos(P.h) * 1.1, hex('#ffe08a'), 6, { size: 0.12, v: 7, vy: 3, life: 0.35, m: 2, g: 12 }); }
    }
  }
  collideVehicles(all, onVehHit);
  // sinking outcomes
  for (const v of all) {
    if (v.sink > 0 && !v.splashed) {
      v.splashed = true; puff(v.x, 0.2, v.z, hex('#e6f6ff'), 18, { size: 0.35, v: 5, vy: 5, life: 0.9, g: 12, spread: 1.5 });
      if (Math.hypot(v.x - P.x, v.z - P.z) < 50) AUD.noiseHit(0.3, 1200, 0.8);
      if (v === P) { setTimeout(() => gameOver('splash'), 1200); }
      else if (v.role === 'cop') { toast('COP TOOK A SWIM +$100'); addCash(100); G.wrecked++; stat('cops', 1); }
    }
  }
}
// marsh: spray from the wheels, bigger and wetter in the open pools, a burst + thump when you hit a pool fast
const SPLASH_W = hex('#d8eef2'), SPLASH_B = hex('#8fbcc4'), SPLASH_M = hex('#6b5a3e');
function marshFX(v, dt, loud) {
  if (v.sink > 0 || v.air || tileAt(v.x, v.z) !== T_MARSH) { v.inPool = false; return; }
  const sp = vSpeed(v); if (sp < 2) { v.inPool = false; return; }
  const pool = marshWet(v.x, v.z) > 0.56, fx = Math.sin(v.h), fz = -Math.cos(v.h), rx = Math.cos(v.h), rz = Math.sin(v.h), back = v.m.len * 0.32;
  v.splT = (v.splT || 0) + dt * sp * (pool ? 1.6 : 0.7) * (loud ? 1 : 0.4);
  while (v.splT > 1) { v.splT -= 1;
    for (const side of [-1, 1]) {
      const x = v.x - fx * back + rx * side * 0.5, z = v.z - fz * back + rz * side * 0.5;
      puff(x, 0.25, z, pool ? (Math.random() < 0.5 ? SPLASH_W : SPLASH_B) : (Math.random() < 0.6 ? SPLASH_M : SPLASH_B), pool ? 4 : 2,
        { size: pool ? 0.27 : 0.17, v: 2.2, vx: -v.vx * 0.15 + rx * side * 2.2, vz: -v.vz * 0.15 + rz * side * 2.2, vy: 2.5 + sp * 0.12, vyr: 2.5, life: 0.65, g: 16, m: pool ? 2 : 0, spread: 0.3 });
    }
  }
  if (pool && !v.inPool && sp > 9 && loud) { // belly-flop into a pool
    puff(v.x, 0.3, v.z, SPLASH_W, 18, { size: 0.26, v: 6, vy: 4, vyr: 4, life: 0.8, g: 14, m: 2, spread: 1.2 });
    G.shake = Math.max(G.shake, 0.25); AUD.noiseHit(Math.min(0.35, 0.08 + sp * 0.008), 500, 0.4);
  }
  v.inPool = pool;
}
function updateWorldRules(dt) {
  const P = G.P;
  if (P && P.alive) marshFX(P, dt, true);
  for (const c of G.cops) if (c.alive && Math.abs(c.x - P.x) < 45 && Math.abs(c.z - P.z) < 45) marshFX(c, dt, false);
  // heat & stars
  if (G.stars > 0) G.heat = Math.min(240, G.heat + dt * 0.45);
  const ns = starsFor(G.heat);
  if (ns > G.stars) { AUD.star(); bigMsg('★'.repeat(ns), 'stars'); if (G.stars === 0) toast('NYPD IS ON YOU — KEEP MOVING · GRAB ⚙ GEARS TO REPAIR'); }
  G.stars = ns; G.maxStars = Math.max(G.maxStars, ns);
  if (G.stars > 0) { G.wantedT = (G.wantedT || 0) + dt; if (G.wantedT > 1) { G.wantedT = 0; addCash(G.stars * 2); } }
  // spawn cops
  const active = G.cops.filter(c => c.alive && !c.wreck && c.sink === 0 && !c.ai.lost).length;
  G.spawnT -= dt;
  if (G.spawnT <= 0 && active < COPS_FOR[G.stars]) { spawnCop(); G.spawnT = G.stars >= 4 ? 0.8 : 1.4; }
  // helicopter
  if (G.stars >= 4 && !G.heli) G.heli = { x: P.x - 30, z: P.z + 30, y: 16, h: 0, t: 0, leaving: false };
  if (G.heli) {
    const H = G.heli; H.t += dt;
    const tx = H.leaving ? H.x + 40 : P.x - 5 + Math.sin(H.t * 0.4) * 6, tz = H.leaving ? H.z + 40 : P.z + 7 + Math.cos(H.t * 0.3) * 5;
    H.x += (tx - H.x) * Math.min(1, dt * (H.leaving ? 0.5 : 1.2)); H.z += (tz - H.z) * Math.min(1, dt * (H.leaving ? 0.5 : 1.2));
    H.h += angWrap(Math.atan2(P.x - H.x, -(P.z - H.z)) - H.h) * Math.min(1, dt * 2);
    if (H.leaving && Math.hypot(H.x - P.x, H.z - P.z) > 90) G.heli = null;
  }
  // despawn far / lost cops
  G.cops = G.cops.filter(c => {
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    if (c.sink > 2.5) return false;
    if (c.wreck) { c.wreckT = (c.wreckT || 0) + dt; if (c.wreckT > 1) { G.wrecks.push(c); return false; } }
    if (d > 95 || (c.ai.lost && d > 60)) return false;
    return true;
  });
  G.wrecks = G.wrecks.filter(c => Math.hypot(c.x - P.x, c.z - P.z) < 80 && c.sink < 2.5).slice(-14);
  // civilians
  const civTarget = G.stars >= 3 ? 5 : 9;
  G.civT -= dt;
  if (G.civT <= 0 && G.civs.length < civTarget) { spawnCiv(); G.civT = 0.4; }
  G.civs = G.civs.filter(c => { if (c.wreck) { G.wrecks.push(c); return false; } return Math.hypot(c.x - P.x, c.z - P.z) < 85 && c.sink < 2.5; });
  // pickups
  G.pickT -= dt;
  if (G.pickT <= 0 && G.pickups.length < 7) { spawnPickup(); G.pickT = 0.6; }
  G.pickups = G.pickups.filter(p => {
    p.t += dt;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 2.3 && P.alive) { addCash(p.v); AUD.cash(); puff(p.x, 0.8, p.z, hex('#2ee66f'), 8, { size: 0.18, v: 3, vy: 3, life: 0.6, m: 2, g: 4 }); return false; }
    return Math.hypot(p.x - P.x, p.z - P.z) < 90;
  });
  for (const c of G.cops) if (c.landed !== undefined) { c.landed = undefined; if (c.landV > 9) damage(c, (c.landV - 9) * 3); }
  P.boost = 1; // nitro removed per owner (Nov 2026)
  // repair gears: spawn more often when you're beat up; grabbing one is an instant full repair
  G.gearT -= dt * (P.hp < P.maxHp * 0.6 ? 2.5 : 1);
  if (G.gearT <= 0 && G.gears.length < 2) { spawnGear(); G.gearT = 7; }
  G.gears = G.gears.filter(p => {
    p.t += dt;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 2.4 && P.alive && P.sink === 0) {
      P.hp = P.maxHp; stat('gears', 1); bigMsg('FULL REPAIR', 'cool'); flash('#ffb347'); AUD.blip(200, 600, 0.3, 'square', 0.06);
      puff(p.x, 1.2, p.z, hex('#ffb347'), 12, { size: 0.2, v: 4, vy: 3, life: 0.6, m: 2, g: 3 });
      return false;
    }
    return Math.hypot(p.x - P.x, p.z - P.z) < 95;
  });
  // high-speed bonus: hold close to top speed and the cash keeps coming
  const spd = vSpeed(P);
  if (P.alive && P.sink === 0) SAVE.stats.dist += spd * dt * MPU / 1000;
  if (G.stars > SAVE.maxStars) { SAVE.maxStars = G.stars; misCheck(); }
  if ((G.misT = (G.misT || 0) + dt) > 1) { G.misT = 0; misCheck(); }
  // autosave every 5 s while money/stats are moving, so a killed tab or app can't lose earnings
  if ((G.autoT = (G.autoT || 0) + dt) > 5) { G.autoT = 0; if (SAVE.bank !== G.savedBank) { G.savedBank = SAVE.bank; save(); } }
  if (spd > P.maxV * 0.88 && P.alive && P.sink === 0) {
    G.spdT += dt; G.spdAcc = (G.spdAcc || 0) + dt;
    if (G.spdAcc >= 1) { G.spdAcc -= 1; addCash(20 + 10 * G.stars); }
  } else { G.spdT = 0; G.spdAcc = 0; }
  // fountains
  G.fountains = G.fountains.filter(f => { f.t -= dt; if (Math.random() < 0.7) puff(f.x, 0.5, f.z, hex('#bfe6ff'), 2, { size: 0.18, v: 1.2, vy: 7, vyr: 2, life: 0.9, g: 14 }); return f.t > 0; });
  // damaged smoke
  for (const v of [P].concat(G.cops)) {
    if (!v.alive || v.sink > 0) continue;
    const k = v.hp / v.maxHp; v.smokeT -= dt;
    if (k < 0.45 && v.smokeT <= 0) { v.smokeT = k < 0.2 ? 0.05 : 0.12; const fx = Math.sin(v.h), fz = -Math.cos(v.h); puff(v.x + fx * 0.8, v.y + 0.8, v.z + fz * 0.8, k < 0.2 ? hex('#2b2b2b') : hex('#9a9a9a'), 1, { size: 0.3, v: 0.6, vy: 1.5, life: 1.2, g: -0.5, grow: 0.5 }); if (k < 0.2 && Math.random() < 0.4) puff(v.x + fx * 0.8, v.y + 0.7, v.z + fz * 0.8, hex('#ff8a1e'), 1, { size: 0.22, v: 0.5, vy: 1.5, life: 0.4, m: 2, g: -1 }); }
  }
  for (const v of G.wrecks) { v.smokeT -= dt; if (v.smokeT <= 0 && v.sink === 0) { v.smokeT = 0.25; puff(v.x, v.y + 0.8, v.z, hex('#3a3a3a'), 1, { size: 0.35, v: 0.5, vy: 1.4, life: 1.6, g: -0.4, grow: 0.5 }); } }
  // busted check
  const sp = vSpeed(P), nc = nearestCopDist(P.x, P.z);
  if (G.stars > 0 && sp < 2.4 && nc < 4.2 && P.alive && P.sink === 0) G.bust += dt; else G.bust = Math.max(0, G.bust - dt * 1.5);
  if (G.bust > 2.4 && G.state === 'play' && !G.noBust) { gameOver('busted'); }
  // neighborhood toast
  G.hoodT -= dt;
  if (G.hoodT <= 0) {
    G.hoodT = 0.5; const name = hoodName(P.x, P.z);
    if (name !== G.hood) { G.hood = name; const el = $('loc'); el.innerHTML = name; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
  }
}
let HOODW = null;
function hoodName(x, z) {
  if (!HOODW) HOODW = GEO.HOODS.map(h => { const p = P(h[2], h[3]); return [h[0], h[1], p[0], p[1]]; });
  const b = boroAt(x, z), s = segHit(x, z);
  if (s && s.br) return s.br.name;
  for (const L of LM) if (L.name && Math.hypot(L.x - x, L.z - z) < (L.nr || L.r + 9)) return L.name + '<small>' + (L.sub || 'LANDMARK') + '</small>';
  if (!b) {
    const W = [['HUDSON RIVER', 40.80, -73.975], ['HUDSON RIVER', 40.74, -74.02], ['EAST RIVER', 40.73, -73.968], ['EAST RIVER', 40.775, -73.935], ['HARLEM RIVER', 40.835, -73.933], ['UPPER BAY', 40.672, -74.045],
      ['THE NARROWS', 40.607, -74.045], ['JAMAICA BAY', 40.612, -73.84], ['LONG ISLAND SOUND', 40.82, -73.78], ['FLUSHING BAY', 40.765, -73.85], ['KILL VAN KULL', 40.645, -74.12], ['ARTHUR KILL', 40.57, -74.215],
      ['LOWER BAY', 40.55, -74.05], ['ATLANTIC OCEAN', 40.54, -73.85], ['ROCKAWAY INLET', 40.567, -73.92], ['RARITAN BAY', 40.49, -74.2]];
    let bn = GEO.BORO_NAMES[0], bd = 1e9; for (const w of W) { const p = P(w[1], w[2]), d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; bn = w[0]; } }
    return bn;
  }
  let best = null, bd = 1e9; for (const h of HOODW) { if (h[0] !== b) continue; const d = Math.hypot(h[2] - x, h[3] - z); if (d < bd) { bd = d; best = h[1]; } }
  return (best && bd < 120 ? best + '<small>' + GEO.BORO_NAMES[b] + '</small>' : GEO.BORO_NAMES[b]);
}

// ---------- rendering helpers ----------
function vehQuat(v) {
  let q = qYaw(Math.PI - v.h);
  if (v.roll || v.pitch) q = qMul(q, qMul(qAxis(0, 0, 1, v.roll || 0), qAxis(1, 0, 0, v.pitch || 0)));
  return q;
}
function pushVehicle(v, t) {
  if (v.m.mesh && GFX.meshes && GFX.meshes[v.m.mesh]) return pushVehicleMesh(v, t);
  const q = vehQuat(v), wr = v.wreck;
  const bc = v.color, bd = [bc[0] * 0.72, bc[1] * 0.72, bc[2] * 0.72];
  const blink = Math.floor(t * 7) % 2 === 0;
  for (const p of v.m.parts) {
    let col = p[6] === 'body' ? bc : p[6] === 'bodyDk' ? bd : p[6], m = p[7] || 0, pq = q;
    const f = p[8];
    if (f === 1) col = (v.role !== 'cop' || v.ai.lost || wr) ? VC.off : (blink ? VC.red : VC.off);
    if (f === 2) col = (v.role !== 'cop' || v.ai.lost || wr) ? VC.off : (!blink ? VC.blue : VC.off);
    if ((f === 1 || f === 2) && col === VC.off) m = 0;
    if (f === 5 && !GFX.night) m = 0;
    if (wr && col !== VC.tire) { col = [col[0] * 0.28, col[1] * 0.26, col[2] * 0.24]; m = 0; }
    else if (v.dim && col !== VC.tire) { col = [col[0] * v.dim, col[1] * v.dim, col[2] * v.dim]; if (m === 2) m = 0; }
    if (f === 3) pq = qMul(q, qYaw(t * 28));
    else if (p[9]) pq = qMul(q, qAxis(1, 0, 0, p[9]));
    const o = qRot(q, [p[0], p[1], p[2]]);
    dpush(v.x + o[0], v.y + o[1] + (v.lift || 0), v.z + o[2], p[3], p[4], p[5], pq, col, m);
  }
}
// dedicated-mesh vehicles: one body instance + wheels that spin with road speed and steer
function pushVehicleMesh(v, t) {
  const m = v.m, q = vehQuat(v), lift = v.lift || 0, pl = v === G.P && G.state !== 'garage';
  const dt = Math.min(0.1, Math.max(0, t - (v._t || t))); v._t = t;
  const fwd = v.vx * Math.sin(v.h) - v.vz * Math.cos(v.h); v.wspin = ((v.wspin || 0) + fwd * dt / m.wheels[0][3]) % (Math.PI * 2);
  const siren = v.role === 'cop' && !v.wreck && !(v.ai && v.ai.lost) ? (Math.floor(t * 7) % 2 ? 1 : 2) : 0;
  const dim = v.wreck ? 0.3 : (v.dim || 0), brake = v.thr < 0 ? 1 : 0;
  GFX.meshPush(m.mesh, pl, v.x, v.y + lift, v.z, q, 1, 1, 1, v.color, siren, dim, brake);
  const spinQ = qAxis(1, 0, 0, v.wspin);
  for (const w of m.wheels) {
    const o = qRot(q, [w[0], w[1], w[2]]), wq = w[5] ? qMul(q, qMul(qYaw(-(v.steer || 0) * 0.45), spinQ)) : qMul(q, spinQ);
    GFX.meshPush('wheel', pl, v.x + o[0], v.y + o[1] + lift, v.z + o[2], wq, w[4], w[3], w[3], m.rim || [0.75, 0.77, 0.8], 0, dim, 0);
  }
}
function buildDynamic(t) {
  DYN.n = 0; if (GFX.meshReset) GFX.meshReset();
  if (G.state === 'garage') { garageScene(t); return 0; }
  const P = G.P;
  if (P) pushVehicle(P, t);
  const silN = DYN.n;
  for (const v of G.cops) pushVehicle(v, t);
  for (const v of G.civs) pushVehicle(v, t);
  for (const v of G.wrecks) pushVehicle(v, t);
  if (G.heli) { const H = G.heli; pushVehicle({ x: H.x, y: H.y, z: H.z, h: H.h, m: MODELS.heli, color: VC.white, role: 'cop', ai: {}, roll: 0, pitch: 0.12 }, t); }
  // pickups: GTA-style floating badges (cash, briefcase, repair) with a glow + ring on the road
  ICONS.length = 0;
  const badge = (p, cell, size, col, ph) => {
    const y = 1.55 + Math.sin(p.t * 3) * 0.16, pulse = 1 + Math.sin(p.t * 5 + ph) * 0.04;
    ICONS.push([p.x, 0.07, p.z, 3.2, 4, 1, col[0], col[1], col[2], 0.55]);
    ICONS.push([p.x, 0.08, p.z, 2.4 + Math.sin(p.t * 4) * 0.25, 5, 1, col[0], col[1], col[2], 0.85]);
    ICONS.push([p.x, y, p.z, size * pulse, cell, 0, 1, 1, 1, 1]);
  };
  for (const p of G.pickups) badge(p, p.big ? 1 : 0, p.big ? 2.9 : 2.4, p.big ? ICON_COL[1] : ICON_COL[0], 0);
  for (const p of G.gears) badge(p, 3, 2.7, ICON_COL[3], 2);
  // particles
  for (const p of PARTS) {
    let s = 1; if (p.shrink) s = Math.max(0.05, p.life / (p.max || 1)); else if (p.life < 0.6) s = p.life / 0.6;
    dpush(p.x, p.y, p.z, p.sx * s, p.sy * s, p.sz * s, p.q, p.c, p.m);
  }
  pushBoats(dpush);
  return silN;
}

// ---------- camera & render ----------
const LIGHT = {
  day: { sun: norm3([-0.604, 0.766, 0.22]), sunCol: [0.62, 0.58, 0.52], amb: [0.6, 0.63, 0.7], fog: [0.64, 0.82, 0.94], water: [0.28, 0.66, 0.88] },
  night: { sun: norm3([-0.35, 0.8, 0.45]), sunCol: [0.16, 0.18, 0.3], amb: [0.22, 0.24, 0.38], fog: [0.05, 0.065, 0.13], water: [0.07, 0.15, 0.28] },
};
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
let BILL_TEX = null, STATIC_BR = null;
function render(t, dt) {
  if (G.state === 'garage') return renderGarage3D(t, dt);
  const cv = GFX.canvas, asp = cv.clientWidth / Math.max(1, cv.clientHeight);
  const P = G.P;
  let fov, dist, pitch = CAM_PITCH, az = CAM_AZ;
  const portrait = asp < 1;
  fov = portrait ? Math.min(68, 2 * Math.atan(Math.tan(17 * Math.PI / 180) / asp) * 180 / Math.PI) : 36;
  const sp = P ? vSpeed(P) : 0;
  dist = (portrait ? 46 : Math.max(38, Math.min(52, 28 + cv.clientHeight * 0.033))) + sp * 0.35;
  let tx = G.cam.tx, tz = G.cam.tz;
  if (G.state === 'play' || G.state === 'over') {
    const la = portrait ? 0.42 : 0.3;
    const wx = P.x + P.vx * la, wz = P.z + P.vz * la;
    const k = 1 - Math.exp(-dt * 5);
    G.cam.tx += (wx - G.cam.tx) * k; G.cam.tz += (wz - G.cam.tz) * k;
    tx = G.cam.tx; tz = G.cam.tz;
  } else if (G.state === 'title') {
    G.cam.orbit += dt * 0.1; az = CAM_AZ + G.cam.orbit; dist = portrait ? 46 : 40; pitch = 54 * Math.PI / 180;
    tx = G.cam.tx = P.x; tz = G.cam.tz = P.z;
    if (portrait) { const f = [Math.sin(az), -Math.cos(az)]; tx += f[0] * 7; tz += f[1] * 7; }
  }
  const f = [Math.sin(az), -Math.cos(az)];
  let ex = tx - f[0] * dist * Math.cos(pitch), ez = tz - f[1] * dist * Math.cos(pitch), ey = dist * Math.sin(pitch);
  let ty = G.state === 'title' ? 1.2 : 0;
  if (G.shake > 0) { const s = G.shake; ex += (Math.random() - 0.5) * s; ey += (Math.random() - 0.5) * s; ez += (Math.random() - 0.5) * s; G.shake = Math.max(0, G.shake - dt * 2.5); }
  const L = GFX.night ? LIGHT.night : LIGHT.day;
  { // motion blur strength: kicks in above ~55% of top speed, strongest flat out
    const k = (G.state === 'play' && P && P.alive) ? Math.max(0, Math.min(1, (vSpeed(P) / (P.maxV || 24) - 0.55) / 0.45)) : 0;
    G.blurAmt = (G.blurAmt || 0) + (k * 0.055 - (G.blurAmt || 0)) * Math.min(1, dt * 4);
  }
  const silN = buildDynamic(t);
  GFX.setDyn(DYN.data, DYN.n, silN);
  const chunks = []; for (const ch of WORLD.chunks.values()) chunks.push(ch);
  const bills = WORLD.bills();
  GFX.render({
    eye: [ex, ey, ez], target: [tx, ty, tz], fov: fov * Math.PI / 180, near: 1, far: 400,
    sunDir: L.sun, sunCol: L.sunCol, amb: L.amb, fogCol: L.fog, waterCol: L.water,
    fog: [dist * 1.7, dist * 3.0 + (portrait ? 20 : 0)], time: t, // pushed out: haze only at the far edge
    shadowCenter: [tx, 0, tz], shadowHalf: portrait ? 52 : 46,
    chunks, statics: STATIC_BR ? [STATIC_BR] : [], bills, billTex: BILL_TEX, icons: ICONS, iconTex: ICON_TEX,
    sil: (G.state === 'play') ? { col: [1, 0.86, 0.15, 0.92], edge: [0.02, 0.02, 0.03, 0.9] } : null, // bold outline: dark rim + solid yellow
    blur: (G.state === 'play' && P && SAVE.blur !== false) ? { amt: G.blurAmt || 0, at: [P.x, 0.5, P.z] } : null,
    slice: null, // building slicing removed per owner (heights popped as the car moved); the car shows through as a silhouette instead
  });
}

// ---------- pickup icon atlas (GTA-style badges, drawn once) ----------
const ICONS = [], ICON_COL = [[0.22, 0.86, 0.42], [1.0, 0.78, 0.2], [0.25, 0.62, 1.0], [1.0, 0.56, 0.12]];
let ICON_TEX = null, ICON_CV = null;
function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function makeIconAtlas() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128; const x = cv.getContext('2d');
  const disc = ['#1f9e4a', '#c98a12', '#1d6fd6', '#e86f0c'], hi = ['#47d873', '#f5c04a', '#59a6ff', '#ffa040'];
  for (let i = 0; i < 4; i++) {
    x.save(); x.translate(i * 128 + 64, 64);
    x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 8; x.shadowOffsetY = 3;
    x.fillStyle = '#0b0d10'; x.beginPath(); x.arc(0, 0, 55, 0, 7); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, 51, 0, 7); x.fill();
    const g = x.createLinearGradient(0, -45, 0, 45); g.addColorStop(0, hi[i]); g.addColorStop(1, disc[i]);
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 45, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.ellipse(0, -22, 34, 18, 0, 0, 7); x.fill(); // gloss
    x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.lineJoin = 'round';
    x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 3; x.shadowOffsetY = 2;
    if (i === 0) { // dollar sign
      x.font = '900 68px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 4);
    } else if (i === 1) { // briefcase
      rrect(x, -30, -14, 60, 40, 7); x.fill();
      x.lineWidth = 6; x.strokeStyle = '#fff'; rrect(x, -11, -26, 22, 16, 5); x.stroke();
      x.shadowColor = 'transparent'; x.fillStyle = disc[1]; x.fillRect(-30, 0, 60, 4); x.fillRect(-5, -3, 10, 10);
    } else if (i === 2) { // lightning bolt
      x.beginPath(); x.moveTo(8, -36); x.lineTo(-20, 6); x.lineTo(-2, 6); x.lineTo(-10, 36); x.lineTo(22, -8); x.lineTo(3, -8); x.closePath(); x.fill();
    } else { // gear
      x.beginPath(); const T = 8;
      for (let k = 0; k < T * 4; k++) { const a = (k / (T * 4)) * Math.PI * 2 - Math.PI / (T * 4), r = (k % 4 === 1 || k % 4 === 2) ? 33 : 25; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.closePath(); x.fill(); x.shadowColor = 'transparent';
      x.fillStyle = disc[3]; x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill();
    }
    x.restore();
  }
  { // 4: soft ground glow, 5: ground ring (both tinted per pickup)
    const g = x.createRadialGradient(4 * 128 + 64, 64, 0, 4 * 128 + 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(4 * 128, 0, 128, 128);
    x.strokeStyle = '#fff'; x.lineWidth = 7; x.shadowColor = '#fff'; x.shadowBlur = 6; x.beginPath(); x.arc(5 * 128 + 64, 64, 50, 0, 7); x.stroke(); x.shadowBlur = 0;
  }
  ICON_CV = cv; return cv;
}

// ---------- billboard atlas ----------
function makeBillboards() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
  const cells = [
    ['#0b0b0b', 'CASH RULES', 'NYC', '#1fd65f', '#e8b923'], ['#0a2a7a', 'BLUESCREENU', 'NAS100 · GOLD · S&P', '#ffffff', '#5fd0ff'],
    ['#2a0d4a', 'AI BEEN HERE', 'OG WISDOM DAILY', '#e9d5ff', '#ffcc33'], ['#0f3d1f', 'GAS GADGETS', 'ELEVATE YOUR SESSION', '#9effa0', '#ffd23a'],
    ['#ff2e7e', 'NYC DJ', 'LIVE ALL 5 BOROUGHS', '#ffffff', '#111111'], ['#111111', 'MINITECH101', 'APPS THAT MOVE', '#00e5ff', '#ffffff'],
    ['#111111', 'CASH RULES', 'RECORDS', '#e8b923', '#1fd65f'], ['#d3202a', 'WANTED', '★★★★★', '#ffffff', '#ffd23a'],
  ];
  cells.forEach((cl, i) => {
    const cx = (i % 2) * 512, cy = (i >> 1) * 256;
    x.fillStyle = cl[0]; x.fillRect(cx, cy, 512, 256);
    x.strokeStyle = cl[4]; x.lineWidth = 10; x.strokeRect(cx + 8, cy + 8, 496, 240);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = cl[3]; x.font = '900 86px Impact, "Arial Black", sans-serif'; fitText(x, cl[1], cx + 256, cy + 108, 470, 86);
    x.fillStyle = cl[4]; x.font = '700 40px "Arial Black", Impact, sans-serif'; fitText(x, cl[2], cx + 256, cy + 192, 460, 40);
  });
  return c;
}
function fitText(x, s, cx, cy, maxW, size) { let sz = size; const f = x.font; while (sz > 16) { x.font = f.replace(/\d+px/, sz + 'px'); if (x.measureText(s).width <= maxW) break; sz -= 4; } x.fillText(s, cx, cy); }

// ---------- minimap ----------
let MAPC = null;
function makeMapCanvas() {
  const c = document.createElement('canvas'); c.width = MW; c.height = MH; const x = c.getContext('2d');
  const img = x.createImageData(MW, MH), d = img.data;
  for (let i = 0; i < MW * MH; i++) { const col = mapColor(BORO[i], ZONE[i]); d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.lineCap = 'round';
  for (const s of SEGS) {
    x.strokeStyle = s.type === SEG_BRIDGE ? '#e9e4d6' : s.type === SEG_HWY ? '#f2c94c' : s.type === SEG_RUN ? '#6a6d73' : '#ffffff';
    x.lineWidth = s.type === SEG_BRIDGE ? 2.6 : s.type === SEG_HWY ? 1.8 : 1.6;
    x.beginPath(); x.moveTo((s.ax - WX0) / MAP_RES, (s.az - WZ0) / MAP_RES); x.lineTo((s.bx - WX0) / MAP_RES, (s.bz - WZ0) / MAP_RES); x.stroke();
  }
  return c;
}
function drawMini(t) {
  const cv = $('mini'), x = cv.getContext('2d'), P = G.P; if (!P || !MAPC) return;
  const W = cv.width, R = W / 2, sc = W / 190; // px per world unit
  x.clearRect(0, 0, W, W);
  x.save(); x.beginPath(); x.arc(R, R, R - 2, 0, Math.PI * 2); x.clip();
  x.fillStyle = '#2c78be'; x.fillRect(0, 0, W, W);
  x.translate(R, R); x.rotate(-CAM_AZ); x.scale(sc, sc);
  x.imageSmoothingEnabled = false;
  x.drawImage(MAPC, WX0 - P.x, WZ0 - P.z, MW * MAP_RES, MH * MAP_RES);
  // blips: same badges as in the world, kept upright while the map is rotated
  const blip = (px, pz, cell, px2) => { if (!ICON_CV) return; const s = px2 / sc; x.save(); x.translate(px - P.x, pz - P.z); x.rotate(CAM_AZ); x.drawImage(ICON_CV, cell * 128, 0, 128, 128, -s / 2, -s / 2, s, s); x.restore(); };
  x.imageSmoothingEnabled = true;
  for (const p of G.pickups) blip(p.x, p.z, p.big ? 1 : 0, (p.big ? 26 : 21) * W / 256);
  for (const p of G.gears) blip(p.x, p.z, 3, 24 * W / 256);
  const blink = Math.floor(t * 6) % 2;
  for (const c of G.cops) { if (!c.alive || c.ai.lost) continue; x.fillStyle = blink ? '#ff3030' : '#3a6bff'; x.beginPath(); x.arc(c.x - P.x, c.z - P.z, 3.4, 0, Math.PI * 2); x.fill(); }
  if (G.heli) { x.strokeStyle = '#ff3030'; x.lineWidth = 1.5; x.beginPath(); x.arc(G.heli.x - P.x, G.heli.z - P.z, 5, 0, Math.PI * 2); x.stroke(); }
  // player arrow
  x.rotate(P.h); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.2;
  x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill(); x.stroke();
  x.restore();
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.beginPath(); x.arc(R, R, R - 1.5, 0, Math.PI * 2); x.stroke();
}
function drawBigMap() {
  const cv = $('bigmap'), x = cv.getContext('2d'), P = G.P;
  const W = cv.width = cv.clientWidth * 2, H = cv.height = cv.clientHeight * 2;
  const sc = Math.min(W / (MW * MAP_RES), H / (MH * MAP_RES)) * 1.0;
  x.fillStyle = '#2c78be'; x.fillRect(0, 0, W, H);
  const ox = (W - MW * MAP_RES * sc) / 2, oz = (H - MH * MAP_RES * sc) / 2;
  x.imageSmoothingEnabled = true; x.drawImage(MAPC, ox, oz, MW * MAP_RES * sc, MH * MAP_RES * sc);
  const toS = (wx, wz) => [ox + (wx - WX0) * sc, oz + (wz - WZ0) * sc];
  x.font = `bold ${Math.round(W / 60)}px Arial`; x.textAlign = 'center';
  for (const [n, ll] of Object.entries({ MANHATTAN: [40.79, -73.965], BRONX: [40.86, -73.87], BROOKLYN: [40.645, -73.95], QUEENS: [40.72, -73.82], 'STATEN ISLAND': [40.585, -74.15], 'NEW JERSEY': [40.75, -74.13] })) {
    const p = toS(...P(ll[0], ll[1])); x.fillStyle = 'rgba(0,0,0,.55)'; x.fillText(n, p[0] + 1, p[1] + 1); x.fillStyle = '#fff'; x.fillText(n, p[0], p[1]);
  }
  if (P) { const p = toS(P.x, P.z); x.save(); x.translate(p[0], p[1]); x.rotate(P.h); x.fillStyle = '#ff3e7e'; x.strokeStyle = '#fff'; x.lineWidth = 3; const k = W / 120; x.beginPath(); x.moveTo(0, -k); x.lineTo(k * 0.75, k * 0.8); x.lineTo(-k * 0.75, k * 0.8); x.closePath(); x.fill(); x.stroke(); x.restore(); }
}

// ---------- HUD ----------
function updateHUD(t) {
  const P = G.P; if (!P) return;
  const st = $('stars'); let h = '';
  const flashing = G.bust > 0.4 && Math.floor(t * 8) % 2;
  for (let i = 0; i < 5; i++) h += `<i class="${i < G.stars ? 'on' : ''}${flashing && i < G.stars ? ' fl' : ''}">★</i>`;
  if (st.dataset.h !== h) { st.innerHTML = h; st.dataset.h = h; }
  $('cash').textContent = fmt$(SAVE.bank);
  $('timer').textContent = mmss(G.runTime);
  const k = Math.max(0, P.hp / P.maxHp); $('hpbar').style.width = (k * 100) + '%'; $('hpbar').style.background = k > 0.5 ? '#2ee66f' : k > 0.25 ? '#ffc93a' : '#ff4040';
  // hints
  let hint = '';
  if (G.bust > 0.4) hint = 'GET MOVING OR GET BUSTED!';
  else if (P.hp < P.maxHp * 0.35 && G.gears.length) hint = 'LOW HEALTH — GRAB A ⚙ GEAR';
  else if (G.spdT > 0.5) hint = 'HIGH-SPEED BONUS';
  const he = $('hint'); if (he.textContent !== hint) he.textContent = hint; he.classList.toggle('on', !!hint);
}

// ---------- input ----------
function setupInput() {
  const tl = $('touch'), ptrs = new Map();
  const upd = () => { let l = false, r = false; for (const x of ptrs.values()) { if (x < window.innerWidth / 2) l = true; else r = true; } G.input.l = l; G.input.r = r; $('tl').classList.toggle('on', l); $('tr').classList.toggle('on', r); };
  let swX = null;
  tl.addEventListener('pointerdown', e => { if (G.state === 'garage') swX = e.clientX; e.preventDefault(); ptrs.set(e.pointerId, e.clientX); try { tl.setPointerCapture(e.pointerId); } catch (_) { } upd(); AUD.init(); });
  tl.addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) { ptrs.set(e.pointerId, e.clientX); upd(); } });
  const end = e => { if (G.state === 'garage' && swX !== null && e.type === 'pointerup') { const dx = e.clientX - swX; if (Math.abs(dx) > 40) garStep(dx < 0 ? 1 : -1); } swX = null; ptrs.delete(e.pointerId); upd(); };
  tl.addEventListener('pointerup', end); tl.addEventListener('pointercancel', end); tl.addEventListener('lostpointercapture', end);
  window.addEventListener('keydown', e => {
    G.input.keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault();
    if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'play') pause(true);
    else if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'pause') pause(false);
    if (e.code === 'KeyM' && (G.state === 'play' || G.state === 'pause')) pause(G.state === 'play');
    if (G.state === 'garage') { if (e.code === 'ArrowLeft' || e.code === 'KeyA') garStep(-1); if (e.code === 'ArrowRight' || e.code === 'KeyD') garStep(1); if (e.code === 'Enter') garAction(); if (e.code === 'Escape') closeGarage(); }
  });
  window.addEventListener('keyup', e => { G.input.keys[e.code] = false; });
  window.addEventListener('blur', () => { G.input.keys = {}; ptrs.clear(); upd(); if (G.state === 'play') pause(true); });
}
function pause(on) {
  if (on && G.state === 'play') { G.state = 'pause'; $('pause').classList.add('on'); drawBigMap(); }
  else if (!on && G.state === 'pause') { G.state = 'play'; $('pause').classList.remove('on'); }
}

// ---------- title / menus ----------
let titleCar = SAVE.car;
const BORO_LABEL = { MANHATTAN: 'MANHATTAN', BROOKLYN: 'BROOKLYN', QUEENS: 'QUEENS', BRONX: 'THE BRONX', 'STATEN ISLAND': 'STATEN ISLAND' };
function renderTitle() {
  { const n = claimable(), b = $('misBadge'); if (b) { b.textContent = n; b.style.display = n ? 'inline-flex' : 'none'; } }
  const btn = $('playBtn');
  btn.textContent = loadingPct() < 1 ? 'LOADING NYC… ' + Math.round(loadingPct() * 100) + '%' : 'PLAY'; btn.disabled = loadingPct() < 1;
  $('bank').textContent = fmt$(SAVE.bank);
  $('best').textContent = SAVE.best ? 'BEST RUN ' + mmss(SAVE.best) : ''; $('best').style.visibility = SAVE.best ? 'visible' : 'hidden';
  $('boroName').textContent = BORO_LABEL[SAVE.boro] || SAVE.boro;
  document.querySelectorAll('#boros button').forEach(b => b.classList.toggle('sel', b.dataset.b === SAVE.boro));
  $('optNight').classList.toggle('sel', SAVE.night); $('optSound').classList.toggle('sel', SAVE.sound); $('optShadow').classList.toggle('sel', SAVE.shadows); $('optBlur').classList.toggle('sel', SAVE.blur !== false);
}
function loadingPct() { return G.P ? Math.min(1, WORLD.loadedAround(G.P.x, G.P.z, 1.6) / 0.999) : 0; }
function previewCar() {
  const P = G.P; if (!P) return;
  const keep = { x: P.x, z: P.z, h: P.h };
  const owned = SAVE.owned.includes(titleCar);
  const v = makeVehicle(titleCar, keep.x, keep.z, keep.h, { role: 'player', color: carColor(titleCar) });
  G.P = v;
}
function goTitle() {
  $('over').classList.remove('on'); $('pause').classList.remove('on');
  resetRun(); G.state = 'title'; titleCar = SAVE.car; spawnPlayer(SAVE.boro); $('title').classList.add('on'); $('hud').classList.remove('on'); renderTitle();
}
function startRun() {
  AUD.init();
  SAVE.car = titleCar; SAVE.stats.runs++; save();
  resetRun();
  const keep = G.P ? { x: G.P.x, z: G.P.z, h: G.P.h } : null;
  spawnPlayer(SAVE.boro);
  G.state = 'play'; $('title').classList.remove('on'); $('hud').classList.add('on'); $('over').classList.remove('on');
  G.hood = ''; G.hoodT = 0; G.spawnT = 2; G.civT = 0;
  bigMsg('ALL 5 BOROUGHS', 'cool'); toast('SMASH = HEAT · ⚙ GEARS = INSTANT REPAIR');
}
function setupMenus() {
  $('playBtn').onclick = () => { AUD.init(); titleCar = SAVE.car; startRun(); };
  $('garBtn').onclick = () => { AUD.init(); openGarage(); };
  $('setBtn').onclick = () => { renderTitle(); $('settings').classList.add('on'); };
  $('boroBtn').onclick = () => { renderTitle(); $('boroSheet').classList.add('on'); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).classList.remove('on'));
  document.querySelectorAll('.sheetov').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('on'); }));
  document.querySelectorAll('#boros button').forEach(b => b.onclick = () => { SAVE.boro = b.dataset.b; save(); spawnPlayer(SAVE.boro); previewCar(); renderTitle(); setTimeout(() => $('boroSheet').classList.remove('on'), 150); });
  $('garBack').onclick = () => closeGarage();
  $('garPrev').onclick = () => garStep(-1);
  $('garNext').onclick = () => garStep(1);
  $('garAct').onclick = () => garAction();
  $('garUp').onclick = () => garUpgrade();
  $('optNight').onclick = () => { SAVE.night = !SAVE.night; GFX.night = SAVE.night ? 1 : 0; save(); renderTitle(); };
  $('optSound').onclick = () => { SAVE.sound = !SAVE.sound; AUD.init(); AUD.setOn(SAVE.sound); save(); renderTitle(); };
  $('optBlur').onclick = () => { SAVE.blur = SAVE.blur === false; save(); renderTitle(); };
  $('optShadow').onclick = () => { SAVE.shadows = !SAVE.shadows; GFX.shadowOn = SAVE.shadows; save(); renderTitle(); };
  $('againBtn').onclick = () => { $('over').classList.remove('on'); titleCar = SAVE.car; startRun(); };
  $('menuBtn').onclick = () => { goTitle(); openGarage(); };
  $('pauseBtn').onclick = () => pause(G.state === 'play');
  $('resumeBtn').onclick = () => pause(false);
  $('quitBtn').onclick = () => goTitle();
  $('mini').onclick = () => pause(true);
  $('misBtn').onclick = () => { AUD.init(); openMissions(true); };
  $('misClose').onclick = () => openMissions(false);
  $('engineBtn').onclick = () => buyUpgrade('engine');
  $('armorBtn').onclick = () => buyUpgrade('armor');
  $('pNight').onclick = () => { SAVE.night = !SAVE.night; GFX.night = SAVE.night ? 1 : 0; save(); };
}

// ---------- main loop ----------
let last = 0, acc = 0, fpsT = 0, fpsN = 0, lowFps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const t = now / 1000; let dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; G.t = t;
  const P = G.P;
  if (P) WORLD.update(P.x, P.z);
  if (G.state === 'play') {
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 4) { stepPlay(1 / 60); acc -= 1 / 60; n++; }
    if (n === 4) acc = 0;
    updateWorldRules(dt);
  } else if (G.state === 'over') {
    acc += dt * 0.5; while (acc >= 1 / 60) { G.P.thr = 0; G.P.steer = 0; stepPlay(1 / 60); acc -= 1 / 60; }
  } else if (G.state === 'title') {
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) renderTitle();
  }
  if (G.state !== 'pause') { updateParts(dt); updateBoats(dt); }
  GFX.resize(G.renderScale);
  render(t, dt);
  if (G.state === 'play' || G.state === 'over') {
    if ((fpsN & 1) === 0) drawMini(t);
    updateHUD(t);
    const nc = nearestCopDist(P.x, P.z);
    AUD.update(vSpeed(P), G.stars > 0 ? Math.max(0, 1 - nc / 55) : 0, t, G.state === 'play');
  } else AUD.update(0, 0, t, false);
  if (FPSBOX) fpsOverlay(now, dt);
  // adaptive resolution
  fpsT += dt; fpsN++;
  if (fpsT > 2) {
    const fps = fpsN / fpsT;
    if (G.state === 'play' && !G.noAdapt) {
      // Sharpness first: shadows get cheaper before the picture gets softer, and on retina phones the
      // render scale only drops below 1.5x if the game is genuinely struggling (< 26 fps). A 30 fps cap
      // (iPhone Low Power Mode) therefore settles at 1.5x instead of a blurry 1x. Recovers when fast again.
      const hiFloor = G.maxScale >= 2 ? 1.5 : 1;
      if (fps < 26 && G.renderScale > 1) { G.renderScale = Math.max(1, G.renderScale - 0.25); G.goodN = 0; }
      else if (fps < 50) {
        G.goodN = 0;
        if (GFX.shadowOn && GFX.shadowSize > 1024) GFX.setShadowSize(1024);
        else if (G.renderScale > hiFloor) G.renderScale = Math.max(hiFloor, G.renderScale - 0.25);
      } else if (fps > 57 && G.renderScale < G.maxScale && ++G.goodN >= 3) { G.renderScale = Math.min(G.maxScale, G.renderScale + 0.25); G.goodN = 0; }
    }
    fpsT = 0; fpsN = 0; G.fps = fps;
  }
}

// ---------- GARAGE: 3D showroom off the map, floating cars on pedestals, upgradable look ----------
// The scene is built from the same instanced boxes as the city, out past the map edge (no chunks there),
// rebuilt every frame into the dynamic buffer. SAVE.gar = garage level owned (0..3).
const GARAGES = [
  { name: 'STREET LOT', price: 0 },
  { name: 'BROOKLYN GARAGE', price: 5000 },
  { name: 'CASH RULES SHOWROOM', price: 20000 },
  { name: 'PENTHOUSE GARAGE', price: 60000 },
];
SAVE.gar = SAVE.gar || 0;
const GX = -3200, GZ = -3200, GSP = 4.6; // garage origin (off-map) and spacing between cars
const GAR = { idx: 0, camX: 0, cars: [], spin: 0 };
function openGarage() {
  $('title').classList.remove('on'); ['settings', 'boroSheet', 'missions'].forEach(k => $(k).classList.remove('on'));
  G.state = 'garage';
  GAR.idx = Math.max(0, PLAYER_CARS.indexOf(SAVE.car)); GAR.camX = GAR.idx * GSP; GAR.spin = 0;
  GAR.cars = PLAYER_CARS.map((k, i) => { const v = makeVehicle(k, GX + i * GSP, GZ, 0, { role: 'player', color: carColor(k) }); v.ai = {}; return v; });
  $('garage').classList.add('on'); renderGarage();
}
function closeGarage() {
  $('garage').classList.remove('on'); G.state = 'title'; titleCar = SAVE.car; previewCar();
  $('title').classList.add('on'); renderTitle();
}
function garStep(d) { GAR.idx = (GAR.idx + d + PLAYER_CARS.length) % PLAYER_CARS.length; GAR.spin = 0; AUD.blip(500, 700, 0.06, 'square', 0.03); renderGarage(); }
function garAction() {
  const k = PLAYER_CARS[GAR.idx], m = MODELS[k];
  if (!SAVE.owned.includes(k)) {
    if (SAVE.bank < m.price) return;
    SAVE.bank -= m.price; SAVE.owned.push(k); AUD.cash(); flash('#e8b923');
  }
  if (SAVE.car !== k) { SAVE.car = k; SAVE.color = null; titleCar = k; AUD.blip(300, 900, 0.2, 'square', 0.05); }
  save(); renderGarage();
}
function garUpgrade() {
  const nx = GARAGES[SAVE.gar + 1]; if (!nx || SAVE.bank < nx.price) return;
  SAVE.bank -= nx.price; SAVE.gar++; save(); AUD.cash(); flash('#1fd65f'); bigMsg(GARAGES[SAVE.gar].name, 'cool'); renderGarage();
}
function renderGarage() {
  const k = PLAYER_CARS[GAR.idx], m = MODELS[k], owned = SAVE.owned.includes(k), cur = SAVE.car === k;
  $('garBank').textContent = fmt$(SAVE.bank); $('garTier').textContent = GARAGES[SAVE.gar].name;
  $('garName').innerHTML = m.name + `<small>${cur ? 'YOUR RIDE' : owned ? 'OWNED' : 'LOCKED'} · ${GAR.idx + 1}/${PLAYER_CARS.length}</small>`;
  const bars = [['SPEED', (m.maxV - 18) / 12], ['GRIP', (m.turn - 2) / 1.0], ['ARMOR', m.hp / 220]];
  $('garStats').innerHTML = bars.map(b => `<div class="stat"><span>${b[0]}</span><i><b style="width:${Math.round(Math.min(1, Math.max(0.08, b[1])) * 100)}%"></b></i></div>`).join('');
  const a = $('garAct'); a.className = 'btn' + (cur ? ' cur' : owned ? '' : ' buy');
  a.textContent = cur ? 'SELECTED ✓' : owned ? 'DRIVE THIS' : 'BUY ' + fmt$(m.price); a.disabled = !cur && !owned && SAVE.bank < m.price;
  for (const u of ['engine', 'armor']) { const lv = SAVE.up[u], c = upCost(u), b = $(u + 'Btn'); b.innerHTML = `${u === 'engine' ? 'ENGINE' : 'ARMOR'} <small>LV ${lv}/3</small> <b>${lv >= 3 ? 'MAX' : fmt$(c)}</b>`; b.disabled = lv >= 3 || SAVE.bank < c; }
  const nx = GARAGES[SAVE.gar + 1], g = $('garUp');
  if (nx) { g.textContent = 'UPGRADE GARAGE → ' + nx.name + ' · ' + fmt$(nx.price); g.disabled = SAVE.bank < nx.price; } else { g.textContent = 'TOP-TIER GARAGE ✓'; g.disabled = true; }
  for (const v of GAR.cars) v.dim = SAVE.owned.includes(v.kind) ? 0 : 0.3;
}
function renderGarage3D(t, dt) {
  const cv = GFX.canvas, asp = cv.clientWidth / Math.max(1, cv.clientHeight), portrait = asp < 1;
  GAR.camX += (GAR.idx * GSP - GAR.camX) * Math.min(1, dt * 6); GAR.spin += dt;
  const fov = portrait ? Math.min(70, 2 * Math.atan(Math.tan(19 * Math.PI / 180) / asp) * 180 / Math.PI) : 40;
  // showroom framing: closer three-quarter view, slightly low, so the silhouette and wheels read
  const tx = GX + GAR.camX + (portrait ? 0.15 : 2.4), tz = GZ, ty = portrait ? -0.45 : 0.5; // landscape: car sits left of the side panel
  const eye = portrait ? [tx + 2.4, 2.15, tz + 5.7] : [tx + 2.4, 2.4, tz + 6.5];
  // studio key light from the camera side (warm), cooler fill; night keeps the garage moody
  const N = GFX.night, L = { sun: norm3([0.42, 0.8, 0.6]), sunCol: N ? [0.42, 0.42, 0.5] : [0.82, 0.78, 0.72], amb: N ? [0.32, 0.34, 0.44] : [0.5, 0.53, 0.6], fog: (GFX.night ? LIGHT.night : LIGHT.day).fog };
  buildDynamic(t); GFX.setDyn(DYN.data, DYN.n, 0);
  const bills = [];
  if (SAVE.gar === 2) bills.push([tx - (tx - GX) + 9.2, 5.2, GZ - 5.35, 7.5, 3.6, 0, 1, 0], [GX - 2.5, 4.6, GZ - 5.35, 5, 2.4, 0, 1, 4], [GX + 20.9, 4.6, GZ - 5.35, 5, 2.4, 0, 1, 6]);
  GFX.render({
    eye, target: [tx, ty, tz], fov: fov * Math.PI / 180, near: 0.5, far: 260,
    sunDir: L.sun, sunCol: L.sunCol, amb: L.amb, fogCol: SAVE.gar === 3 ? L.fog : GFX.night ? [0.03, 0.035, 0.05] : [0.1, 0.11, 0.13], waterCol: [0.08, 0.08, 0.1],
    fog: [90, 250], time: t, shadowCenter: [GX + GAR.camX, 0, tz], shadowHalf: 14,
    chunks: [], statics: [], bills, billTex: BILL_TEX, sil: null, slice: null, studio: true,
  });
}
function garageScene(t) {
  const lv = SAVE.gar, q0 = qYaw(0), W = (PLAYER_CARS.length - 1) * GSP, cx = W / 2;
  const B = (x, y, z, sx, sy, sz, col, m, yaw) => dpush(GX + x, y, GZ + z, sx, sy, sz, yaw ? qYaw(yaw) : q0, col, m || 0);
  const H = hex;
  // room shell: floor, back wall, side walls
  const floor = [H('#2e3036'), H('#8c8a86'), H('#111317'), H('#e9e6df')][lv], fm = [0, 0, 6, 6][lv];
  B(cx, -0.05, 4, W + 30, 0.1, 30, floor, fm);
  if (lv === 0) { // STREET LOT: tenement walls with lit windows, fence, cones, lamp
    B(cx, 5, -7.5, W + 30, 10, 2, H('#7a3b2e'), 1); B(-11, 5, 4, 2, 10, 26, H('#6b5a4e'), 1); B(W + 11, 5, 4, 2, 10, 26, H('#5a4c48'), 1);
    for (let x = -8; x <= W + 8; x += 2.6) B(x, 1.1, -5, 0.1, 2.2, 0.1, H('#8d9196'));
    for (const y of [0.4, 1.3, 2.15]) B(cx, y, -5, W + 16, 0.06, 0.06, H('#8d9196'));
    for (let i = 0; i <= PLAYER_CARS.length; i++) B(i * GSP - GSP / 2, 0.01, 0.6, 0.12, 0.02, 4.2, H('#e8e8e8'));
    B(-6, 0.6, -3.6, 2.2, 1.2, 1.2, H('#1f6f43')); B(-6, 1.25, -3.6, 2.3, 0.1, 1.3, H('#185a35'));
    for (const x of [-4.2, W + 4.4, W + 5.2]) B(x, 0.2, 2.5, 0.25, 0.4, 0.25, H('#f07c1e'));
    B(W + 6.5, 2.4, -3.8, 0.12, 4.8, 0.12, H('#4d535b')); B(W + 6.1, 4.75, -3.8, 0.9, 0.1, 0.2, H('#4d535b')); B(W + 5.8, 4.65, -3.8, 0.4, 0.12, 0.3, H('#fff2b0'), 5);
  } else if (lv === 1) { // BROOKLYN GARAGE: brick, beams, tube lights, tool wall, tyres, drums
    B(cx, 5, -6, W + 30, 10, 1, H('#8e4632')); B(-10, 5, 4, 1, 10, 26, H('#7d3e2c')); B(W + 10, 5, 4, 1, 10, 26, H('#7d3e2c'));
    for (let y = 0.6; y < 9; y += 1.2) B(cx, y, -5.48, W + 28, 0.06, 0.04, H('#a85a40'));
    for (let x = -6; x <= W + 6; x += 6) B(x, 8.6, 4, 0.4, 0.5, 26, H('#2b2d33'));
    for (let x = -3; x <= W + 3; x += 6) { B(x, 7.4, 1.5, 0.25, 0.08, 3.4, H('#ffffff'), 2); B(x, 7.6, 1.5, 0.05, 0.4, 0.05, H('#2b2d33')); }
    B(-4.5, 2.6, -5.4, 4, 2.6, 0.12, H('#3a3f46'));
    for (let k = 0; k < 9; k++) B(-6 + (k % 3) * 1.2 + 0.4, 1.8 + Math.floor(k / 3) * 0.8, -5.3, 0.15 + (k % 2) * 0.2, 0.5, 0.06, [H('#c0392b'), H('#8f9aa6'), H('#f2b01e')][k % 3]);
    B(-4.5, 0.55, -4.6, 1.8, 1.1, 0.8, H('#c0392b')); B(-4.5, 1.12, -4.6, 1.85, 0.04, 0.85, H('#8f9aa6'));
    for (let k = 0; k < 4; k++) B(W + 5, 0.15 + k * 0.3, -3.6, 0.95, 0.28, 0.95, H('#1b1b1d'));
    for (let k = 0; k < 3; k++) B(W + 6.6, 0.5, -1.5 + k * 1.1, 0.8, 1.0, 0.8, H('#2b5fb3'));
    for (let i = 0; i < 4; i++) B(i * GSP + 2.3, 0.01, 2.6 + (i % 2), 0.9, 0.02, 0.6, H('#6f6d69'));
  } else if (lv === 2) { // CASH RULES SHOWROOM: black gloss, green neon, gold trim, brand boards
    B(cx, 5, -6, W + 30, 10, 1, H('#0d0f12')); B(-10, 5, 4, 1, 10, 26, H('#0d0f12')); B(W + 10, 5, 4, 1, 10, 26, H('#0d0f12'));
    for (const y of [0.15, 8.2]) B(cx, y, -5.45, W + 28, 0.12, 0.06, H('#1fd65f'), 2);
    B(cx, 0.03, -4.6, W + 26, 0.04, 0.1, H('#1fd65f'), 2); B(cx, 0.03, 7, W + 26, 0.04, 0.1, H('#1fd65f'), 2);
    B(cx, 0.06, -4.3, W + 26, 0.04, 0.06, H('#e8b923'), 2);
    for (let x = -6; x <= W + 6; x += 4.6) { B(x, 8.8, 0, 0.3, 0.3, 14, H('#1b1c20')); B(x, 8.5, 1.2, 0.35, 0.35, 0.35, H('#fff7d6'), 2); }
  } else { // PENTHOUSE GARAGE: marble, floor-to-ceiling windows on the skyline, gold, plants
    B(cx, 0.6, -5.6, W + 30, 1.2, 0.4, H('#d8d2c4')); B(cx, 9.0, -5.6, W + 30, 0.6, 0.6, H('#d8d2c4'));
    for (let x = -12; x <= W + 12; x += 3.2) B(x, 4.8, -5.6, 0.18, 8.4, 0.25, H('#1b1c20'));
    B(cx, 1.25, -5.4, W + 28, 0.06, 0.08, H('#e8b923'), 2);
    B(-10, 5, 4, 1, 10, 26, H('#e9e6df')); B(W + 10, 5, 4, 1, 10, 26, H('#e9e6df'));
    const R = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let k = 0; k < 26; k++) { const x = -30 + k * 3.4 + Math.abs(R(k)) * 2, h = 12 + Math.abs(R(k + 7)) * 30, z = -24 - Math.abs(R(k + 3)) * 40; B(x, h / 2 - 10, z, 2.6 + Math.abs(R(k + 1)) * 2, h, 2.6, k % 3 ? H('#8ea2b5') : H('#5d86a8'), k % 3 ? 1 : 7); }
    for (const x of [-6, W + 6]) { B(x, 0.4, -3.5, 0.9, 0.8, 0.9, H('#e8b923'), 6); B(x, 1.35, -3.5, 1.2, 1.2, 1.2, H('#3f9e45')); }
    B(cx, 0.03, 6.5, W + 6, 0.02, 0.3, H('#e8b923'), 6);
  }
  // pedestals: glossy turntable with chrome edge and LED ring (rotates with the car), light pool on the floor; cars hover just above
  const led = [H('#f2b01e'), H('#ff9f1a'), H('#1fd65f'), H('#e8b923')][lv], plinth = [H('#1b1c20'), H('#2b2d33'), H('#0c0d0f'), H('#f4f1e8')][lv];
  GAR.cars.forEach((v, i) => {
    const x = i * GSP, sel = i === GAR.idx, owned = SAVE.owned.includes(v.kind), ring = owned ? led : H('#7a2a2a');
    const rot = sel ? GAR.spin * 0.45 : 0;
    const disc = (R, y, h, col, m, off) => { const N = 30, cw = 2 * R * Math.sin(Math.PI / N) + 0.04; for (let k = 0; k < N; k++) { const a = (k + 0.5) / N * Math.PI * 2 + (off || 0); B(x + Math.cos(a) * R / 2, y, Math.sin(a) * R / 2, R, h, cw, col, m, -a); } };
    if (sel) disc(2.6, 0.012, 0.01, lv === 3 ? H('#fffaf0') : ring.map(c => c * 0.22), 2);        // light pool
    disc(1.85, 0.1, 0.2, plinth, lv === 3 ? 6 : 0);                                              // plinth
    for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; B(x + Math.cos(a) * 1.86, 0.2, Math.sin(a) * 1.86, 0.4, 0.035, 0.06, H('#d4d8dd'), 6, -a + Math.PI / 2); } // chrome edge
    const top = [H('#2a2c31'), H('#5b5f66'), H('#121417'), H('#e9e6df')][lv];
    disc(1.7, 0.215, 0.03, top, 6, rot);                                                         // glossy turntable top
    // soft contact shadow under the car: three stacked rounded pads, darkest in the middle
    [[1.34, 2.6, 0.62], [1.2, 2.38, 0.42], [1.04, 2.1, 0.24]].forEach(([w, l, k], n) => B(x, 0.233 + n * 0.002, 0, w, 0.004, l, top.map(c => c * k), 3, Math.PI - (sel ? 2.4 + rot : 2.25)));
    for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2 + rot; B(x + Math.cos(a) * 1.55, 0.235, Math.sin(a) * 1.55, 0.2, 0.012, 0.05, ring, 2, -a + Math.PI / 2); } // LED ring
    v.x = GX + x; v.z = GZ; v.y = 0.24; // sits on the turntable
    v.h = sel ? 2.4 + rot : 2.25; v.roll = 0; v.pitch = 0; v.vx = v.vz = 0;
    pushVehicle(v, t);
  });
}

// ---------- ?fps=1 overlay (for measuring on real phones) ----------
let FPSBOX = null;
const FPSD = { t: 0, n: 0, worst: 0, last: 0 };
try { if (/[?&]fps\b/.test(location.search)) { FPSBOX = document.createElement('div'); FPSBOX.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(4px + env(safe-area-inset-top,0px));z-index:50;font:600 11px/1.35 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,.65);padding:4px 8px;border-radius:6px;pointer-events:none;white-space:pre;text-align:center'; document.body.appendChild(FPSBOX); } } catch (e) { }
function fpsOverlay(now, dt) {
  const ms = FPSD.last ? now - FPSD.last : 16.7; FPSD.last = now;
  FPSD.t += ms; FPSD.n++; FPSD.worst = Math.max(FPSD.worst, ms);
  if (FPSD.t < 500) return;
  const fps = 1000 * FPSD.n / FPSD.t, st = GFX.stat || { inst: 0, calls: 0 }, c = GFX.canvas;
  FPSBOX.textContent = `${fps.toFixed(0)} fps · worst ${FPSD.worst.toFixed(0)} ms\n${c.width}×${c.height} @${G.renderScale.toFixed(2)} · shadow ${GFX.shadowOn ? GFX.shadowSize : 'off'}\n${st.inst} boxes · ${st.calls} draws · ${WORLD.chunks.size} chunks`;
  FPSD.t = 0; FPSD.n = 0; FPSD.worst = 0;
}

// ---------- boot ----------
function boot() {
  buildMap(); initWorldData(); initBoats();
  const cv = $('gl');
  let ok = false;
  try { ok = GFX.init(cv); } catch (e) { console.error(e); $('err').textContent = 'Graphics error: ' + e.message; $('err').style.display = 'block'; return; }
  if (!ok) { $('err').innerHTML = 'This game needs WebGL2. Try Safari 15+ or Chrome.'; $('err').style.display = 'block'; return; }
  G.maxScale = Math.min(window.devicePixelRatio || 1, 2); G.renderScale = G.maxScale; G.goodN = 0;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 700;
  if (mobile) GFX.setShadowSize(1536);
  GFX.shadowOn = SAVE.shadows; GFX.night = SAVE.night ? 1 : 0;
  BILL_TEX = GFX.makeTex(makeBillboards(), 1024, 1024, false, true);
  ICON_TEX = GFX.makeTex(makeIconAtlas(), 1024, 128, false, true);
  buildVehicleMeshes();
  STATIC_BR = GFX.makeInst(buildBridgeGeometry());
  MAPC = makeMapCanvas();
  const mini = $('mini'); mini.width = mini.height = Math.round(mini.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || 260;
  WORLD.initWorkers($('shared').textContent);
  setupInput(); setupMenus();
  goTitle();
  requestAnimationFrame(frame);
  window.__G = G;
  window.__sim = (sec, steer) => {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) {
      if (G.state !== 'play') break;
      if (steer !== undefined) { G.input.l = steer < 0; G.input.r = steer > 0; }
      stepPlay(1 / 60); updateWorldRules(1 / 60); updateParts(1 / 60); updateBoats(1 / 60);
    }
    G.input.l = G.input.r = false;
    WORLD.update(G.P.x, G.P.z);
  };
}
window.addEventListener('load', boot);
// Add to Home Screen / offline: only on a real https host (Netlify). Skipped for file:// and sandboxed previews.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
