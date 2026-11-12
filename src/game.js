// ============================================================
//  CASH RULES NYC: WANTED — game loop, rules, UI, audio
// ============================================================
const $ = (id) => document.getElementById(id);
const CAM_AZ = -16 * Math.PI / 180;
// Steeper than the original 60deg: closer to the classic top-down city chase look, so towers
// lean away from the car instead of across it. Anything still in the way gets sliced (gl.js).
const CAM_PITCH = 66 * Math.PI / 180;
const STAR_HEAT = [1, 16, 40, 80, 140];
const COPS_FOR = [0, 2, 3, 5, 6, 8];
const fmt$ = (n) => '$' + Math.floor(n).toLocaleString('en-US');

// ---------- save ----------
const SAVE_KEY = 'crnyc_wanted_v1';
let SAVE = { bank: 250, owned: ['sedan'], car: 'sedan', color: null, up: { engine: 0, armor: 0 }, best: 0, night: false, sound: true, shadows: true, boro: 'MANHATTAN' };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) SAVE = Object.assign(SAVE, s); } catch (e) { }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }

// ---------- game state ----------
const G = {
  state: 'boot', t: 0, P: null, cops: [], civs: [], wrecks: [], pickups: [], heat: 0, stars: 0, maxStars: 0, runCash: 0, runTime: 0, wrecked: 0,
  bust: 0, grace: 0, spawnT: 0, civT: 0, pickT: 0, shop: null, shopT: 0, heli: null, shake: 0, hoodT: 0, hood: '', toastT: 0,
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
function addCash(n, x, z) { G.runCash += n; SAVE.bank += n; popCash(n); }
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
function nearestShop(x, z) { let best = null, bd = 1e9; for (const s of SHOPS) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return [best, bd]; }
function nearestCopDist(x, z) { let bd = 1e9; for (const c of G.cops) if (c.alive && !c.wreck && c.sink === 0 && !c.ai.lost) bd = Math.min(bd, Math.hypot(c.x - x, c.z - z)); return bd; }

// ---------- player ----------
function playerStats() {
  const m = MODELS[SAVE.car];
  return { maxV: m.maxV * (1 + SAVE.up.engine * 0.06), hp: Math.round(m.hp * (1 + SAVE.up.armor * 0.22)) };
}
function spawnPlayer(boro) {
  const ll = GEO.SPAWNS[boro] || GEO.SPAWNS.MANHATTAN, p = P(ll[0], ll[1]);
  const r = findRoad(p[0], p[1], 40);
  const v = makeVehicle(SAVE.car, r.x, r.z, r.h, { role: 'player', color: SAVE.color ? SAVE.color.slice() : MODELS[SAVE.car].color.slice() });
  const st = playerStats(); v.maxV = st.maxV; v.hp = v.maxHp = st.hp;
  G.P = v; G.cam.x = G.cam.tx = v.x; G.cam.z = G.cam.tz = v.z;
  return v;
}
function resetRun() {
  G.cops = []; G.civs = []; G.wrecks = []; G.pickups = []; PARTS.length = 0; G.heat = 0; G.stars = 0; G.maxStars = 0; G.runCash = 0; G.runTime = 0; G.wrecked = 0;
  G.bust = 0; G.grace = 2; G.heli = null; G.fountains = []; G.shop = null;
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
    const t = tileAt(x, z); if (t !== T_ROAD && t !== T_WALK && t !== T_PARK && t !== T_PLAZA) continue;
    if (WORLD.pointBlocked(x, z, 0.6)) continue;
    const big = Math.random() < 0.08;
    G.pickups.push({ x, z, v: big ? 250 : 20 + Math.floor(Math.random() * 5) * 10, big, t: Math.random() * 6 });
    return;
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
  if (v.role === 'cop') { G.wrecked++; addHeat(10); addCash(100); toast('COP WRECKED +$100'); }
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

// ---------- shops ----------
function shopLocal(s, x, z) { const dx = x - s.x, dz = z - s.z, g = s.g; return [dx * g.ex + dz * g.ez, (dx * g.dx + dz * g.dz) * s.sd]; }
function updateShops(dt) {
  const P = G.P, nc = nearestCopDist(P.x, P.z);
  DYNCOLS.length = 0;
  G.nearShop = null;
  for (const s of SHOPS) {
    const d = Math.hypot(s.x - P.x, s.z - P.z);
    if (s.doorY === undefined) s.doorY = 1;
    const hot = G.stars > 0 && nc < 9;
    const open = G.state === 'shop' ? false : !hot;
    s.doorY += ((open ? 1 : 0) - s.doorY) * Math.min(1, dt * 5);
    if (d > 70) continue;
    const g = s.g, bayW = 3.2, fv = s.bv / 2 - 0.05;
    const c = gWorld(g, (s.i + 0.5) * g.A, (s.j + 0.5) * g.S + s.sd * fv);
    DYNCOLS.push({ on: s.doorY < 0.5, c: [c[0], c[1], Math.cos(s.yaw), -Math.sin(s.yaw), bayW / 2, 0.12, 3] });
    if (d < 16) G.nearShop = { s, hot, d };
    if (G.state === 'play' && d < 8) {
      const l = shopLocal(s, P.x, P.z);
      if (Math.abs(l[0]) < 1.5 && l[1] < s.bv / 2 - 0.4 && l[1] > -s.bv / 2 + 0.3 && s.doorY > 0.5) enterShop(s);
    }
  }
}
function enterShop(s) {
  const P = G.P;
  G.state = 'shop'; G.shop = s; G.shopT = 0;
  P.vx = P.vz = 0; P.spin = 0; P.thr = 0; P.steer = 0;
  const c = gWorld(s.g, (s.i + 0.5) * s.g.A, (s.j + 0.5) * s.g.S);
  P.x = c[0]; P.z = c[1];
  P.h = Math.atan2(-s.g.dx * s.sd, s.g.dz * s.sd);
  AUD.blip(300, 120, 0.4, 'sawtooth', 0.05);
  setTimeout(() => openShopUI(), 700);
}
const PAINTS = [['CASH GREEN', '#1fd65f'], ['TAXI YELLOW', '#f7c412'], ['MIDNIGHT', '#14161c'], ['CANDY RED', '#d3202a'], ['ICE WHITE', '#f4f6f8'], ['ROYAL BLUE', '#1f4fd8'],
['GOLD RUSH', '#d4a017'], ['GRAPE', '#6c2bd9'], ['GUNMETAL', '#4a5059'], ['SUNSET', '#ff7a1a'], ['HOT PINK', '#ff3ea5'], ['TEAL', '#0fb5ae']];
function serviceCost(kind) {
  const P = G.P;
  if (kind === 'paint') return 120 + G.stars * 100;
  if (kind === 'fix') return 60 + Math.round((P.maxHp - P.hp) * 1.6) + G.stars * 40;
  return 0;
}
function openShopUI() {
  if (G.state !== 'shop') return;
  const s = G.shop, P = G.P, el = $('shop');
  el.classList.add('on'); $('hud').classList.remove('on');
  $('shopName').textContent = 'CASH RULES CUSTOMS · ' + s.name;
  renderShopUI();
}
function renderShopUI() {
  const P = G.P, wanted = G.stars > 0;
  $('shopHeat').innerHTML = wanted ? `<span class="hotstars">${'★'.repeat(G.stars)}${'☆'.repeat(5 - G.stars)}</span> HEAT ON YOU — PAINT OR FIX TO LOSE IT` : '<span class="cool">NO HEAT</span> — CUSTOMIZE YOUR RIDE';
  $('shopWallet').textContent = fmt$(SAVE.bank);
  const pc = serviceCost('paint'), fc = serviceCost('fix');
  $('paintCost').textContent = fmt$(pc); $('fixCost').textContent = fmt$(fc);
  $('fixHp').style.width = Math.round(P.hp / P.maxHp * 100) + '%';
  $('fixBtn').disabled = SAVE.bank < fc || (P.hp >= P.maxHp && !wanted);
  $('fixBtn').textContent = P.hp >= P.maxHp && !wanted ? 'MINT CONDITION' : (SAVE.bank < fc ? 'NEED ' + fmt$(fc) : 'REPAIR ' + fmt$(fc));
  const sw = $('swatches'); sw.innerHTML = '';
  for (const p of PAINTS) {
    const b = document.createElement('button'); b.className = 'sw'; b.style.background = p[1]; b.title = p[0];
    b.disabled = SAVE.bank < pc;
    b.onclick = () => doService('paint', p[1], p[0]);
    sw.appendChild(b);
  }
  $('paintNote').textContent = SAVE.bank < pc ? 'NEED ' + fmt$(pc) + ' FOR A RESPRAY' : 'TAP A COLOR · NEW PAINT + PLATES';
  for (const k of ['engine', 'armor']) {
    const lv = SAVE.up[k], cost = upCost(k);
    $(k + 'Lv').textContent = 'LV ' + lv + '/3';
    const b = $(k + 'Btn'); b.disabled = lv >= 3 || SAVE.bank < cost; b.textContent = lv >= 3 ? 'MAXED' : 'UPGRADE ' + fmt$(cost);
  }
}
function upCost(k) { const lv = SAVE.up[k]; return k === 'engine' ? [700, 1500, 3000][lv] || 0 : [500, 1100, 2400][lv] || 0; }
function doService(kind, color, name) {
  const P = G.P, cost = serviceCost(kind);
  if (SAVE.bank < cost) return;
  SAVE.bank -= cost; G.runCash -= cost;
  const wasWanted = G.stars > 0;
  if (kind === 'paint') { P.color = hex(color); SAVE.color = P.color.slice(); AUD.spray(); flash('#ffffff'); burstPaint(P, P.color); }
  if (kind === 'fix') { P.hp = P.maxHp; AUD.blip(200, 600, 0.3, 'square', 0.05); flash('#9effa0'); }
  if (wasWanted) clearWanted(kind === 'paint' ? 'FRESH PAINT — COPS LOST YOUR DESCRIPTION' : 'FRESH TAGS — WANTED LEVEL CLEARED');
  save(); renderShopUI();
}
function buyUpgrade(k) {
  const c = upCost(k); if (SAVE.up[k] >= 3 || SAVE.bank < c) return;
  SAVE.bank -= c; SAVE.up[k]++; save();
  const st = playerStats(), P = G.P; const ratio = P.hp / P.maxHp; P.maxV = st.maxV; P.maxHp = st.hp; P.hp = Math.round(st.hp * ratio);
  AUD.blip(300, 900, 0.25, 'square', 0.05); renderShopUI();
}
function clearWanted(msg) {
  G.heat = 0; G.stars = 0; G.bust = 0;
  for (const c of G.cops) c.ai.lost = true;
  if (G.heli) G.heli.leaving = true;
  bigMsg('WANTED LEVEL CLEARED', 'cool'); toast(msg);
}
function burstPaint(P, col) { for (let i = 0; i < 4; i++) puff(P.x, 0.6 + i * 0.3, P.z, col, 6, { size: 0.35, v: 3, vy: 1, life: 1.4, g: -0.2, spread: 1.6 }); }
function leaveShop() {
  const s = G.shop, P = G.P; if (!s) return;
  $('shop').classList.remove('on'); $('hud').classList.add('on');
  const c = gWorld(s.g, (s.i + 0.5) * s.g.A, (s.j + 0.5) * s.g.S + s.sd * (s.bv / 2 + s.g.sw + s.g.ws * 0.5));
  P.x = c[0]; P.z = c[1];
  // face along the street
  P.h = Math.atan2(s.g.ex, -s.g.ez) + (Math.random() < 0.5 ? Math.PI : 0);
  const r = findRoad(P.x, P.z, 4); if (r) { P.x = r.x; P.z = r.z; }
  P.vx = Math.sin(P.h) * 4; P.vz = -Math.cos(P.h) * 4;
  G.state = 'play'; G.shop = null; G.grace = G.stars === 0 ? 4 : 0; G.godT = 1.5;
  save();
}

// ---------- outcomes ----------
function gameOver(kind) {
  if (G.state === 'over' || G.state === 'title') return;
  G.state = 'over';
  const t = G.runTime, best = Math.max(SAVE.best, t); const newBest = t > SAVE.best + 0.5; SAVE.best = best;
  let extra = '';
  if (kind === 'busted') { const bail = Math.min(SAVE.bank, 50 + G.stars * 25); SAVE.bank -= bail; extra = `<div class="bail">BAIL POSTED −${fmt$(bail)}</div>`; }
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
      else if (v.role === 'cop') { toast('COP TOOK A SWIM +$100'); addCash(100); G.wrecked++; }
    }
  }
}
function updateWorldRules(dt) {
  const P = G.P;
  // heat & stars
  if (G.stars > 0) G.heat = Math.min(240, G.heat + dt * 0.45);
  const ns = starsFor(G.heat);
  if (ns > G.stars) { AUD.star(); bigMsg('★'.repeat(ns), 'stars'); if (G.stars === 0) toast('NYPD IS ON YOU — HIT A CASH RULES CUSTOMS TO LOSE THE HEAT'); }
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
    if (Math.hypot(p.x - P.x, p.z - P.z) < 1.7 && P.alive) { addCash(p.v); puff(p.x, 0.8, p.z, hex('#2ee66f'), 8, { size: 0.18, v: 3, vy: 3, life: 0.6, m: 2, g: 4 }); return false; }
    return Math.hypot(p.x - P.x, p.z - P.z) < 90;
  });
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
  // shops
  updateShops(dt);
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
  for (const L of LM) if (L.name && Math.hypot(L.x - x, L.z - z) < (L.nr || L.r + 9)) return L.name + '<small>LANDMARK</small>';
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
    if (f === 3) pq = qMul(q, qYaw(t * 28));
    else if (p[9]) pq = qMul(q, qAxis(1, 0, 0, p[9]));
    const o = qRot(q, [p[0], p[1], p[2]]);
    dpush(v.x + o[0], v.y + o[1] + (v.lift || 0), v.z + o[2], p[3], p[4], p[5], pq, col, m);
  }
}
function buildDynamic(t) {
  DYN.n = 0;
  const P = G.P;
  if (P) pushVehicle(P, t);
  const silN = DYN.n;
  for (const v of G.cops) pushVehicle(v, t);
  for (const v of G.civs) pushVehicle(v, t);
  for (const v of G.wrecks) pushVehicle(v, t);
  if (G.heli) { const H = G.heli; pushVehicle({ x: H.x, y: H.y, z: H.z, h: H.h, m: MODELS.heli, color: VC.white, role: 'cop', ai: {}, roll: 0, pitch: 0.12 }, t); }
  // pickups
  for (const p of G.pickups) {
    const q = qYaw(p.t * 2.2), y = 0.65 + Math.sin(p.t * 3) * 0.12;
    if (p.big) { dpush(p.x, y, p.z, 0.9, 0.6, 0.3, q, hex('#141414'), 0); dpush(p.x, y + 0.36, p.z, 0.4, 0.1, 0.12, q, hex('#d4a017'), 2); }
    else { dpush(p.x, y, p.z, 0.8, 0.22, 0.45, q, hex('#2ecc71'), 2); dpush(p.x, y, p.z, 0.22, 0.24, 0.47, q, hex('#f4f4f4'), 0); }
  }
  // shops: doors + beacons
  for (const s of SHOPS) {
    const d = P ? Math.hypot(s.x - P.x, s.z - P.z) : 999; if (d > 75) continue;
    const g = s.g, fv = s.bv / 2 - 0.05, dy = s.doorY === undefined ? 1 : s.doorY;
    const c = gWorld(g, (s.i + 0.5) * g.A, (s.j + 0.5) * g.S + s.sd * fv);
    const hgt = 2.6 * (1 - dy) + 0.25;
    const q = qYaw(s.yaw);
    dpush(c[0], 3.2 - hgt / 2 - 0.25, c[1], 3.2, hgt, 0.12, q, hex('#c9ccd1'), 0);
    for (let k = 0; k < 4; k++) if ((1 - dy) * 2.6 > k * 0.65 + 0.3) dpush(c[0], 3.2 - 0.3 - k * 0.65, c[1], 3.22, 0.05, 0.14, q, hex('#8a8e95'), 0);
    // beacon (rotating wrench-ish diamond)
    const top = gWorld(g, (s.i + 0.5) * g.A, (s.j + 0.5) * g.S);
    const bq = qMul(qYaw(t * 1.6), qAxis(0, 0, 1, Math.PI / 4)), hot = G.stars > 0;
    dpush(top[0], 7.4 + Math.sin(t * 2) * 0.3, top[1], 1.1, 1.1, 1.1, bq, hot ? hex('#1fd65f') : hex('#e8b923'), 2);
    // floor glow in bay
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    dpush(top[0], 0.05, top[1], 2.6, 0.04, s.bv - 1.2, q, hot ? [0.1, 0.5 + 0.4 * pulse, 0.25] : [0.6, 0.5, 0.1], 2);
  }
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
  } else if (G.state === 'shop') {
    G.shopT += dt; const s = G.shop;
    const out = gWorld(s.g, (s.i + 0.5) * s.g.A, (s.j + 0.5) * s.g.S + s.sd * (s.bv / 2 + 4));
    az = Math.atan2(s.x - out[0], -(s.z - out[1])) + Math.sin(G.shopT * 0.4) * 0.25; dist = portrait ? 26 : 17; pitch = 30 * Math.PI / 180;
    const fa = [Math.sin(az), -Math.cos(az)], k = portrait ? 11 : 3.5;
    tx = G.cam.tx = s.x - fa[0] * k; tz = G.cam.tz = s.z - fa[1] * k;
  }
  const f = [Math.sin(az), -Math.cos(az)];
  let ex = tx - f[0] * dist * Math.cos(pitch), ez = tz - f[1] * dist * Math.cos(pitch), ey = dist * Math.sin(pitch);
  let ty = G.state === 'shop' ? (portrait ? -3 : 0.5) : (G.state === 'title' ? 1.2 : 0);
  if (G.shake > 0) { const s = G.shake; ex += (Math.random() - 0.5) * s; ey += (Math.random() - 0.5) * s; ez += (Math.random() - 0.5) * s; G.shake = Math.max(0, G.shake - dt * 2.5); }
  const L = GFX.night ? LIGHT.night : LIGHT.day;
  const silN = buildDynamic(t);
  GFX.setDyn(DYN.data, DYN.n, silN);
  const chunks = []; for (const ch of WORLD.chunks.values()) chunks.push(ch);
  const bills = WORLD.bills();
  GFX.render({
    eye: [ex, ey, ez], target: [tx, ty, tz], fov: fov * Math.PI / 180, near: 1, far: 400,
    sunDir: L.sun, sunCol: L.sunCol, amb: L.amb, fogCol: L.fog, waterCol: L.water,
    fog: [dist * 1.7, dist * 3.0 + (portrait ? 20 : 0)], time: t, // pushed out: haze only at the far edge
    shadowCenter: [tx, 0, tz], shadowHalf: portrait ? 52 : 46,
    chunks, statics: STATIC_BR ? [STATIC_BR] : [], bills, billTex: BILL_TEX,
    sil: (G.state === 'play') ? { col: [1, 0.85, 0.2, 0.55] } : null,
    slice: P && G.state !== 'shop' ? { x: P.x, z: P.z, minH: 2.7, fx: f[0], fz: f[1], slope: Math.tan(pitch) * 0.92 } : null,
  });
}

// ---------- billboard atlas ----------
function makeBillboards() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
  const cells = [
    ['#0b0b0b', 'CASH RULES', 'NYC', '#1fd65f', '#e8b923'], ['#0a2a7a', 'BLUESCREENU', 'NAS100 · GOLD · S&P', '#ffffff', '#5fd0ff'],
    ['#2a0d4a', 'AI BEEN HERE', 'OG WISDOM DAILY', '#e9d5ff', '#ffcc33'], ['#0f3d1f', 'GAS GADGETS', 'ELEVATE YOUR SESSION', '#9effa0', '#ffd23a'],
    ['#ff2e7e', 'NYC DJ', 'LIVE ALL 5 BOROUGHS', '#ffffff', '#111111'], ['#111111', 'MINITECH101', 'APPS THAT MOVE', '#00e5ff', '#ffffff'],
    ['#111111', 'CASH RULES', 'CUSTOMS', '#e8b923', '#1fd65f'], ['#d3202a', 'WANTED', '★★★★★', '#ffffff', '#ffd23a'],
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
  // shops
  for (const s of SHOPS) { const dx = s.x - P.x, dz = s.z - P.z; if (Math.abs(dx) > 140 || Math.abs(dz) > 140) continue; drawShopIcon(x, dx, dz, 1 / sc); }
  for (const p of G.pickups) { x.fillStyle = '#2ee66f'; x.fillRect(p.x - P.x - 1.5, p.z - P.z - 1.5, 3, 3); }
  const blink = Math.floor(t * 6) % 2;
  for (const c of G.cops) { if (!c.alive || c.ai.lost) continue; x.fillStyle = blink ? '#ff3030' : '#3a6bff'; x.beginPath(); x.arc(c.x - P.x, c.z - P.z, 3.4, 0, Math.PI * 2); x.fill(); }
  if (G.heli) { x.strokeStyle = '#ff3030'; x.lineWidth = 1.5; x.beginPath(); x.arc(G.heli.x - P.x, G.heli.z - P.z, 5, 0, Math.PI * 2); x.stroke(); }
  // player arrow
  x.rotate(P.h); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.2;
  x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill(); x.stroke();
  x.restore();
  // nearest shop at edge when wanted
  const [ns, nd] = nearestShop(P.x, P.z);
  if (ns) {
    const dx = ns.x - P.x, dz = ns.z - P.z, a = Math.atan2(dz, dx) - CAM_AZ;
    const rr = Math.hypot(dx, dz) * sc;
    if (rr > R - 10) { const ex = R + Math.cos(a) * (R - 11), ey = R + Math.sin(a) * (R - 11); x.save(); x.translate(ex, ey); drawShopIcon(x, 0, 0, 1.2, true); x.restore(); }
  }
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.beginPath(); x.arc(R, R, R - 1.5, 0, Math.PI * 2); x.stroke();
}
function drawShopIcon(x, px, pz, s, edge) {
  x.save(); x.translate(px, pz); x.rotate(edge ? 0 : CAM_AZ); x.scale(s, s);
  x.fillStyle = G.stars > 0 ? '#1fd65f' : '#e8b923'; x.strokeStyle = '#000'; x.lineWidth = 2;
  x.beginPath(); x.arc(0, 0, 8, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#000'; x.font = 'bold 11px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, 1);
  x.restore();
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
  for (const s of SHOPS) { const p = toS(s.x, s.z); drawShopIcon(x, p[0], p[1], W / 900, true); }
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
  else if (G.nearShop && G.nearShop.hot && G.stars > 0) hint = 'COPS TOO CLOSE — SHAKE ’EM AND THE DOOR OPENS';
  else if (G.nearShop && !G.nearShop.hot) hint = 'DRIVE IN · CASH RULES CUSTOMS';
  const he = $('hint'); if (he.textContent !== hint) he.textContent = hint; he.classList.toggle('on', !!hint);
  // compass to nearest shop
  const cp = $('compass');
  if (G.stars > 0 && G.state === 'play') {
    const [s, d] = nearestShop(P.x, P.z);
    if (s) {
      const a = Math.atan2(s.x - P.x, -(s.z - P.z)) - CAM_AZ;
      cp.style.display = 'flex'; $('compArrow').style.transform = `rotate(${a}rad)`; $('compDist').textContent = Math.round(d * MPU) + 'm';
    }
  } else cp.style.display = 'none';
}

// ---------- input ----------
function setupInput() {
  const tl = $('touch'), ptrs = new Map();
  const upd = () => { let l = false, r = false; for (const x of ptrs.values()) { if (x < window.innerWidth / 2) l = true; else r = true; } G.input.l = l; G.input.r = r; $('tl').classList.toggle('on', l); $('tr').classList.toggle('on', r); };
  tl.addEventListener('pointerdown', e => { e.preventDefault(); ptrs.set(e.pointerId, e.clientX); try { tl.setPointerCapture(e.pointerId); } catch (_) { } upd(); AUD.init(); });
  tl.addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) { ptrs.set(e.pointerId, e.clientX); upd(); } });
  const end = e => { ptrs.delete(e.pointerId); upd(); };
  tl.addEventListener('pointerup', end); tl.addEventListener('pointercancel', end); tl.addEventListener('lostpointercapture', end);
  window.addEventListener('keydown', e => {
    G.input.keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault();
    if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'play') pause(true);
    else if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'pause') pause(false);
    if (e.code === 'KeyM' && (G.state === 'play' || G.state === 'pause')) pause(G.state === 'play');
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
function renderTitle() {
  const m = MODELS[titleCar], owned = SAVE.owned.includes(titleCar);
  $('carName').textContent = m.name;
  const bars = [['SPEED', (m.maxV - 18) / 12], ['GRIP', (m.turn - 2) / 1.0], ['ARMOR', m.hp / 220]];
  $('carStats').innerHTML = bars.map(b => `<div class="stat"><span>${b[0]}</span><i><b style="width:${Math.round(Math.min(1, Math.max(0.08, b[1])) * 100)}%"></b></i></div>`).join('');
  const btn = $('playBtn');
  if (owned) { btn.textContent = loadingPct() < 1 ? 'LOADING NYC… ' + Math.round(loadingPct() * 100) + '%' : 'PLAY'; btn.disabled = loadingPct() < 1; btn.dataset.mode = 'play'; }
  else { btn.textContent = 'BUY ' + fmt$(m.price); btn.disabled = SAVE.bank < m.price; btn.dataset.mode = 'buy'; }
  $('bank').textContent = fmt$(SAVE.bank);
  $('best').textContent = SAVE.best ? 'BEST RUN ' + mmss(SAVE.best) : ''; $('best').style.visibility = SAVE.best ? 'visible' : 'hidden';
  document.querySelectorAll('#boros button').forEach(b => b.classList.toggle('sel', b.dataset.b === SAVE.boro));
  $('optNight').classList.toggle('sel', SAVE.night); $('optSound').classList.toggle('sel', SAVE.sound); $('optShadow').classList.toggle('sel', SAVE.shadows);
}
function loadingPct() { return G.P ? Math.min(1, WORLD.loadedAround(G.P.x, G.P.z, 1.6) / 0.999) : 0; }
function previewCar() {
  const P = G.P; if (!P) return;
  const keep = { x: P.x, z: P.z, h: P.h };
  const owned = SAVE.owned.includes(titleCar);
  const v = makeVehicle(titleCar, keep.x, keep.z, keep.h, { role: 'player', color: (titleCar === SAVE.car && SAVE.color) ? SAVE.color.slice() : MODELS[titleCar].color.slice() });
  G.P = v;
}
function goTitle() {
  $('over').classList.remove('on'); $('pause').classList.remove('on'); $('shop').classList.remove('on');
  resetRun(); G.state = 'title'; titleCar = SAVE.car; spawnPlayer(SAVE.boro); $('title').classList.add('on'); $('hud').classList.remove('on'); renderTitle();
}
function startRun() {
  AUD.init();
  SAVE.car = titleCar; save();
  resetRun();
  const keep = G.P ? { x: G.P.x, z: G.P.z, h: G.P.h } : null;
  spawnPlayer(SAVE.boro);
  G.state = 'play'; $('title').classList.remove('on'); $('hud').classList.add('on'); $('over').classList.remove('on');
  G.hood = ''; G.hoodT = 0; G.spawnT = 2; G.civT = 0;
  bigMsg('ALL 5 BOROUGHS', 'cool'); toast('SMASH = HEAT · CASH RULES CUSTOMS CLEARS IT');
}
function setupMenus() {
  $('prevCar').onclick = () => { const i = PLAYER_CARS.indexOf(titleCar); titleCar = PLAYER_CARS[(i + PLAYER_CARS.length - 1) % PLAYER_CARS.length]; previewCar(); renderTitle(); };
  $('nextCar').onclick = () => { const i = PLAYER_CARS.indexOf(titleCar); titleCar = PLAYER_CARS[(i + 1) % PLAYER_CARS.length]; previewCar(); renderTitle(); };
  $('playBtn').onclick = () => {
    AUD.init();
    if ($('playBtn').dataset.mode === 'buy') { const m = MODELS[titleCar]; if (SAVE.bank >= m.price) { SAVE.bank -= m.price; SAVE.owned.push(titleCar); SAVE.car = titleCar; SAVE.color = null; save(); AUD.cash(); renderTitle(); } return; }
    if (titleCar !== SAVE.car) SAVE.color = null;
    startRun();
  };
  document.querySelectorAll('#boros button').forEach(b => b.onclick = () => { SAVE.boro = b.dataset.b; save(); spawnPlayer(SAVE.boro); previewCar(); renderTitle(); });
  $('optNight').onclick = () => { SAVE.night = !SAVE.night; GFX.night = SAVE.night ? 1 : 0; save(); renderTitle(); };
  $('optSound').onclick = () => { SAVE.sound = !SAVE.sound; AUD.init(); AUD.setOn(SAVE.sound); save(); renderTitle(); };
  $('optShadow').onclick = () => { SAVE.shadows = !SAVE.shadows; GFX.shadowOn = SAVE.shadows; save(); renderTitle(); };
  $('againBtn').onclick = () => { $('over').classList.remove('on'); titleCar = SAVE.car; startRun(); };
  $('menuBtn').onclick = () => goTitle();
  $('pauseBtn').onclick = () => pause(G.state === 'play');
  $('resumeBtn').onclick = () => pause(false);
  $('quitBtn').onclick = () => goTitle();
  $('mini').onclick = () => pause(true);
  $('leaveBtn').onclick = () => leaveShop();
  $('fixBtn').onclick = () => doService('fix');
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
  if (G.state !== 'pause') { updateParts(dt); updateBoats(dt); if (G.state !== 'play') updateShops(dt); }
  GFX.resize(G.renderScale);
  render(t, dt);
  if (G.state === 'play' || G.state === 'over' || G.state === 'shop') {
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
