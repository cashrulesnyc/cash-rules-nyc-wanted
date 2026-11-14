// ============================================================
//  Chunk generation (runs in a Web Worker and on main thread)
//  Output per chunk: ground texture, box instances, colliders,
//  smashable props, billboards.
// ============================================================
const CH = 48, CTEX = 256;
const INST = 14; // floats per box instance: pos3 scale3 quat4 rgb3 mat1
const COLF = 7;  // collider: cx cz ax az ha hb h
const PROPF = 8; // prop: x z r type instStart instCount yaw mass

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
const PAL = {
  tower: ['#9db4c8', '#c3c9cf', '#d9d0c1', '#8ea2b5', '#e3ddd2', '#7f8d9a', '#b8b0a2', '#a7b7c4', '#cfd8de', '#6f7f8f'].map(hex),
  walkup: ['#a5573a', '#b9764f', '#8e4f3a', '#c9a27e', '#d8c9b0', '#b08a6a', '#9a4a3a'].map(hex),
  brown: ['#8b4a32', '#a0522d', '#b5653a', '#9c6b4e', '#c48a5a', '#7c4a3a', '#d9b38c', '#a8705a'].map(hex),
  brick: ['#b45f3c', '#c9b49a', '#a65a3a', '#d6c7ae', '#8e5b45', '#e0d5c1', '#9a6a50', '#c78a62'].map(hex),
  house: ['#f0e6d2', '#cfe3f0', '#e9d7a8', '#d9ead3', '#f2d4cf', '#fafafa', '#e6e0f2', '#f6e3b4'].map(hex),
  roof: ['#6b4f3a', '#4a4a4a', '#7a3b2e', '#3f4a56', '#5c5048'].map(hex),
  car: ['#d23c3c', '#2f6fd0', '#f2f2f2', '#222428', '#8a8f96', '#2e8b57', '#e0b030', '#7a3fb0', '#c9c9c9', '#1d3557', '#f28c28', '#5a2a1a'].map(hex),
  leaf: ['#4caf50', '#3f9e45', '#5bbd4f', '#45a347'].map(hex),
  glass: ['#5d86a8', '#4f7c8f', '#7c97ad', '#3f6f8f', '#6aa0b8', '#8aa3b8', '#4b6478', '#5f8f9a'].map(hex),
  awning: ['#c0392b', '#1f6f43', '#1d3557', '#e0a91a', '#6b2d5c', '#d35400', '#2c3e50', '#8e1b1b'].map(hex),
  stone: ['#c9b79c', '#b8a88f', '#d8cbb4', '#a99a83'].map(hex),
};
const C = {
  trunk: hex('#6b4a2b'), pole: hex('#4d535b'), lamp: hex('#fff2b0'), red: hex('#d22b2b'), dkgreen: hex('#2f5a3a'), gray: hex('#8d9196'),
  dark: hex('#2a2c31'), glass: hex('#2c3e55'), tire: hex('#1b1b1d'), wood: hex('#7a5230'), wood2: hex('#5b3c22'), silver: hex('#c9cdd2'),
  stone: hex('#d8d0bf'), liberty: hex('#6fb7a0'), libdark: hex('#5aa08b'), gold: hex('#f2c230'), white: hex('#f4f4f4'), blue: hex('#2b5fb3'),
  green: hex('#1eb35a'), black: hex('#141414'), rust: hex('#8a4b2f'), field: hex('#4fa84a'), dirt: hex('#c08a58'), brick: hex('#9a4b35'),
  sand: hex('#e8cf8e'), concrete: hex('#b9b5ad'), steel: hex('#8f9aa4'), yellow: hex('#f5c518'), orange: hex('#f07c1e'),
};

let OB = null; // output boxes
function box(x, y, z, sx, sy, sz, yaw, col, mat) {
  const q = yaw * 0.5;
  OB.push(x, y, z, sx, sy, sz, 0, Math.sin(q), 0, Math.cos(q), col[0], col[1], col[2], mat || 0);
}
function boxQ(x, y, z, sx, sy, sz, q, col, mat) { OB.push(x, y, z, sx, sy, sz, q[0], q[1], q[2], q[3], col[0], col[1], col[2], mat || 0); }
function rot(cx, cz, yaw, lx, lz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [cx + lx * c + lz * s, cz - lx * s + lz * c]; }
// local box relative to an object frame
function lbox(cx, cz, yaw, lx, y, lz, sx, sy, sz, col, mat) { const p = rot(cx, cz, yaw, lx, lz); box(p[0], y, p[1], sx, sy, sz, yaw, col, mat); }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function ihash(a, b, c) { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return (h ^ (h >>> 16)) >>> 0; }
function gauss(x, z, p, s) { const dx = x - p[0], dz = z - p[1]; return Math.exp(-(dx * dx + dz * dz) / (s * s)); }

// ---------- landmarks ----------
const LM = [];
function lmAdd(type, lat, lon, r, extra) { const p = P(lat, lon); LM.push(Object.assign({ type, x: p[0], z: p[1], r }, extra || {})); }
function initWorldData() {
  LM.length = 0;

  lmAdd('liberty', 40.6892, -74.0445, 0, { name: 'STATUE OF LIBERTY', nr: 14 });
  lmAdd('yankee', 40.8296, -73.9262, 11, { name: 'YANKEE STADIUM' });
  lmAdd('citi', 40.7571, -73.8458, 11, { name: 'CITI FIELD' });
  lmAdd('barclays', 40.6826, -73.9754, 9, { name: 'BARCLAYS CENTER' });
  lmAdd('wheel', 40.5745, -73.9790, 5, { name: 'WONDER WHEEL' });
  lmAdd('parachute', 40.5738, -73.9845, 3, { name: 'PARACHUTE JUMP' });
  lmAdd('unisphere', 40.7465, -73.8448, 7, { name: 'UNISPHERE' });
  // block-anchored landmarks: centred on the Manhattan grid block that holds them
  lmAdd('vessel', 40.7537, -74.0021, 3.4, { name: 'THE VESSEL · HUDSON YARDS' });
  lmAdd('hy30', 40.7541, -74.0004, 3.6, { name: 'EDGE · 30 HUDSON YARDS' });
  // Bloomfield logistics park (Staten Island): labels only; the geometry is pre-built once (buildSite) and streamed per chunk
  { const a = bfW(34, 31), b = bfW(80, 29), m = bfW(70, 66);
    LM.push({ type: 'label', x: a[0], z: a[1], r: 0, nr: 26, name: 'JFK8', sub: 'FULFILLMENT CENTER · GULF AVE' });
    LM.push({ type: 'label', x: b[0], z: b[1], r: 0, nr: 24, name: 'DYY6', sub: 'DELIVERY STATION · GULF AVE' });
    LM.push({ type: 'label', x: m[0], z: m[1], r: 0, nr: 34, name: 'BLOOMFIELD MARSH', sub: 'ARTHUR KILL WETLANDS' });
    LM.push({ type: 'label', x: SNUG[0], z: SNUG[1], r: 17, nr: 22, name: 'SNUG HARBOR', sub: 'CULTURAL CENTER · RICHMOND TERRACE' }); LM.push({ type: 'label', x: SNUG[0] + 24, z: SNUG[1], r: 4.5 }); LM.push({ type: 'label', x: SNUG[0] - 6, z: SNUG[1] + 15, r: 5 });
    const sm = fW(SM, 0, 37); LM.push({ type: 'label', x: sm[0], z: sm[1], r: 0, nr: 42, name: 'STATEN ISLAND MALL', sub: 'RICHMOND AVE · NEW SPRINGVILLE' });
    for (const c of GEO.CAMPUS) { let la = 0, lo = 0; for (const q of c[2]) { la += q[0]; lo += q[1]; } const w = P(la / c[2].length, lo / c[2].length); LM.push({ type: 'label', x: w[0], z: w[1], r: 0, nr: 16, name: c[0], sub: c[1] }); }
    for (const [s, t, nr, name, sub] of [[66, 40, 18, 'RICHMOND AVE PLAZA', '2795 RICHMOND AVE · ELECTRONICS · GROCERY'], [97, 40, 14, 'RICHMOND SHOPPING CENTER', '2873 RICHMOND AVE · DEPARTMENT STORE'], [119, 38, 18, 'WAREHOUSE CLUB', '2975 RICHMOND AVE · GAS · TIRES']]) {
      const w = fW(PZ, s, t); LM.push({ type: 'label', x: w[0], z: w[1], r: 0, nr, name, sub }); } }
  initLots(); buildSite(); carveSites();
  for (const [type, lat, lon, r, name, dv] of [['flatiron', 40.7411, -73.9897, 3.6, 'FLATIRON BUILDING', 0], ['wsq', 40.7308, -73.9973, 3.2, 'WASHINGTON SQUARE ARCH', 0],
    ['msg', 40.7505, -73.9934, 4.6, 'MADISON SQUARE GARDEN', 0], ['gct', 40.7527, -73.9772, 4.0, 'GRAND CENTRAL TERMINAL', 0], ['metlife', 40.7536, -73.9766, 4.0, 'METLIFE BUILDING', 0],
    ['rock', 40.7587, -73.9787, 5.0, 'ROCKEFELLER CENTER', 0], ['esb', 40.7484, -73.9857, 5.5, 'EMPIRE STATE BUILDING', 0],
    ['chrysler', 40.7516, -73.9755, 4.5, 'CHRYSLER BUILDING', 0], ['wtc', 40.7130, -74.0132, 4.5, 'ONE WORLD TRADE CENTER', 0]]) {
    const g = GRIDS[1], b = blockOf(g, lat, lon), c = gWorld(g, (b[0] + 0.5) * g.A, (b[1] + 0.5) * g.S + dv);
    LM.push({ type, x: c[0], z: c[1], r, name });
  }
  lmAdd('ferryterm', 40.6440, -74.0728, 6);
  lmAdd('ferryterm', 40.7013, -74.0130, 4);
  lmAdd('plane', 40.6460, -73.7820, 6, { yaw: 0.6 });
  lmAdd('plane', 40.6420, -73.7905, 6, { yaw: 2.2 });
  lmAdd('plane', 40.6380, -73.7770, 6, { yaw: -1.1 });
  lmAdd('plane', 40.7752, -73.8735, 6, { yaw: 1.2 });
  lmAdd('plane', 40.7790, -73.8800, 6, { yaw: -0.4 });
  // Times Square: four blocks around nearest intersection
  {
    const g = GRIDS[1], p = P(40.7575, -73.9858), l = gLocal(g, p[0], p[1]);
    const iu = Math.round(l[0] / g.A), iv = Math.round(l[1] / g.S);
    LM.push({ type: 'tsq', x: gWorld(g, iu * g.A, iv * g.S)[0], z: gWorld(g, iu * g.A, iv * g.S)[1], r: 0, iu, iv, blocks: [[iu - 1, iv - 1], [iu, iv - 1], [iu - 1, iv], [iu, iv]] });
  }
}
function lmExcluded(x, z, pad) {
  for (let k = 0; k < LM.length; k++) { const L = LM[k]; if (L.r > 0) { const dx = x - L.x, dz = z - L.z; if (dx * dx + dz * dz < (L.r + pad) * (L.r + pad)) return true; } }
  return false;
}
// ---------- jump ramps ----------
// A ramp is a two-sided hump across an avenue, mid-block. rampValid(g,i,j) says whether avenue line i has
// one at block j; rampHeight(x,z) is the deck height under a point (0 if none). Both are pure, so the chunk
// worker (visuals) and the main thread (physics) agree without sharing data.
const RAMP_L = 3.2, RAMP_H = 0.62, RAMP_P = 0; // ramps removed per owner (Nov 2026): share of mid-blocks with a ramp = 0, so none are built and rampHeight() is always 0
const RAMPC = new Map();
function rampValid(g, i, j) {
  const k = g.boro * 1e8 + (i + 5000) * 1e4 + (j + 5000);
  let r = RAMPC.get(k); if (r !== undefined) return r;
  r = false;
  if ((ihash(i, j, g.boro * 31 + 7) % 1000) / 1000 < RAMP_P && g.S - g.ws > RAMP_L + 2) {
    r = true;
    for (const dv of [-RAMP_L / 2 - 0.6, 0, RAMP_L / 2 + 0.6]) for (const du of [-g.wa * 0.4, 0, g.wa * 0.4]) {
      const q = gWorld(g, i * g.A + du, (j + 0.5) * g.S + dv);
      if (tileAt(q[0], q[1]) !== T_ROAD || boroAt(q[0], q[1]) !== g.boro || lmExcluded(q[0], q[1], 1)) { r = false; break; }
    }
  }
  if (RAMPC.size > 20000) RAMPC.clear();
  RAMPC.set(k, r); return r;
}
function rampHeight(x, z) {
  const b = boroAt(x, z); if (!b) return 0;
  const g = GRIDS[b], l = gLocal(g, x, z);
  const i = Math.round(l[0] / g.A), du = l[0] - i * g.A;
  if (Math.abs(du) > g.wa * 0.45) return 0;
  const j = Math.floor(l[1] / g.S), dv = l[1] - (j + 0.5) * g.S;
  if (Math.abs(dv) > RAMP_L / 2) return 0;
  if (!rampValid(g, i, j)) return 0;
  return RAMP_H * (1 - Math.abs(dv) / (RAMP_L / 2));
}
function buildRamp(g, i, j) {
  const yaw = -g.th, half = RAMP_L / 2, len = Math.hypot(half, RAMP_H), ang = Math.atan2(RAMP_H, half), w = g.wa * 0.9;
  const Y = hex('#f2b01e'), K = hex('#1b1c20');
  for (const sd of [-1, 1]) { // local z = -v; slab centred at v = -sd*half/2 rises toward the crest
    const c = gWorld(g, i * g.A, (j + 0.5) * g.S - sd * half / 2);
    boxQ(c[0], RAMP_H / 2 - 0.04, c[1], w, 0.1, len, qm(qy(yaw), qa(1, 0, 0, sd * ang)), Y, 0);
    for (const o of [-0.32, 0, 0.32]) { // black chevron stripes
      const c2 = gWorld(g, i * g.A, (j + 0.5) * g.S - sd * half / 2 + sd * o * half);
      boxQ(c2[0], RAMP_H * (0.5 + o) - 0.02, c2[1], w + 0.02, 0.1, 0.22, qm(qy(yaw), qa(1, 0, 0, sd * ang)), K, 0);
    }
    for (const su of [-1, 1]) { const e = gWorld(g, i * g.A + su * w / 2, (j + 0.5) * g.S - sd * half / 2); boxQ(e[0], RAMP_H / 4, e[1], 0.12, RAMP_H / 2, half, qy(yaw), K, 0); }
  }
}

function tsqBlock(b, i, j) {
  if (b !== 1) return false;
  for (const L of LM) if (L.type === 'tsq') for (const q of L.blocks) if (q[0] === i && q[1] === j) return true;
  return false;
}

// ---------- chunk generation ----------
function genChunk(cx, cz) {
  const x0 = cx * CH, z0 = cz * CH;
  const tex = new Uint8Array(CTEX * CTEX * 4), o = [0, 0, 0], st = CH / CTEX;
  let land = 0;
  for (let j = 0; j < CTEX; j++) {
    const z = z0 + (j + 0.5) * st;
    for (let i = 0; i < CTEX; i++) {
      const t = texel(x0 + (i + 0.5) * st, z, o);
      // alpha: 32*borough where the street grid decides the tile (the ground shader then draws roads,
      // sidewalks and markings analytically, sharp at any resolution); 255 = use the texture colour as-is
      const k = (j * CTEX + i) * 4; tex[k] = o[0]; tex[k + 1] = o[1]; tex[k + 2] = o[2];
      tex[k + 3] = (t === T_ROAD || t === T_WALK || t === T_LOT) && LASTG ? LASTG.boro * 32 : (t === T_HWY || t === T_RUNWAY) ? 224 : 255; // 224 = highway/avenue/runway segment
      if (t !== T_WATER) land++;
    }
  }
  OB = [];
  const cols = [], props = [], bills = [];
  const ctx = { x0, z0, cols, props, bills };
  if (land > 0) {
    const boros = new Set();
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) { const bb = boroAt(x0 + a * CH / 8, z0 + b * CH / 8); if (bb) boros.add(bb); }
    for (const b of boros) placeBlocks(GRIDS[b], ctx);
    placeOpenProps(ctx);
    addSite(ctx);
    for (const L of LM) if (L.x >= x0 && L.x < x0 + CH && L.z >= z0 && L.z < z0 + CH) {
      const s0 = OB.length; buildLandmark(L, ctx);
      for (let i = s0 + 13; i < OB.length; i += INST) OB[i] += 16; // landmark flag for the slicing shader
    }
  }
  const boxes = new Float32Array(OB); OB = null;
  return { cx, cz, tex, boxes, cols: new Float32Array(cols), props: new Float32Array(props), bills: new Float32Array(bills), land };
}

function inChunk(ctx, x, z) { return x >= ctx.x0 && x < ctx.x0 + CH && z >= ctx.z0 && z < ctx.z0 + CH; }
// ---------- Bloomfield logistics park: two big-box warehouses (generic design, no logos), truck docks, trailers,
// delivery-van lots, employee parking. Built once into SITE_BOXES / SITE_COLS; genChunk copies the boxes whose
// centre falls in the chunk and every collider that overlaps it (so big buildings stay solid across chunk edges).
let SITE_BOXES = null, SITE_COLS = null;
// lot extras (live in this file): which buildings each striped lot serves, the mall ring, keep-clear rects
function initLots() { LOTS[1].bl = MALL_BLDGS; LOTS[1].ring = MALL_RING; if (LOTS.length < 3) LOTS.push({ F: PZ, s0: 48, s1: 132, t0: 2.4, t1: 62, tb: 10.0, bl: PLAZA_BLDGS, ex: [[112, 126, 6, 19]] }); }
// Staten Island Mall (generic: no store names or logos): long concourse, two anchor stores, a big centre court with a
// glass pyramid, a rear wing, entrance canopies, outparcel restaurants. Rects in the SM frame: [s0, s1, t0, t1, H, colour]
const MALL_BLDGS = [
  [-20, 20, 30, 42, 2.4, '#d9cbb2'],   // concourse
  [-4.5, 4.5, 26, 46, 3.4, '#e4d8c2'], // centre court
  [-33, -20, 27, 45, 3.2, '#b8644c'],  // north anchor
  [20, 33, 27, 45, 3.2, '#e2e2dc'],    // south anchor
  [-9, 9, 42, 53, 2.8, '#c9c2b8'],     // rear wing
  [-31, -24, 13, 18.5, 1.3, '#efe6d6'], // outparcel restaurant
  [24, 31, 13, 18.5, 1.3, '#dfe7ea'],  // outparcel
];
// Richmond Ave plazas south of the mall, across Richmond Hill Rd (generic stores, by street address; no names or logos)
// [s0, s1, t0, t1, H, wall colour, kind, accent]   kinds: box (big-box store), super (supermarket), club (warehouse club), pad
const PLAZA_BLDGS = [
  [51, 62, 34, 50, 2.4, '#59656f', 'box', '#20303f'],    // 2795: electronics store
  [63.5, 77, 33, 50, 2.2, '#cfbea3', 'super', '#3d6b47'], // 2795: supermarket
  [78.5, 85, 36, 50, 2.0, '#9c928a', 'box', '#5a4636'],  // 2795: furniture store
  [89, 105, 31, 51, 2.7, '#e7e1d5', 'box', '#6e5c4a'],   // 2873: department store (Richmond Shopping Center)
  [109, 129, 27, 56, 3.0, '#b4b8bc', 'club', '#3a4855'], // 2975: warehouse club
  [54, 59, 10, 15, 1.2, '#efe6d6', 'pad', '#b5452f'],
  [93, 98, 10, 15, 1.2, '#dfe7ea', 'pad', '#2f6f9f'],
];
// generic gas station (canopy + pump islands + kiosk + price pylon); x/z = centre, yaw = local +z along the road,
// local -x = the road side. Pushes boxes into OB and colliders into cols.
function gasStation(cols, x, z, yaw, big, accent) {
  const lb2 = (lx, y, lz, sx, sy, sz, col, mat) => lbox(x, z, yaw, lx, y, lz, sx, sy, sz, col, mat);
  const lc = (lx, lz, sx, sz, h) => { const p = rot(x, z, yaw, lx, lz); cols.push(p[0], p[1], yaw, sx / 2, sz / 2, h); };
  const W = big ? 9 : 7, D = big ? 5 : 4, cx = -0.6, white = hex('#f2f3f4'), ac = hex(accent || '#2f6f9f');
  lb2(cx, 1.85, 0, D, 0.32, W, white, 0);                                               // canopy
  lb2(cx, 1.85, 0, D + 0.06, 0.16, W + 0.06, ac, 2);                                    // lit accent band
  lb2(cx, 1.68, 0, D - 0.4, 0.04, W - 0.4, hex('#fff8dc'), 5);                           // canopy lights
  const isl = big ? [-3.2, -1.1, 1.1, 3.2] : [-1.8, 1.8];
  for (const iz of isl) {
    lb2(cx, 0.08, iz, D * 0.62, 0.16, 0.55, hex('#c9c6bf'), 0);                         // island curb
    for (const ix of [-D * 0.18, D * 0.18]) { lb2(cx + ix, 0.55, iz, 0.42, 0.9, 0.3, hex('#e9eaec'), 0); lb2(cx + ix, 0.75, iz, 0.3, 0.22, 0.32, ac, 2); lb2(cx + ix, 0.55, iz, 0.2, 0.18, 0.33, hex('#1d2430'), 6); }
    lb2(cx, 1.0, iz, 0.14, 1.7, 0.14, hex('#d8d8d8'), 0);                               // column
    lc(cx, iz, D * 0.62, 0.6, 1.0);
  }
  lb2(cx + D / 2 + 1.6, 0.7, 0, 2.2, 1.4, big ? 4.2 : 3.4, hex('#e8e2d6'), 0);           // kiosk / convenience store
  lb2(cx + D / 2 + 0.48, 0.55, 0, 0.06, 0.8, big ? 3.4 : 2.6, hex('#2c3e55'), 7);
  lb2(cx + D / 2 + 1.6, 1.45, 0, 2.3, 0.14, big ? 4.3 : 3.5, ac, 2);
  lc(cx + D / 2 + 1.6, 0, 2.2, big ? 4.2 : 3.4, 1.5);
  const pz = W / 2 + 0.4;                                                                // price pylon at the road corner
  lb2(-D / 2 - 1.4, 1.5, pz, 0.16, 3.0, 0.16, hex('#4d535b'), 0);
  lb2(-D / 2 - 1.4, 2.7, pz, 0.12, 1.2, 1.0, ac, 2); lb2(-D / 2 - 1.46, 2.5, pz, 0.04, 0.55, 0.8, hex('#101318'), 2);
  for (const d of [-0.2, 0.2]) lb2(-D / 2 - 1.49, 2.5, pz + d, 0.02, 0.12, 0.3, hex('#ffb020'), 2);   // LED price digits
  lc(-D / 2 - 1.4, pz, 0.3, 0.3, 3);
}
function buildSite() {
  const keep = OB; OB = [];
  const cols = [], Y = BF.yaw;
  const sb = (s, t, y, ss, sy, st, col, mat) => { const p = bfW(s, t); box(p[0], y, p[1], st, sy, ss, Y, col, mat); };   // ss along the expressway, st across
  const sc = (s, t, ss, st, h) => { const p = bfW(s, t); cols.push(p[0], p[1], Y, st / 2, ss / 2, h); };
  const wall = hex('#d9dcde'), wall2 = hex('#cfd3d6'), base = hex('#7d858d'), band = hex('#4a5866'), rib = hex('#c4c9cd'), roof = hex('#b9bec3');
  const door = hex('#353a42'), trailer = hex('#eef0f2'), van = hex('#e6e8ea'), glass = hex('#2c3e55');
  const R = rng(4242);
  function warehouse(s0, t0, Ls, Lt, H, docksWest, vanDoorsSouth) {
    const ns = Math.ceil(Ls / 11), nt = Math.ceil(Lt / 11), ts = Ls / ns, tt = Lt / nt;
    for (let a = 0; a < ns; a++) for (let b = 0; b < nt; b++) {      // tilt-up wall/roof sections
      const s = s0 - Ls / 2 + (a + 0.5) * ts, t = t0 - Lt / 2 + (b + 0.5) * tt;
      sb(s, t, H / 2, ts, H, tt, (a + b) % 2 ? wall : wall2, 0);
      sb(s, t, H + 0.03, ts - 0.2, 0.06, tt - 0.2, roof, 0);
      for (let k = 0; k < 2; k++) for (let m = 0; m < 2; m++) if (R() < 0.75) sb(s - ts / 4 + k * ts / 2, t - tt / 4 + m * tt / 2, H + 0.08, 1.6, 0.07, 0.7, hex('#a9d2e8'), 6); // skylights
      if (R() < 0.5) { sb(s + (R() - 0.5) * ts * 0.6, t + (R() - 0.5) * tt * 0.6, H + 0.3, 1.1, 0.5, 0.8, hex('#9aa1a8'), 0); }  // rooftop HVAC
    }
    // base band + parapet band on all four faces, plus vertical panel ribs
    for (const side of [-1, 1]) {
      for (let a = 0; a < ns; a++) { const s = s0 - Ls / 2 + (a + 0.5) * ts;
        sb(s, t0 + side * (Lt / 2 + 0.03), 0.3, ts, 0.6, 0.08, base, 0); sb(s, t0 + side * (Lt / 2 + 0.03), H - 0.25, ts, 0.5, 0.1, band, 0); }
      for (let b = 0; b < nt; b++) { const t = t0 - Lt / 2 + (b + 0.5) * tt;
        sb(s0 + side * (Ls / 2 + 0.03), t, 0.3, 0.08, 0.6, tt, base, 0); sb(s0 + side * (Ls / 2 + 0.03), t, H - 0.25, 0.1, 0.5, tt, band, 0); }
      for (let s = s0 - Ls / 2 + 1.6; s < s0 + Ls / 2 - 0.5; s += 1.6) sb(s, t0 + side * (Lt / 2 + 0.05), H / 2, 0.08, H - 0.9, 0.06, rib, 0);
    }
    sc(s0, t0, Ls, Lt, H);
    // front (east, toward Gulf Ave): glass entrance block, canopy, accent stripe, employee entrance stair towers
    const tf = t0 - Lt / 2;
    sb(s0, tf - 0.25, H * 0.42, 7, H * 0.84, 0.5, glass, 7); sb(s0, tf - 1.0, H * 0.5, 8, 0.12, 1.6, hex('#3d4855'), 0);
    for (const o of [-4.6, 4.6]) sb(s0 + o, tf - 0.15, H * 0.5 + 0.2, 1.0, H + 0.4, 0.3, hex('#2f6f9f'), 0);
    for (const o of [-Ls * 0.35, Ls * 0.35]) { sb(s0 + o, tf - 0.4, H * 0.55, 1.6, H * 1.1, 0.8, wall2, 0); sb(s0 + o, tf - 0.82, H * 0.5, 0.6, H * 0.8, 0.05, glass, 6); }
    sb(s0 + 7, tf - 3.0, 0.45, 2.2, 0.9, 0.35, hex('#3a3f46'), 0); sb(s0 + 7, tf - 3.0, 0.55, 2.0, 0.5, 0.37, hex('#e6e8ea'), 2);   // monument sign (blank)
    sc(s0 + 7, tf - 3.0, 2.2, 0.35, 1);
    // truck docks (west) with trailers backed in, some with tractors
    if (docksWest) {
      const tw = t0 + Lt / 2;
      for (let s = s0 - Ls / 2 + 1.2; s < s0 + Ls / 2 - 0.8; s += 1.3) {
        sb(s, tw + 0.04, 0.75, 0.95, 1.2, 0.06, door, 0); sb(s, tw + 0.12, 0.2, 1.0, 0.18, 0.12, hex('#1d1f23'), 0);
        if (R() < 0.62) {
          const L = 4.0, tc = tw + 0.35 + L / 2;
          sb(s, tc, 0.98, 1.0, 1.15, L, trailer, 0); sb(s, tc, 0.38, 0.86, 0.12, L - 0.2, hex('#2a2c31'), 0);
          sb(s, tw + 0.35 + L - 0.6, 0.22, 0.95, 0.44, 0.9, C.tire, 0); sb(s, tc, 1.0, 1.01, 0.08, L, hex('#9aa3ad'), 0);
          if (R() < 0.3) { const cab = [hex('#c0392b'), hex('#2b5fb3'), hex('#f4f4f4'), hex('#2e3238')][Math.floor(R() * 4)];
            sb(s, tw + 0.35 + L + 0.9, 0.75, 1.0, 1.1, 1.5, cab, 0); sb(s, tw + 0.35 + L + 1.45, 1.0, 0.9, 0.4, 0.06, glass, 6); sb(s, tw + 0.35 + L + 0.9, 0.22, 1.0, 0.44, 1.4, C.tire, 0); }
          sc(s, tc + (R() < 0 ? 0 : 0.6), 1.0, L + 1.6, 1.4);
        }
      }
    }
    if (vanDoorsSouth) { const ts2 = s0 + Ls / 2; for (let t = t0 - Lt / 2 + 1.4; t < t0 + Lt / 2 - 1; t += 1.6) sb(ts2 + 0.04, t, 0.6, 0.06, 1.0, 1.1, door, 0); }
  }
  function vanRow(s0, s1, t, faceWest) { // generic white delivery vans (no branding), nose toward the aisle
    let n = 0;
    for (let s = s0; s <= s1; s += 1.5) { if (R() < 0.25) continue; n++;
      const d = faceWest ? 1 : -1;
      sb(s, t, 0.68, 0.98, 1.05, 2.1, van, 0); sb(s, t + d * 0.98, 0.9, 0.9, 0.3, 0.12, glass, 6); sb(s, t + d * 0.86, 1.2, 0.9, 0.04, 0.3, glass, 6); // windshield (visible from above)
      sb(s, t + d * 1.08, 0.3, 0.98, 0.18, 0.08, hex('#2a2c31'), 0); sb(s, t - d * 0.1, 0.5, 1.0, 0.1, 1.7, hex('#5f7f99'), 0);               // bumper, side stripe
      sb(s, t, 0.17, 0.92, 0.34, 1.6, C.tire, 0); sb(s, t - d * 1.06, 0.7, 0.92, 0.8, 0.04, hex('#c8ccd0'), 0);
    }
    if (n) sc((s0 + s1) / 2, t, s1 - s0 + 1.0, 2.1, 1.3);
  }
  warehouse(34, 31, 36, 22, 3.6, true, false);    // JFK8: ~855k sq ft fulfillment center
  warehouse(74, 29, 24, 16, 2.6, false, true);    // DYY6: delivery station
  for (const t of [40.2, 42.4]) vanRow(63, 87, t, t < 41);
  for (const t of [46.6]) vanRow(63, 87, t, false);
  for (const [t, w] of [[21, false], [23.2, true], [30, false], [32.2, true], [39.5, false], [41.7, true]]) vanRow(92, 114, t, w);
  // light poles along the van lot and dock apron
  for (let s = 8; s < 118; s += 10) for (const t of [17.5, 48.8]) { sb(s, t, 1.6, 0.12, 3.2, 0.12, C.pole, 0); sb(s, t - 0.3, 3.2, 0.2, 0.1, 0.7, C.lamp, 5); }
  // ---- Staten Island Mall ----
  { const F = SM, Y2 = F.yaw;
    const mb = (s, t, y, ss, sy, st, col, mat) => { const p = fW(F, s, t); box(p[0], y, p[1], st, sy, ss, Y2, col, mat); };
    const mc = (s, t, ss, st, h) => { const p = fW(F, s, t); cols.push(p[0], p[1], Y2, st / 2, ss / 2, h); };
    for (const [s0, s1, t0, t1, H, cs] of MALL_BLDGS) {
      const col = hex(cs), sc2 = (s0 + s1) / 2, tc = (t0 + t1) / 2, Ls = s1 - s0, Lt = t1 - t0;
      const ns = Math.ceil(Ls / 11), nt = Math.ceil(Lt / 11);
      for (let a = 0; a < ns; a++) for (let b = 0; b < nt; b++) mb(s0 + (a + 0.5) * Ls / ns, t0 + (b + 0.5) * Lt / nt, H / 2, Ls / ns, H, Lt / nt, col, 0);
      for (let a = 0; a < ns; a++) mb(s0 + (a + 0.5) * Ls / ns, t0 - 0.04, H - 0.2, Ls / ns, 0.4, 0.1, hex('#5d6670'), 0);   // cornice band facing the avenue
      mb(sc2, tc, H + 0.03, Ls - 0.3, 0.06, Lt - 0.3, H >= 3.2 ? hex('#8e959c') : H >= 2.8 ? hex('#a7adb3') : hex('#c3c5c8'), 0); // anchors darker roofs
      mc(sc2, tc, Ls, Lt, H);
      if (H < 2) { mb(sc2, t0 - 0.05, 0.6, Ls * 0.7, 0.8, 0.06, glass, 6); mb(sc2, tc, H + 0.25, Ls + 0.4, 0.3, Lt + 0.4, hex('#b5452f'), 0); } // diner-style pad
    }
    // skylight ridge along the concourse, glass pyramid over centre court
    for (let s = -18; s <= 18; s += 4) if (Math.abs(s) > 5) mb(s, 36, 2.55, 3.2, 0.25, 2.2, hex('#a9d2e8'), 6);
    for (let k = 0; k < 4; k++) mb(0, 36, 3.5 + k * 0.32, 6 - k * 1.4, 0.34, 6 - k * 1.4, hex('#9cc8e0'), 6);
    // entrances facing Richmond Ave: glass doors + canopy + columns
    for (const s of [-12, 0, 12]) { const t0 = s === 0 ? 26 : 30;
      mb(s, t0 - 0.2, 0.8, 4, 1.6, 0.4, glass, 7); mb(s, t0 - 1.3, 1.9, 5, 0.18, 2.4, hex('#41505f'), 0);
      for (const o of [-2.2, 2.2]) mb(s + o, t0 - 2.3, 0.95, 0.2, 1.9, 0.2, hex('#d8d8d8'), 0); }
    for (const s of [-26.5, 26.5]) { mb(s, 26.8, 1.1, 5, 2.2, 0.4, glass, 7); mb(s, 26.2, 2.4, 6, 0.3, 1.2, hex('#2f3a45'), 0); } // anchor entrances
    // light poles + cart corrals
    for (let s = -34; s <= 34; s += 8.5) for (const t of [12.5, 22.5, 57, 62]) { if (MALL_BLDGS.some(b => s > b[0] - 1.5 && s < b[1] + 1.5 && t > b[2] - 1.5 && t < b[3] + 1.5)) continue;
      mb(s, t, 1.7, 0.12, 3.4, 0.12, C.pole, 0); mb(s, t, 3.4, 0.9, 0.1, 0.25, C.lamp, 5); }
    for (const [s, t] of [[-15, 20], [8, 21], [-6, 15], [16, 24], [-28, 60], [26, 58]]) { mb(s, t, 0.35, 2.4, 0.7, 0.7, hex('#c9cdd2'), 6); mc(s, t, 2.4, 0.7, 0.7); }
  }
  // ---- real buildings from OSM footprints (GEO.RB): projects, big boxes, institutions ----
  { const BRICK = [hex('#8b4a36'), hex('#9a5a40'), hex('#7c4433'), hex('#a0634a')], RET = [hex('#d9d2c4'), hex('#c9ccd0')], INSTC = [hex('#d8cfbf'), hex('#c7b9a3')];
    let k = 0;
    for (const [lat, lon, sx0, sz0, yd, h, st] of GEO.RB) {
      const p = P(lat, lon), y = yd * Math.PI / 180, n = k++; let sx = sx0 * 1.35, sz = sz0 * 1.35;   // footprints scaled up to match the game's oversized cars/houses
      if (!boroAt(p[0], p[1])) continue;                                                     // mapped footprint that lands in the water here
      { // never on a mapped avenue / highway (bridges are elevated and fine): shrink to fit, else drop
        const roadOn = (k) => { const c = Math.cos(y), sn = Math.sin(y), hx = sx * k / 2 + 0.35, hz = sz * k / 2 + 0.35;
          for (const [a, d] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]]) { const sg = segHit(p[0] + a * hx * c + d * hz * sn, p[1] - a * hx * sn + d * hz * c); if (sg && sg.type !== SEG_BRIDGE) return true; } return false; };
        let k = 1; while (k > 0.8 && roadOn(k)) k -= 0.05;
        if (k <= 0.8) continue;                                                              // would turn into a sliver: leave it out
        if (k < 1) { sx *= k; sz *= k; } }
      if (st === 0) {
        const c = BRICK[n % 4];
        box(p[0], h / 2, p[1], sx, h, sz, y, c, 4);                                       // brick slab with small windows
        box(p[0], h + 0.05, p[1], sx - 0.15, 0.1, sz - 0.15, y, hex('#4a4d52'), 0);       // roof
        box(p[0], 0.25, p[1], sx + 0.06, 0.5, sz + 0.06, y, hex('#6b6f75'), 0);           // base course
        if (sx * sz > 4) { const q = rot(p[0], p[1], y, (sx > sz ? sx * 0.3 : 0), (sx > sz ? 0 : sz * 0.3)); box(q[0], h + 0.45, q[1], 0.9, 0.8, 0.9, y, c, 0); } // stair bulkhead
        const e = rot(p[0], p[1], y, 0, sz / 2 + 0.25); box(e[0], 0.9, e[1], Math.min(1.4, sx * 0.4), 0.08, 0.5, y, hex('#3a3f46'), 0); // entry canopy
      } else if (st === 1) {
        box(p[0], h / 2, p[1], sx, h, sz, y, RET[n % 2], 0); box(p[0], h + 0.04, p[1], sx - 0.2, 0.08, sz - 0.2, y, hex('#a9adb2'), 0);
        box(p[0], h - 0.2, p[1], sx + 0.05, 0.4, sz + 0.05, y, hex('#5d6670'), 0);
      } else if (st === 3) {   // industrial / self-storage: ribbed metal walls, a row of roll-up doors on both long sides, roof vents
        const IND = [hex('#b8bec4'), hex('#cfc7b4'), hex('#9fb0bf'), hex('#c9c2ae')], c = IND[n % 4], long = sx >= sz, L = long ? sx : sz, W = long ? sz : sx;
        box(p[0], h / 2, p[1], sx, h, sz, y, c, 0); box(p[0], h + 0.04, p[1], sx - 0.1, 0.08, sz - 0.1, y, hex('#8d949b'), 0);
        for (let r = -L / 2 + 0.3; r < L / 2 - 0.2; r += 0.6) for (const sd of [-1, 1]) { const q = long ? rot(p[0], p[1], y, r, sd * (W / 2 + 0.02)) : rot(p[0], p[1], y, sd * (W / 2 + 0.02), r);
          box(q[0], h / 2, q[1], long ? 0.05 : 0.04, h, long ? 0.04 : 0.05, y, hex('#9aa1a8'), 0); }                         // wall ribs
        const nd = Math.max(1, Math.floor((L - 0.6) / 1.1));
        for (let k = 0; k < nd; k++) { const r = -L / 2 + 0.85 + k * (L - 1.1) / Math.max(1, nd - 1 || 1); for (const sd of [-1, 1]) {
          const q = long ? rot(p[0], p[1], y, r, sd * (W / 2 + 0.04)) : rot(p[0], p[1], y, sd * (W / 2 + 0.04), r);
          box(q[0], 0.42, q[1], long ? 0.7 : 0.05, 0.84, long ? 0.05 : 0.7, y, [hex('#d9822b'), hex('#2f6f9f'), hex('#5d6670')][n % 3], 0); } }   // roll-up doors
        for (let k = 0; k < Math.min(4, Math.floor(L / 2.5)); k++) { const q = long ? rot(p[0], p[1], y, -L / 2 + 1.2 + k * 2.5, 0) : rot(p[0], p[1], y, 0, -L / 2 + 1.2 + k * 2.5); box(q[0], h + 0.25, q[1], 0.45, 0.4, 0.45, y, hex('#a7adb3'), 0); }
      } else {
        box(p[0], h / 2, p[1], sx, h, sz, y, INSTC[n % 2], 1); box(p[0], h + 0.05, p[1], sx - 0.15, 0.1, sz - 0.15, y, hex('#6d6f73'), 0);
      }
      cols.push(p[0], p[1], y, sx / 2, sz / 2, h);
    }
  }
  // ---- Snug Harbor: five Greek Revival temple-front buildings (A-E) in a row facing north to Richmond Terrace ----
  { const X = SNUG[0], Z = SNUG[1], wht = hex('#eee8da'), wht2 = hex('#e2dbc9'), roofc = hex('#8a8f96'), b = (x, y, z, sx, sy, sz, c, m) => box(X + x, y, Z + z, sx, sy, sz, 0, c, m);
    const sc = (x, z, sx, sz, h) => cols.push(X + x, Z + z, 0, sx / 2, sz / 2, h);
    function temple(x, W, D, H, nCol, dome) {
      b(x, H / 2, 0, W, H, D, wht2, 1);                                                    // body (window rows)
      b(x, H + 0.08, 0, W + 0.2, 0.16, D + 0.2, wht, 0);                                   // cornice
      b(x, H + 0.35, 0, W - 0.3, 0.4, D - 0.3, roofc, 0);                                  // low roof
      const Dp = 1.4, zf = -D / 2 - Dp / 2, ph = H * 0.92;
      b(x, 0.12, zf, W * 0.86, 0.24, Dp + 0.2, wht, 0);                                    // portico steps / stylobate
      for (let k = 0; k < nCol; k++) { const cx = x - W * 0.38 + k * (W * 0.76) / (nCol - 1); b(cx, ph / 2 + 0.2, -D / 2 - Dp + 0.25, 0.24, ph, 0.24, wht, 0); b(cx, ph + 0.18, -D / 2 - Dp + 0.25, 0.34, 0.1, 0.34, wht, 0); }
      b(x, ph + 0.35, zf, W * 0.86, 0.3, Dp, wht, 0);                                      // entablature
      for (let k = 0; k < 4; k++) b(x, ph + 0.58 + k * 0.17, zf - 0.02, W * 0.86 * (1 - (k + 1) / 5), 0.17, Dp + 0.04, k % 2 ? wht : wht2, 0); // pediment steps
      const ang = 0.38, half = W * 0.43;
      for (const sd of [-1, 1]) boxQ(X + x + sd * half / 2, ph + 0.62 + half / 2 * Math.tan(ang), Z + zf, half / Math.cos(ang) + 0.1, 0.12, Dp + 0.2, qa(0, 0, 1, -sd * ang), roofc, 0);
      if (dome) { for (let k = 0; k < 3; k++) b(x, H + 0.7 + k * 0.32, 0, 1.8 - k * 0.5, 0.34, 1.8 - k * 0.5, k === 2 ? hex('#9fb0a8') : wht, 0); b(x, H + 1.75, 0, 0.12, 0.5, 0.12, hex('#c9a227'), 2); }
      sc(x, -Dp / 2, W, D + Dp, H);
    }
    temple(0, 5.6, 4.4, 2.8, 8, true);                                                     // Building C (1833)
    for (const x of [-7, 7]) temple(x, 4.2, 3.8, 2.5, 6, false);                           // B, D
    for (const x of [-13.5, 13.5]) temple(x, 4.0, 3.8, 2.4, 6, false);                     // A, E
    for (const x of [-3.9, 3.9, -10.4, 10.4]) { b(x, 1.0, 0.6, 1.6, 2.0, 2.6, wht2, 1); sc(x, 0.6, 1.6, 2.6, 2.0); } // hyphen links
    // Music Hall to the east (brick with a columned front), iron fence + gate piers on the Terrace, a central path
    b(24, 1.2, 0, 6, 2.4, 4.4, hex('#9b4b3a'), 1); b(24, 2.5, 0, 6.2, 0.2, 4.6, wht, 0); for (let k = 0; k < 4; k++) b(21.9 + k * 1.4, 1.0, -2.4, 0.22, 2.0, 0.22, wht, 0); sc(24, 0, 6, 4.4, 2.4);
    for (let x = -22; x <= 30; x += 1.6) if (Math.abs(x) > 2.8) b(x, 0.35, -7.0, 0.07, 0.7, 0.07, hex('#1d1f23'), 0);
    b(-23 + 26, 0.62, -7.0, 52, 0.06, 0.06, hex('#1d1f23'), 0);
    for (const x of [-2.8, 2.8]) { b(x, 0.7, -7.0, 0.5, 1.4, 0.5, hex('#cfc6b4'), 0); b(x, 1.5, -7.0, 0.3, 0.2, 0.3, hex('#cfc6b4'), 0); sc(x, -7.0, 0.5, 0.5, 1.4); }
    b(0, 0.02, -5.0, 2.4, 0.04, 4.0, hex('#d9d2c2'), 0);
    // Chinese Scholar's Garden (walled, behind the row)
    for (const [x, z, sx, sz] of [[-6, 12, 9, 0.3], [-6, 18, 9, 0.3], [-10.5, 15, 0.3, 6], [-1.5, 15, 0.3, 6]]) { b(x, 0.6, z, sx, 1.2, sz, hex('#f1eee8'), 0); b(x, 1.25, z, sx + 0.2, 0.12, sz + 0.2, hex('#3a3d42'), 0); sc(x, z, sx, sz, 1.2); }
    b(-6, 0.9, 15, 2.2, 0.12, 1.6, hex('#3a3d42'), 0); for (const [dx, dz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) b(-6 + dx, 0.45, 15 + dz, 0.12, 0.9, 0.12, hex('#9b2d24'), 0);
  }
  // ---- Howland Hook container terminal: gantry cranes on the quay, container stacks, gatehouse ----
  { const F = HH, inl = -1;                                                                  // land is on the -e side of the quay
    const hb = (s, t, y, ss, sy, st, c, m) => { const q = fW(F, s, t * inl); box(q[0], y, q[1], st, sy, ss, F.yaw, c, m); };
    const hc = (s, t, ss, st, h) => { const q = fW(F, s, t * inl); cols.push(q[0], q[1], F.yaw, st / 2, ss / 2, h); };
    const R3 = rng(9090), CC = ['#c0392b', '#2b5fb3', '#1e8449', '#d68910', '#7d3c98', '#e8e8e8', '#5d6d7e', '#a04000', '#117a65', '#f1c40f'].map(hex);
    for (const s of [6, 18, 30, 42, 54]) {                                                     // ship-to-shore gantry cranes
      const blue = hex('#2e6fb5'), red = hex('#c0392b');
      for (const [ds, dt] of [[-1.6, 1.2], [1.6, 1.2], [-1.6, 5.2], [1.6, 5.2]]) hb(s + ds, dt, 3.4, 0.3, 6.8, 0.3, blue, 0);
      hb(s, 3.2, 6.9, 3.8, 0.5, 4.8, blue, 0); hb(s, -1.5, 7.3, 1.2, 0.35, 15, red, 0);          // portal beam + boom over the water
      hb(s, 3.5, 7.9, 2.0, 1.1, 2.2, hex('#e8e8e8'), 0); hb(s, 5.6, 8.6, 0.25, 1.6, 0.25, blue, 0); // machinery house, A-frame
      hc(s, 1.2, 3.6, 0.6, 7); hc(s, 5.2, 3.6, 0.6, 7);
    }
    for (let bs = 2; bs < 60; bs += 11) for (let bt = 10; bt < 27; bt += 5.5) {                 // container blocks
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const n = 1 + Math.floor(R3() * 4); if (R3() < 0.1) continue;
        hb(bs + k * 2.3 + 1.2, bt + r * 1.05, n * 0.27, 2.2, n * 0.54, 0.95, CC[Math.floor(R3() * CC.length)], 0); }
      hc(bs + 4.6 + 0.6, bt + 1.6, 9.4, 4.4, 2.2);
    }
    for (let k = 0; k < 6; k++) { const s = 4 + k * 9.5; hb(s, 8.2, 1.3, 1.0, 2.6, 2.6, hex('#d4ac0d'), 0); hb(s, 8.2, 2.7, 1.1, 0.3, 2.7, hex('#2e3238'), 0); } // straddle carriers
    hb(30, 29, 0.9, 12, 1.8, 2.2, hex('#d6d9dc'), 0); hb(30, 29, 2.0, 14, 0.2, 4.0, hex('#2e6fb5'), 0); hc(30, 29, 12, 2.2, 1.8); // gatehouse canopy
    for (let s = 0; s < 62; s += 10) { hb(s, 7, 4, 0.2, 8, 0.2, C.pole, 0); hb(s, 7, 8.1, 1.2, 0.15, 0.4, C.lamp, 5); }
    const L = fW(F, 30, 16 * inl); LM.push({ type: 'label', x: L[0], z: L[1], r: 0, nr: 32, name: 'HOWLAND HOOK', sub: 'CONTAINER TERMINAL · RICHMOND TERRACE' });
  }
  // ---- civic landmarks (CIVIC_SITES, map.js): precincts, hospitals, Borough Hall, energy facility ----
  for (const c of CIVIC_SITES) {
    const X = c.x, Z = c.z, Y = c.yaw, lb = (lx, y, lz, sx, sy, sz, col, mat) => lbox(X, Z, Y, lx, y, lz, sx, sy, sz, col, mat);
    const lc = (lx, lz, sx, sz, h) => { const q = rot(X, Z, Y, lx, lz); cols.push(q[0], q[1], Y, sx / 2, sz / 2, h); };
    const copCar = (lx, lz, yy) => { const q = rot(X, Z, Y, lx, lz), yw = Y + yy; carBoxes(q[0], q[1], yw, hex('#f2f4f7'));
      lbox(q[0], q[1], yw, 0, 0.42, 0, 1.1, 0.08, 1.4, hex('#1f4fb8'), 0); lbox(q[0], q[1], yw, -0.2, 0.97, -0.2, 0.32, 0.08, 0.2, hex('#ff2b2b'), 2); lbox(q[0], q[1], yw, 0.2, 0.97, -0.2, 0.32, 0.08, 0.2, hex('#2b6bff'), 2);
      cols.push(q[0], q[1], yw, 0.55, 1.08, 1.0); };
    if (c.type === 'precinct') {                         // limestone base, brick upper floors, the green lamps by the door, cars out front
      lb(0, 0.45, 1, 6.4, 0.9, 4.2, hex('#cfc6b4'), 0); lb(0, 1.6, 1, 6.4, 1.4, 4.2, hex('#8f4b3a'), 1); lb(0, 2.38, 1, 6.6, 0.16, 4.4, hex('#d8d0c0'), 0);
      lb(0, 0.7, -1.12, 1.2, 1.4, 0.08, hex('#22272e'), 0); lb(0, 1.55, -1.14, 2.2, 0.32, 0.06, hex('#1f4fb8'), 2); lb(0, 1.55, -1.16, 1.8, 0.08, 0.04, hex('#f4f4f4'), 2);
      for (const sx of [-0.95, 0.95]) { lb(sx, 0.6, -1.3, 0.08, 1.2, 0.08, hex('#2a2c31'), 0); lb(sx, 1.25, -1.3, 0.26, 0.26, 0.26, hex('#2ecc71'), 2); }
      lb(0, 0.08, -1.7, 2.4, 0.16, 1.0, hex('#cfc6b4'), 0);
      lb(2.6, 1.8, -2.4, 0.08, 3.6, 0.08, hex('#c9cdd2'), 0); lb(2.6, 3.3, -2.0, 0.04, 0.5, 0.75, hex('#b22234'), 2); lb(2.6, 3.42, -2.2, 0.05, 0.28, 0.32, hex('#3c3b6e'), 2);
      lc(0, 1, 6.4, 4.2, 2.4);
      copCar(-2.4, -3.6, 0.5); copCar(-0.6, -3.9, 0.35); copCar(1.4, -3.7, -0.4);
    } else if (c.type.startsWith('hospital')) {
      const b = c.type === 'hospital_big' ? 1.35 : 1;
      lb(0, 0.8, 0, 16 * b, 1.6, 11 * b, hex('#e3ddd2'), 1); lc(0, 0, 16 * b, 11 * b, 1.6);                                  // podium
      lb(-2 * b, 1.6 + 2.4 * b, 0.6, 9 * b, 4.8 * b, 6 * b, hex('#a9bccb'), 7); lc(-2 * b, 0.6, 9 * b, 6 * b, 1.6 + 4.8 * b); // tower (glass bands)
      lb(-2 * b, 1.6 + 4.8 * b + 0.05, 0.6, 9 * b - 0.2, 0.1, 6 * b - 0.2, hex('#7d838b'), 0);
      lb(-4 * b, 1.6 + 4.8 * b + 0.4, 1.5, 2.2, 0.7, 1.6, hex('#9aa1a8'), 0);
      if (b > 1) { const hy = 1.6 + 4.8 * b + 0.12; lb(0, hy, 0.6, 4, 0.06, 4, hex('#4a4f56'), 0); for (const [x, z, sx, sz] of [[-0.7, 0.6, 0.25, 1.6], [0.7, 0.6, 0.25, 1.6], [0, 0.6, 1.2, 0.25]]) lb(x, hy + 0.04, z, sx, 0.04, sz, hex('#f4f4f4'), 2);
        for (const [x, z, sx, sz] of [[0, -1.35, 4, 0.12], [0, 2.55, 4, 0.12], [-1.95, 0.6, 0.12, 4], [1.95, 0.6, 0.12, 4]]) lb(x, hy + 0.03, z, sx, 0.03, sz, hex('#f5c518'), 2); }   // rooftop helipad
      lb(5 * b, 1.5, -5.5 * b - 1.6, 5.5, 0.2, 3.2, hex('#3a3f46'), 0); lb(5 * b, 1.35, -5.5 * b - 3.2, 5.5, 0.3, 0.12, hex('#c0392b'), 2);   // ER canopy
      for (const o of [-2.5, 2.5]) lb(5 * b + o, 0.7, -5.5 * b - 3.0, 0.2, 1.4, 0.2, hex('#d8d8d8'), 0);
      for (const o of [3.6, 5.0, 6.4]) { lb(o * b, 0.6, -5.5 * b - 1.7, 1.0, 1.1, 2.2, hex('#f4f4f4'), 0); lb(o * b, 0.55, -5.5 * b - 1.7, 1.02, 0.18, 2.2, hex('#e67e22'), 0); lb(o * b, 1.2, -5.5 * b - 0.75, 0.6, 0.1, 0.2, hex('#ff2b2b'), 2); lc(o * b, -5.5 * b - 1.7, 1.0, 2.2, 1.2); }
      lb(-7 * b, 1.6, -6 * b - 1.5, 0.15, 3.2, 0.15, hex('#4d535b'), 0); lb(-7 * b, 3.1, -6 * b - 1.5, 0.12, 1.4, 1.4, hex('#1f5fbf'), 2); // blue H sign
      for (const [y, z, sy, sz] of [[3.1, -0.4, 0.9, 0.16], [3.1, 0.4, 0.9, 0.16], [3.1, 0, 0.16, 0.8]]) lb(-7 * b - 0.08, y, -6 * b - 1.5 + z, 0.04, sy, sz, hex('#ffffff'), 2);
      lb(-2 * b, 0.8, -5.5 * b - 0.05, 6 * b, 1.4, 0.08, hex('#2c3e55'), 7);                                               // main entrance glass
    } else if (c.type === 'boroughhall') {               // brick with stone trim, mansard roof, the clock tower
      lb(0, 1.3, 0, 9, 2.6, 5, hex('#a0523d'), 1); lb(0, 2.7, 0, 9.3, 0.2, 5.3, hex('#d8cdb8'), 0); lb(0, 3.15, 0, 8.4, 0.8, 4.4, hex('#3f4650'), 0);
      lb(3.4, 3.0, -1.4, 1.7, 6.0, 1.7, hex('#a0523d'), 1); lb(3.4, 6.1, -1.4, 1.9, 0.2, 1.9, hex('#d8cdb8'), 0);
      for (const [x, z] of [[3.4, -2.27], [3.4, -0.53], [2.53, -1.4], [4.27, -1.4]]) lb(x, 5.4, z, x === 3.4 ? 0.9 : 0.04, 0.9, x === 3.4 ? 0.04 : 0.9, hex('#f6f1dc'), 2);
      for (let k = 0; k < 3; k++) lb(3.4, 6.4 + k * 0.3, -1.4, 1.5 - k * 0.45, 0.32, 1.5 - k * 0.45, hex('#3f4650'), 0);
      lb(0, 0.15, -2.9, 3, 0.3, 0.9, hex('#d8cdb8'), 0); lc(0, 0, 9, 5, 2.6); lc(3.4, -1.4, 1.7, 1.7, 6);
    } else if (c.type === 'energy') {                    // substation yard: transformers, steel gantries, lattice towers, control house, fence
      for (let x = -8; x <= 8; x += 1.6) { lb(x, 0.6, -8, 0.06, 1.2, 0.06, hex('#6b7077'), 0); lb(x, 0.6, 8, 0.06, 1.2, 0.06, hex('#6b7077'), 0); lb(-8, 0.6, x, 0.06, 1.2, 0.06, hex('#6b7077'), 0); lb(8, 0.6, x, 0.06, 1.2, 0.06, hex('#6b7077'), 0); }
      for (const [x, z, sx, sz] of [[0, 8, 16, 0.1], [-8, 0, 0.1, 16], [8, 0, 0.1, 16]]) lc(x, z, sx, sz, 1.2); lc(-4.5, -8, 7, 0.1, 1.2); lc(4.5, -8, 7, 0.1, 1.2);
      for (let k = 0; k < 6; k++) { const x = -5 + (k % 3) * 5, z = k < 3 ? -2.5 : 3; lb(x, 0.7, z, 1.5, 1.4, 1.3, hex('#3f5a4a'), 0); for (let f = -2; f <= 2; f++) lb(x + f * 0.28, 0.7, z + 0.75, 0.06, 1.0, 0.25, hex('#33483c'), 0);
        lb(x, 1.6, z, 0.18, 0.5, 0.18, hex('#b9bec3'), 0); lc(x, z, 1.5, 1.6, 1.4); }
      for (const z of [-5.5, 0.3, 6]) { for (const x of [-6.5, 6.5]) lb(x, 1.8, z, 0.18, 3.6, 0.18, hex('#9aa1a8'), 0); lb(0, 3.55, z, 13.2, 0.16, 0.16, hex('#9aa1a8'), 0); for (let w = -5; w <= 5; w += 2.5) lb(w, 3.2, z, 0.05, 0.6, 0.05, hex('#d9d2c4'), 0); }
      for (const x of [-11, 11]) { for (let k = 0; k < 5; k++) lb(x, 1.2 + k * 2.4, 4, 1.4 - k * 0.22, 2.4, 1.4 - k * 0.22, hex('#a7adb3'), 0); lb(x, 10.5, 4, 3.6, 0.18, 0.18, hex('#a7adb3'), 0); lc(x, 4, 1.4, 1.4, 12); }
      lb(5, 0.85, -6.3, 4, 1.7, 2.6, hex('#8f4b3a'), 1); lc(5, -6.3, 4, 2.6, 1.7);
    } else if (c.type === 'store') {                     // big box set back behind its front lot (local -z faces the avenue)
      const [W, D, H] = c.dims, zc = c.R - D / 2 - 0.4, wall = [hex('#d9d2c4'), hex('#c9ccd0'), hex('#d4c8b4')][(Math.abs(Math.round(X * 3 + Z))) % 3];
      lb(0, H / 2, zc, W, H, D, wall, 0); lb(0, H + 0.05, zc, W - 0.2, 0.1, D - 0.2, hex('#a9adb2'), 0); lc(0, zc, W, D, H);
      lb(0, H - 0.25, zc - D / 2 - 0.03, W + 0.05, 0.5, 0.08, hex('#5d6670'), 0);                                  // parapet band
      lb(0, H * 0.5, zc - D / 2 - 0.35, Math.min(2.4, W * 0.3), H, 0.7, hex('#8a9097'), 0);                        // entrance vestibule
      lb(0, H * 0.45, zc - D / 2 - 0.72, Math.min(2.0, W * 0.25), H * 0.7, 0.04, hex('#2c3e55'), 7);               // glass doors
      lb(0, H + 0.35, zc - D / 2 - 0.1, Math.min(3.2, W * 0.4), 0.7, 0.12, hex('#3a4855'), 0);                     // blank sign panel (no names)
      for (const x of [-W / 2 + 1, 0, W / 2 - 1]) { const zl = zc - D / 2 - 2.6; lb(x, 0.9, zl, 0.1, 1.8, 0.1, hex('#9aa1a8'), 0); lb(x, 1.82, zl, 0.5, 0.08, 0.2, hex('#f4f1e0'), 5); }
      for (const [x, zo] of [[-W / 2 + 0.8, 1.3], [-W / 2 + 2.2, 1.6], [W / 2 - 1.0, 1.5], [W / 2 - 2.4, 1.2], [1.2, 3.4]]) { const q = rot(X, Z, Y, x, zc - D / 2 - zo - 0.6);
        carBoxes(q[0], q[1], Y + (zo > 1.4 ? 0 : Math.PI), hex(['#9aa0a6', '#2b2f36', '#c0392b', '#f2f4f7', '#1f4e79'][Math.abs(Math.round(x * 5)) % 5])); cols.push(q[0], q[1], Y, 0.55, 1.08, 1.0); }
    } else if (c.type === 'plant') {                     // gas-fired power plant: turbine halls, boiler (HRSG) blocks, tall banded stacks, tanks
      lb(-3, 1.7, 3.5, 12, 3.4, 5, hex('#c4c9ce'), 0); lb(-3, 3.45, 3.5, 12.2, 0.12, 5.2, hex('#8a9097'), 0); lc(-3, 3.5, 12, 5, 3.4);
      for (let k = 0; k < 4; k++) { const x = -7.5 + k * 3;
        lb(x, 2.7, -2.5, 2.4, 5.4, 4.2, hex('#a3abb3'), 0); lb(x, 5.45, -2.5, 2.5, 0.1, 4.3, hex('#7d838b'), 0); lc(x, -2.5, 2.4, 4.2, 5.4);
        lb(x, 6.5, -5.2, 1.0, 13, 1.0, hex('#e3e5e8'), 0); lb(x, 11.6, -5.2, 1.04, 0.7, 1.04, hex('#c0392b'), 0); lb(x, 12.6, -5.2, 1.04, 0.5, 1.04, hex('#c0392b'), 0); lc(x, -5.2, 1, 1, 13);
        lb(x, 2.0, 1.0, 0.5, 0.5, 2.6, hex('#6b7077'), 0); }
      for (const [x, z] of [[7.5, -5], [7.5, 0], [7.5, 5]]) { lb(x, 1.1, z, 3.4, 2.2, 3.4, hex('#eceeef'), 0); lb(x, 2.25, z, 3.2, 0.1, 3.2, hex('#b9bec3'), 0); lc(x, z, 3.4, 3.4, 2.2); }
      for (let x = -11; x <= 11; x += 1.6) { lb(x, 0.6, -11, 0.06, 1.2, 0.06, hex('#6b7077'), 0); lb(x, 0.6, 11, 0.06, 1.2, 0.06, hex('#6b7077'), 0); lb(-11, 0.6, x, 0.06, 1.2, 0.06, hex('#6b7077'), 0); lb(11, 0.6, x, 0.06, 1.2, 0.06, hex('#6b7077'), 0); }
    }
    LM.push({ type: 'label', x: X, z: Z, r: c.R * 0.75, nr: c.R + 6, name: c.name, sub: c.sub });
  }
  // ---- St. George ferry terminal (SG frame: s seaward toward the slips, t across; +t = south-east) ----
  // Built from the real terminal footprint (~215 x 160 m) at ~2x, on fill (map.js SG_FILL) so it fits beside the outlets.
  { const F = SG, gb = (s, t, y, ss, sy, st, col, m) => { const q = fW(F, s, t); box(q[0], y, q[1], st, sy, ss, F.yaw, col, m); };
    const gc = (s, t, ss, st, h) => { const q = fW(F, s, t); cols.push(q[0], q[1], F.yaw, st / 2, ss / 2, h); };
    const S0 = -6, S1 = 7.8, T0 = -12, T1 = 10, TC = (T0 + T1) / 2, TW = T1 - T0;
    const conc = hex('#d6d9dc'), white = hex('#eef1f3'), glass = hex('#8fb2c8'), steel = hex('#9aa1a8'), green = hex('#2f6f4f'), pile = hex('#4a3b2c'), wale = hex('#3a2e22');
    gb((S0 + S1) / 2, TC, 1.2, S1 - S0, 2.4, TW, conc, 1); gc((S0 + S1) / 2, TC, S1 - S0, TW, 2.4);                     // podium (ground floor + mezzanine)
    gb((S0 + S1) / 2 + 0.6, TC, 3.8, S1 - S0 - 1.4, 2.8, TW - 1.2, hex('#b9c7d2'), 7); gc((S0 + S1) / 2 + 0.6, TC, S1 - S0 - 1.4, TW - 1.2, 5.2);   // glass waiting hall
    gb(S1 - 0.02, TC, 2.95, 0.12, 5.1, TW - 0.4, glass, 7);                                                             // full-height harbour glass wall
    for (let t = T0 + 0.6; t <= T1 - 0.5; t += 1.2) gb(S1 + 0.06, t, 2.95, 0.1, 5.1, 0.09, white, 0);                 // mullions
    for (let k = 0; k < 4; k++) gb(S1 + 0.06, TC, 1.25 + k * 1.3, 0.1, 0.07, TW - 0.4, white, 0);                     // transoms
    for (let k = 0; k < 12; k++) { const s = S0 + 1.2 + (k + 0.5) * 16 / 12; gb(s, TC, 5.45 + k * 0.1, 16 / 12 + 0.02, 0.2, TW + 1.2, k % 3 === 1 ? hex('#9cc8e0') : white, k % 3 === 1 ? 6 : 0); }  // visor roof rising to the harbour, skylight bands
    gb(S0 + 17.25, TC, 6.62, 0.2, 0.42, TW + 1.4, hex('#cfd5da'), 0); gb(S0 + 1.15, TC, 5.38, 0.2, 0.3, TW + 1.4, hex('#cfd5da'), 0);   // roof fascias
    for (let t = T0 + 1; t < T1; t += 4.4) gb(S0 + 8.5, t, 5.95, 15.5, 0.12, 0.14, hex('#b9c0c7'), 0);               // roof ribs
    for (let t = T0 + 0.4; t <= T1; t += 3.6) { gb(S1 + 2.6, t, 3.1, 0.24, 6.2, 0.24, white, 0); gb(S0 + 1.6, t, 3.0, 0.24, 6.0, 0.24, white, 0); }                     // columns under the overhang
    gb(S0 - 0.06, TC, 1.1, 0.1, 2.0, 8, glass, 7); gb(S0 - 1.3, TC, 2.3, 2.6, 0.16, 10.5, steel, 0);                  // landside entrance + canopy
    for (const t of [TC - 4.6, TC + 4.6]) { gb(S0 - 2.4, t, 2.0, 0.08, 4.0, 0.08, hex('#c9cdd2'), 0); gb(S0 - 2.4, t + 0.35, 3.6, 0.04, 0.5, 0.7, hex('#b22234'), 2); }  // flagpoles
    // landside bus deck: elevated slab on columns, ramp down at the south-east end, city buses
    gb(-8.8, TC, 1.6, 4.6, 0.3, TW - 1, hex('#a7adb3'), 0); gb(-11.05, TC, 1.95, 0.08, 0.42, TW - 1, steel, 0);
    for (const s of [-10.6, -7.0]) for (let t = T0 + 1; t <= T1 - 1; t += 3.6) { gb(s, t, 0.75, 0.3, 1.5, 0.3, hex('#8a9097'), 0); gc(s, t, 0.3, 0.3, 1.5); }
    for (let k = 0; k < 5; k++) gb(-8.8, T1 + 0.1 + k * 1.2, 1.45 - k * 0.3, 4.2, 0.26, 1.25, hex('#a7adb3'), 0);
    for (const t of [T0 + 3, TC, T1 - 4]) { gb(-8.8, t, 2.3, 1.1, 1.0, 3.6, hex('#e8ecef'), 0); gb(-8.8, t, 2.05, 1.12, 0.2, 3.62, hex('#2b5fb3'), 0); gb(-8.8, t, 2.5, 1.12, 0.34, 3.3, hex('#2c3e55'), 7); }
    // five slips: pile racks with wales, dolphins at the end, transfer apron + green gantry at the head
    for (const tc of [-9, -4.5, 0, 4.5, 9]) {
      for (const o of [-2.0, 2.0]) {
        for (let s = 9.4; s <= 22.2; s += 0.85) gb(s, tc + o, 0.55, 0.26, 1.9, 0.26, pile, 0);
        for (const y of [0.9, 1.4]) gb(15.8, tc + o, y, 13, 0.18, 0.34, wale, 0);
        gb(22.9, tc + o, 0.7, 0.95, 2.3, 0.95, wale, 0); gb(22.9, tc + o, 1.9, 1.0, 0.12, 1.0, hex('#c9a227'), 0);
      }
      gb(8.7, tc, 0.55, 1.8, 0.2, 3.4, hex('#5d6670'), 0);                                                              // transfer apron
      for (const o of [-1.95, 1.95]) gb(8.6, tc + o, 2.1, 0.36, 4.2, 0.36, green, 0);                                    // gantry towers
      gb(8.6, tc, 4.15, 0.42, 0.32, 4.3, green, 0); gb(8.6, tc, 4.55, 0.9, 0.5, 1.3, green, 0);                          // crossbeam + hoist house
    }
    const L = fW(F, 0, TC); LM.push({ type: 'label', x: L[0], z: L[1], r: 13, nr: 18, name: 'ST. GEORGE FERRY TERMINAL', sub: 'STATEN ISLAND FERRY · TO MANHATTAN' });
  }
  // ---- Empire Outlets + ballpark on the St. George waterfront (SGW frame: s heading WNW along the shore, +t = seaward) ----
  { const F = SGW, gb = (s, t, y, ss, sy, st, col, m) => { const q = fW(F, s, t); box(q[0], y, q[1], st, sy, ss, F.yaw, col, m); };
    const gc = (s, t, ss, st, h) => { const q = fW(F, s, t); cols.push(q[0], q[1], F.yaw, st / 2, ss / 2, h); };
    const gby = (s, t, y, ss, sy, st, yaw, col, m) => { const q = fW(F, s, t); box(q[0], y, q[1], st, sy, ss, F.yaw + yaw, col, m); };
    const timber = hex('#8b6b4a'), glass = hex('#2c3e55'), glassL = hex('#9cc8e0'), mull = hex('#c9cdd2');
    // two 2-storey outlet buildings either side of a pedestrian street (t 5..8), storefronts on both faces
    const bar = (s0, s1, t0, t1) => {
      const sc = (s0 + s1) / 2, tc = (t0 + t1) / 2, Ls = s1 - s0, Lt = t1 - t0;
      gb(sc, tc, 0.75, Ls, 1.5, Lt, hex('#e6e2da'), 0); gb(sc, tc, 2.25, Ls - 0.2, 1.5, Lt - 0.2, hex('#d8d2c6'), 1); gc(sc, tc, Ls, Lt, 3.0);
      for (const tf of [t0 - 0.05, t1 + 0.05]) { gb(sc, tf, 0.72, Ls - 0.5, 1.22, 0.08, glass, 8); for (let s = s0 + 0.6; s < s1 - 0.3; s += 1.0) gb(s, tf, 0.72, 0.07, 1.24, 0.1, mull, 0); }
      for (let s = s0 + 0.15; s <= s1; s += 3.4) for (const tf of [t0 - 0.12, t1 + 0.12]) gb(s, tf, 1.5, 0.32, 3.0, 0.24, timber, 0);   // timber fins
      gb(sc, tc, 3.04, Ls, 0.08, Lt, timber, 0);                                                                         // roof deck
      for (const tf of [t0 + 0.05, t1 - 0.05]) gb(sc, tf, 3.32, Ls, 0.5, 0.05, glassL, 6);                            // glass railings
      for (let s = s0 + 2.5; s < s1 - 1.5; s += 5) { gb(s, tc, 3.6, 2.4, 1.1, Lt * 0.5, glassL, 6); gb(s, tc, 4.2, 2.7, 0.1, Lt * 0.55, hex('#e6e2da'), 0); }
    };
    bar(3, 14, 0, 5); bar(3, 14, 8, 13);
    for (const tf of [5.6, 7.4]) gb(8.5, tf, 1.65, 11, 0.1, 1.2, hex('#3a4855'), 0);                                   // street canopies
    for (let s = 4.5; s < 14; s += 3) { gb(s, 6.5, 0.6, 0.14, 1.2, 0.14, hex('#5a3e24'), 0); gb(s, 6.5, 1.55, 1.0, 0.9, 1.0, hex('#3f8b4a'), 0); }   // street trees
    gb(3.9, 10.5, 2.5, 1.8, 5.0, 5.2, hex('#d8d2c6'), 1); gb(3.9, 10.5, 5.1, 1.9, 0.2, 5.3, timber, 0); gc(3.9, 10.5, 1.8, 5.2, 5.0);   // corner tower facing the terminal
    gb(14, 17.2, 0.5, 34, 0.5, 0.06, mull, 0);                                                                          // waterfront railing
    for (let s = -2; s < 32; s += 4) { gb(s, 16.4, 0.9, 0.12, 1.8, 0.12, hex('#4d535b'), 0); gb(s, 16.4, 1.85, 0.5, 0.1, 0.2, hex('#f4f1e0'), 5); }   // promenade lamps
    beam([fW(F, 2.6, 2.5)[0], 2.4, fW(F, 2.6, 2.5)[1]], [fW(SG, 0, -12.3)[0], 2.4, fW(SG, 0, -12.3)[1]], 1.2, glassL, 6);   // glass footbridge to the terminal
    // ballpark beside the outlets: home plate at (20, 8), centre field up the shore and out over the fill (A0 from +t toward +s)
    const HS = 20, HT = 8, R = 10, A0 = 1.22, ang = (a, r) => [HS + Math.sin(a + A0) * r, HT + Math.cos(a + A0) * r];
    for (let k = -4; k <= 4; k++) { const a = k * Math.PI / 16, m = ang(a, R / 2); gby(m[0], m[1], 0.03, R * 0.2, 0.04, R, a + A0, hex('#3f9b4a'), 0); }   // outfield grass fan
    for (let k = -4; k <= 4; k++) { const a = k * Math.PI / 16, m = ang(a, R + 0.5); gby(m[0], m[1], 0.035, R * 0.2 + 0.4, 0.04, 1.1, a + A0, hex('#b88a5a'), 0);
      const w = ang(a, R + 1.15); gby(w[0], w[1], 0.5, R * 0.2 + 0.45, 1.0, 0.25, a + A0, hex('#1f5f3f'), 0); gby(w[0], w[1], 1.02, R * 0.2 + 0.45, 0.05, 0.27, a + A0, hex('#f5c518'), 0); gc(w[0], w[1], R * 0.2 + 0.45, 0.3, 1.0); }
    { const m = ang(0, 2.3); gby(m[0], m[1], 0.05, 3.4, 0.04, 3.4, Math.PI / 4 + A0, hex('#b88a5a'), 0); gby(m[0], m[1], 0.07, 2.3, 0.04, 2.3, Math.PI / 4 + A0, hex('#3f9b4a'), 0);
      gby(m[0], m[1], 0.09, 0.5, 0.06, 0.5, A0, hex('#b88a5a'), 0);
      for (const [a, r] of [[0, 0.1], [Math.PI / 4, 2.3], [-Math.PI / 4, 2.3], [0, 3.25]]) { const b = ang(a, r); gby(b[0], b[1], 0.1, 0.24, 0.06, 0.24, Math.PI / 4 + A0, hex('#f4f4f4'), 0); } }
    for (let tier = 0; tier < 5; tier++) for (let k = -14; k <= 14; k++) {                                             // seating bowl from 1st to 3rd base (fine segments, stepped tiers)
      const a = Math.PI + k * Math.PI / 21, r = 2.8 + tier * 0.8, m = ang(a, r), y = 0.2 + tier * 0.36;
      gby(m[0], m[1], y, r * Math.PI / 21 + 0.06, 0.4 + tier * 0.72, 0.8, a + A0, hex(tier === 2 ? '#e6e2da' : (Math.abs(k) % 7 === 0 ? '#c9cdd2' : '#2b5fb3')), 0);
      if (tier === 4) { gc(m[0], m[1], r * Math.PI / 21, 0.8, 2.4); const c = ang(a, r + 0.9); gby(c[0], c[1], 3.5, r * Math.PI / 21 + 0.3, 0.16, 1.4, a + A0, hex('#e6e2da'), 0); }
    }
    for (const a of [-0.6, 0.6, -1.3, 1.3, -2.1, 2.1]) { const p = ang(a, a * a > 2 ? 7.4 : R + 2.0); gb(p[0], p[1], 3.6, 0.22, 7.2, 0.22, hex('#9aa1a8'), 0); gby(p[0], p[1], 7.3, 1.6, 0.7, 0.25, a + A0, hex('#f4f1e0'), 5); gc(p[0], p[1], 0.3, 0.3, 7.2); }
    { const p = ang(0, R + 2.4); gby(p[0], p[1], 2.8, 4.4, 2.4, 0.3, A0, hex('#1b1e23'), 0); gby(p[0], p[1], 2.9, 3.8, 1.8, 0.34, A0, hex('#3aa86b'), 5); gb(p[0], p[1], 0.8, 0.3, 1.6, 0.3, hex('#4d535b'), 0); gc(p[0], p[1], 4.4, 0.4, 4.0); }
    const L1 = fW(F, 8.5, 6.5), L2 = fW(F, ang(0, 6)[0], ang(0, 6)[1]);
    LM.push({ type: 'label', x: L1[0], z: L1[1], r: 9, nr: 14, name: 'EMPIRE OUTLETS', sub: 'ST. GEORGE WATERFRONT' });
    LM.push({ type: 'label', x: L2[0], z: L2[1], r: 11, nr: 14, name: 'BALLPARK', sub: 'ST. GEORGE WATERFRONT' });
  }
  // ---- gas stations (GAS_SITES, map.js) ----
  for (const g of GAS_SITES) gasStation(cols, g.x, g.z, g.yaw, g.big, g.accent);
  // ---- Richmond Ave plazas ----
  { const F = PZ, Y2 = F.yaw;
    const mb = (s, t, y, ss, sy, st, col, mat) => { const p = fW(F, s, t); box(p[0], y, p[1], st, sy, ss, Y2, col, mat); };
    const mc = (s, t, ss, st, h) => { const p = fW(F, s, t); cols.push(p[0], p[1], Y2, st / 2, ss / 2, h); };
    for (const [s0, s1, t0, t1, H, cs, kind, acs] of PLAZA_BLDGS) {
      const col = hex(cs), ac = hex(acs), sc2 = (s0 + s1) / 2, tc = (t0 + t1) / 2, Ls = s1 - s0, Lt = t1 - t0;
      const ns = Math.ceil(Ls / 11), nt = Math.ceil(Lt / 11);
      for (let a = 0; a < ns; a++) for (let b = 0; b < nt; b++) mb(s0 + (a + 0.5) * Ls / ns, t0 + (b + 0.5) * Lt / nt, H / 2, Ls / ns, H, Lt / nt, col, 0);
      mb(sc2, tc, H + 0.03, Ls - 0.3, 0.06, Lt - 0.3, kind === 'club' ? hex('#9aa0a6') : hex('#b9bdc2'), 0);
      mc(sc2, tc, Ls, Lt, H);
      if (kind === 'pad') { mb(sc2, t0 - 0.05, 0.6, Ls * 0.7, 0.8, 0.06, glass, 6); mb(sc2, tc, H + 0.25, Ls + 0.4, 0.3, Lt + 0.4, ac, 0); continue; }
      // front (toward Richmond Ave): raised entrance parapet with an accent fascia, glass vestibule, canopy, bollards
      const ew = kind === 'club' ? Ls * 0.28 : Ls * 0.42, es = kind === 'club' ? s0 + ew / 2 + 1 : sc2;
      mb(es, t0 + 0.6, H + 0.45, ew, 0.9, 1.2, col, 0); mb(es, t0 - 0.05, H + 0.2, ew + 0.1, 0.9, 0.12, ac, 0);
      mb(es, t0 - 0.06, 0.8, ew * 0.55, 1.6, 0.08, glass, 7); mb(es, t0 - 1.0, 1.85, ew * 0.75, 0.16, 2.0, ac, 0);
      for (const o of [-ew * 0.33, ew * 0.33]) { mb(es + o, t0 - 1.9, 0.9, 0.18, 1.8, 0.18, hex('#d8d8d8'), 0); }
      for (let k = -2; k <= 2; k++) mb(es + k * 0.9, t0 - 2.4, 0.3, 0.2, 0.6, 0.2, hex('#c8c8c8'), 0);
      mb(sc2, t0 - 0.05, 0.25, Ls, 0.5, 0.1, hex('#6d747c'), 0);                                   // base band
      if (kind === 'super') { mb(sc2, t0 - 0.08, 0.75, Ls * 0.8, 0.9, 0.06, glass, 8); mb(sc2, t0 - 0.7, 1.45, Ls * 0.9, 0.12, 1.3, ac, 0); }
      if (kind === 'club') {                                                                       // ribbed metal walls + tyre centre bays
        for (let s = s0 + 1.2; s < s1 - 0.6; s += 1.2) { mb(s, t0 - 0.05, H / 2, 0.08, H - 0.6, 0.06, hex('#a2a7ac'), 0); mb(s, t1 + 0.05, H / 2, 0.08, H - 0.6, 0.06, hex('#a2a7ac'), 0); }
        for (let t = t0 + 3; t < t0 + 11; t += 2.6) mb(s1 + 0.05, t, 0.8, 0.06, 1.4, 2.0, hex('#3a3f46'), 0);
      }
      for (let t = t0 + 4; t < t1 - 2; t += 2.5) mb(sc2, t1 + 0.04, 0.75, Math.min(1.2, Ls * 0.1), 1.2, 0.06, hex('#353a42'), 0); // service doors at the back
      mb(es + ew * 0.6 + 1.5, t0 - 4, 0.35, 2.4, 0.7, 0.7, hex('#c9cdd2'), 6); mc(es + ew * 0.6 + 1.5, t0 - 4, 2.4, 0.7, 0.7); // cart corral
    }
    // warehouse club gas station out by the avenue, lot light poles
    { const w = fW(F, 119, 12); gasStation(cols, w[0], w[1], Y2, true, '#3a4855'); }
    for (let s = 50; s <= 130; s += 9) for (const t of [8, 18, 27]) { if (s > 112 && s < 126 && t < 20) continue;
      mb(s, t, 1.7, 0.12, 3.4, 0.12, C.pole, 0); mb(s, t, 3.4, 0.9, 0.1, 0.25, C.lamp, 5); }
  }
  SITE_BOXES = new Float32Array(OB); SITE_COLS = cols; OB = keep;
}
// Real buildings must never stand on the procedural street grid. For every site building (collider >= 1.2 tall), each grid
// street or avenue it touches is removed for the whole block (curb to curb, sidewalks included) and the intersections it
// sits on are cleared, so neighbouring blocks merge into one superblock (as NYC does around projects and big sites) instead
// of leaving crosswalks and road stubs under walls. The cleared ground takes the zone around the building (lawn / plaza /
// tarmac); bare grid lots under a footprint become plaza so no procedural house grows inside it. Mapped avenues and
// highways (segments) are not touched: sites are placed clear of them.
let CARVED = 0;
function carveSites() {
  if (!SITE_COLS) return;
  const S = SITE_COLS, done = new Set(), sw = GRID_SW;
  const zAt = (x, z) => { const m = landIdx(x, z); return m < 0 ? -1 : ZONE[m]; };
  for (let i = 0; i < S.length; i += 6) {
    const cx = S[i], cz = S[i + 1], yaw = S[i + 2], ha = S[i + 3], hb = S[i + 4], h = S[i + 5];
    if (h < 1.2 || ha * hb * 4 < 1.5) continue;
    const b = boroAt(cx, cz), g = GRIDS[b]; if (!b || !g) continue;
    const zc = zAt(cx, cz), val = zc > 0 ? zc : 5;
    const c = Math.cos(yaw), sn = Math.sin(yaw), W = (lx, lz) => [cx + lx * c + lz * sn, cz - lx * sn + lz * c];
    if (zc === 0) fillPoly(ZONE, [W(-ha - 0.6, -hb - 0.6), W(ha + 0.6, -hb - 0.6), W(ha + 0.6, hb + 0.6), W(-ha - 0.6, hb + 0.6)], 5, true);
    const rect = (u0, u1, v0, v1) => fillPoly(ZONE, [gWorld(g, u0, v0), gWorld(g, u1, v0), gWorld(g, u1, v1), gWorld(g, u0, v1)], val, true);
    for (let a = -ha - 0.4; a <= ha + 0.4; a += 0.5) for (let d = -hb - 0.4; d <= hb + 0.4; d += 0.5) {
      const q = W(a, d); if (zAt(q[0], q[1]) !== 0 || boroAt(q[0], q[1]) !== b || segHit(q[0], q[1])) continue;
      const l = gLocal(g, q[0], q[1]), iu = Math.round(l[0] / g.A), jv = Math.round(l[1] / g.S);
      const onA = Math.abs(l[0] - iu * g.A) < g.wa / 2 + sw, onS = Math.abs(l[1] - jv * g.S) < g.ws / 2 + sw;
      if (!onA && !onS) continue;
      const key = b + ':' + (onA && onS ? 'x' + iu + ',' + jv : onA ? 'a' + iu + ',' + Math.floor(l[1] / g.S) : 's' + Math.floor(l[0] / g.A) + ',' + jv);
      if (done.has(key)) continue; done.add(key); CARVED++;
      const ea = g.wa / 2 + sw + MAP_RES * 0.6, es = g.ws / 2 + sw + MAP_RES * 0.6;   // + over half a raster cell, so no sliver of curb survives
      if (onA && onS) rect(iu * g.A - ea, iu * g.A + ea, jv * g.S - es, jv * g.S + es);                                   // intersection
      else if (onA) { const j0 = Math.floor(l[1] / g.S); rect(iu * g.A - ea, iu * g.A + ea, j0 * g.S + g.ws / 2, (j0 + 1) * g.S - g.ws / 2); }   // avenue, one block
      else { const i0 = Math.floor(l[0] / g.A); rect(i0 * g.A + g.wa / 2, (i0 + 1) * g.A - g.wa / 2, jv * g.S - es, jv * g.S + es); }        // street, one block
    }
  }
}

function addSite(ctx) {
  if (!SITE_BOXES) return;
  const B = SITE_BOXES;
  for (let i = 0; i < B.length; i += INST) if (B[i] >= ctx.x0 && B[i] < ctx.x0 + CH && B[i + 2] >= ctx.z0 && B[i + 2] < ctx.z0 + CH) for (let k = 0; k < INST; k++) OB.push(B[i + k]);
  const S = SITE_COLS;
  for (let i = 0; i < S.length; i += 6) { const r = Math.hypot(S[i + 3], S[i + 4]);
    if (S[i] + r > ctx.x0 && S[i] - r < ctx.x0 + CH && S[i + 1] + r > ctx.z0 && S[i + 1] - r < ctx.z0 + CH) addCol(ctx, S[i], S[i + 1], S[i + 2], S[i + 3], S[i + 4], S[i + 5]); }
}

function addCol(ctx, cx, cz, yaw, ha, hb, h) { ctx.cols.push(cx, cz, Math.cos(yaw), -Math.sin(yaw), ha, hb, h); }

function lotOK(g, b, u, v, hu, hv) {
  for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
    const q = gWorld(g, u + a * hu, v + c * hv);
    if (tileAt(q[0], q[1]) !== T_LOT || boroAt(q[0], q[1]) !== b) return false;
  }
  const q = gWorld(g, u, v);
  if (lmExcluded(q[0], q[1], Math.max(hu, hv))) return false;
  return true;
}

function heightFor(b, x, z, r, style) {
  if (b === 1) {
    const mid = gauss(x, z, P(40.7545, -73.9830), 75), fidi = gauss(x, z, P(40.7080, -74.0095), 42), hy = gauss(x, z, P(40.7540, -74.0000), 30);
    let base = 3.6 + 8.5 * mid + 9.5 * fidi + 5 * hy;
    if (z < P(40.8000, 0)[1]) base = 3.0 + 1.0 * r;
    return Math.max(2.4, base * (0.6 + 0.75 * r));
  }
  if (b === 2) return (2.6 + 2.6 * r) * (1 + 0.4 * gauss(x, z, P(40.8270, -73.9200), 60));
  if (b === 3) { const dt = gauss(x, z, P(40.6930, -73.9870), 32) + 0.7 * gauss(x, z, P(40.7150, -73.9620), 20); return dt > 0.25 ? (3 + 8 * dt) * (0.6 + 0.7 * r) : 2.0 + 1.3 * r; }
  if (b === 4) { const lic = gauss(x, z, P(40.7470, -73.9430), 32); return lic > 0.2 ? (3 + 8.5 * lic) * (0.6 + 0.7 * r) : 1.8 + 1.8 * r + 4 * gauss(x, z, P(40.7600, -73.8300), 25) + 4 * gauss(x, z, P(40.7020, -73.8000), 25); }
  if (b === 5) return 1.4 + 0.6 * r;
  if (b === 6) { const jc = gauss(x, z, P(40.7200, -74.0360), 28); return jc > 0.15 ? (3 + 10 * jc) * (0.6 + 0.7 * r) : 2.2 + 1.8 * r; }
  return 3;
}

function placeBlocks(g, ctx) {
  const b = g.boro;
  const cs = [[ctx.x0, ctx.z0], [ctx.x0 + CH, ctx.z0], [ctx.x0, ctx.z0 + CH], [ctx.x0 + CH, ctx.z0 + CH]].map(p => gLocal(g, p[0], p[1]));
  let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
  for (const c of cs) { umin = Math.min(umin, c[0]); umax = Math.max(umax, c[0]); vmin = Math.min(vmin, c[1]); vmax = Math.max(vmax, c[1]); }
  const yaw = -g.th;
  const bu = g.A - g.wa - 2 * g.sw, bv = g.S - g.ws - 2 * g.sw;
  const br = Math.hypot(bu, bv) / 2;
  for (let i = Math.floor(umin / g.A) - 1; i <= Math.ceil(umax / g.A); i++) {
    for (let j = Math.floor(vmin / g.S) - 1; j <= Math.ceil(vmax / g.S); j++) {
      const uc = (i + 0.5) * g.A, vc = (j + 0.5) * g.S;
      const wc = gWorld(g, uc, vc);
      const own = inChunk(ctx, wc[0], wc[1]);
      // blocks that only hang over this chunk still get their barrier here (collision lookups are per chunk)
      if (!own && (wc[0] < ctx.x0 - br || wc[0] > ctx.x0 + CH + br || wc[1] < ctx.z0 - br || wc[1] > ctx.z0 + CH + br)) continue;
      blockFence(g, b, uc, vc, bu, bv, yaw, ctx);
      if (!own) continue;
      const R = rng(ihash(i, j, b * 7 + 1));
      const tsq = tsqBlock(b, i, j);
      // ---- buildings ----
      if (!tsq) placeLots(g, b, i, j, uc, vc, bu, bv, R, ctx);
      if (rampValid(g, i, j)) buildRamp(g, i, j);
      // ---- street props around the block perimeter ----
      blockProps(g, b, i, j, uc, vc, bu, bv, R, ctx, yaw);
    }
  }
}
// Solid blocks: the whole lot area inside the sidewalks is a collider ("force field"), so cars can't
// squeeze between buildings or through backyards. Full blocks get one box; blocks cut by water, parks,
// highways or landmark plazas get one box per ~2.5-unit cell that is entirely lot.
function blockFence(g, b, uc, vc, bu, bv, yaw, ctx) {
  const lotAt = (u, v) => { const q = gWorld(g, u, v); return tileAt(q[0], q[1]) === T_LOT && boroAt(q[0], q[1]) === b && !lmExcluded(q[0], q[1], 0); };
  let full = true; // sample every ~0.9 units so a diagonal like Broadway can't slip between samples
  const na = Math.ceil(bu / 0.9), nc = Math.ceil(bv / 0.9);
  for (let a = 0; a <= na && full; a++) for (let c = 0; c <= nc; c++) if (!lotAt(uc - bu / 2 + 0.1 + a * (bu - 0.2) / na, vc - bv / 2 + 0.1 + c * (bv - 0.2) / nc)) { full = false; break; }
  if (full) { const w = gWorld(g, uc, vc); addCol(ctx, w[0], w[1], yaw, bu / 2, bv / 2, 40); return; }
  const nu = Math.max(1, Math.round(bu / 2.5)), nv = Math.max(1, Math.round(bv / 2.5)), cu = bu / nu, cv = bv / nv;
  for (let a = 0; a < nu; a++) for (let c = 0; c < nv; c++) {
    const u = uc - bu / 2 + (a + 0.5) * cu, v = vc - bv / 2 + (c + 0.5) * cv;
    let ok = true;
    for (let p = -1; p <= 1 && ok; p++) for (let q = -1; q <= 1; q++) if (!lotAt(u + p * cu * 0.49, v + q * cv * 0.49)) { ok = false; break; }
    if (!ok) continue;
    const w = gWorld(g, u, v); addCol(ctx, w[0], w[1], yaw, cu / 2, cv / 2, 40);
  }
}

function placeLots(g, b, i, j, uc, vc, bu, bv, R, ctx) {
  const yaw = -g.th;
  let style = g.style;
  const wc = gWorld(g, uc, vc);
  if (b === 4 && wc[0] > 330) style = 'sub';
  if (b === 4 && style !== 'sub' && gauss(wc[0], wc[1], P(40.7470, -73.9430), 32) < 0.2 && R() < 0.5) style = 'brown';
  if (b === 1 && wc[1] < P(40.8000, 0)[1]) style = 'brown';
  let lots = [];
  if (style === 'sub') {
    const nu = Math.max(2, Math.round(bu / 3.2)), nv = 2;
    for (let a = 0; a < nu; a++) for (let c = 0; c < nv; c++) lots.push([uc - bu / 2 + (a + 0.5) * bu / nu, vc - bv / 2 + (c + 0.5) * bv / nv, bu / nu / 2, bv / nv / 2, 'house']);
  } else if (style === 'brown') {
    const nu = Math.max(3, Math.round(bu / 1.7));
    for (let c = 0; c < 2; c++) for (let a = 0; a < nu; a++) lots.push([uc - bu / 2 + (a + 0.5) * bu / nu, vc - bv / 2 + (c + 0.5) * bv / 2, bu / nu / 2, bv / 4, 'row']);
  } else {
    const nu = 1 + Math.floor(R() * 3), split = R() < 0.4 && bv > 4.5;
    for (let a = 0; a < nu; a++) {
      if (split) for (let c = 0; c < 2; c++) lots.push([uc - bu / 2 + (a + 0.5) * bu / nu, vc - bv / 2 + (c + 0.5) * bv / 2, bu / nu / 2, bv / 4, 'tower']);
      else lots.push([uc - bu / 2 + (a + 0.5) * bu / nu, vc, bu / nu / 2, bv / 2, 'tower']);
    }
  }
  for (const L of lots) {
    const gap = L[4] === 'row' ? 0.04 : L[4] === 'house' ? 0.45 : 0.12;
    const hu = L[2] - gap, hv = L[3] - gap;
    if (hu < 0.4 || hv < 0.4) continue;
    if (!lotOK(g, b, L[0], L[1], hu, hv)) continue;
    const w = gWorld(g, L[0], L[1]);
    const r = R();
    if (L[4] === 'house') { house(w[0], w[1], yaw, hu * 2, hv * 2, R, ctx); continue; }
    let h = L[4] === 'row' ? 2.0 + R() * 1.3 : heightFor(b, w[0], w[1], r, g.style);
    const pal = L[4] === 'row' ? PAL.brown : (b === 1 ? (h > 7 ? PAL.tower : PAL.walkup) : b === 6 ? (h > 7 ? PAL.tower : PAL.brick) : (h > 7 ? PAL.tower : (b === 3 ? PAL.brown : PAL.brick)));
    // which local-z side faces a street: lots sit either side of the block's centre line in v (v = -lz)
    const dvc = L[1] - vc, faceZ = Math.abs(dvc) > 0.01 ? -Math.sign(dvc) : (R() < 0.5 ? -1 : 1);
    tower(w[0], w[1], yaw, hu * 2, hv * 2, h, pal[Math.floor(R() * pal.length)], R, ctx, b, faceZ, L[4], pal !== PAL.tower);
  }
}

// Building styles (materials: 1 punched windows, 7 glass curtain wall, 8 storefront; see BOX_FS)
//  - tall: tiered tower, either masonry with windows or a glass curtain wall; tallest get a crown or spire
//  - walk-up / brick: cornice, storefront band + awning on the street side, fire escapes
//  - row (brownstone): cornice + stoop
//  - every flat roof gets a darker inset membrane so it reads as a roof with a parapet from above
const shadeC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
function roofCap(x, z, yaw, w, d, top, col) { if (w > 0.7 && d > 0.7) box(x, top + 0.01, z, w - 0.26, 0.03, d - 0.26, yaw, shadeC(col, 0.62), 0); }
function tower(x, z, yaw, w, d, h, col, R, ctx, b, faceZ, kind, masonry) {
  faceZ = faceZ || 1;
  const street = b === 1 || b === 2 || b === 3 || b === 4 || b === 6;
  if (h > 8.5 && w > 2.5 && d > 2.5) {
    const glass = R() < (b === 1 || b === 6 ? 0.5 : 0.3);
    const wm = glass ? 7 : 1, c = glass ? PAL.glass[Math.floor(R() * PAL.glass.length)] : col;
    const h1 = h * (0.35 + R() * 0.2);
    box(x, h1 / 2, z, w, h1, d, yaw, c, wm);
    if (street && R() < 0.8) box(x, 0.33, z, w + 0.06, 0.66, d + 0.06, yaw, PAL.awning[Math.floor(R() * PAL.awning.length)], 8);
    const w2 = w * (0.72 + R() * 0.12), d2 = d * (0.72 + R() * 0.12);
    roofCap(x, z, yaw, w, d, h1, glass ? hex('#8c949c') : col);
    if (h > 12.5 && w2 > 2.2) {
      const h2 = h * 0.72;
      box(x, h1 + (h2 - h1) / 2, z, w2, h2 - h1, d2, yaw, c, wm);
      box(x, h2 + (h - h2) / 2, z, w2 * 0.7, h - h2, d2 * 0.7, yaw, c, wm);
      const cw = w2 * 0.7, cd = d2 * 0.7, r = R();
      if (r < 0.35) { // art deco stepped crown + spire
        const cc = glass ? hex('#c9d2da') : shadeC(col, 1.12);
        box(x, h + 0.3, z, cw * 0.7, 0.6, cd * 0.7, yaw, cc, 0);
        box(x, h + 0.85, z, cw * 0.45, 0.5, cd * 0.45, yaw, cc, 0);
        box(x, h + 1.25, z, cw * 0.25, 0.3, cd * 0.25, yaw, cc, 0);
        box(x, h + 2.4, z, 0.1, 2.0, 0.1, yaw, C.silver, 6);
      } else if (r < 0.7) { // mechanical penthouse + antenna
        roofCap(x, z, yaw, cw, cd, h, glass ? hex('#8c949c') : col);
        box(x, h + 0.3, z, cw * 0.45, 0.6, cd * 0.4, yaw, hex('#8d9196'), 0);
        box(x, h + 1.5, z, 0.12, 2.4, 0.12, yaw, C.gray, 0);
      } else { // flat roof with helipad-ish marking
        roofCap(x, z, yaw, cw, cd, h, glass ? hex('#8c949c') : col);
        if (cw > 1.6) box(x, h + 0.04, z, cw * 0.5, 0.02, cd * 0.5, yaw, hex('#d8d8d8'), 0);
      }
    } else {
      box(x, h1 + (h - h1) / 2, z, w2, h - h1, d2, yaw, c, wm);
      roofCap(x, z, yaw, w2, d2, h, glass ? hex('#8c949c') : col);
      box(x, h + 0.25, z, w2 * 0.35, 0.5, d2 * 0.35, yaw, hex('#8d9196'), 0);
    }
  } else {
    box(x, h / 2, z, w, h, d, yaw, col, 1);
    // cornice doubles as the roof: its top sits just above the wall top so the faces never z-fight
    if (h > 1.8 && w > 0.8) box(x, h - 0.05, z, w + 0.1, 0.14, d + 0.1, yaw, shadeC(col, 0.68), 0);
    else roofCap(x, z, yaw, w, d, h, col);
    if (kind === 'row') { // brownstone stoop
      if (w > 0.7) lbox(x, z, yaw, (R() - 0.5) * w * 0.4, 0.18, faceZ * (d / 2 + 0.22), 0.34, 0.36, 0.44, PAL.stone[Math.floor(R() * PAL.stone.length)], 0);
    } else if (street) {
      if (R() < 0.75) { // storefront band + awning on the street side
        const ac = PAL.awning[Math.floor(R() * PAL.awning.length)];
        box(x, 0.33, z, w + 0.06, 0.66, d + 0.06, yaw, ac, 8);
        if (R() < 0.7) lbox(x, z, yaw, 0, 0.74, faceZ * (d / 2 + 0.17), w * 0.78, 0.05, 0.34, ac, 0);
      }
      if (masonry && h >= 3 && h < 9 && w > 1.4 && R() < 0.55) { // fire escape
        const lx = (R() - 0.5) * (w - 1.2), top = h - 0.5, fz = faceZ * (d / 2 + 0.14);
        for (let y = 1.3; y <= top; y += 0.75) lbox(x, z, yaw, lx, y, fz, 0.78, 0.04, 0.28, C.black, 0);
        if (top > 1.3) lbox(x, z, yaw, lx + 0.33, (1.3 + top) / 2, faceZ * (d / 2 + 0.27), 0.04, top - 1.3, 0.04, C.black, 0);
      }
    }
    // rooftop details
    if (h > 2.2 && w > 1.2 && d > 1.2) {
      const nAC = R() < 0.6 ? 1 + Math.floor(R() * 2) : 0;
      for (let k = 0; k < nAC; k++) lbox(x, z, yaw, (R() - 0.5) * (w - 0.8), h + 0.2, (R() - 0.5) * (d - 0.8), 0.45, 0.36, 0.38, C.gray, 0);
      if ((b === 1 || b === 3 || b === 2) && h < 9 && R() < 0.3 && w > 1.6) {
        const lx = (R() - 0.5) * (w - 1), lz = (R() - 0.5) * (d - 1);
        for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) lbox(x, z, yaw, lx + sx, h + 0.35, lz + sz, 0.06, 0.7, 0.06, C.wood2, 0);
        lbox(x, z, yaw, lx, h + 1.0, lz, 0.75, 0.75, 0.75, C.wood, 0);
        lbox(x, z, yaw, lx, h + 1.5, lz, 0.55, 0.25, 0.55, C.wood2, 0);
      }
    }
  }
  addCol(ctx, x, z, yaw, w / 2, d / 2, h);
}

function house(x, z, yaw, w, d, R, ctx) {
  const col = PAL.house[Math.floor(R() * PAL.house.length)], rc = PAL.roof[Math.floor(R() * PAL.roof.length)];
  const bw = Math.min(w, 2.4), bd = Math.min(d, 2.6), h = 1.2 + R() * 0.5;
  box(x, h / 2, z, bw, h, bd, yaw, col, 4);
  box(x, h + 0.16, z, bw + 0.15, 0.32, bd + 0.15, yaw, rc, 0);
  box(x, h + 0.45, z, bw * 0.62, 0.3, bd + 0.15, yaw, rc, 0);
  addCol(ctx, x, z, yaw, bw / 2, bd / 2, h);
  if (R() < 0.5) { const p = rot(x, z, yaw, (R() < 0.5 ? -1 : 1) * (bw / 2 + 0.5), 0); if (tileAt(p[0], p[1]) === T_LOT) prop(ctx, 12, p[0], p[1], yaw, R); }
}

// prop types
const PT = { TREE: 1, LAMP: 2, HYDRANT: 3, TRASH: 4, NEWS: 5, BENCH: 6, PCAR: 7, CART: 8, TOMB: 9, UMB: 10, BUSH: 12, CONE: 13 };
const PMASS = [0, 1.0, 0.8, 0.5, 0.25, 0.2, 0.3, 3.0, 0.8, 0.2, 0.1, 0, 0.2, 0.1];
const PRAD = [0, 0.38, 0.22, 0.2, 0.22, 0.2, 0.45, 1.0, 0.5, 0.18, 0.3, 0, 0.4, 0.18];
function prop(ctx, type, x, z, yaw, R) {
  const start = OB.length / INST;
  switch (type) {
    case PT.TREE: {
      const lf = PAL.leaf[Math.floor(R() * PAL.leaf.length)], s = 0.85 + R() * 0.4;
      box(x, 0.4 * s, z, 0.18, 0.8 * s, 0.18, 0, C.trunk);
      box(x, 1.15 * s, z, 0.95 * s, 0.75 * s, 0.95 * s, R() * 1.5, lf);
      box(x, 1.62 * s, z, 0.6 * s, 0.4 * s, 0.6 * s, R() * 1.5, lf);
      break;
    }
    case PT.LAMP: {
      box(x, 1.1, z, 0.09, 2.2, 0.09, yaw, C.pole);
      lbox(x, z, yaw, 0, 2.18, 0.28, 0.08, 0.07, 0.56, C.pole);
      lbox(x, z, yaw, 0, 2.12, 0.5, 0.2, 0.08, 0.24, C.lamp, 5);
      break;
    }
    case PT.HYDRANT: box(x, 0.2, z, 0.24, 0.4, 0.24, yaw, C.red); box(x, 0.43, z, 0.16, 0.08, 0.16, yaw, C.red); box(x, 0.25, z, 0.36, 0.08, 0.1, yaw, C.red); break;
    case PT.TRASH: box(x, 0.22, z, 0.3, 0.44, 0.3, yaw, C.dkgreen); break;
    case PT.NEWS: box(x, 0.25, z, 0.3, 0.5, 0.26, yaw, R() < 0.5 ? C.blue : C.red); break;
    case PT.BENCH: box(x, 0.22, z, 0.9, 0.08, 0.32, yaw, C.wood); lbox(x, z, yaw, 0, 0.4, -0.14, 0.9, 0.3, 0.06, C.wood); lbox(x, z, yaw, -0.38, 0.1, 0, 0.06, 0.2, 0.3, C.pole); lbox(x, z, yaw, 0.38, 0.1, 0, 0.06, 0.2, 0.3, C.pole); break;
    case PT.PCAR: { const col = PAL.car[Math.floor(R() * PAL.car.length)]; carBoxes(x, z, yaw, col); break; }
    case PT.CART: box(x, 0.45, z, 0.95, 0.6, 0.55, yaw, C.silver); box(x, 1.25, z, 1.2, 0.08, 1.0, yaw, R() < 0.5 ? C.yellow : C.red); box(x, 0.95, z, 0.05, 0.6, 0.05, yaw, C.pole); break;
    case PT.TOMB: box(x, 0.18, z, 0.28, 0.36, 0.1, yaw, R() < 0.5 ? C.gray : C.concrete); break;
    case PT.UMB: box(x, 0.6, z, 0.06, 1.2, 0.06, 0, C.white); box(x, 1.2, z, 1.1, 0.1, 1.1, yaw, [C.red, C.blue, C.yellow, C.green][Math.floor(R() * 4)]); break;
    case PT.BUSH: box(x, 0.3, z, 0.7, 0.6, 0.7, yaw, PAL.leaf[Math.floor(R() * 4)]); break;
    case PT.CONE: box(x, 0.2, z, 0.25, 0.4, 0.25, 0, C.orange); break;
  }
  const n = OB.length / INST - start;
  ctx.props.push(x, z, PRAD[type], type, start, n, yaw, PMASS[type]);
}
// parked sedan made of boxes, front = +z local (static, so no raked glass; same proportions as the driven sedan)
function carBoxes(x, z, yaw, col) {
  lbox(x, z, yaw, 0, 0.33, 0, 1.08, 0.34, 2.16, col);
  lbox(x, z, yaw, 0, 0.52, 0.68, 1.02, 0.08, 0.8, col);
  lbox(x, z, yaw, 0, 0.52, -0.86, 1.02, 0.08, 0.44, col);
  lbox(x, z, yaw, 0, 0.7, -0.2, 0.96, 0.34, 1.0, C.glass, 6);
  lbox(x, z, yaw, 0, 0.89, -0.2, 0.92, 0.06, 0.74, col);
  lbox(x, z, yaw, 0, 0.25, 1.1, 1.08, 0.14, 0.08, C.dark); lbox(x, z, yaw, 0, 0.25, -1.1, 1.08, 0.14, 0.08, C.dark);
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.7, 0.7]) { lbox(x, z, yaw, sx, 0.2, sz, 0.2, 0.4, 0.39, C.tire); lbox(x, z, yaw, sx * 1.21, 0.2, sz, 0.02, 0.25, 0.25, C.silver, 6); }
}

function blockProps(g, b, i, j, uc, vc, bu, bv, R, ctx, yaw) {
  const off = g.sw * 0.62;
  const dense = b === 1 ? 0.55 : b === 5 ? 0.25 : 0.5;
  // sides along u (streets) at v = vc +/- (bv/2 + off)
  for (const sd of [-1, 1]) {
    const v = vc + sd * (bv / 2 + off);
    const n = Math.max(1, Math.floor(bu / 3.2));
    for (let k = 0; k < n; k++) {
      const u = uc - bu / 2 + (k + 0.5) * bu / n + (R() - 0.5) * 0.6;
      const q = gWorld(g, u, v);
      if (tileAt(q[0], q[1]) !== T_WALK || lmExcluded(q[0], q[1], 0.5)) continue;
      const r = R();
      if (r < dense) prop(ctx, PT.TREE, q[0], q[1], 0, R);
      else if (r < dense + 0.08) prop(ctx, b === 1 && R() < 0.5 ? PT.CART : PT.TRASH, q[0], q[1], yaw, R);
      else if (r < dense + 0.13) prop(ctx, PT.NEWS, q[0], q[1], yaw, R);
    }
    // parked cars in the street parking lane
    if (b !== 1 || R() < 0.5) {
      const vp = vc + sd * (bv / 2 + g.sw + 0.62);
      const n2 = Math.max(1, Math.floor(bu / 2.7));
      for (let k = 0; k < n2; k++) {
        if (R() > 0.22) continue;
        const u = uc - bu / 2 + (k + 0.5) * bu / n2;
        const q = gWorld(g, u, vp);
        if (tileAt(q[0], q[1]) !== T_ROAD || lmExcluded(q[0], q[1], 1)) continue;
        // only along streets (not intersections)
        const lu = Math.abs(u - g.A * Math.round(u / g.A)); if (lu < g.wa / 2 + 1.3) continue;
        prop(ctx, PT.PCAR, q[0], q[1], yaw + Math.PI / 2 + (R() < 0.5 ? Math.PI : 0), R);
      }
    }
  }
  // sides along v (avenues): lamps
  for (const sd of [-1, 1]) {
    const u = uc + sd * (bu / 2 + off);
    const n = Math.max(1, Math.floor(bv / 4));
    for (let k = 0; k < n; k++) {
      const v = vc - bv / 2 + (k + 0.5) * bv / n;
      const q = gWorld(g, u, v);
      if (tileAt(q[0], q[1]) !== T_WALK || lmExcluded(q[0], q[1], 0.5)) continue;
      const r = R();
      if (r < 0.45) prop(ctx, PT.LAMP, q[0], q[1], yaw + (sd > 0 ? -Math.PI / 2 : Math.PI / 2), R);
      else if (r < 0.6 && b !== 1) prop(ctx, PT.TREE, q[0], q[1], 0, R);
    }
  }
  // hydrant at a corner
  if (R() < 0.55) {
    const su = R() < 0.5 ? -1 : 1, sv = R() < 0.5 ? -1 : 1;
    const q = gWorld(g, uc + su * (bu / 2 + off), vc + sv * (bv / 2 + off));
    if (tileAt(q[0], q[1]) === T_WALK) prop(ctx, PT.HYDRANT, q[0], q[1], yaw, R);
  }
}

function placeOpenProps(ctx) {
  const R = rng(ihash(ctx.x0 | 0, ctx.z0 | 0, 99));
  // striped lots (LOTS in map.js): parked cars in the stalls + light poles. Busier close to the buildings.
  if (SITE_BOXES) for (const L of LOTS) {
    const q = fLocal(L.F, ctx.x0 + CH / 2, ctx.z0 + CH / 2);
    if (q[0] < L.s0 - 40 || q[0] > L.s1 + 40 || q[1] < L.t0 - 40 || q[1] > L.t1 + 40) continue;
    const mall = !!L.bl, R2 = L.ring;
    for (let s = L.s0 + 0.7; s < L.s1; s += 1.4) for (let b = 0; b * 8.8 + L.tb < L.t1; b++) for (const tb of [1.3, 3.9]) {
      const t = L.tb + b * 8.8 + tb; if (t < L.t0 + 0.6 || t > L.t1 - 1.3) continue;
      const w = fW(L.F, s, t); if (!inChunk(ctx, w[0], w[1]) || tileAt(w[0], w[1]) !== T_PARKING) continue;
      let p = 0.38;
      if (mall) {
        if (R2 && (Math.abs(t - R2.t0) < 2.6 || Math.abs(t - R2.t1) < 2.6 || Math.abs(s - R2.s0) < 2.6 || Math.abs(s - R2.s1) < 2.6 || (Math.abs(Math.abs(s) - 20) < 2.4 && t < R2.t0 + 2))) continue;
        if (L.ex && L.ex.some(e => s > e[0] && s < e[1] && t > e[2] && t < e[3])) continue;
        let dmin = 1e9; for (const m of L.bl) { const ds = Math.max(m[0] - s, 0, s - m[1]), dt = Math.max(m[2] - t, 0, t - m[3]); dmin = Math.min(dmin, Math.hypot(ds, dt)); }
        if (dmin < 1.6) continue; p = 0.06 + 0.6 * Math.exp(-dmin / 12);
      }
      if (ihash(Math.round(s * 10), Math.round(t * 10), mall ? 78 : 77) % 1000 < p * 1000) prop(ctx, PT.PCAR, w[0], w[1], L.F.yaw + (tb < 2 ? Math.PI / 2 : -Math.PI / 2), R);
    }
    if (!mall) for (let s = 9; s < 118; s += 12) { const w = fW(L.F, s, 3.2 + 7.0); if (inChunk(ctx, w[0], w[1])) prop(ctx, PT.LAMP, w[0], w[1], L.F.yaw, R); }
  }
  // site colliders near this chunk, so park/plaza trees never grow inside a real building
  const SC = []; if (SITE_COLS) for (let i = 0; i < SITE_COLS.length; i += 6) { const S = SITE_COLS, r = Math.hypot(S[i + 3], S[i + 4]) + 1;
    if (S[i] + r > ctx.x0 && S[i] - r < ctx.x0 + CH && S[i + 1] + r > ctx.z0 && S[i + 1] - r < ctx.z0 + CH) SC.push(i); }
  const siteHit = (x, z, pad) => { for (const i of SC) { const S = SITE_COLS, c = Math.cos(S[i + 2]), sn = Math.sin(S[i + 2]), dx = x - S[i], dz = z - S[i + 1];
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (Math.abs(lx) < S[i + 3] + pad && Math.abs(lz) < S[i + 4] + pad) return true; } return false; };
  const inCampus = (x, z) => { for (const b of CAMPUS_BB) if (x > b[0] && x < b[2] && z > b[1] && z < b[3]) return true; return false; };
  // parks: jittered lattice
  for (let z = ctx.z0 + 1.6; z < ctx.z0 + CH; z += 3.2) for (let x = ctx.x0 + 1.6; x < ctx.x0 + CH; x += 3.2) {
    const px = x + (R() - 0.5) * 2.2, pz = z + (R() - 0.5) * 2.2, r = R();
    const t = tileAt(px, pz);
    if (t === T_PARK) { if (lmExcluded(px, pz, 1) || (SC.length && siteHit(px, pz, 0.9))) continue; if (inCampus(px, pz)) { if (r < 0.16) prop(ctx, PT.TREE, px, pz, 0, R); else if (r < 0.19) prop(ctx, PT.BENCH, px, pz, R() * 3, R); continue; } if (r < 0.55) prop(ctx, PT.TREE, px, pz, 0, R); else if (r < 0.58) prop(ctx, PT.BENCH, px, pz, R() * 3, R); else if (r < 0.6) prop(ctx, PT.LAMP, px, pz, R() * 6, R); }
    else if (t === T_SAND) { if (lmExcluded(px, pz, 1)) continue; if (r < 0.12) prop(ctx, PT.UMB, px, pz, R(), R); }
    else if (t === T_MARSH) { // reed clumps (decor only: no collider, no heat) away from open pools
      if (r < 0.55 && marshWet(px, pz) < 0.54) { const k = 3 + Math.floor(R() * 4);
        for (let q = 0; q < k; q++) { const rx = px + (R() - 0.5) * 1.4, rz = pz + (R() - 0.5) * 1.4, h = 0.5 + R() * 0.7;
          box(rx, h / 2, rz, 0.07, h, 0.07, R() * 3, R() < 0.5 ? hex('#8f9a4e') : hex('#b3a868'), 0); if (R() < 0.5) box(rx, h, rz, 0.1, 0.2, 0.1, 0, hex('#5a3e24'), 0); } }
    }
    else if (t === T_PLAZA) { if (r < 0.18 && !lmExcluded(px, pz, 2) && !(SC.length && siteHit(px, pz, 0.9))) prop(ctx, PT.TREE, px, pz, 0, R); }
    else if (t === T_CEM) {
      if (r < 0.15) prop(ctx, PT.TREE, px, pz, 0, R);
      else for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) if (R() < 0.7) { const tx = px - 0.7 + a * 1.4, tz = pz - 0.7 + c * 1.4; if (tileAt(tx, tz) === T_CEM) prop(ctx, PT.TOMB, tx, tz, 0.2, R); }
    }
  }
}

// ---------- landmarks ----------
const LMY = 0.68;
function vbox(x, y, z, sx, sy, sz, yaw, col, mat) { box(x, y * LMY, z, sx, sy * LMY, sz, yaw, col, mat); }
// quaternion helpers for landmark parts (shared code can't use world.js)
function qy(a) { return [0, Math.sin(a / 2), 0, Math.cos(a / 2)]; }
function qa(x, y, z, a) { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; }
function qm(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
// square-section beam between two 3D points
function beam(a, b, th, col, mat) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const q = qm(qy(Math.atan2(dx, dz)), qa(1, 0, 0, -Math.atan2(dy, Math.hypot(dx, dz))));
  boxQ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, th, th, L + th * 0.5, q, col, mat);
}
// Landmarks. Heights are exaggerated vs. the generic city so the skyline reads at a glance.
// mat 9 = art-deco vertical piers (ESB / Chrysler shafts), see BOX_FS. Landmark boxes get +16 on mat
// in genChunk so the slicing shader treats them leniently (they stay recognizable as you drive past).
function buildLandmark(L, ctx) {
  const x = L.x, z = L.z;
  const R = rng(ihash(x | 0, z | 0, 5));
  const gy = GRIDS[boroAt(x, z) || 1] ? -GRIDS[boroAt(x, z) || 1].th : 0;
  const lb = (lx, y, lz, sx, sy, sz, yaw, col, mat) => lbox(x, z, yaw, lx, y, lz, sx, sy, sz, col, mat);
  // like lb, but the part has its own yaw (by) while its position stays in the landmark frame (fy)
  const lr = (fy, lx, y, lz, sx, sy, sz, by, col, mat) => { const p = rot(x, z, fy, lx, lz); box(p[0], y, p[1], sx, sy, sz, by, col, mat); };
  switch (L.type) {
    case 'esb': {
      const yaw = -GRIDS[1].th, s = hex('#d6cdb8'), s2 = hex('#c9bfa8');
      box(x, 0.8, z, 9, 1.6, 4.1, yaw, s2, 1);                        // 5-storey base fills the block
      box(x, 1.6 + 2.6, z, 6.8, 5.2, 3.7, yaw, s, 9);                 // lower setback mass
      box(x, 6.8 + 5.6, z, 4.6, 11.2, 3.0, yaw, s, 9);                // main shaft
      box(x, 18.0 + 0.8, z, 3.4, 1.6, 2.5, yaw, s, 9);               // 72nd-81st floor steps
      box(x, 19.6 + 0.5, z, 2.6, 1.0, 1.9, yaw, s, 9);
      box(x, 20.6 + 0.6, z, 1.7, 1.2, 1.4, yaw, hex('#efe6cf'), 5);  // observatory crown (lit at night)
      box(x, 21.8 + 0.9, z, 1.0, 1.8, 0.9, yaw, C.silver, 6);         // mooring mast
      box(x, 23.6 + 0.6, z, 0.6, 1.2, 0.6, yaw, C.silver, 6);
      box(x, 24.8 + 2.0, z, 0.16, 4.0, 0.16, yaw, C.white, 0);       // antenna
      box(x, 28.9, z, 0.3, 0.3, 0.3, yaw, C.red, 2);
      addCol(ctx, x, z, yaw, 4.5, 2.05, 30);
      break;
    }
    case 'chrysler': {
      const yaw = -GRIDS[1].th, s = hex('#d9d4cb'), sil = hex('#dfe4ea');
      box(x, 0.9, z, 5.4, 1.8, 4.1, yaw, hex('#c9c1b4'), 1);
      box(x, 1.8 + 3.4, z, 3.8, 6.8, 3.8, yaw, s, 9);
      box(x, 8.6 + 2.4, z, 3.2, 4.8, 3.2, yaw, s, 9);
      // eagles at the 61st-floor corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lr(yaw, sx * 1.65, 13.2, sz * 1.65, 0.5, 0.25, 0.5, yaw + Math.PI / 4, sil, 6);
      // terraced crown: 5 shrinking tiers, each with sunburst points on all four faces
      const tiers = [2.6, 2.1, 1.65, 1.2, 0.8];
      let y = 13.4;
      for (let k = 0; k < tiers.length; k++) {
        const w = tiers[k], h = 0.95;
        box(x, y + h / 2, z, w, h, w, yaw, sil, 6);
        const tri = w * 0.62;
        for (let f = 0; f < 4; f++) {
          const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
          const p = rot(x, z, yaw, nx * (w / 2 - 0.12), nz * (w / 2 - 0.12));
          const q = qm(qy(yaw + a), qa(0, 0, 1, Math.PI / 4));
          boxQ(p[0], y + h, p[1], tri, tri, 0.2, q, k % 2 ? sil : hex('#f4f1e8'), 5); // top half pokes above the tier = sunburst arch
        }
        y += h;
      }
      box(x, y + 0.3, z, 0.4, 0.6, 0.4, yaw, sil, 6);
      box(x, y + 2.2, z, 0.14, 3.2, 0.14, yaw, sil, 6);               // needle spire
      addCol(ctx, x, z, yaw, 2.7, 2.05, 20);
      break;
    }
    case 'wtc': {
      const yaw = -GRIDS[1].th, gl = hex('#9cc1dc'), W = 4.0, H0 = 1.4, H = 21.5, N = 12;
      box(x, H0 / 2, z, W + 2.0, H0, W + 0.1, yaw, hex('#c7ccd1'), 0); // podium
      for (let k = 0; k < N; k++) {
        const t = (k + 0.5) / N, y0 = H0 + k * H / N, hh = H / N + 0.02;
        const sA = W * (1 - 0.65 * t), sB = W * (0.45 + 0.27 * t);   // square shrinks while the 45deg square grows: twisting taper
        box(x, y0 + hh / 2, z, sA, hh, sA, yaw, gl, 7);
        box(x, y0 + hh / 2, z, sB, hh, sB, yaw + Math.PI / 4, gl, 7);
      }
      const top = H0 + H, sw = W * 0.72;
      box(x, top + 0.25, z, sw * 0.7, 0.5, sw * 0.7, yaw + Math.PI / 4, hex('#dfe4ea'), 0);
      box(x, top + 5.5, z, 0.24, 10.5, 0.24, yaw, C.white, 0);       // spire
      for (const ry of [top + 1.5, top + 4, top + 6.5]) box(x, ry, z, 0.7, 0.12, 0.7, yaw, C.white, 0);
      box(x, top + 10.9, z, 0.3, 0.3, 0.3, yaw, hex('#9fe6ff'), 2);
      addCol(ctx, x, z, yaw, W / 2, W / 2, 30);
      break;
    }
    case 'flatiron': {
      const g = GRIDS[1], yaw = -g.th, Lz = 4.0, W = 4.4, H = 5.6, N = 7, col = hex('#e2d3b5');
      // triangle: straight 5th Ave side (+x), Broadway side tapers to a narrow prow pointing uptown (-z)
      for (let k = 0; k < N; k++) {
        const t = (k + 0.5) / N, w = W * (1 - t * 0.88), lz = Lz / 2 - (k + 0.5) * Lz / N;
        lb(W / 2 - w / 2, H / 2, lz, w, H, Lz / N + 0.02, yaw, col, 1);
        lb(W / 2 - w / 2, H + 0.12, lz, w + 0.12, 0.24, Lz / N + 0.04, yaw, hex('#b9a888'), 0); // cornice
      }
      lb(W / 2 - 0.25, H / 2, -Lz / 2 - 0.1, 0.5, H, 0.4, yaw, col, 1);                         // rounded prow
      lb(0, 0.35, 0, W + 0.1, 0.7, Lz + 0.1, yaw, hex('#6b2d2d'), 8);                           // ground-floor shops
      const p = rot(x, z, yaw, W / 4, 0); addCol(ctx, p[0], p[1], yaw, W / 2.5, Lz / 2, H);
      break;
    }
    case 'wsq': {
      const g = GRIDS[1], yaw = -g.th, m = hex('#f1ece1'), m2 = hex('#ddd6c8');
      const az = -1.6; // arch on the north side of the square, facing up 5th Ave
      for (const sx of [-1, 1]) lb(sx * 1.45, 1.6, az, 1.1, 3.2, 1.0, yaw, m, 0);
      lb(0, 3.6, az, 4.0, 0.8, 1.0, yaw, m, 0);
      lb(0, 4.2, az, 4.2, 0.45, 1.1, yaw, m2, 0);
      lb(0, 3.05, az, 1.8, 0.3, 1.02, yaw, m2, 0);                  // arch soffit
      // fountain: ring of stone + water + jet
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; lr(yaw, Math.cos(a) * 1.9, 0.14, 1.0 + Math.sin(a) * 1.9, 0.56, 0.28, 0.32, yaw - a - Math.PI / 2, m2, 0); }
      for (const r of [0, Math.PI / 8, Math.PI / 4, 3 * Math.PI / 8]) lr(yaw, 0, 0.06, 1.0, 3.6, 0.06, 3.6, yaw + r, hex('#5fb3e0'), 6);
      lb(0, 0.7, 1.0, 0.3, 1.4, 0.3, yaw, hex('#e8f6ff'), 2);
      for (const sx of [-1, 1]) { const p = rot(x, z, yaw, sx * 1.45, az); addCol(ctx, p[0], p[1], yaw, 0.55, 0.5, 3.2); }
      break;
    }
    case 'msg': { // round drum with vertical ribs, a dark window band and a white roof
      const yaw = -GRIDS[1].th, Rr = 2.0, N = 20, conc = hex('#b9b4ab'), H = 3.0;
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2, by = yaw - a - Math.PI / 2, cw = 2 * Rr * Math.sin(Math.PI / N) + 0.06;
        lr(yaw, Math.cos(a) * Rr, H / 2, Math.sin(a) * Rr, cw, H, 0.7, by, conc, 0);
        lr(yaw, Math.cos(a) * (Rr + 0.05), 2.3, Math.sin(a) * (Rr + 0.05), cw, 0.55, 0.62, by, hex('#2c3e55'), 6);
        if (k % 2 === 0) lr(yaw, Math.cos(a) * (Rr + 0.12), H / 2, Math.sin(a) * (Rr + 0.12), 0.14, H + 0.1, 0.2, by, hex('#e9e6df'), 0);
      }
      for (let k = 0; k < N; k++) { // round roof from pie slices (each slice: centre -> rim)
        const a = (k + 0.5) / N * Math.PI * 2, cw = 2 * Rr * Math.sin(Math.PI / N) + 0.08;
        lr(yaw, Math.cos(a) * Rr * 0.5, H + 0.02, Math.sin(a) * Rr * 0.5, Rr, 0.12, cw, yaw - a, hex('#dfe2e6'), 0);
      }
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; lr(yaw, Math.cos(a) * 0.85, H + 0.16, Math.sin(a) * 0.85, 0.6, 0.1, 0.22, yaw - a - Math.PI / 2, hex('#b3b9c0'), 0); }
      lr(yaw, Rr + 0.9, 0.5, 0, 1.0, 1.0, 2.4, yaw, hex('#1d3557'), 8); // entrance pavilion
      addCol(ctx, x, z, yaw, Rr, Rr, H);
      break;
    }
    case 'gct': { // beaux-arts terminal: three giant arched windows on 42nd St, copper roof, clock + statues
      const yaw = -GRIDS[1].th, cr = hex('#e3d7bd'), cr2 = hex('#efe6d2');
      lb(0, 1.25, 0, 6.4, 2.5, 3.8, yaw, cr, 0);
      lb(0, 2.62, 0, 6.2, 0.26, 3.6, yaw, hex('#6fa58a'), 0);
      for (const lx of [-1.7, 0, 1.7]) { lb(lx, 1.25, 1.91, 1.0, 1.8, 0.06, yaw, hex('#2c3e55'), 6); lb(lx, 2.2, 1.91, 0.7, 0.25, 0.07, yaw, hex('#2c3e55'), 6); }
      for (const lx of [-2.6, -0.85, 0.85, 2.6]) lb(lx, 1.2, 1.97, 0.28, 2.3, 0.14, yaw, cr2, 0); // columns
      lb(0, 3.05, 1.55, 1.6, 0.8, 0.5, yaw, hex('#b08a3c'), 0);    // sculpture group
      lb(0, 2.55, 1.94, 0.5, 0.5, 0.08, yaw, hex('#f4f1e8'), 2);    // clock
      addCol(ctx, x, z, yaw, 3.2, 1.9, 2.6);
      break;
    }
    case 'metlife': { // broad slab straddling Park Ave, chamfered ends
      const yaw = -GRIDS[1].th, col = hex('#a39d90');
      lb(0, 1.1, 0, 7.0, 2.2, 4.0, yaw, hex('#b8b2a6'), 1);
      lb(0, 2.2 + 6.4, 0, 5.4, 12.8, 2.8, yaw, col, 1);
      for (const sx of [-1, 1]) lr(yaw, sx * 2.7, 8.6, 0, 1.98, 12.8, 1.98, yaw + Math.PI / 4, col, 1);
      lb(0, 15.2, 0, 5.6, 0.4, 2.9, yaw, hex('#4b4e55'), 0);
      lb(0, 15.5, 0, 3.2, 0.5, 1.6, yaw, hex('#8d9196'), 0);
      addCol(ctx, x, z, yaw, 3.5, 2.0, 15);
      break;
    }
    case 'rock': { // 30 Rock slab + Rockefeller Plaza rink, Prometheus, flags and the Christmas tree
      const yaw = -GRIDS[1].th, ls = hex('#d2c8b2');
      lb(-2.1, 3.0, 0, 5.0, 6.0, 3.4, yaw, ls, 9);
      lb(-2.1, 6.0 + 5.2, 0, 4.2, 10.4, 2.0, yaw, ls, 9);
      lb(-2.1, 16.4 + 0.5, 0, 2.6, 1.0, 1.4, yaw, ls, 9);
      lb(-2.1, 17.5, 0, 1.6, 0.25, 1.0, yaw, hex('#c7ccd1'), 0);
      lb(2.8, 0.08, 0, 2.9, 0.16, 2.1, yaw, hex('#9aa3ab'), 0);
      lb(2.8, 0.17, 0, 2.6, 0.03, 1.8, yaw, hex('#eef6fb'), 6);       // ice
      lb(2.8, 0.55, -1.1, 0.45, 0.6, 0.3, yaw, C.gold, 2);            // Prometheus
      for (let k = 0; k < 10; k++) { const lx = 1.35 + (k % 5) * 0.72, lz = k < 5 ? -1.25 : 1.25; lb(lx, 0.7, lz, 0.05, 1.4, 0.05, yaw, C.white, 0); lb(lx + 0.12, 1.25, lz, 0.22, 0.14, 0.03, yaw, [C.red, C.blue, C.yellow, C.green, C.white][k % 5], 0); }
      const tg = hex('#1f6b3a'); // Christmas tree
      for (let k = 0; k < 5; k++) lb(0.9, 0.5 + k * 0.7, 0, 1.6 - k * 0.3, 0.75, 1.6 - k * 0.3, yaw + k * 0.4, tg, 0);
      for (let k = 0; k < 14; k++) { const a = k * 2.4, h = 0.6 + (k / 14) * 3.0, r = 0.82 - (k / 14) * 0.6; lb(0.9 + Math.cos(a) * r, h, Math.sin(a) * r, 0.1, 0.1, 0.1, yaw, [C.red, C.gold, C.blue, C.white][k % 4], 2); }
      lb(0.9, 4.15, 0, 0.3, 0.3, 0.3, yaw, C.gold, 2);
      const p = rot(x, z, yaw, -2.1, 0); addCol(ctx, p[0], p[1], yaw, 2.5, 1.7, 17);
      break;
    }
    case 'vessel': { // copper honeycomb bowl: rings widening upward + diagonal lattice
      const cu = hex('#b8692e'), N = 12, L = 8;
      const P3 = (k, i) => { const r = 1.0 + k * 0.22, a = (i + (k % 2) * 0.5) / N * Math.PI * 2; return [x + Math.cos(a) * r, 0.3 + k * 0.62, z + Math.sin(a) * r]; };
      for (let k = 0; k < L; k++) for (let i = 0; i < N; i++) {
        beam(P3(k, i), P3(k, i + 1), 0.12, cu, 6);
        if (k + 1 < L) { beam(P3(k, i), P3(k + 1, i), 0.09, cu, 6); beam(P3(k, i + 1), P3(k + 1, i), 0.09, cu, 6); }
      }
      box(x, 0.12, z, 2.4, 0.24, 2.4, 0.3, hex('#9b8f84'), 0);
      addCol(ctx, x, z, 0, 2.2, 2.2, 5);
      break;
    }
    case 'hy30': { // tall glass tower with the Edge's triangular sky deck jutting out near the top
      const yaw = -GRIDS[1].th, gl = hex('#7fa6c2'), H = 19;
      lb(0, H / 2, 0, 4.0, H, 3.6, yaw, gl, 7);
      lr(yaw, 1.3, H + 0.8, 0, 2.4, 1.6, 3.0, yaw + 0.5, gl, 7);       // slanted crown
      const q = qm(qy(yaw + Math.PI / 4), qa(1, 0, 0, 0));
      const e = rot(x, z, yaw, -2.3, 1.6); boxQ(e[0], H - 1.6, e[1], 2.6, 0.18, 2.6, q, hex('#dfe4ea'), 0);   // Edge deck
      boxQ(e[0], H - 1.3, e[1], 2.6, 0.4, 2.6, q, hex('#bfe4ff'), 6);
      addCol(ctx, x, z, yaw, 2.0, 1.8, H);
      break;
    }
    case 'liberty': {
      const yaw = 0.3, ped = hex('#c9b99b'), g = C.liberty, gd = C.libdark;
      box(x, 0.4, z, 7, 0.8, 7, yaw, hex('#b9b2a2')); box(x, 0.4, z, 7, 0.8, 7, yaw + Math.PI / 4, hex('#b9b2a2')); // Fort Wood star
      box(x, 0.8 + 1.9, z, 2.8, 3.8, 2.8, yaw, ped, 0);
      box(x, 4.6 + 0.25, z, 3.3, 0.5, 3.3, yaw, hex('#bfae8c'), 0);
      lb(0, 5.1 + 0.6, 0, 1.9, 1.2, 1.7, yaw, gd);                  // robe hem
      lb(0, 6.3 + 1.2, 0, 1.55, 2.4, 1.35, yaw, g);                 // robe
      lb(0, 8.7 + 0.5, 0, 1.2, 1.0, 1.05, yaw, g);                  // shoulders
      lb(0, 9.2 + 0.1, 0.32, 0.9, 0.2, 0.5, yaw, gd);               // drape
      lb(0, 10.0, 0, 0.6, 0.6, 0.6, yaw, g);                        // head
      for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4, len = 0.55; const p = rot(x, z, yaw, Math.sin(a) * 0.45, -Math.cos(a) * 0.45); boxQ(p[0], 10.35, p[1], 0.08, 0.08, len, qm(qy(yaw + a + Math.PI), qa(1, 0, 0, -0.35)), g, 0); }
      lb(-0.7, 10.3, 0, 0.32, 2.4, 0.32, yaw, g);                   // raised right arm
      lb(-0.7, 11.65, 0, 0.5, 0.3, 0.5, yaw, C.gold, 2);            // torch
      lb(-0.7, 12.0, 0, 0.32, 0.45, 0.32, yaw, hex('#ffb347'), 2);
      lb(0.75, 7.9, 0.2, 0.28, 1.2, 0.8, yaw, g);                   // tablet
      addCol(ctx, x, z, yaw, 1.7, 1.7, 12);
      break;
    }
    case 'tsq': {
      const g = GRIDS[1], yaw = -g.th, bu = g.A - g.wa - 2 * g.sw, bv = g.S - g.ws - 2 * g.sw;
      for (const q of L.blocks) {
        const uc = (q[0] + 0.5) * g.A, vc = (q[1] + 0.5) * g.S, w = gWorld(g, uc, vc);
        const h = 10 + R() * 3, col = PAL.tower[Math.floor(R() * 10)];
        // built from cells so Broadway stays open through the square
        const ncu = Math.round(bu / 1.5), ncv = Math.round(bv / 1.6), cu = bu / ncu, cv = bv / ncv;
        const cellOK = (a, c) => { const u = uc - bu / 2 + (a + 0.5) * cu, v = vc - bv / 2 + (c + 0.5) * cv;
          for (let p = -1; p <= 1; p++) for (let r = -1; r <= 1; r++) { const t = gWorld(g, u + p * cu * 0.45, v + r * cv * 0.45); if (tileAt(t[0], t[1]) !== T_LOT) return false; } return true; };
        let all = true; for (let a = 0; a < ncu && all; a++) for (let c = 0; c < ncv; c++) if (!cellOK(a, c)) { all = false; break; }
        const piece = (a0, a1, c0, c1) => { // one box over cells [a0,a1) x [c0,c1)
          const u = uc - bu / 2 + (a0 + a1) / 2 * cu, v = vc - bv / 2 + (c0 + c1) / 2 * cv, sw = (a1 - a0) * cu, sd = (c1 - c0) * cv, q = gWorld(g, u, v);
          box(q[0], h / 2, q[1], sw, h, sd, yaw, col, 1); addCol(ctx, q[0], q[1], yaw, sw / 2, sd / 2, h);
        };
        if (all) piece(0, ncu, 0, ncv);
        else for (let c = 0; c < ncv; c++) { let a = 0; while (a < ncu) { if (!cellOK(a, c)) { a++; continue; } let e = a; while (e < ncu && cellOK(e, c)) e++; piece(a, e, c, c + 1); a = e; } } // Broadway cuts it: row runs
        const su = Math.sign(L.iu * g.A - uc), sv = Math.sign(L.iv * g.S - vc);
        const fu = gWorld(g, uc + su * (bu / 2 + 0.05), vc), fv = gWorld(g, uc, vc + sv * (bv / 2 + 0.05));
        const nu = [g.ex * su, g.ez * su], nv = [g.dx * sv, g.dz * sv];
        ctx.bills.push(fu[0], 5.5, fu[1], bv * 0.9, 3.6, nu[0], nu[1], Math.floor(R() * 6));
        ctx.bills.push(fu[0], 8.4, fu[1], bv * 0.8, 2.2, nu[0], nu[1], Math.floor(R() * 6));
        ctx.bills.push(fv[0], 4.6, fv[1], bu * 0.8, 3.0, nv[0], nv[1], Math.floor(R() * 6));
        ctx.bills.push(fv[0], 8.0, fv[1], bu * 0.7, 2.8, nv[0], nv[1], Math.floor(R() * 6));
      }
      break;
    }
    case 'yankee': case 'citi': {
      const yaw = gy, R0 = 7.2, yk = L.type === 'yankee', wall = yk ? hex('#d9d6cf') : hex('#9a5a3e'), N = 24;
      box(x, 0.03, z, 12.5, 0.06, 12.5, yaw + Math.PI / 4, C.field, 0);
      box(x, 0.07, z, 4.2, 0.06, 4.2, yaw + Math.PI / 4, C.dirt, 0);
      box(x, 0.05, z, 13.5, 0.06, 13.5, yaw + Math.PI / 4, hex('#3f9a45'), 0);
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2, px = x + Math.cos(a) * R0, pz = z + Math.sin(a) * R0;
        const h = 2.6 + (Math.sin(a + 1) > 0.3 ? 1.2 : 0), sa = -a + Math.PI / 2;
        box(px, h / 2, pz, 2.0, h, 1.4, sa, wall, 1);
        box(x + Math.cos(a) * (R0 - 1.2), h * 0.4, z + Math.sin(a) * (R0 - 1.2), 1.7, h * 0.8, 1.2, sa, yk ? hex('#2d4f8f') : hex('#2f5aa8'), 0); // seating
        if (yk) { // the white frieze along the roof
          const fx = x + Math.cos(a) * (R0 - 0.9), fz = z + Math.sin(a) * (R0 - 0.9);
          box(fx, h + 0.35, fz, 1.9, 0.12, 0.25, sa, C.white, 0);
          for (const o of [-0.6, 0, 0.6]) { const p = rot(fx, fz, sa, o, 0); box(p[0], h + 0.15, p[1], 0.08, 0.35, 0.08, sa, C.white, 0); }
        } else box(px, h + 0.12, pz, 2.1, 0.24, 1.6, sa, hex('#f07c1e'), 0);
      }
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; box(x + Math.cos(a) * 8.2, 3.5, z + Math.sin(a) * 8.2, 0.25, 7, 0.25, 0, C.pole); box(x + Math.cos(a) * 8.2, 7.2, z + Math.sin(a) * 8.2, 1.2, 0.6, 0.3, -a, C.lamp, 5); }
      addCol(ctx, x, z, 0, 8.2, 8.2, 4);
      break;
    }
    case 'barclays': {
      const yaw = gy, rust = hex('#7d4129'), dk = hex('#3a2418'), A = 5.4, B = 4.2, N = 11;
      // oval bowl built from slices whose depth follows an ellipse
      for (let k = 0; k < N; k++) {
        const t = -1 + (k + 0.5) * 2 / N, d = 2 * B * Math.sqrt(1 - t * t * 0.96), lx = t * A, sw = 2 * A / N + 0.03;
        lb(lx, 1.6, 0, sw, 3.2, d, yaw, rust, 0);
        for (const yy of [0.85, 1.65, 2.45]) lb(lx, yy, 0, sw + 0.02, 0.14, d + 0.14, yaw, dk, 0); // weathering-steel bands
        lb(lx, 3.24, 0, sw, 0.1, Math.max(0.1, d - 0.8), yaw, hex('#5d8f4a'), 0);                   // green roof
      }
      // oculus canopy over the plaza at Flatbush & Atlantic, with the LED ring underneath
      const oc = rot(x, z, yaw, -6.2, -4.4);
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; box(oc[0] + Math.cos(a) * 2.4, 2.6, oc[1] + Math.sin(a) * 2.4, 1.1, 0.3, 1.4, -a, dk, 0); box(oc[0] + Math.cos(a) * 1.75, 2.42, oc[1] + Math.sin(a) * 1.75, 0.7, 0.08, 0.3, -a + Math.PI / 2, hex('#ffffff'), 2); }
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; box(oc[0] + Math.cos(a) * 2.6, 1.3, oc[1] + Math.sin(a) * 2.6, 0.2, 2.6, 0.2, 0, dk, 0); }
      addCol(ctx, x, z, yaw, A, B, 4);
      break;
    }
    case 'wheel': {
      // faces the camera (camera azimuth is about -16deg) so it reads as a wheel, not a line
      const yaw = 0.28, Rw = 4.4, cy = 5.0, N = 24, W = C.white, ax = [Math.cos(yaw), -Math.sin(yaw)];
      const P3 = (a, r) => [x + ax[0] * Math.cos(a) * r, cy + Math.sin(a) * r, z + ax[1] * Math.cos(a) * r];
      for (let k = 0; k < N; k++) { const a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2; beam(P3(a0, Rw), P3(a1, Rw), 0.16, W, 0); beam(P3(a0, Rw * 0.86), P3(a1, Rw * 0.86), 0.09, W, 0); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; beam(P3(a, 0.3), P3(a, Rw), 0.07, W, 0); }
      const cars = [C.red, C.blue, C.yellow, C.green, C.orange, hex('#e84393')];
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, p = P3(a, Rw); box(p[0], p[1] - 0.45, p[2], 0.55, 0.5, 0.5, yaw, cars[k % cars.length], 0); }
      for (const s of [-1, 1]) for (const f of [-1, 1]) { const top = P3(0, 0), base = [x + ax[0] * s * 2.2 - ax[1] * f * 0.9, 0, z + ax[1] * s * 2.2 + ax[0] * f * 0.9]; beam(base, top, 0.2, W, 0); }
      box(x, cy, z, 0.5, 0.5, 0.5, yaw, W, 0);
      box(x, 0.3, z, 6, 0.6, 1.4, yaw, hex('#c0392b'), 0);
      addCol(ctx, x, z, yaw, 3.0, 0.8, 6);
      break;
    }
    case 'parachute': {
      const red = hex('#d0312d');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam([x + sx * 1.4, 0, z + sz * 1.4], [x + sx * 0.5, 9.5, z + sz * 0.5], 0.18, red, 0);
      for (let y = 2; y < 9.5; y += 2.4) { const k = 1.4 - (y / 9.5) * 0.9; box(x, y, z, k * 2 + 0.2, 0.12, k * 2 + 0.2, 0, red, 0); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; beam([x, 10, z], [x + Math.cos(a) * 2.6, 9.3, z + Math.sin(a) * 2.6], 0.12, red, 0); }
      box(x, 10.4, z, 0.6, 0.8, 0.6, 0, red, 0);
      addCol(ctx, x, z, 0, 1.3, 1.3, 9);
      break;
    }
    case 'unisphere': {
      const st = hex('#b9c1c9'), Rs = 3.0, cy = 4.4, pool = hex('#5fb3e0');
      const S3 = (lat, lon) => [x + Math.cos(lat) * Math.cos(lon) * Rs, cy + Math.sin(lat) * Rs, z + Math.cos(lat) * Math.sin(lon) * Rs];
      for (let m = 0; m < 8; m++) { const lon = m / 8 * Math.PI; for (let k = 0; k < 16; k++) beam(S3(-Math.PI / 2 + k / 16 * Math.PI * 2, lon), S3(-Math.PI / 2 + (k + 1) / 16 * Math.PI * 2, lon), 0.09, st, 6); } // meridians
      for (const lat of [-0.9, -0.45, 0, 0.45, 0.9]) for (let k = 0; k < 16; k++) beam(S3(lat, k / 16 * Math.PI * 2), S3(lat, (k + 1) / 16 * Math.PI * 2), 0.09, st, 6);           // parallels
      // continents as flat plates hugging the globe
      for (const [la, lo, w] of [[0.6, 0.3, 1.3], [0.2, 0.9, 1.1], [-0.3, 2.2, 1.2], [0.7, 2.6, 1.4], [-0.5, 4.2, 1.0], [0.4, 5.2, 1.2]]) { const p = S3(la, lo); boxQ(p[0], p[1], p[2], w, 0.08, w * 0.8, qm(qy(-lo + Math.PI / 2), qa(1, 0, 0, Math.PI / 2 - la)), hex('#8f989f'), 6); }
      // three tilted orbit rings
      for (const [tilt, rr] of [[0.5, 3.8], [-0.6, 3.6], [1.2, 3.5]]) for (let k = 0; k < 20; k++) {
        const a0 = k / 20 * Math.PI * 2, a1 = (k + 1) / 20 * Math.PI * 2, O = (a) => [x + Math.cos(a) * rr, cy + Math.sin(a) * Math.sin(tilt) * rr, z + Math.sin(a) * Math.cos(tilt) * rr];
        beam(O(a0), O(a1), 0.07, st, 6);
      }
      for (let k = 0; k < 3; k++) { const a = k * 2.094; beam([x + Math.cos(a) * 1.2, 0, z + Math.sin(a) * 1.2], [x, cy - Rs + 0.2, z], 0.3, st, 0); }
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; box(x + Math.cos(a) * 5.6, 0.15, z + Math.sin(a) * 5.6, 1.6, 0.3, 0.35, -a + Math.PI / 2, hex('#d8d2c4'), 0); }
      box(x, 0.05, z, 10.6, 0.06, 10.6, 0, pool, 6); box(x, 0.05, z, 10.6, 0.06, 10.6, Math.PI / 4, pool, 6);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; box(x + Math.cos(a) * 4.6, 0.5, z + Math.sin(a) * 4.6, 0.12, 1.0, 0.12, 0, hex('#eaf7ff'), 2); } // fountain jets
      addCol(ctx, x, z, 0, 1.3, 1.3, 5);
      break;
    }
    case 'ferryterm': {
      const yaw = gy;
      box(x, 1.5, z, 7, 3, 4, yaw, hex('#6b8db0'), 1);
      box(x, 3.3, z, 7.6, 0.4, 4.6, yaw, C.dark);
      addCol(ctx, x, z, yaw, 3.5, 2, 3);
      break;
    }
    case 'plane': {
      const yaw = L.yaw || 0, w = C.white, tail = R() < 0.5 ? C.blue : C.red;
      lbox(x, z, yaw, 0, 1.0, 0, 1.2, 1.2, 9, w);
      lbox(x, z, yaw, 0, 0.9, 0.5, 9.5, 0.18, 1.6, w);
      lbox(x, z, yaw, 0, 1.2, -4.0, 3.2, 0.14, 0.9, w);
      lbox(x, z, yaw, 0, 2.4, -4.1, 0.16, 1.8, 1.2, tail);
      lbox(x, z, yaw, -2.0, 0.55, 0.8, 0.7, 0.6, 1.4, C.gray);
      lbox(x, z, yaw, 2.0, 0.55, 0.8, 0.7, 0.6, 1.4, C.gray);
      lbox(x, z, yaw, 0, 1.25, 4.3, 0.9, 0.5, 0.5, C.glass, 6);
      addCol(ctx, x, z, yaw, 0.7, 4.5, 2);
      addCol(ctx, x, z, yaw, 4.7, 0.8, 1.2);
      break;
    }
  }
}
