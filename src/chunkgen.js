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
let SHOPS = [];
function initWorldData() {
  lmAdd('esb', 40.7484, -73.9857, 7.5);
  lmAdd('wtc', 40.7130, -74.0132, 7);
  lmAdd('chrysler', 40.7516, -73.9755, 5.5);
  lmAdd('liberty', 40.6892, -74.0445, 0);
  lmAdd('yankee', 40.8296, -73.9262, 11);
  lmAdd('citi', 40.7571, -73.8458, 11);
  lmAdd('barclays', 40.6826, -73.9754, 7);
  lmAdd('wheel', 40.5745, -73.9790, 4);
  lmAdd('parachute', 40.5738, -73.9845, 3);
  lmAdd('unisphere', 40.7465, -73.8448, 5);
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
  // auto shops: find a clean block near each requested spot
  SHOPS = [];
  for (const s of GEO.SHOPS) {
    const p = P(s[1], s[2]); const b = boroAt(p[0], p[1]); if (!b) continue;
    const g = GRIDS[b], l = gLocal(g, p[0], p[1]);
    const i0 = Math.floor(l[0] / g.A), j0 = Math.floor(l[1] / g.S);
    let best = null, bd = 1e9;
    for (let di = -4; di <= 4; di++) for (let dj = -4; dj <= 4; dj++) {
      const i = i0 + di, j = j0 + dj, d = di * di + dj * dj; if (d >= bd) continue;
      if (blockClean(g, i, j)) {
        // door side: which street side has a proper road
        const bv = g.S - g.ws - 2 * g.sw;
        for (const sd of [1, -1]) {
          const q = gWorld(g, (i + 0.5) * g.A, (j + 0.5) * g.S + sd * (bv / 2 + g.sw + g.ws * 0.25));
          if (tileAt(q[0], q[1]) === T_ROAD) { best = { i, j, sd }; bd = d; break; }
        }
      }
    }
    if (!best) continue;
    const c = gWorld(g, (best.i + 0.5) * g.A, (best.j + 0.5) * g.S);
    SHOPS.push({ name: s[0], boro: b, g, i: best.i, j: best.j, sd: best.sd, x: c[0], z: c[1], bu: g.A - g.wa - 2 * g.sw, bv: g.S - g.ws - 2 * g.sw, yaw: -g.th });
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
function shopAtBlock(b, i, j) { for (const s of SHOPS) if (s.boro === b && s.i === i && s.j === j) return s; return null; }
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
      const k = (j * CTEX + i) * 4; tex[k] = o[0]; tex[k + 1] = o[1]; tex[k + 2] = o[2]; tex[k + 3] = 255;
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
    for (const L of LM) if (L.x >= x0 && L.x < x0 + CH && L.z >= z0 && L.z < z0 + CH) buildLandmark(L, ctx);
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
  for (let i = Math.floor(umin / g.A) - 1; i <= Math.ceil(umax / g.A); i++) {
    for (let j = Math.floor(vmin / g.S) - 1; j <= Math.ceil(vmax / g.S); j++) {
      const uc = (i + 0.5) * g.A, vc = (j + 0.5) * g.S;
      const wc = gWorld(g, uc, vc);
      if (!inChunk(ctx, wc[0], wc[1])) continue;
      const R = rng(ihash(i, j, b * 7 + 1));
      const shop = shopAtBlock(b, i, j);
      const tsq = tsqBlock(b, i, j);
      // ---- buildings ----
      if (!shop && !tsq) placeLots(g, b, i, j, uc, vc, bu, bv, R, ctx);
      // ---- street props around the block perimeter ----
      blockProps(g, b, i, j, uc, vc, bu, bv, R, ctx, yaw);
    }
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
function buildLandmark(L, ctx) {
  const x = L.x, z = L.z;
  const R = rng(ihash(x | 0, z | 0, 5));
  const gy = GRIDS[boroAt(x, z) || 1] ? -GRIDS[boroAt(x, z) || 1].th : 0;
  switch (L.type) {
    case 'esb': {
      const yaw = -GRIDS[1].th, s = C.stone;
      vbox(x, 2.2, z, 9, 4.4, 5.4, yaw, s, 1);
      vbox(x, 4.4 + 5.5, z, 6.2, 11, 4.0, yaw, s, 1);
      vbox(x, 15.4 + 3.5, z, 4.4, 7, 3.0, yaw, s, 1);
      vbox(x, 22.4 + 1.5, z, 2.6, 3, 2.0, yaw, s, 1);
      vbox(x, 25.4 + 0.8, z, 1.6, 1.6, 1.4, yaw, s, 0);
      vbox(x, 27.0 + 1.2, z, 0.8, 2.4, 0.8, yaw, C.silver, 0);
      vbox(x, 29.4 + 1.6, z, 0.25, 3.2, 0.25, yaw, C.silver, 0);
      vbox(x, 26.2, z, 1.7, 0.3, 1.5, yaw, C.lamp, 5);
      addCol(ctx, x, z, yaw, 4.5, 2.7, 30);
      break;
    }
    case 'wtc': {
      const yaw = -GRIDS[1].th + Math.PI / 4, gl = hex('#8fb6d6');
      vbox(x, 1.8, z, 5.6, 3.6, 5.6, yaw, C.concrete, 1);
      const N = 7, H = 30;
      for (let k = 0; k < N; k++) {
        const t = k / N, w = 4.8 * (1 - t * 0.55), y0 = 3.6 + t * H, hh = H / N;
        vbox(x, y0 + hh / 2, z, w, hh + 0.02, w, yaw, gl, 1);
        vbox(x, y0 + hh / 2, z, w * 0.92, hh + 0.02, w * 0.92, yaw + Math.PI / 4 * (t), gl, 1);
      }
      vbox(x, 3.6 + H + 0.4, z, 2.4, 0.8, 2.4, yaw, C.silver, 0);
      vbox(x, 3.6 + H + 4.5, z, 0.22, 8, 0.22, yaw, C.white, 0);
      addCol(ctx, x, z, yaw, 2.8, 2.8, 30);
      break;
    }
    case 'chrysler': {
      const yaw = -GRIDS[1].th, s = hex('#cfc8ba');
      vbox(x, 3.5, z, 4.6, 7, 4.6, yaw, s, 1);
      vbox(x, 7 + 4.5, z, 3.4, 9, 3.4, yaw, s, 1);
      const cr = [2.6, 2.0, 1.5, 1.0, 0.6];
      for (let k = 0; k < cr.length; k++) vbox(x, 16 + k * 0.9 + 0.45, z, cr[k], 0.9, cr[k], yaw, C.silver, k % 2 ? 5 : 0);
      vbox(x, 20.5 + 1.6, z, 0.18, 3.2, 0.18, yaw, C.silver, 0);
      addCol(ctx, x, z, yaw, 2.3, 2.3, 20);
      break;
    }
    case 'liberty': {
      const yaw = 0.3;
      box(x, 0.4, z, 6, 0.8, 6, yaw, hex('#b9b2a2'));
      box(x, 0.4, z, 6, 0.8, 6, yaw + Math.PI / 4, hex('#b9b2a2'));
      box(x, 0.8 + 1.6, z, 2.6, 3.2, 2.6, yaw, hex('#c8b89a'), 0);
      box(x, 4.0 + 0.2, z, 3.0, 0.4, 3.0, yaw, hex('#c0b090'), 0);
      const g = C.liberty, gd = C.libdark;
      lbox(x, z, yaw, 0, 4.4 + 0.3, 0, 1.6, 0.6, 1.4, gd);
      lbox(x, z, yaw, 0, 4.4 + 1.9, 0, 1.25, 2.6, 1.1, g);
      lbox(x, z, yaw, 0, 7.5 + 0.35, 0, 1.0, 0.7, 0.9, g);
      lbox(x, z, yaw, 0, 8.25, 0, 0.55, 0.6, 0.55, g);
      for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45; lbox(x, z, yaw, Math.sin(a) * 0.35, 8.75, -Math.cos(a) * 0.1 + 0.05, 0.1, 0.45, 0.1, g); }
      lbox(x, z, yaw, -0.62, 9.0, 0, 0.3, 2.2, 0.3, g);          // raised arm
      lbox(x, z, yaw, -0.62, 10.25, 0, 0.42, 0.35, 0.42, C.gold, 2); // torch
      lbox(x, z, yaw, -0.62, 10.6, 0, 0.26, 0.4, 0.26, hex('#ffb347'), 2);
      lbox(x, z, yaw, 0.7, 6.4, 0.25, 0.25, 1.1, 0.7, g);        // tablet
      addCol(ctx, x, z, yaw, 1.6, 1.6, 10);
      break;
    }
    case 'tsq': {
      const g = GRIDS[1], yaw = -g.th, bu = g.A - g.wa - 2 * g.sw, bv = g.S - g.ws - 2 * g.sw;
      for (const q of L.blocks) {
        const uc = (q[0] + 0.5) * g.A, vc = (q[1] + 0.5) * g.S, w = gWorld(g, uc, vc);
        const h = 10 + R() * 3;
        box(w[0], h / 2, w[1], bu, h, bv, yaw, PAL.tower[Math.floor(R() * 10)], 1);
        addCol(ctx, w[0], w[1], yaw, bu / 2, bv / 2, h);
        const su = Math.sign(L.iu * g.A - uc), sv = Math.sign(L.iv * g.S - vc);
        // billboard on the u-facing face and v-facing face
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
      const yaw = gy, R0 = 7.2, wall = L.type === 'yankee' ? hex('#d9d6cf') : hex('#9a5a3e'), N = 20;
      box(x, 0.03, z, 12.5, 0.06, 12.5, yaw + Math.PI / 4, C.field, 0);
      box(x, 0.07, z, 4.2, 0.06, 4.2, yaw + Math.PI / 4, C.dirt, 0);
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2, px = x + Math.cos(a) * R0, pz = z + Math.sin(a) * R0;
        const h = 2.6 + (Math.sin(a * 1 + 1) > 0.3 ? 1.2 : 0);
        box(px, h / 2, pz, 2.4, h, 1.4, -a + Math.PI / 2, wall, 1);
        box(px, h + 0.12, pz, 2.5, 0.24, 1.6, -a + Math.PI / 2, C.blue, 0);
      }
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; box(x + Math.cos(a) * 8.2, 3.5, z + Math.sin(a) * 8.2, 0.25, 7, 0.25, 0, C.pole); box(x + Math.cos(a) * 8.2, 7.2, z + Math.sin(a) * 8.2, 1.2, 0.6, 0.3, -a, C.lamp, 5); }
      addCol(ctx, x, z, 0, 8.2, 8.2, 4);
      break;
    }
    case 'barclays': {
      const yaw = gy;
      box(x, 1.8, z, 9, 3.6, 7, yaw, C.rust, 0);
      box(x, 1.8, z, 7, 3.6, 9, yaw, C.rust, 0);
      box(x, 3.7, z, 8, 0.3, 8, yaw, C.dark, 0);
      box(x, 1.2, z, 9.1, 0.5, 7.1, yaw, C.black, 2);
      addCol(ctx, x, z, yaw, 4.6, 4.6, 4);
      break;
    }
    case 'wheel': {
      const yaw = 0.15, Rw = 3.6, cy = 4.4, N = 16;
      lbox(x, z, yaw, -0.5, 2.2, 0, 0.25, 4.4, 0.25, C.white);
      lbox(x, z, yaw, 0.5, 2.2, 0, 0.25, 4.4, 0.25, C.white);
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2, px = Math.cos(a) * Rw, py = cy + Math.sin(a) * Rw;
        lbox(x, z, yaw, 0, py, px, 0.2, 0.2, 1.5, C.white);
        lbox(x, z, yaw, 0.45, py - 0.4, px, 0.5, 0.5, 0.45, [C.red, C.yellow, C.blue, C.green][k % 4]);
        lbox(x, z, yaw, 0, cy + Math.sin(a) * Rw * 0.5, Math.cos(a) * Rw * 0.5, 0.08, 0.08, 0.08, C.white);
      }
      addCol(ctx, x, z, yaw, 0.8, 2.5, 6);
      break;
    }
    case 'parachute': {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + sx * 0.9, 4.5, z + sz * 0.9, 0.18, 9, 0.18, 0, C.red);
      box(x, 9.2, z, 4.2, 0.3, 4.2, 0.3, C.red); box(x, 9.2, z, 4.2, 0.3, 4.2, 1.08, C.red);
      box(x, 10.2, z, 0.25, 2, 0.25, 0, C.red);
      addCol(ctx, x, z, 0, 1.1, 1.1, 9);
      break;
    }
    case 'unisphere': {
      box(x, 0.5, z, 1.2, 1.0, 1.2, 0, C.steel);
      box(x, 0.05, z, 9, 0.1, 9, 0.4, hex('#7ec3e8'));
      const Rs = 2.8, cy = 4;
      for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 18; k++) {
        const a = k / 18 * Math.PI * 2, ry = ring * Math.PI / 3;
        const px = Math.cos(a) * Rs, py = Math.sin(a) * Rs;
        box(x + px * Math.cos(ry), cy + py, z + px * Math.sin(ry), 0.3, 0.3, 0.3, ry, C.steel, 0);
      }
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; box(x + Math.cos(a) * Rs, cy, z + Math.sin(a) * Rs, 0.3, 0.3, 0.3, 0, C.steel); }
      addCol(ctx, x, z, 0, 1, 1, 5);
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
  const g = S.g, yaw = S.yaw, bu = S.bu, bv = S.bv, sd = S.sd;
  // local frame: lx along e (u), lz along -d => v = -lz. Door faces +sd*d => lz = -sd*...
  const H = 3.4, bayW = 3.2, wall = 0.25, blk = hex('#17181c'), green = hex('#1fd65f'), gold = hex('#e8b923');
  const L = (lx, y, v, sx, sy, sv, col, mat) => { const p = rot(S.x, S.z, yaw, lx, -v); box(p[0], y, p[1], sx, sy, sv, yaw, col, mat); };
  const sideW = (bu - bayW) / 2 - wall;
  // side blocks
  for (const s of [-1, 1]) {
    const cxl = s * (bayW / 2 + wall + sideW / 2);
    if (sideW > 0.3) { L(cxl, H / 2, 0, sideW, H, bv, blk, 1); const p = rot(S.x, S.z, yaw, cxl, 0); addCol(ctx, p[0], p[1], yaw, sideW / 2, bv / 2, H); }
    L(s * (bayW / 2 + wall / 2), H / 2, 0, wall, H, bv, blk, 0);
    const p2 = rot(S.x, S.z, yaw, s * (bayW / 2 + wall / 2), 0); addCol(ctx, p2[0], p2[1], yaw, wall / 2, bv / 2, H);
  }
  // back wall
  L(0, H / 2, -sd * (bv / 2 - 0.15), bayW, H, 0.3, blk, 0);
  { const p = rot(S.x, S.z, yaw, 0, sd * (bv / 2 - 0.15)); addCol(ctx, p[0], p[1], yaw, bayW / 2, 0.15, H); }
  // roof over bay + stripes (green roof + gold trim so it pops from above)
  L(0, H - 0.3, 0, bayW + 0.1, 0.6, bv, blk, 0);
  L(0, H + 0.02, 0, bu - 0.3, 0.06, bv - 0.3, green, 0);
  L(0, H + 0.06, 0, bu * 0.55, 0.06, bv * 0.5, gold, 0);
  L(0, H + 0.1, 0, bu * 0.4, 0.06, bv * 0.32, blk, 0);
  L(0, H + 0.08, sd * (bv / 2 - 0.05), bu, 0.16, 0.12, green, 2);
  L(0, H - 0.75, sd * (bv / 2 + 0.02), bayW + 0.6, 0.12, 0.08, gold, 2);
  L(0, 0.02, 0, bayW - 0.2, 0.04, bv - 0.6, hex('#2a2b30'), 0);
  // sign billboard on the roof facing the street
  const sp = rot(S.x, S.z, yaw, 0, -sd * (bv / 2 - 0.6));
  L(0, H + 0.6, sd * (bv / 2 - 0.6), 0.3, 1.2, 0.3, C.pole, 0);
  ctx.bills.push(sp[0], H + 1.9, sp[1], Math.min(bu, 7), 1.9, g.dx * sd, g.dz * sd, 6);
}
