// ============================================================
//  Vehicles: models, physics, collisions, AI, particles
// ============================================================
const VC = {
  glass: hex('#22334a'), tire: hex('#151517'), dark: hex('#2b2d33'), headl: hex('#fff7d6'), tail: hex('#ff2a2a'), white: hex('#f6f6f6'),
  nypd: hex('#1f4fb8'), black: hex('#121214'), yellow: hex('#f7c412'), red: hex('#ff2b2b'), blue: hex('#2b6bff'), off: hex('#333844'),
  navy: hex('#1a2a4a'), gun: hex('#3a3f46'), mta: hex('#2a6fd6'),
};
// part: [x,y,z, sx,sy,sz, color|'body'|'bodyDk', mat, flag, pitch]
//   flag: 1 siren red, 2 siren blue, 3 rotor, 4 tail rotor, 5 headlight
//   pitch: optional tilt about the car's local X axis (radians; + = front edge down), used for raked glass
const VC2 = { rim: hex('#c3c8cf'), chrome: hex('#dfe3e8'), grille: hex('#1c1d21'), plate: hex('#f2f2ea'), amber: hex('#ffb020') };
// tyre + rim (+ hub) at each corner. r = wheel radius, w = tyre width
function wheels(xs, zs, r, w) {
  const p = [];
  for (const x of xs) for (const z of zs) {
    const o = Math.sign(x);
    p.push([x, r, z, w, r * 2, r * 1.95, VC.tire, 0]);
    p.push([x + o * (w / 2 + 0.006), r, z, 0.02, r * 1.25, r * 1.25, VC2.rim, 6]);
    p.push([x + o * (w / 2 + 0.016), r, z, 0.02, r * 0.45, r * 0.45, VC.dark, 0]);
  }
  return p;
}
// panel between two side-profile points (y,z) on the centreline: a raked windshield / rear glass
function rake(y0, z0, y1, z1, w, col, mat) {
  const dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz);
  return [0, (y0 + y1) / 2, (z0 + z1) / 2, w, 0.05, len, col, mat || 0, 0, Math.atan2(-dy, dz)];
}
function sedanParts(extra) {
  const p = [
    [0, 0.33, 0, 1.08, 0.34, 2.16, 'body', 0],                 // lower body
    [0, 0.52, 0.68, 1.02, 0.08, 0.8, 'body', 0],                // hood
    [0, 0.52, -0.86, 1.02, 0.08, 0.44, 'body', 0],              // trunk lid
    rake(0.55, 0.64, 0.88, 0.16, 0.92, VC.glass, 6),           // windshield
    rake(0.88, -0.56, 0.55, -0.86, 0.92, VC.glass, 6),         // rear window
    [0, 0.72, -0.2, 0.96, 0.3, 0.7, VC.glass, 6],              // side glass
    [0, 0.89, -0.2, 0.92, 0.06, 0.74, 'body', 0],               // roof
    [0, 0.25, 1.1, 1.08, 0.14, 0.08, VC.dark, 0], [0, 0.25, -1.1, 1.08, 0.14, 0.08, VC.dark, 0], // bumpers
    [0, 0.4, 1.085, 0.42, 0.1, 0.03, VC2.grille, 0], [0, 0.4, -1.09, 0.3, 0.08, 0.02, VC2.plate, 0],
    [0.35, 0.42, 1.085, 0.24, 0.08, 0.04, VC.headl, 2, 5], [-0.35, 0.42, 1.085, 0.24, 0.08, 0.04, VC.headl, 2, 5],
    [0.37, 0.44, -1.085, 0.24, 0.08, 0.04, VC.tail, 2], [-0.37, 0.44, -1.085, 0.24, 0.08, 0.04, VC.tail, 2],
    [0.57, 0.62, 0.22, 0.08, 0.06, 0.1, 'body', 0], [-0.57, 0.62, 0.22, 0.08, 0.06, 0.1, 'body', 0], // mirrors
    [0, 0.16, 0, 1.0, 0.06, 1.6, VC.dark, 0],                  // sills
  ].concat(wheels([-0.5, 0.5], [-0.7, 0.7], 0.2, 0.2));
  return extra ? p.concat(extra) : p;
}
const MODELS = {
  sedan: { name: 'STREET SEDAN', parts: sedanParts(), build: (M) => buildSedan(M), wheels: [[0.465, 0.245, 0.72, 0.245, 0.2, 1], [-0.465, 0.245, 0.72, 0.245, 0.2, 1], [0.465, 0.245, -0.72, 0.245, 0.2, 0], [-0.465, 0.245, -0.72, 0.245, 0.2, 0]], rim: hex('#c3c8cf'), len: 2.2, wid: 1.1, maxV: 24, turn: 2.7, grip: 7, hp: 100, mass: 1, price: 0, color: hex('#f2f2f2') },
  taxi: { name: 'YELLOW CAB', parts: sedanParts([[0, 0.98, -0.18, 0.5, 0.14, 0.22, VC.white, 2], [0, 0.93, -0.18, 0.56, 0.03, 0.26, VC.dark, 0],
    [0.545, 0.4, 0, 0.02, 0.07, 1.7, VC.black, 0], [-0.545, 0.4, 0, 0.02, 0.07, 1.7, VC.black, 0]]), len: 2.2, wid: 1.1, maxV: 25.5, turn: 2.85, grip: 7.5, hp: 100, mass: 1, price: 1500, color: VC.yellow },
  ev: {
    name: 'ELECTRIC CROSSOVER', parts: [
      [0, 0.4, 0, 1.14, 0.42, 2.2, 'body', 0], [0, 0.63, 0.72, 1.08, 0.06, 0.74, 'body', 0],
      rake(0.65, 0.66, 0.99, 0.08, 1.0, VC.glass, 6),
      [0, 0.82, -0.4, 1.04, 0.34, 0.92, VC.glass, 6], [0, 1.0, -0.4, 1.0, 0.06, 0.96, VC.black, 6],
      rake(0.98, -0.86, 0.66, -1.05, 1.0, VC.glass, 6),
      [0, 0.24, 0, 1.17, 0.14, 2.12, VC.black, 0],               // cladding
      [0, 0.52, 1.105, 0.96, 0.04, 0.03, VC.headl, 2, 5], [0, 0.36, 1.11, 0.6, 0.1, 0.03, VC.black, 0],
      [0, 0.58, -1.105, 1.02, 0.05, 0.03, VC.tail, 2],
      [0.59, 0.72, 0.28, 0.08, 0.06, 0.1, 'body', 0], [-0.59, 0.72, 0.28, 0.08, 0.06, 0.1, 'body', 0],
      [0.4, 1.05, -0.4, 0.04, 0.03, 0.9, VC2.chrome, 6], [-0.4, 1.05, -0.4, 0.04, 0.03, 0.9, VC2.chrome, 6], // roof rails
    ].concat(wheels([-0.55, 0.55], [-0.72, 0.72], 0.23, 0.22)), len: 2.25, wid: 1.16, maxV: 27, turn: 2.95, grip: 8, hp: 120, mass: 1.3, price: 3000, color: hex('#1b5e3b')
  },
  muscle: {
    name: 'MUSCLE COUPE', parts: [
      [0, 0.31, 0, 1.14, 0.32, 2.42, 'body', 0], [0, 0.5, 0.6, 1.08, 0.08, 1.14, 'body', 0], [0, 0.5, -0.98, 1.08, 0.08, 0.44, 'body', 0],
      [0, 0.57, 0.58, 0.42, 0.08, 0.42, VC.dark, 0],            // hood scoop
      [0.17, 0.545, 0.6, 0.15, 0.01, 1.12, VC.black, 0], [-0.17, 0.545, 0.6, 0.15, 0.01, 1.12, VC.black, 0],
      rake(0.53, 0.04, 0.8, -0.36, 0.94, VC.glass, 6),
      [0, 0.67, -0.6, 1.0, 0.24, 0.5, VC.glass, 6], [0, 0.81, -0.6, 0.94, 0.06, 0.5, 'body', 0],
      [0.17, 0.845, -0.6, 0.15, 0.01, 0.5, VC.black, 0], [-0.17, 0.845, -0.6, 0.15, 0.01, 0.5, VC.black, 0],
      rake(0.8, -0.84, 0.54, -1.08, 0.94, VC.glass, 6),
      [0, 0.64, -1.17, 1.1, 0.04, 0.2, VC.black, 0], [0.42, 0.58, -1.14, 0.06, 0.1, 0.06, VC.black, 0], [-0.42, 0.58, -1.14, 0.06, 0.1, 0.06, VC.black, 0], // spoiler
      [0, 0.24, 1.23, 1.1, 0.12, 0.06, VC2.chrome, 6], [0, 0.24, -1.23, 1.1, 0.12, 0.06, VC2.chrome, 6],
      [0, 0.38, 1.215, 0.5, 0.1, 0.03, VC2.grille, 0],
      [0.4, 0.39, 1.22, 0.18, 0.1, 0.03, VC.headl, 2, 5], [-0.4, 0.39, 1.22, 0.18, 0.1, 0.03, VC.headl, 2, 5], [0, 0.42, -1.225, 0.92, 0.08, 0.03, VC.tail, 2],
      [0.2, 0.13, -1.2, 0.1, 0.07, 0.12, VC2.chrome, 6], [-0.2, 0.13, -1.2, 0.1, 0.07, 0.12, VC2.chrome, 6], // exhausts
    ].concat(wheels([-0.55], [0.82], 0.21, 0.22), wheels([0.55], [0.82], 0.21, 0.22), wheels([-0.56, 0.56], [-0.8], 0.24, 0.28)),
    len: 2.45, wid: 1.16, maxV: 29, turn: 2.55, grip: 5.5, hp: 90, mass: 1.1, price: 5000, color: hex('#c0392b')
  },
  truck: {
    name: 'BOX TRUCK', parts: [
      [0, 0.66, 0.95, 1.2, 0.9, 0.85, 'body', 0], rake(0.78, 1.37, 1.06, 1.28, 1.08, VC.glass, 6), [0.601, 0.85, 1.0, 0.02, 0.28, 0.4, VC.glass, 6], [-0.601, 0.85, 1.0, 0.02, 0.28, 0.4, VC.glass, 6],
      [0, 1.15, -0.45, 1.3, 1.6, 1.95, VC.white, 0], [0, 1.95, -0.45, 1.24, 0.04, 1.88, hex('#d9dde2'), 0],
      [0, 0.3, 0, 1.0, 0.2, 2.8, VC.dark, 0], [0.656, 1.05, -0.45, 0.02, 0.5, 1.6, 'body', 0], [-0.656, 1.05, -0.45, 0.02, 0.5, 1.6, 'body', 0],
      [0, 0.32, 1.42, 1.2, 0.16, 0.1, VC.dark, 0], [0, 0.55, 1.38, 0.6, 0.18, 0.03, VC2.grille, 0],
      [0.42, 0.52, 1.385, 0.22, 0.12, 0.03, VC.headl, 2, 5], [-0.42, 0.52, 1.385, 0.22, 0.12, 0.03, VC.headl, 2, 5],
      [0.5, 0.5, -1.43, 0.14, 0.14, 0.03, VC.tail, 2], [-0.5, 0.5, -1.43, 0.14, 0.14, 0.03, VC.tail, 2],
      [0.68, 0.92, 1.25, 0.06, 0.2, 0.08, VC.dark, 0], [-0.68, 0.92, 1.25, 0.06, 0.2, 0.08, VC.dark, 0],
    ].concat(wheels([-0.58, 0.58], [1.0], 0.24, 0.22), wheels([-0.6, 0.6], [-0.9], 0.24, 0.24)), len: 2.8, wid: 1.3, maxV: 21, turn: 2.25, grip: 8, hp: 220, mass: 2.2, price: 8000, color: hex('#1fd65f')
  },
  cop: {
    name: 'NYPD', parts: sedanParts([
      [0.546, 0.38, 0.05, 0.02, 0.09, 1.9, VC.nypd, 0], [-0.546, 0.38, 0.05, 0.02, 0.09, 1.9, VC.nypd, 0],
      [0.546, 0.48, -0.3, 0.02, 0.04, 1.2, VC.nypd, 0], [-0.546, 0.48, -0.3, 0.02, 0.04, 1.2, VC.nypd, 0],
      [0, 0.3, 1.17, 0.86, 0.24, 0.06, VC.black, 0], [0.3, 0.3, 1.13, 0.06, 0.24, 0.08, VC.black, 0], [-0.3, 0.3, 1.13, 0.06, 0.24, 0.08, VC.black, 0],
      [0.22, 0.97, -0.18, 0.34, 0.08, 0.2, VC.red, 2, 1], [-0.22, 0.97, -0.18, 0.34, 0.08, 0.2, VC.blue, 2, 2], [0, 0.93, -0.18, 0.86, 0.03, 0.24, VC.black, 0],
    ]), len: 2.2, wid: 1.1, maxV: 23.5, turn: 2.6, grip: 7.5, hp: 45, mass: 1, color: VC.white
  },
  suv: {
    name: 'ESU', parts: [
      [0, 0.5, 0, 1.2, 0.6, 2.3, 'body', 0], rake(0.8, 0.74, 1.12, 0.48, 1.08, VC.glass, 6), [0, 0.97, -0.25, 1.12, 0.32, 1.42, VC.glass, 6], [0, 1.16, -0.18, 1.12, 0.07, 1.56, 'body', 0],
      [0.61, 0.55, 0, 0.02, 0.1, 2.0, VC.white, 0], [-0.61, 0.55, 0, 0.02, 0.1, 2.0, VC.white, 0],
      [0, 0.36, 1.2, 1.04, 0.32, 0.1, VC.black, 0], [0, 0.6, 1.16, 0.6, 0.14, 0.03, VC2.grille, 0],
      [0.25, 1.24, -0.1, 0.4, 0.1, 0.24, VC.red, 2, 1], [-0.25, 1.24, -0.1, 0.4, 0.1, 0.24, VC.blue, 2, 2],
      [0.38, 0.62, 1.155, 0.2, 0.1, 0.03, VC.headl, 2, 5], [-0.38, 0.62, 1.155, 0.2, 0.1, 0.03, VC.headl, 2, 5],
      [0.42, 0.62, -1.155, 0.16, 0.14, 0.03, VC.tail, 2], [-0.42, 0.62, -1.155, 0.16, 0.14, 0.03, VC.tail, 2],
      [0.64, 0.86, 0.5, 0.08, 0.08, 0.12, VC.black, 0], [-0.64, 0.86, 0.5, 0.08, 0.08, 0.12, VC.black, 0],
    ].concat(wheels([-0.56, 0.56], [-0.75, 0.75], 0.24, 0.24)), len: 2.3, wid: 1.2, maxV: 25.5, turn: 2.45, grip: 7.5, hp: 75, mass: 1.5, color: VC.navy
  },
  armored: {
    name: 'ESU HEAVY', parts: [
      [0, 0.75, 0, 1.45, 1.1, 2.9, 'body', 0], rake(1.0, 1.46, 1.3, 1.2, 1.2, VC.glass, 6), [0, 0.45, 1.5, 1.3, 0.4, 0.15, VC.black, 0],
      [0, 1.32, -0.2, 1.3, 0.04, 2.3, VC.dark, 0], [0.735, 1.05, -0.3, 0.02, 0.2, 0.9, VC.glass, 6], [-0.735, 1.05, -0.3, 0.02, 0.2, 0.9, VC.glass, 6],
      [0.3, 1.36, 0.6, 0.4, 0.12, 0.26, VC.red, 2, 1], [-0.3, 1.36, 0.6, 0.4, 0.12, 0.26, VC.blue, 2, 2], [0.74, 0.7, -0.2, 0.02, 0.18, 2.2, VC.white, 0], [-0.74, 0.7, -0.2, 0.02, 0.18, 2.2, VC.white, 0],
      [0.45, 0.72, 1.455, 0.2, 0.1, 0.03, VC.headl, 2, 5], [-0.45, 0.72, 1.455, 0.2, 0.1, 0.03, VC.headl, 2, 5],
      [0.55, 0.7, -1.455, 0.14, 0.14, 0.03, VC.tail, 2], [-0.55, 0.7, -1.455, 0.14, 0.14, 0.03, VC.tail, 2],
    ].concat(wheels([-0.66, 0.66], [-0.95, 0.95], 0.3, 0.26)), len: 2.9, wid: 1.45, maxV: 22, turn: 2.1, grip: 9, hp: 170, mass: 3, color: VC.gun
  },
  bus: {
    name: 'MTA BUS', parts: [
      [0, 0.85, 0, 1.3, 1.3, 5.0, VC.white, 0], [0, 1.15, 0.1, 1.32, 0.45, 4.6, VC.glass, 6], [0, 0.55, 0, 1.32, 0.18, 4.9, VC.mta, 0], [0, 1.52, 0, 1.25, 0.06, 4.8, VC.mta, 0],
      [0, 1.15, 2.51, 1.1, 0.5, 0.03, VC.glass, 6], [0, 1.6, 2.5, 0.8, 0.15, 0.04, hex('#ff9f1a'), 2],
      [0.4, 0.55, 2.51, 0.2, 0.1, 0.03, VC.headl, 2, 5], [-0.4, 0.55, 2.51, 0.2, 0.1, 0.03, VC.headl, 2, 5], [0.5, 0.55, -2.51, 0.14, 0.18, 0.03, VC.tail, 2], [-0.5, 0.55, -2.51, 0.14, 0.18, 0.03, VC.tail, 2],
    ].concat(wheels([-0.6, 0.6], [1.7, -1.6], 0.26, 0.22)), len: 5.0, wid: 1.3, maxV: 12, turn: 1.6, grip: 9, hp: 200, mass: 4, color: VC.white
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

// ============================================================
//  Vehicle mesh builder (dedicated geometry, not boxes)
//  A model's build(M) adds parts to a mesh builder; the result is one flat-shaded triangle list
//  uploaded once to the GPU and drawn instanced (gl.js addMesh / meshPush). Same mesh in the garage
//  and on the street. Wheels are a separate shared mesh so they can spin and steer.
//  Style: { c: [r,g,b] colour, m: material, p: paint factor (0 = fixed colour, >0 = instance colour × p) }
// ============================================================
function MeshBuilder() { this.v = []; }
MeshBuilder.prototype = {
  // triangle with normal oriented away from `ref` (a point inside the part)
  tri(a, b, c, S, ref) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    const mx = (a[0] + b[0] + c[0]) / 3 - ref[0], my = (a[1] + b[1] + c[1]) / 3 - ref[1], mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; const t = b; b = c; c = t; }
    for (const p of [a, b, c]) this.v.push(p[0], p[1], p[2], nx, ny, nz, S.c[0], S.c[1], S.c[2], S.m || 0, S.p || 0);
  },
  quad(a, b, c, d, S, ref) { this.tri(a, b, c, S, ref); this.tri(a, c, d, S, ref); },
  // closed hull through stations [{z, pts:[[x,y]...]}] (same point count, convex loops), capped at both ends
  loft(st, S) {
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const s of st) for (const p of s.pts) { cx += p[0]; cy += p[1]; cz += s.z; n++; }
    const ref = [cx / n, cy / n, cz / n], K = st[0].pts.length;
    for (let i = 0; i + 1 < st.length; i++) for (let k = 0; k < K; k++) {
      const a = st[i], b = st[i + 1], k2 = (k + 1) % K;
      this.quad([a.pts[k][0], a.pts[k][1], a.z], [b.pts[k][0], b.pts[k][1], b.z], [b.pts[k2][0], b.pts[k2][1], b.z], [a.pts[k2][0], a.pts[k2][1], a.z], S, ref);
    }
    for (const s of [st[0], st[st.length - 1]]) {
      let qx = 0, qy = 0; for (const p of s.pts) { qx += p[0]; qy += p[1]; } qx /= K; qy /= K;
      for (let k = 0; k < K; k++) { const k2 = (k + 1) % K; this.tri([qx, qy, s.z], [s.pts[k][0], s.pts[k][1], s.z], [s.pts[k2][0], s.pts[k2][1], s.z], S, ref); }
    }
  },
  // 8 corners (any order) → 6 faces of a convex hexahedron: c[0..3] one end, c[4..7] other end, same winding
  hexa(c, S) {
    const ref = [0, 1, 2].map(i => c.reduce((s, p) => s + p[i], 0) / 8);
    const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    for (const f of F) this.quad(c[f[0]], c[f[1]], c[f[2]], c[f[3]], S, ref);
  },
  // box centred at (x,y,z) size (sx,sy,sz); ch = chamfer on the 4 edges running along z
  box(x, y, z, sx, sy, sz, S, ch) {
    const hx = sx / 2, hy = sy / 2, c = Math.min(ch || 0, hx * 0.45, hy * 0.45);
    const pts = c > 0 ? [[hx - c, -hy], [hx, -hy + c], [hx, hy - c], [hx - c, hy], [-hx + c, hy], [-hx, hy - c], [-hx, -hy + c], [-hx + c, -hy]] : [[hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]];
    this.loft([-sz / 2, sz / 2].map(dz => ({ z: z + dz, pts: pts.map(p => [p[0] + x, p[1] + y]) })), S);
  },
  // bar between two 3D points; w = width across x, h = thickness in the y/z plane
  beam(a, b, w, h, S) {
    const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...t); t[0] /= L; t[1] /= L; t[2] /= L;
    let u = [0, -t[2], t[1]]; const ul = Math.hypot(...u) || 1; u = u.map(x => x / ul);         // perpendicular in the y/z plane
    const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
    const C = []; for (const P of [a, b]) for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) C.push([0, 1, 2].map(i => P[i] + u[i] * su * h / 2 + v[i] * sv * w / 2));
    this.hexa(C, S);
  },
  // solid of revolution around the x axis through (0,cy,cz): profile [[x, r], ...]; styles per segment
  revolve(cx, cy, cz, prof, seg, styles) {
    for (let i = 0; i + 1 < prof.length; i++) {
      const [x0, r0] = prof[i], [x1, r1] = prof[i + 1], S = styles[i];
      for (let k = 0; k < seg; k++) {
        const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
        const P = (x, r, a) => [cx + x, cy + Math.sin(a) * r, cz + Math.cos(a) * r];
        const ref = [cx + (x0 + x1) / 2 * 0.2, cy, cz];
        this.quad(P(x0, r0, a0), P(x1, r1, a0), P(x1, r1, a1), P(x0, r0, a1), S, ref);
      }
    }
  },
  // flat arc band in the y/z plane at x (wheel-arch trim): radii r0..r1, angles a0..a1 (0 = +z, π/2 = up)
  arc(x, cy, cz, r0, r1, a0, a1, seg, th, S) {
    for (let k = 0; k < seg; k++) {
      const A = a0 + (a1 - a0) * k / seg, B = a0 + (a1 - a0) * (k + 1) / seg;
      const P = (r, a, dx) => [x + dx, cy + Math.sin(a) * r, cz + Math.cos(a) * r];
      this.hexa([P(r0, A, -th / 2), P(r1, A, -th / 2), P(r1, B, -th / 2), P(r0, B, -th / 2), P(r0, A, th / 2), P(r1, A, th / 2), P(r1, B, th / 2), P(r0, B, th / 2)], S);
    }
  },
  mirrorX(fn) { fn(1); fn(-1); },
  out() { return new Float32Array(this.v); },
};
// shared wheel: radius 1, axle along x, width 1. Tyre (tread, shoulders, sidewalls), recessed rim (instance colour), spokes, hub
function buildWheelMesh() {
  const M = new MeshBuilder(), T = { c: hex('#1a1b1e') }, TR = { c: hex('#24252a') }, RIM = { c: [1, 1, 1], p: 1, m: 14 }, RD = { c: [1, 1, 1], p: 0.42 }, HUB = { c: hex('#3a3f46'), m: 14 };
  const prof = [[-0.36, 0], [-0.36, 0.6], [-0.47, 0.66], [-0.5, 0.86], [-0.42, 1.0], [0.42, 1.0], [0.5, 0.86], [0.47, 0.66], [0.36, 0.6], [0.36, 0]];
  M.revolve(0, 0, 0, prof, 16, [RD, RIM, T, T, TR, T, T, RIM, RD]);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; M.beam([sx * 0.4, Math.sin(a) * 0.14, Math.cos(a) * 0.14], [sx * 0.4, Math.sin(a) * 0.56, Math.cos(a) * 0.56], 0.06, 0.13, RIM); }
    M.revolve(sx * 0.42, 0, 0, sx > 0 ? [[-0.04, 0.17], [0.04, 0.13], [0.05, 0]] : [[0.04, 0.17], [-0.04, 0.13], [-0.05, 0]], 10, [HUB, HUB]);
  }
  return M.out();
}
// cross-section helper for lower bodies: chamfered bottom, shoulder crease, tumblehome to the top surface
function sec(z, yb, ys, yt, wb, ws, wt, c) { c = c || 0.04; return { z, pts: [[wb - c, yb], [wb, yb + c], [ws, ys], [wt, yt], [-wt, yt], [-ws, ys], [-wb, yb + c], [-wb + c, yb]] }; }
function gsec(z, yb, yt, wb, wt) { return { z, pts: [[wb, yb], [wt, yt], [-wt, yt], [-wb, yb]] }; }
const CS = {
  body: { c: [1, 1, 1], p: 1 }, bodyDk: { c: [1, 1, 1], p: 0.7 }, glass: { c: hex('#1c2838'), m: 6 }, trim: { c: hex('#1d1f24') }, black: { c: hex('#121316') },
  chrome: { c: hex('#d4d8dd'), m: 14 }, gold: { c: hex('#e8b923'), m: 14 }, gloss: { c: hex('#0f1012'), m: 6 }, rev: { c: hex('#e9ecef'), m: 2 }, head: { c: hex('#fff7d6'), m: 12 }, tail: { c: hex('#ff2a2a'), m: 13 }, plate: { c: hex('#f2f2ea') }, amber: { c: hex('#ffb020'), m: 2 },
};
const SEDAN_WHEEL = { x: 0.465, r: 0.245, w: 0.2, z: 0.72 };
// ---- STREET SEDAN (quality benchmark) ----
// Three-box NYC sedan: long hood, cabin set back, flat separate trunk deck, low roof. Front at +z.
function buildSedan(M) {
  const B = CS, W = SEDAN_WHEEL;
  // lower body: rear bumper → trunk deck → cabin base → long hood → nose
  M.loft([
    sec(-1.12, 0.18, 0.40, 0.50, 0.48, 0.51, 0.46, 0.05),
    sec(-1.07, 0.16, 0.45, 0.575, 0.515, 0.548, 0.50),
    sec(-0.56, 0.15, 0.46, 0.585, 0.52, 0.556, 0.505),
    sec(0.32, 0.15, 0.46, 0.585, 0.52, 0.556, 0.505),
    sec(0.80, 0.15, 0.45, 0.545, 0.52, 0.552, 0.50),
    sec(1.06, 0.17, 0.41, 0.475, 0.50, 0.53, 0.465),
    sec(1.12, 0.20, 0.37, 0.43, 0.46, 0.49, 0.42, 0.05),
  ], B.body);
  // glasshouse: steep-ish rear glass → low roof → raked windshield
  M.loft([gsec(-0.58, 0.585, 0.59, 0.495, 0.48), gsec(-0.30, 0.585, 0.875, 0.495, 0.395), gsec(-0.01, 0.585, 0.88, 0.495, 0.395), gsec(0.34, 0.585, 0.59, 0.495, 0.48)], B.glass);
  M.box(0, 0.893, -0.155, 0.83, 0.03, 0.34, B.body, 0.015);                              // roof skin
  M.box(0, 0.6, -1.045, 0.93, 0.022, 0.07, B.body, 0.008);                                // trunk lip
  M.mirrorX(s => {
    // pillars: body-colour A and wide C, gloss-black B
    M.beam([s * 0.478, 0.595, 0.34], [s * 0.392, 0.885, -0.01], 0.05, 0.065, B.body);
    M.beam([s * 0.492, 0.595, -0.135], [s * 0.405, 0.885, -0.135], 0.05, 0.08, B.gloss);
    M.beam([s * 0.478, 0.595, -0.58], [s * 0.392, 0.885, -0.30], 0.05, 0.13, B.body);
    M.beam([s * 0.502, 0.592, -0.56], [s * 0.502, 0.592, 0.31], 0.014, 0.018, B.chrome); // window belt chrome
    // side: rocker, crease, door shut lines, handles with recess
    M.box(s * 0.535, 0.19, -0.12, 0.04, 0.075, 1.05, B.trim, 0.01);
    M.box(s * 0.557, 0.455, 0, 0.008, 0.012, 1.9, B.bodyDk);                               // shoulder crease
    for (const z of [0.30, -0.13]) M.box(s * 0.553, 0.385, z, 0.012, 0.37, 0.018, B.black); // door fronts/rear
    M.box(s * 0.548, 0.36, -0.545, 0.012, 0.33, 0.018, B.black);                            // rear door rear edge
    M.box(s * 0.545, 0.205, -0.12, 0.012, 0.016, 0.85, B.black);                            // door bottoms
    for (const z of [0.12, -0.36]) { M.box(s * 0.553, 0.49, z, 0.012, 0.04, 0.13, B.black); M.box(s * 0.562, 0.49, z, 0.012, 0.026, 0.11, B.chrome); }
    // mirror: body shell on black stalk, amber repeater
    M.box(s * 0.55, 0.615, 0.27, 0.06, 0.03, 0.06, B.trim);
    M.box(s * 0.605, 0.64, 0.27, 0.1, 0.075, 0.14, B.body, 0.02); M.box(s * 0.606, 0.615, 0.33, 0.09, 0.012, 0.02, B.amber);
    // wheel arches: body-colour flare lip + black liner
    for (const z of [W.z, -W.z]) { M.arc(s * 0.557, W.r, z, W.r + 0.035, W.r + 0.075, -0.15, Math.PI + 0.15, 11, 0.035, B.body); M.arc(s * 0.551, W.r, z, W.r + 0.005, W.r + 0.04, -0.1, Math.PI + 0.1, 11, 0.03, B.black); }
    // headlights: black housing, lens, LED daytime strip, side wrap
    M.box(s * 0.32, 0.405, 1.09, 0.27, 0.095, 0.07, B.black, 0.02);
    M.box(s * 0.325, 0.41, 1.112, 0.22, 0.06, 0.02, B.head, 0.015);
    M.box(s * 0.32, 0.372, 1.118, 0.24, 0.012, 0.014, B.head);
    M.box(s * 0.458, 0.405, 1.02, 0.04, 0.075, 0.14, B.head);
    // bumper details: fog lights in black pods, amber corner markers
    M.box(s * 0.37, 0.205, 1.148, 0.13, 0.05, 0.02, B.black); M.box(s * 0.37, 0.205, 1.156, 0.09, 0.03, 0.01, B.head);
    M.box(s * 0.485, 0.27, 1.085, 0.04, 0.03, 0.06, B.amber);
    // taillights: wide red bar with inner reverse lamp, wrap onto the quarter
    M.box(s * 0.35, 0.475, -1.11, 0.31, 0.11, 0.05, B.black, 0.02);                      // smoked housing
    M.box(s * 0.35, 0.478, -1.128, 0.27, 0.07, 0.02, B.tail, 0.015);
    M.box(s * 0.35, 0.448, -1.137, 0.27, 0.012, 0.01, B.tail);                            // lower LED line
    M.box(s * 0.23, 0.478, -1.14, 0.045, 0.045, 0.012, B.rev);
    M.box(s * 0.502, 0.478, -1.02, 0.04, 0.075, 0.17, B.black); M.box(s * 0.512, 0.478, -1.02, 0.03, 0.05, 0.14, B.tail);
    M.box(s * 0.3, 0.165, -1.135, 0.08, 0.05, 0.05, B.chrome);                              // dual exhaust
  });
  // front fascia: chrome-framed grille with slats + badge, body-colour bumper with black intake
  M.box(0, 0.33, 1.112, 0.54, 0.15, 0.035, B.chrome, 0.03);
  M.box(0, 0.33, 1.124, 0.48, 0.11, 0.02, B.black, 0.02);
  for (const y of [0.30, 0.33, 0.36]) M.box(0, y, 1.136, 0.46, 0.011, 0.012, B.chrome);
  M.box(0, 0.33, 1.145, 0.075, 0.05, 0.012, B.gold, 0.01);
  M.box(0, 0.225, 1.11, 1.03, 0.12, 0.085, B.body, 0.035);
  M.box(0, 0.19, 1.155, 0.52, 0.045, 0.02, B.black, 0.01); M.box(0, 0.165, 1.13, 0.9, 0.02, 0.05, B.trim);
  // rear: chrome strip, recessed plate, body bumper + black diffuser
  M.box(0, 0.475, -1.128, 0.36, 0.022, 0.012, B.chrome);
  M.box(0, 0.36, -1.128, 0.3, 0.11, 0.012, B.black); M.box(0, 0.36, -1.136, 0.26, 0.085, 0.01, B.plate);
  M.box(0, 0.235, -1.11, 1.03, 0.12, 0.085, B.body, 0.035);
  M.box(0, 0.175, -1.145, 0.68, 0.045, 0.03, B.trim, 0.01);
  M.box(0, 0.165, 0, 0.98, 0.03, 1.95, B.black);                                           // underbody
}
function buildVehicleMeshes() {
  if (!GFX.ok) return;
  GFX.addMesh('wheel', buildWheelMesh());
  for (const k in MODELS) { const m = MODELS[k]; if (!m.build) continue; const M = new MeshBuilder(); m.build(M); m.mesh = 'car_' + k; m.tris = M.v.length / 33; GFX.addMesh(m.mesh, M.out()); }
}

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
const AIR_G = 30;
function groundH(x, z) {
  const s = segHit(x, z);
  if (s && s.type === SEG_BRIDGE) return bridgeH(s.br, SH.t);
  return rampHeight(x, z);
}
function stepVehicle(v, dt) {
  const fx = Math.sin(v.h), fz = -Math.cos(v.h), rx = Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  if (v.sink > 0) { v.sink += dt; v.y -= dt * 0.9; v.vx *= 0.94; v.vz *= 0.94; v.x += v.vx * dt; v.z += v.vz * dt; v.pitch += dt * 0.5; return; }
  if (!v.alive || v.wreck) { vf *= Math.exp(-2.5 * dt); vr *= Math.exp(-4 * dt); v.thr = 0; v.steer = 0; }
  // airborne (off a jump ramp): ballistic, no grip or steering until it lands
  if (v.air) {
    v.vy -= AIR_G * dt; v.y += v.vy * dt; v.airT += dt;
    v.x += v.vx * dt; v.z += v.vz * dt;
    v.h += v.spin * dt; v.spin *= Math.exp(-1 * dt);
    v.pitch = Math.max(-0.35, Math.min(0.45, -v.vy * 0.035));
    const gh = groundH(v.x, v.z);
    if (v.y <= gh) { v.y = gh; v.air = false; v.landed = v.airT; v.landV = -v.vy; v.vy = 0; v.pitch = 0; }
    return;
  }
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
  // jump ramps: follow the hump up; when it starts dropping away at speed, launch
  const rh = rampHeight(v.x, v.z);
  if (rh > 0) {
    if (rh < (v.rampH || 0) - 0.001 && (v.rampH || 0) > RAMP_H * 0.45 && sp > 6) {
      v.air = true; v.airT = 0; v.vy = Math.min(17, sp * 0.62); v.y = v.rampH; v.rampH = 0;
    } else { v.rampH = rh; v.y = rh; }
  } else if (v.rampH) { v.rampH = 0; }
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
    if (v.y > 0.6 && !v.air) continue; // on elevated bridge deck: only railings matter
    WORLD.forCols(cx, cz, r + 0.2, (c, k) => {
      if (v.air && c[k + 6] < v.y) return false; // flying over it
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
    if (!v.air || v.y < 1.2) WORLD.forProps(cx, cz, r + 1.1, (ch, id) => {
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
    v.onBridge = br; if (!v.air) v.y += (h - v.y) * Math.min(1, dt * 20);
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
    v.onBridge = null;
    if (!v.air && !v.rampH) v.y += (0 - v.y) * Math.min(1, dt * 8);
    if (!v.air && v.y < 0.3 && tileAt(v.x, v.z) === T_WATER && v.sink === 0) v.sink = 0.001;
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
