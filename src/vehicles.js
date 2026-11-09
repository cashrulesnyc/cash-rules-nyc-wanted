// ============================================================
//  Vehicles: models, physics, collisions, AI, particles
// ============================================================
const VC = {
  glass: hex('#22334a'), tire: hex('#151517'), dark: hex('#2b2d33'), headl: hex('#fff7d6'), tail: hex('#ff2a2a'), white: hex('#f6f6f6'),
  nypd: hex('#1f4fb8'), black: hex('#121214'), yellow: hex('#f7c412'), red: hex('#ff2b2b'), blue: hex('#2b6bff'), off: hex('#333844'),
  navy: hex('#1a2a4a'), gun: hex('#3a3f46'), mta: hex('#2a6fd6'),
};
// part: [x,y,z, sx,sy,sz, color|'body'|'bodyDk', mat, flag]  flag: 1 siren red, 2 siren blue, 3 rotor, 4 tail rotor, 5 headlight
function sedanParts(extra) {
  const p = [
    [0, 0.36, 0, 1.1, 0.42, 2.2, 'body', 0], [0, 0.74, -0.12, 0.96, 0.36, 1.12, VC.glass, 6], [0, 0.95, -0.12, 0.98, 0.08, 0.98, 'bodyDk', 0],
    [0, 0.26, 1.12, 1.12, 0.16, 0.06, VC.dark, 0], [0, 0.26, -1.12, 1.12, 0.16, 0.06, VC.dark, 0],
    [0.34, 0.43, 1.105, 0.24, 0.1, 0.03, VC.headl, 2, 5], [-0.34, 0.43, 1.105, 0.24, 0.1, 0.03, VC.headl, 2, 5],
    [0.36, 0.45, -1.105, 0.24, 0.1, 0.03, VC.tail, 2], [-0.36, 0.45, -1.105, 0.24, 0.1, 0.03, VC.tail, 2],
  ];
  for (const sx of [-0.52, 0.52]) for (const sz of [-0.7, 0.7]) p.push([sx, 0.2, sz, 0.2, 0.4, 0.42, VC.tire, 0]);
  return extra ? p.concat(extra) : p;
}
const MODELS = {
  sedan: { name: 'STREET SEDAN', parts: sedanParts(), len: 2.2, wid: 1.1, maxV: 24, turn: 2.7, grip: 7, hp: 100, mass: 1, price: 0, color: hex('#f2f2f2') },
  taxi: { name: 'YELLOW CAB', parts: sedanParts([[0, 1.06, -0.1, 0.52, 0.16, 0.24, VC.white, 2], [0.56, 0.42, 0, 0.02, 0.09, 1.7, VC.black, 0], [-0.56, 0.42, 0, 0.02, 0.09, 1.7, VC.black, 0]]), len: 2.2, wid: 1.1, maxV: 25.5, turn: 2.85, grip: 7.5, hp: 100, mass: 1, price: 1500, color: VC.yellow },
  ev: {
    name: 'ELECTRIC CROSSOVER', parts: [
      [0, 0.42, 0, 1.16, 0.5, 2.25, 'body', 0], [0, 0.82, -0.1, 1.02, 0.34, 1.35, VC.glass, 6], [0, 1.0, -0.15, 1.04, 0.06, 1.2, VC.black, 6],
      [0, 0.33, 1.14, 1.14, 0.2, 0.06, VC.black, 0], [0, 0.5, 1.13, 0.9, 0.05, 0.03, VC.headl, 2, 5], [0, 0.55, -1.13, 1.0, 0.06, 0.03, VC.tail, 2],
      [0.55, 0.22, 0.72, 0.22, 0.44, 0.46, VC.tire], [-0.55, 0.22, 0.72, 0.22, 0.44, 0.46, VC.tire], [0.55, 0.22, -0.72, 0.22, 0.44, 0.46, VC.tire], [-0.55, 0.22, -0.72, 0.22, 0.44, 0.46, VC.tire],
    ], len: 2.25, wid: 1.16, maxV: 27, turn: 2.95, grip: 8, hp: 120, mass: 1.3, price: 3000, color: hex('#1b5e3b')
  },
  muscle: {
    name: 'MUSCLE COUPE', parts: [
      [0, 0.33, 0, 1.16, 0.38, 2.45, 'body', 0], [0, 0.66, -0.35, 0.98, 0.3, 0.95, VC.glass, 6], [0, 0.83, -0.35, 1.0, 0.07, 0.85, 'bodyDk', 0],
      [0.18, 0.53, 0.6, 0.14, 0.02, 1.2, VC.black, 0], [-0.18, 0.53, 0.6, 0.14, 0.02, 1.2, VC.black, 0], [0, 0.6, 0.55, 0.42, 0.1, 0.4, VC.dark, 0],
      [0, 0.62, -1.15, 1.1, 0.06, 0.25, VC.black, 0],
      [0.38, 0.38, 1.235, 0.22, 0.1, 0.03, VC.headl, 2, 5], [-0.38, 0.38, 1.235, 0.22, 0.1, 0.03, VC.headl, 2, 5], [0, 0.42, -1.235, 0.9, 0.08, 0.03, VC.tail, 2],
      [0.55, 0.22, 0.8, 0.24, 0.44, 0.48, VC.tire], [-0.55, 0.22, 0.8, 0.24, 0.44, 0.48, VC.tire], [0.56, 0.24, -0.78, 0.26, 0.48, 0.52, VC.tire], [-0.56, 0.24, -0.78, 0.26, 0.48, 0.52, VC.tire],
    ], len: 2.45, wid: 1.16, maxV: 29, turn: 2.55, grip: 5.5, hp: 90, mass: 1.1, price: 5000, color: hex('#c0392b')
  },
  truck: {
    name: 'BOX TRUCK', parts: [
      [0, 0.62, 0.95, 1.2, 0.86, 0.85, 'body', 0], [0, 0.85, 1.25, 1.1, 0.3, 0.3, VC.glass, 6], [0, 1.05, -0.45, 1.3, 1.5, 1.95, VC.white, 0],
      [0, 0.3, 0, 1.0, 0.2, 2.8, VC.dark, 0], [0.6, 1.05, -0.45, 0.02, 0.5, 1.6, 'body', 0], [-0.6, 1.05, -0.45, 0.02, 0.5, 1.6, 'body', 0],
      [0.38, 0.45, 1.385, 0.24, 0.12, 0.03, VC.headl, 2, 5], [-0.38, 0.45, 1.385, 0.24, 0.12, 0.03, VC.headl, 2, 5],
      [0.58, 0.24, 1.0, 0.22, 0.48, 0.48, VC.tire], [-0.58, 0.24, 1.0, 0.22, 0.48, 0.48, VC.tire], [0.6, 0.24, -0.9, 0.22, 0.48, 0.48, VC.tire], [-0.6, 0.24, -0.9, 0.22, 0.48, 0.48, VC.tire],
    ], len: 2.8, wid: 1.3, maxV: 21, turn: 2.25, grip: 8, hp: 220, mass: 2.2, price: 8000, color: hex('#1fd65f')
  },
  cop: {
    name: 'NYPD', parts: sedanParts([
      [0.57, 0.42, 0.1, 0.02, 0.1, 1.9, VC.nypd, 0], [-0.57, 0.42, 0.1, 0.02, 0.1, 1.9, VC.nypd, 0], [0, 0.3, 1.18, 0.9, 0.3, 0.08, VC.black, 0],
      [0.23, 1.04, -0.12, 0.36, 0.1, 0.22, VC.red, 2, 1], [-0.23, 1.04, -0.12, 0.36, 0.1, 0.22, VC.blue, 2, 2], [0, 1.0, -0.12, 0.9, 0.04, 0.26, VC.black, 0],
    ]), len: 2.2, wid: 1.1, maxV: 23.5, turn: 2.6, grip: 7.5, hp: 45, mass: 1, color: VC.white
  },
  suv: {
    name: 'ESU', parts: [
      [0, 0.5, 0, 1.2, 0.6, 2.3, 'body', 0], [0, 0.95, -0.1, 1.1, 0.34, 1.6, VC.glass, 6], [0, 1.15, -0.1, 1.12, 0.07, 1.55, 'body', 0],
      [0.61, 0.55, 0, 0.02, 0.1, 2.0, VC.white, 0], [-0.61, 0.55, 0, 0.02, 0.1, 2.0, VC.white, 0], [0, 0.38, 1.2, 1.0, 0.36, 0.1, VC.black, 0],
      [0.25, 1.24, -0.1, 0.4, 0.1, 0.24, VC.red, 2, 1], [-0.25, 1.24, -0.1, 0.4, 0.1, 0.24, VC.blue, 2, 2],
      [0.36, 0.6, 1.155, 0.24, 0.1, 0.03, VC.headl, 2, 5], [-0.36, 0.6, 1.155, 0.24, 0.1, 0.03, VC.headl, 2, 5],
      [0.56, 0.24, 0.75, 0.24, 0.48, 0.48, VC.tire], [-0.56, 0.24, 0.75, 0.24, 0.48, 0.48, VC.tire], [0.56, 0.24, -0.75, 0.24, 0.48, 0.48, VC.tire], [-0.56, 0.24, -0.75, 0.24, 0.48, 0.48, VC.tire],
    ], len: 2.3, wid: 1.2, maxV: 25.5, turn: 2.45, grip: 7.5, hp: 75, mass: 1.5, color: VC.navy
  },
  armored: {
    name: 'ESU HEAVY', parts: [
      [0, 0.75, 0, 1.45, 1.1, 2.9, 'body', 0], [0, 1.0, 1.25, 1.2, 0.3, 0.4, VC.glass, 6], [0, 0.45, 1.5, 1.3, 0.4, 0.15, VC.black, 0],
      [0.3, 1.36, 0, 0.4, 0.12, 0.26, VC.red, 2, 1], [-0.3, 1.36, 0, 0.4, 0.12, 0.26, VC.blue, 2, 2], [0.74, 0.8, -0.2, 0.02, 0.18, 2.2, VC.white, 0], [-0.74, 0.8, -0.2, 0.02, 0.18, 2.2, VC.white, 0],
      [0.66, 0.3, 0.95, 0.26, 0.6, 0.6, VC.tire], [-0.66, 0.3, 0.95, 0.26, 0.6, 0.6, VC.tire], [0.66, 0.3, -0.95, 0.26, 0.6, 0.6, VC.tire], [-0.66, 0.3, -0.95, 0.26, 0.6, 0.6, VC.tire],
    ], len: 2.9, wid: 1.45, maxV: 22, turn: 2.1, grip: 9, hp: 170, mass: 3, color: VC.gun
  },
  bus: {
    name: 'MTA BUS', parts: [
      [0, 0.85, 0, 1.3, 1.3, 5.0, VC.white, 0], [0, 1.15, 0.1, 1.32, 0.45, 4.6, VC.glass, 6], [0, 0.55, 0, 1.32, 0.18, 4.9, VC.mta, 0], [0, 1.52, 0, 1.25, 0.06, 4.8, VC.mta, 0],
      [0, 1.15, 2.51, 1.1, 0.5, 0.03, VC.glass, 6], [0, 1.6, 2.5, 0.8, 0.15, 0.04, hex('#ff9f1a'), 2],
      [0.6, 0.26, 1.7, 0.2, 0.5, 0.5, VC.tire], [-0.6, 0.26, 1.7, 0.2, 0.5, 0.5, VC.tire], [0.6, 0.26, -1.6, 0.2, 0.5, 0.5, VC.tire], [-0.6, 0.26, -1.6, 0.2, 0.5, 0.5, VC.tire],
    ], len: 5.0, wid: 1.3, maxV: 12, turn: 1.6, grip: 9, hp: 200, mass: 4, color: VC.white
  },
  heli: {
    parts: [
      [0, 0, 0, 1.1, 0.95, 2.0, VC.white, 0], [0, -0.05, 0.75, 1.0, 0.6, 0.6, VC.glass, 6], [0, -0.2, 0, 1.12, 0.3, 2.02, VC.nypd, 0],
      [0, 0.1, -1.7, 0.25, 0.25, 1.8, VC.nypd, 0], [0.15, 0.35, -2.5, 0.05, 0.7, 0.3, VC.dark, 0, 4],
      [0, 0.62, 0, 0.14, 0.05, 4.6, VC.dark, 0, 3], [0, 0.62, 0, 4.6, 0.05, 0.14, VC.dark, 0, 3], [0, 0.55, 0, 0.3, 0.2, 0.3, VC.dark, 0],
      [0.45, -0.62, 0, 0.08, 0.08, 1.9, VC.dark, 0], [-0.45, -0.62, 0, 0.08, 0.08, 1.9, VC.dark, 0],
      [0.3, 0.52, -0.2, 0.3, 0.08, 0.18, VC.red, 2, 1], [-0.3, 0.52, -0.2, 0.3, 0.08, 0.18, VC.blue, 2, 2],
    ]
  },
};
for (const k in MODELS) { const m = MODELS[k]; if (!m.len) continue; m.circles = []; const n = m.len > 3.5 ? 3 : 2; for (let i = 0; i < n; i++) m.circles.push((n === 3 ? (i - 1) * m.len * 0.33 : (i - 0.5) * m.len * 0.5)); m.cr = m.wid * 0.53; }
const PLAYER_CARS = ['sedan', 'taxi', 'ev', 'muscle', 'truck'];

let VEH_ID = 1;
function makeVehicle(kind, x, z, h, opts) {
  const m = MODELS[kind];
  const v = {
    id: VEH_ID++, kind, m, x, z, y: 0, h, vx: 0, vz: 0, spin: 0, steer: 0, thr: 0, maxV: m.maxV, turn: m.turn, grip: m.grip, mass: m.mass,
    hp: m.hp, maxHp: m.hp, color: (opts && opts.color) || m.color, alive: true, sink: 0, wreck: false, roll: 0, pitch: 0, smokeT: 0, onBridge: null,
    role: (opts && opts.role) || 'civ', ai: (opts && opts.ai) || {}, lastHit: 0, stuck: 0, rev: 0, age: 0,
  };
  return v;
}
function vSpeed(v) { return Math.hypot(v.vx, v.vz); }
function angWrap(a) { return ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }

// ---------- physics ----------
function stepVehicle(v, dt) {
  const fx = Math.sin(v.h), fz = -Math.cos(v.h), rx = Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  if (v.sink > 0) { v.sink += dt; v.y -= dt * 0.9; v.vx *= 0.94; v.vz *= 0.94; v.x += v.vx * dt; v.z += v.vz * dt; v.pitch += dt * 0.5; return; }
  if (!v.alive || v.wreck) { vf *= Math.exp(-2.5 * dt); vr *= Math.exp(-4 * dt); v.thr = 0; v.steer = 0; }
  const t = tileAt(v.x, v.z);
  const surf = (t === T_PARK || t === T_SAND || t === T_CEM) ? 0.78 : (t === T_WALK || t === T_LOT) ? 0.92 : 1;
  const maxV = v.maxV * surf * (v.boost || 1);
  if (v.thr > 0) { if (vf < maxV) vf += maxV * 1.25 * dt * (1 - Math.max(0, vf) / maxV) + (vf < 0 ? 20 * dt : 0); else vf -= (vf - maxV) * 2 * dt; }
  else if (v.thr < 0) { if (vf > 0.5) vf -= 32 * dt; else vf = Math.max(vf - 14 * dt, -maxV * 0.38); }
  else vf *= Math.exp(-1.0 * dt);
  const sp = Math.abs(vf);
  const steerK = Math.max(v.thr !== 0 && v.role === 'player' ? 0.7 : 0, Math.min(1, sp / 5)) * (vf >= -0.3 ? 1 : -1) * (1 - Math.min(0.35, sp / 90));
  v.h += (v.steer * v.turn * steerK + v.spin) * dt;
  v.spin *= Math.exp(-4 * dt);
  const drift = Math.abs(v.steer) > 0.5 && sp > 15;
  vr *= Math.exp(-(drift ? v.grip * 0.45 : v.grip) * dt);
  const nfx = Math.sin(v.h), nfz = -Math.cos(v.h), nrx = Math.cos(v.h), nrz = Math.sin(v.h);
  v.vx = nfx * vf + nrx * vr; v.vz = nfz * vf + nrz * vr;
  v.x += v.vx * dt; v.z += v.vz * dt;
  v.roll += ((-v.steer * Math.min(1, sp / 20) * 0.07) - v.roll) * Math.min(1, dt * 6);
  v.drifting = drift && Math.abs(vr) > 2.5;
}

// circle vs OBB colliders + props; returns max impact speed
function collideWorld(v, dt, onProp) {
  const fx = Math.sin(v.h), fz = -Math.cos(v.h);
  let maxImp = 0;
  const r = v.m.cr;
  for (const o of v.m.circles) {
    let cx = v.x + fx * o, cz = v.z + fz * o;
    if (v.y > 0.6) continue; // on elevated bridge deck: only railings matter
    WORLD.forCols(cx, cz, r + 0.2, (c, k) => {
      const dx = cx - c[k], dz = cz - c[k + 1], ax = c[k + 2], az = c[k + 3], ha = c[k + 4], hb = c[k + 5];
      const lu = dx * ax + dz * az, lv = dx * az - dz * ax; // b axis = (az, -ax)?? keep consistent below
      // local b axis vector = (-az?); derive: a=(ax,az), b=(-az,ax) rotated +90; use lv2 = -dx*az + dz*ax
      const lb = -dx * az + dz * ax;
      const qu = Math.max(-ha, Math.min(ha, lu)), qb = Math.max(-hb, Math.min(hb, lb));
      let du = lu - qu, db = lb - qb; let d = Math.hypot(du, db);
      if (d >= r) return false;
      let nu, nb, pen;
      if (d < 1e-5) { // inside: push along min axis
        const pu = ha - Math.abs(lu), pb = hb - Math.abs(lb);
        if (pu < pb) { nu = Math.sign(lu) || 1; nb = 0; pen = pu + r; } else { nu = 0; nb = Math.sign(lb) || 1; pen = pb + r; }
      } else { nu = du / d; nb = db / d; pen = r - d; }
      const nx = nu * ax - nb * az, nz = nu * az + nb * ax;
      v.x += nx * pen; v.z += nz * pen; cx += nx * pen; cz += nz * pen;
      const vn = v.vx * nx + v.vz * nz;
      if (vn < 0) {
        v.vx -= nx * vn * 1.3; v.vz -= nz * vn * 1.3;
        const tx = -nz, tz = nx, vt = v.vx * tx + v.vz * tz; v.vx -= tx * vt * 0.12; v.vz -= tz * vt * 0.12;
        maxImp = Math.max(maxImp, -vn);
        v.spin += o * (fx * nz - fz * nx) * (-vn) * 0.12;
      }
      return false;
    });
    WORLD.forProps(cx, cz, r + 1.1, (ch, id) => {
      const k = id * PROPF, px = ch.props[k], pz = ch.props[k + 1], pr = ch.props[k + 2];
      const dx = cx - px, dz = cz - pz, d = Math.hypot(dx, dz);
      if (d >= r + pr || d < 1e-5) return;
      onProp(v, ch, id, dx / d, dz / d, r + pr - d);
    });
  }
  // bridge railings
  const s = segHit(v.x, v.z);
  if (s && s.type === SEG_BRIDGE) {
    const br = s.br, h = bridgeH(br, SH.t);
    v.onBridge = br; v.y += (h - v.y) * Math.min(1, dt * 20);
    if (h > 0.25) {
      const lim = s.hw - v.m.wid * 0.5 - 0.1;
      if (Math.abs(SH.lat) > lim) {
        const sg = Math.sign(SH.lat), nx = -s.dz * sg, nz = s.dx * sg; // pointing back inside
        const push = Math.abs(SH.lat) - lim; v.x += nx * push; v.z += nz * push;
        const vn = v.vx * nx + v.vz * nz; if (vn < 0) { v.vx -= nx * vn * 1.4; v.vz -= nz * vn * 1.4; maxImp = Math.max(maxImp, -vn * 0.6); }
      }
    }
  } else {
    // left a bridge sideways at height? clamp down
    v.onBridge = null; v.y += (0 - v.y) * Math.min(1, dt * 8);
    if (v.y < 0.3 && tileAt(v.x, v.z) === T_WATER && v.sink === 0) v.sink = 0.001;
  }
  return maxImp;
}

function collideVehicles(list, onHit) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.sink > 0) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.sink > 0) continue;
      const dx0 = b.x - a.x, dz0 = b.z - a.z; if (dx0 * dx0 + dz0 * dz0 > 36) continue;
      if (Math.abs(a.y - b.y) > 1) continue;
      const afx = Math.sin(a.h), afz = -Math.cos(a.h), bfx = Math.sin(b.h), bfz = -Math.cos(b.h);
      for (const oa of a.m.circles) for (const ob of b.m.circles) {
        const ax = a.x + afx * oa, az = a.z + afz * oa, bx = b.x + bfx * ob, bz = b.z + bfz * ob;
        const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), R = a.m.cr + b.m.cr;
        if (d >= R || d < 1e-5) continue;
        const nx = dx / d, nz = dz / d, pen = R - d, ma = a.mass, mb = b.mass, tot = ma + mb;
        a.x -= nx * pen * mb / tot; a.z -= nz * pen * mb / tot; b.x += nx * pen * ma / tot; b.z += nz * pen * ma / tot;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const j = -(1.35) * rv / (1 / ma + 1 / mb);
          a.vx -= nx * j / ma; a.vz -= nz * j / ma; b.vx += nx * j / mb; b.vz += nz * j / mb;
          a.spin += oa * (afx * nz - afz * nx) * (-rv) * 0.1 / ma; b.spin -= ob * (bfx * nz - bfz * nx) * (-rv) * 0.1 / mb;
          onHit(a, b, -rv);
        }
      }
    }
  }
}

// ---------- AI ----------
function probeBlocked(x, z) {
  const t = tileAt(x, z);
  if (t === T_WATER) return 2;
  if (WORLD.pointBlocked(x, z, 0.5)) return 1;
  return 0;
}
function aiSteerTo(v, tx, tz, dt, avoid) {
  const desired = Math.atan2(tx - v.x, -(tz - v.z));
  let diff = angWrap(desired - v.h);
  let steer = Math.max(-1, Math.min(1, diff * 2.4));
  if (avoid) {
    const sp = vSpeed(v), look = 3.5 + sp * 0.3;
    const pr = (a) => probeBlocked(v.x + Math.sin(v.h + a) * look, v.z - Math.cos(v.h + a) * look);
    const c = pr(0);
    if (c) {
      const l = pr(-0.7), r = pr(0.7);
      if (!l && r) steer = -1; else if (l && !r) steer = 1; else if (!l && !r) steer = diff < 0 ? -1 : 1;
      else { steer = diff < 0 ? -1 : 1; v.thr = sp > 8 ? -1 : v.thr; }
      if (c === 2 && sp > 10) v.thr = -1;
    }
  }
  v.steer = steer;
  return diff;
}
function aiStuck(v, dt) {
  if (v.rev > 0) { v.rev -= dt; v.thr = -1; v.steer = -v.revSteer; return true; }
  if (v.thr > 0 && vSpeed(v) < 1.6) v.stuck += dt; else v.stuck = Math.max(0, v.stuck - dt * 2);
  if (v.stuck > 0.9) { v.stuck = 0; v.rev = 0.8 + Math.random() * 0.4; v.revSteer = v.steer || 1; }
  return false;
}
function copAI(v, P, dt, stars) {
  if (!v.alive || v.wreck || v.sink > 0) return;
  v.thr = 1;
  if (aiStuck(v, dt)) return;
  if (v.ai.lost) {
    const ax = v.x + (v.x - P.x), az = v.z + (v.z - P.z);
    aiSteerTo(v, ax, az, dt, true); v.boost = 0.8; return;
  }
  const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz);
  const lead = Math.min(0.9, 0.2 + d / 50);
  const tx = P.x + P.vx * lead, tz = P.z + P.vz * lead;
  const diff = aiSteerTo(v, tx, tz, dt, d > 3.5);
  v.boost = d > 35 ? 1.22 : d > 20 ? 1.1 : 1.0;
  v.boost *= 1 + Math.min(0.08, stars * 0.015);
  if (Math.abs(diff) > 2.3 && d < 10 && vSpeed(v) > 8) v.thr = -1;
}
// civilians follow the street grid
function civInit(v) {
  const g = GRIDS[boroAt(v.x, v.z)] || GRIDS[1];
  const l = gLocal(g, v.x, v.z);
  const du = Math.abs(l[0] - g.A * Math.round(l[0] / g.A)), dv = Math.abs(l[1] - g.S * Math.round(l[1] / g.S));
  const ai = v.ai; ai.g = g;
  if (du < g.wa / 2 && (dv >= g.ws / 2 || du < dv)) { ai.axis = 'u'; ai.line = Math.round(l[0] / g.A); }
  else { ai.axis = 'v'; ai.line = Math.round(l[1] / g.S); }
  ai.dir = Math.random() < 0.5 ? 1 : -1;
  ai.cruise = 8 + Math.random() * 4;
  civHeading(v);
}
function civHeading(v) { // set heading along road
  const g = v.ai.g, ai = v.ai;
  const fx = ai.axis === 'u' ? g.dx * ai.dir : g.ex * ai.dir, fz = ai.axis === 'u' ? g.dz * ai.dir : g.ez * ai.dir;
  v.h = Math.atan2(fx, -fz);
}
function civAI(v, dt) {
  if (!v.alive || v.wreck || v.sink > 0) { v.thr = 0; return; }
  const ai = v.ai;
  if (ai.stun > 0) { ai.stun -= dt; v.thr = 0; v.steer = 0; return; }
  const g = ai.g, l = gLocal(g, v.x, v.z);
  let free = ai.axis === 'u' ? l[1] : l[0];
  const step = ai.axis === 'u' ? g.S : g.A, cross = ai.axis === 'u' ? g.A : g.S;
  // lane offset to the right of travel
  const lane = (ai.axis === 'u' ? g.wa : g.ws) * 0.24;
  const laneOff = ai.axis === 'u' ? lane * ai.dir : -lane * ai.dir;
  const fixed = ai.line * cross + laneOff;
  // intersection decision
  const nextI = ai.dir > 0 ? Math.ceil(free / step + 0.0001) : Math.floor(free / step - 0.0001);
  if (ai.nextI !== nextI) { ai.nextI = nextI; ai.turnAt = null; if (Math.random() < 0.35) ai.turnAt = nextI; }
  if (ai.turnAt !== null && ai.turnAt !== undefined && Math.abs(free - ai.turnAt * step) < 0.6) {
    const nd = Math.random() < 0.5 ? 1 : -1;
    const newAxis = ai.axis === 'u' ? 'v' : 'u', newLine = ai.turnAt;
    // check road continues in new direction
    const testU = newAxis === 'u' ? newLine * g.A : ai.line * g.A + nd * 6, testV = newAxis === 'u' ? ai.line * g.S + nd * 6 : newLine * g.S;
    const tp = gWorld(g, newAxis === 'u' ? newLine * g.A : (ai.line) * cross + nd * 6, newAxis === 'u' ? ai.line * g.S + nd * 6 : newLine * g.S);
    const tp2 = newAxis === 'u' ? gWorld(g, newLine * g.A, ai.line * g.S + nd * 6) : gWorld(g, ai.line * g.A + nd * 6, newLine * g.S);
    if (tileAt(tp2[0], tp2[1]) === T_ROAD) { ai.axis = newAxis; ai.line = newLine; ai.dir = nd; ai.turnAt = null; ai.nextI = null; return; }
    ai.turnAt = null;
  }
  // look ahead target
  const ahead = free + ai.dir * 5;
  const tgt = ai.axis === 'u' ? gWorld(g, fixed, ahead) : gWorld(g, ahead, fixed);
  const ahead2 = ai.axis === 'u' ? gWorld(g, fixed, free + ai.dir * 3.5) : gWorld(g, free + ai.dir * 3.5, fixed);
  const ta = tileAt(ahead2[0], ahead2[1]);
  if (ta !== T_ROAD && ta !== T_HWY && ta !== T_BRIDGE) { ai.dir = -ai.dir; ai.nextI = null; return; }
  aiSteerTo(v, tgt[0], tgt[1], dt, false);
  const sp = vSpeed(v);
  v.thr = sp < ai.cruise ? 1 : 0;
  // keep away from player if right in front
  const off = ai.axis === 'u' ? Math.abs(l[0] - fixed) : Math.abs(l[1] - fixed);
  if (off > 5) { ai.stun = 3; }
}

// ---------- particles ----------
const PARTS = [];
function addPart(o) { if (PARTS.length > 700) PARTS.shift(); PARTS.push(o); return o; }
function spawnDebris(boxArr, vx, vz, power) {
  for (const b of boxArr) {
    const sp = power * (0.5 + Math.random() * 0.6);
    addPart({ x: b[0], y: b[1], z: b[2], vx: vx * 0.7 + (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 4 * sp / 10, vz: vz * 0.7 + (Math.random() - 0.5) * 4,
      sx: b[3], sy: b[4], sz: b[5], q: [b[6], b[7], b[8], b[9]], w: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10],
      c: [b[10], b[11], b[12]], m: b[13], life: 3 + Math.random() * 1.5, g: 18, bounce: true });
  }
}
function puff(x, y, z, col, n, opt) {
  opt = opt || {};
  for (let i = 0; i < n; i++) {
    const s = (opt.size || 0.3) * (0.6 + Math.random() * 0.8);
    addPart({ x: x + (Math.random() - 0.5) * (opt.spread || 0.4), y, z: z + (Math.random() - 0.5) * (opt.spread || 0.4),
      vx: (Math.random() - 0.5) * (opt.v || 2) + (opt.vx || 0), vy: (opt.vy || 1.5) + Math.random() * (opt.vyr || 1.5), vz: (Math.random() - 0.5) * (opt.v || 2) + (opt.vz || 0),
      sx: s, sy: s, sz: s, q: [0, 0, 0, 1], w: [Math.random() * 3, Math.random() * 3, 0], c: col, m: opt.m || 0, life: opt.life || 1.2, max: opt.life || 1.2, g: opt.g === undefined ? -0.5 : opt.g, shrink: true, grow: opt.grow || 0 });
  }
}
function updateParts(dt) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i];
    p.life -= dt; if (p.life <= 0) { PARTS.splice(i, 1); continue; }
    p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.bounce && p.y < p.sy / 2) { p.y = p.sy / 2; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6; p.w[0] *= 0.6; p.w[1] *= 0.6; p.w[2] *= 0.6; if (Math.abs(p.vy) < 0.5) p.vy = 0; }
    if (p.w) { const wl = Math.hypot(p.w[0], p.w[1], p.w[2]); if (wl > 0.01) { const dq = qAxis(p.w[0] / wl, p.w[1] / wl, p.w[2] / wl, wl * dt); p.q = qNorm(qMul(dq, p.q)); } }
    if (p.grow) { p.sx += p.grow * dt; p.sy += p.grow * dt; p.sz += p.grow * dt; }
  }
}
