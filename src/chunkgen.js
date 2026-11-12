// ============================================================
//  Chunk generation (runs in a Web Worker and on main thread)
//  Output per chunk: ground texture, box instances, colliders,
//  smashable props, billboards.
// ============================================================
const CH = 48, CTEX = 256;
const SHOP_PAD = 3.4; // Cash Rules Customs service pad size (units)
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
let SHOPS = []; const SHOPKEY = new Set();
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
  // Cash Rules Customs pads: the named sites first, then a regular lattice so there is one roughly every
  // ~110 units (about 2 km) in every borough. Each takes over one clean block as an open parking lot.
  SHOPS = []; SHOPKEY.clear();
  const tryShop = (name, x, z, R) => {
    const b = boroAt(x, z); if (!b) return false;
    const g = GRIDS[b], l = gLocal(g, x, z);
    const i0 = Math.floor(l[0] / g.A), j0 = Math.floor(l[1] / g.S);
    let best = null, bd = 1e9;
    for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
      const i = i0 + di, j = j0 + dj, d = di * di + dj * dj; if (d >= bd || SHOPKEY.has(b + ',' + i + ',' + j)) continue;
      if (blockClean(g, i, j)) {
        const bv = g.S - g.ws - 2 * g.sw;
        for (const sd of [1, -1]) { // entry side: the street side with a proper road
          const q = gWorld(g, (i + 0.5) * g.A, (j + 0.5) * g.S + sd * (bv / 2 + g.sw + g.ws * 0.25));
          if (tileAt(q[0], q[1]) === T_ROAD) { best = { i, j, sd }; bd = d; break; }
        }
      }
    }
    if (!best) return false;
    const c = gWorld(g, (best.i + 0.5) * g.A, (best.j + 0.5) * g.S);
    for (const o of SHOPS) if (Math.hypot(o.x - c[0], o.z - c[1]) < 40) return false;
    if (!name) { // name it after the nearest neighbourhood
      let bn = GEO.BORO_NAMES ? GEO.BORO_NAMES[b] : 'NYC', bdd = 1e9;
      for (const h of GEO.HOODS) { if (h[0] !== b) continue; const q = P(h[2], h[3]), dd = Math.hypot(q[0] - c[0], q[1] - c[1]); if (dd < bdd) { bdd = dd; bn = h[1]; } }
      name = bn;
    }
    SHOPS.push({ name, boro: b, g, i: best.i, j: best.j, sd: best.sd, x: c[0], z: c[1], bu: g.A - g.wa - 2 * g.sw, bv: g.S - g.ws - 2 * g.sw, yaw: -g.th });
    SHOPKEY.add(b + ',' + best.i + ',' + best.j);
    return true;
  };
  for (const s of GEO.SHOPS) { const p = P(s[1], s[2]); tryShop(s[0], p[0], p[1], 4); }
  const SP = 110; // lattice spacing (units); NYC boroughs only (New Jersey keeps its named site)
  for (let z = WZ0 + SP / 2; z < WZ1; z += SP) for (let x = WX0 + SP / 2; x < WX1; x += SP) {
    const bb = boroAt(x, z); if (!bb || bb === 6) continue;
    let near = false; for (const o of SHOPS) if (Math.hypot(o.x - x, o.z - z) < SP * 0.7) { near = true; break; }
    if (!near) tryShop(null, x, z, 2);
  }
}
function blockClean(g, i, j) {
  const bu = g.A - g.wa - 2 * g.sw, bv = g.S - g.ws - 2 * g.sw;
  if (bu < 5.5 || bv < 4.2) return false;
  for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5) {
    const q = gWorld(g, (i + 0.5) * g.A + a * bu * 0.45, (j + 0.5) * g.S + b * bv * 0.45);
    if (tileAt(q[0], q[1]) !== T_LOT || boroAt(q[0], q[1]) !== g.boro) return false;
  }
  for (const L of LM) if (Math.hypot(gWorld(g, (i + 0.5) * g.A, (j + 0.5) * g.S)[0] - L.x, gWorld(g, (i + 0.5) * g.A, (j + 0.5) * g.S)[1] - L.z) < L.r + 8) return false;
  return true;
}
function shopAtBlock(b, i, j) { if (!SHOPKEY.has(b + ',' + i + ',' + j)) return null; for (const s of SHOPS) if (s.boro === b && s.i === i && s.j === j) return s; return null; }
function lmExcluded(x, z, pad) {
  for (let k = 0; k < LM.length; k++) { const L = LM[k]; if (L.r > 0) { const dx = x - L.x, dz = z - L.z; if (dx * dx + dz * dz < (L.r + pad) * (L.r + pad)) return true; } }
  return false;
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
    for (const L of LM) if (L.x >= x0 && L.x < x0 + CH && L.z >= z0 && L.z < z0 + CH) {
      const s0 = OB.length; buildLandmark(L, ctx);
      for (let i = s0 + 13; i < OB.length; i += INST) OB[i] += 16; // landmark flag for the slicing shader
    }
    for (const S of SHOPS) if (S.x >= x0 && S.x < x0 + CH && S.z >= z0 && S.z < z0 + CH) buildShop(S, ctx);
  }
  const boxes = new Float32Array(OB); OB = null;
  return { cx, cz, tex, boxes, cols: new Float32Array(cols), props: new Float32Array(props), bills: new Float32Array(bills), land };
}

function inChunk(ctx, x, z) { return x >= ctx.x0 && x < ctx.x0 + CH && z >= ctx.z0 && z < ctx.z0 + CH; }
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
      const shop = shopAtBlock(b, i, j);
      if (!shop) blockFence(g, b, uc, vc, bu, bv, yaw, ctx);
      if (!own) continue;
      const R = rng(ihash(i, j, b * 7 + 1));
      const tsq = tsqBlock(b, i, j);
      // ---- buildings ----
      if (!shop && !tsq) placeLots(g, b, i, j, uc, vc, bu, bv, R, ctx);
      // ---- street props around the block perimeter (none around Customs: keep the way in clear) ----
      if (!shop) blockProps(g, b, i, j, uc, vc, bu, bv, R, ctx, yaw);
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
  if (full) { const w = gWorld(g, uc, vc); addCol(ctx, w[0], w[1], yaw, bu / 2, bv / 2, 3); return; }
  const nu = Math.max(1, Math.round(bu / 2.5)), nv = Math.max(1, Math.round(bv / 2.5)), cu = bu / nu, cv = bv / nv;
  for (let a = 0; a < nu; a++) for (let c = 0; c < nv; c++) {
    const u = uc - bu / 2 + (a + 0.5) * cu, v = vc - bv / 2 + (c + 0.5) * cv;
    let ok = true;
    for (let p = -1; p <= 1 && ok; p++) for (let q = -1; q <= 1; q++) if (!lotAt(u + p * cu * 0.49, v + q * cv * 0.49)) { ok = false; break; }
    if (!ok) continue;
    const w = gWorld(g, u, v); addCol(ctx, w[0], w[1], yaw, cu / 2, cv / 2, 3);
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
  // parks: jittered lattice
  for (let z = ctx.z0 + 1.6; z < ctx.z0 + CH; z += 3.2) for (let x = ctx.x0 + 1.6; x < ctx.x0 + CH; x += 3.2) {
    const px = x + (R() - 0.5) * 2.2, pz = z + (R() - 0.5) * 2.2, r = R();
    const t = tileAt(px, pz);
    if (t === T_PARK) { if (lmExcluded(px, pz, 1)) continue; if (r < 0.55) prop(ctx, PT.TREE, px, pz, 0, R); else if (r < 0.58) prop(ctx, PT.BENCH, px, pz, R() * 3, R); else if (r < 0.6) prop(ctx, PT.LAMP, px, pz, R() * 6, R); }
    else if (t === T_SAND) { if (lmExcluded(px, pz, 1)) continue; if (r < 0.12) prop(ctx, PT.UMB, px, pz, R(), R); }
    else if (t === T_PLAZA) { if (r < 0.18 && !lmExcluded(px, pz, 2)) prop(ctx, PT.TREE, px, pz, 0, R); }
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
      box(x, 0.8, z, 9, 1.6, 4.6, yaw, s2, 1);                        // 5-storey base fills the block
      box(x, 1.6 + 2.6, z, 6.8, 5.2, 4.0, yaw, s, 9);                 // lower setback mass
      box(x, 6.8 + 5.6, z, 4.6, 11.2, 3.2, yaw, s, 9);                // main shaft
      box(x, 18.0 + 0.8, z, 3.4, 1.6, 2.5, yaw, s, 9);               // 72nd-81st floor steps
      box(x, 19.6 + 0.5, z, 2.6, 1.0, 1.9, yaw, s, 9);
      box(x, 20.6 + 0.6, z, 1.7, 1.2, 1.4, yaw, hex('#efe6cf'), 5);  // observatory crown (lit at night)
      box(x, 21.8 + 0.9, z, 1.0, 1.8, 0.9, yaw, C.silver, 6);         // mooring mast
      box(x, 23.6 + 0.6, z, 0.6, 1.2, 0.6, yaw, C.silver, 6);
      box(x, 24.8 + 2.0, z, 0.16, 4.0, 0.16, yaw, C.white, 0);       // antenna
      box(x, 28.9, z, 0.3, 0.3, 0.3, yaw, C.red, 2);
      addCol(ctx, x, z, yaw, 4.5, 2.3, 30);
      break;
    }
    case 'chrysler': {
      const yaw = -GRIDS[1].th, s = hex('#d9d4cb'), sil = hex('#dfe4ea');
      box(x, 0.9, z, 5.4, 1.8, 4.6, yaw, hex('#c9c1b4'), 1);
      box(x, 1.8 + 3.4, z, 4.0, 6.8, 4.0, yaw, s, 9);
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
      addCol(ctx, x, z, yaw, 2.7, 2.3, 20);
      break;
    }
    case 'wtc': {
      const yaw = -GRIDS[1].th, gl = hex('#9cc1dc'), W = 4.4, H0 = 1.4, H = 21.5, N = 12;
      box(x, H0 / 2, z, W + 2.0, H0, W + 0.2, yaw, hex('#c7ccd1'), 0); // podium
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
      const g = GRIDS[1], yaw = -g.th, Lz = 4.4, W = 4.4, H = 5.6, N = 7, col = hex('#e2d3b5');
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
      const yaw = -GRIDS[1].th, Rr = 2.3, N = 20, conc = hex('#b9b4ab'), H = 3.0;
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
      lb(-2.2, 3.0, 0, 5.4, 6.0, 3.4, yaw, ls, 9);
      lb(-2.2, 6.0 + 5.2, 0, 4.4, 10.4, 2.0, yaw, ls, 9);
      lb(-2.2, 16.4 + 0.5, 0, 2.6, 1.0, 1.4, yaw, ls, 9);
      lb(-2.2, 17.5, 0, 1.6, 0.25, 1.0, yaw, hex('#c7ccd1'), 0);
      lb(2.8, 0.08, 0, 2.9, 0.16, 2.1, yaw, hex('#9aa3ab'), 0);
      lb(2.8, 0.17, 0, 2.6, 0.03, 1.8, yaw, hex('#eef6fb'), 6);       // ice
      lb(2.8, 0.55, -1.1, 0.45, 0.6, 0.3, yaw, C.gold, 2);            // Prometheus
      for (let k = 0; k < 10; k++) { const lx = 1.35 + (k % 5) * 0.72, lz = k < 5 ? -1.25 : 1.25; lb(lx, 0.7, lz, 0.05, 1.4, 0.05, yaw, C.white, 0); lb(lx + 0.12, 1.25, lz, 0.22, 0.14, 0.03, yaw, [C.red, C.blue, C.yellow, C.green, C.white][k % 5], 0); }
      const tg = hex('#1f6b3a'); // Christmas tree
      for (let k = 0; k < 5; k++) lb(0.9, 0.5 + k * 0.7, 0, 1.6 - k * 0.3, 0.75, 1.6 - k * 0.3, yaw + k * 0.4, tg, 0);
      for (let k = 0; k < 14; k++) { const a = k * 2.4, h = 0.6 + (k / 14) * 3.0, r = 0.82 - (k / 14) * 0.6; lb(0.9 + Math.cos(a) * r, h, Math.sin(a) * r, 0.1, 0.1, 0.1, yaw, [C.red, C.gold, C.blue, C.white][k % 4], 2); }
      lb(0.9, 4.15, 0, 0.3, 0.3, 0.3, yaw, C.gold, 2);
      const p = rot(x, z, yaw, -2.2, 0); addCol(ctx, p[0], p[1], yaw, 2.7, 1.7, 17);
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

// ---------- shops (Cash Rules Customs) ----------
function buildShop(S, ctx) {
  // Open parking lot with a drive-on service pad (the floating wrench + glow are dynamic, see game.js)
  const g = S.g, yaw = S.yaw, bu = S.bu, bv = S.bv, sd = S.sd;
  const asph = hex('#34363c'), white = hex('#e8e8e8'), green = hex('#1fd65f'), gold = hex('#e8b923'), blk = hex('#17181c');
  const L = (lx, y, v, sx, sy, sv, col, mat) => { const p = rot(S.x, S.z, yaw, lx, -v); box(p[0], y, p[1], sx, sy, sv, yaw, col, mat); };
  L(0, 0.02, 0, bu - 0.04, 0.04, bv - 0.04, asph, 0);                       // paved lot
  const PS = SHOP_PAD;                                                      // service pad in the middle
  L(0, 0.05, 0, PS, 0.02, PS, hex('#22382a'), 0);
  for (const s2 of [-1, 1]) { L(0, 0.065, s2 * PS / 2, PS + 0.2, 0.02, 0.2, green, 2); L(s2 * PS / 2, 0.065, 0, 0.2, 0.02, PS + 0.2, green, 2); }
  L(0, 0.07, 0, 0.35, 0.02, PS * 0.7, gold, 2); L(0, 0.07, 0, PS * 0.7, 0.02, 0.35, gold, 2); // plus mark
  // parking bays either side of the pad
  for (const s2 of [-1, 1]) for (let k = 0; k <= 2; k++) { const lx = s2 * (PS / 2 + 0.6 + k * 1.3); if (Math.abs(lx) < bu / 2 - 0.3) L(lx, 0.05, -sd * (bv / 2 - 1.0), 0.08, 0.02, 1.6, white, 0); }
  // booth at a back corner + tyre stack
  const bx = (bu / 2 - 0.8) * (S.i % 2 ? 1 : -1), bz = -sd * (bv / 2 - 0.65);
  L(bx, 0.6, bz, 1.1, 1.2, 0.9, blk, 0); L(bx, 1.27, bz, 1.3, 0.14, 1.1, green, 0); L(bx, 0.7, bz + sd * 0.46, 0.8, 0.4, 0.03, hex('#ffe08a'), 2);
  { const p = rot(S.x, S.z, yaw, bx, -bz); addCol(ctx, p[0], p[1], yaw, 0.55, 0.45, 1.2); }
  for (let k = 0; k < 3; k++) L(-bx, 0.15 + k * 0.28, bz, 0.7, 0.26, 0.7, hex('#1b1b1d'), 0);
  { const p = rot(S.x, S.z, yaw, -bx, -bz); addCol(ctx, p[0], p[1], yaw, 0.35, 0.35, 0.9); }
  // sign on a pole at the back, facing the street
  L(0, 1.4, -sd * (bv / 2 - 0.3), 0.18, 2.8, 0.18, C.pole, 0);
  const sp = rot(S.x, S.z, yaw, 0, sd * (bv / 2 - 0.3));
  ctx.bills.push(sp[0], 3.4, sp[1], Math.min(bu - 0.6, 5.5), 1.5, g.dx * sd, g.dz * sd, 6);
}
