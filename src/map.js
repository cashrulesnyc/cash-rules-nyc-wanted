// ============================================================
//  Map: projection, rasterised boroughs/zones, grids, roads
// ============================================================
const MPU = 18, LAT0 = 40.71, LON0 = -73.98;
const KX = 84390 / MPU, KZ = 111132 / MPU;
function P(lat, lon) { return [(lon - LON0) * KX, -(lat - LAT0) * KZ]; }
function PL(p) { return P(p[0], p[1]); }

const WX0 = -1500, WZ0 = -1392, WX1 = 1364, WZ1 = 1360, MAP_RES = 2;
const MW = (WX1 - WX0) / MAP_RES | 0, MH = (WZ1 - WZ0) / MAP_RES | 0;
const BORO = new Uint8Array(MW * MH);
const ZONE = new Uint8Array(MW * MH);

// tile codes
const T_WATER = 0, T_ROAD = 1, T_WALK = 2, T_LOT = 3, T_PARK = 4, T_SAND = 5, T_TARMAC = 6,
  T_HWY = 7, T_BRIDGE = 8, T_CEM = 9, T_PLAZA = 10, T_RUNWAY = 11;

function fillPoly(arr, pts, val, landOnly) {
  const n = pts.length; if (n < 3) return;
  const px = new Float64Array(n), py = new Float64Array(n);
  let minY = 1e9, maxY = -1e9;
  for (let i = 0; i < n; i++) {
    px[i] = (pts[i][0] - WX0) / MAP_RES; py[i] = (pts[i][1] - WZ0) / MAP_RES;
    if (py[i] < minY) minY = py[i]; if (py[i] > maxY) maxY = py[i];
  }
  const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(MH - 1, Math.floor(maxY - 0.5));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5; xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ay = py[j], by = py[i];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(px[j] + (yc - ay) * (px[i] - px[j]) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(MW - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      const row = y * MW;
      for (let x = xa; x <= xb; x++) { if (!landOnly || BORO[row + x]) arr[row + x] = val; }
    }
  }
}
const toW = a => a.map(PL);

// ---------- street grids ----------
function mkGrid(boro, thDeg, A, S, wa, ws, oLat, oLon, style) {
  const th = thDeg * Math.PI / 180, o = P(oLat, oLon);
  return { boro, A, S, wa, ws, sw: 0.7, ox: o[0], oz: o[1], dx: Math.sin(th), dz: -Math.cos(th), ex: Math.cos(th), ez: Math.sin(th), th, style };
}
const GRIDS = [];
GRIDS[1] = mkGrid(1, 29, 15.5, 9, 3.6, 2.8, 40.7681, -73.9819, 'city');
GRIDS[2] = mkGrid(2, 6, 12, 10, 3.4, 2.8, 40.8280, -73.9190, 'boro');
GRIDS[3] = mkGrid(3, -10, 11, 9, 3.4, 2.7, 40.6840, -73.9780, 'brown');
GRIDS[4] = mkGrid(4, 22, 12, 10, 3.4, 2.7, 40.7450, -73.9330, 'boro');
GRIDS[5] = mkGrid(5, 12, 14, 12, 3.0, 2.6, 40.6400, -74.0800, 'sub');
GRIDS[6] = mkGrid(6, 16, 13, 10, 3.4, 2.8, 40.7250, -74.0450, 'boro');
function gLocal(g, x, z) { const rx = x - g.ox, rz = z - g.oz; return [rx * g.ex + rz * g.ez, rx * g.dx + rz * g.dz]; }
function gWorld(g, u, v) { return [g.ox + u * g.ex + v * g.dx, g.oz + u * g.ez + v * g.dz]; }
function gRect(g, u0, v0, u1, v1) { return [gWorld(g, u0, v0), gWorld(g, u1, v0), gWorld(g, u1, v1), gWorld(g, u0, v1)]; }
function blockOf(g, lat, lon) { const p = P(lat, lon), l = gLocal(g, p[0], p[1]); return [Math.floor(l[0] / g.A), Math.floor(l[1] / g.S)]; }
function blockRect(g, i, j, ni, nj, inset) {
  const a = g.wa / 2 + g.sw + (inset || 0), b = g.ws / 2 + g.sw + (inset || 0);
  return gRect(g, i * g.A + a, j * g.S + b, (i + ni) * g.A - a, (j + nj) * g.S - b);
}

// ---------- segments (highways, bridges, runways) ----------
const SEG_HWY = 1, SEG_AVE = 2, SEG_RUN = 3, SEG_BRIDGE = 4;
const SEGS = [], BRIDGES = [];
const BK = 24, BKW = Math.ceil((WX1 - WX0) / BK), BKH = Math.ceil((WZ1 - WZ0) / BK);
const BUCKETS = new Array(BKW * BKH);
function addSeg(a, b, w, type, br) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  const s = { ax: a[0], az: a[1], bx: b[0], bz: b[1], dx: dx / len, dz: dz / len, len, hw: w / 2, type, br, t0: 0 };
  SEGS.push(s);
  const r = s.hw + 1;
  const x0 = Math.floor((Math.min(a[0], b[0]) - r - WX0) / BK), x1 = Math.floor((Math.max(a[0], b[0]) + r - WX0) / BK);
  const z0 = Math.floor((Math.min(a[1], b[1]) - r - WZ0) / BK), z1 = Math.floor((Math.max(a[1], b[1]) + r - WZ0) / BK);
  for (let z = Math.max(0, z0); z <= Math.min(BKH - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(BKW - 1, x1); x++) {
    // conservative: distance from bucket center to segment
    const cx = WX0 + (x + 0.5) * BK, cz = WZ0 + (z + 0.5) * BK;
    let t = (cx - s.ax) * s.dx + (cz - s.az) * s.dz; t = Math.max(0, Math.min(len, t));
    const ddx = cx - (s.ax + s.dx * t), ddz = cz - (s.az + s.dz * t);
    if (Math.hypot(ddx, ddz) > r + BK * 0.75) continue;
    const k = z * BKW + x; (BUCKETS[k] || (BUCKETS[k] = [])).push(s);
  }
  return s;
}
const SH = { seg: null, t: 0, lat: 0 };
function segHit(x, z) {
  const bx = Math.floor((x - WX0) / BK), bz = Math.floor((z - WZ0) / BK);
  if (bx < 0 || bz < 0 || bx >= BKW || bz >= BKH) return null;
  const L = BUCKETS[bz * BKW + bx]; if (!L) return null;
  let best = null, bp = 0;
  for (let i = 0; i < L.length; i++) {
    const s = L[i];
    const rx = x - s.ax, rz = z - s.az;
    const t = rx * s.dx + rz * s.dz;
    if (t < -s.hw * 0.3 || t > s.len + s.hw * 0.3) continue;
    const lat = rx * s.dz - rz * s.dx; // signed lateral (right positive)
    if (Math.abs(lat) > s.hw) continue;
    const pr = s.type === SEG_BRIDGE ? 3 : (s.type === SEG_HWY ? 2 : 1);
    if (pr > bp) { bp = pr; best = s; SH.t = t; SH.lat = lat; }
  }
  SH.seg = best; return best;
}

function buildRoads() {
  for (const r of GEO.ROADS) {
    const pts = toW(r[2]);
    for (let i = 0; i + 1 < pts.length; i++) addSeg(pts[i], pts[i + 1], r[1], r[0] === 1 ? SEG_HWY : r[0] === 2 ? SEG_AVE : SEG_RUN);
  }
  for (const b of GEO.BRIDGES) {
    const a = PL(b[5]), c = PL(b[6]);
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const br = { name: b[0], style: b[1], w: b[2], H: b[3], color: b[4], a, b: c, len, ramp: Math.min(16, len * 0.28) };
    br.dx = (c[0] - a[0]) / len; br.dz = (c[1] - a[1]) / len;
    // find water span along the bridge (for towers)
    let w0 = -1, w1 = -1;
    for (let t = 0; t <= len; t += 1) { const x = a[0] + br.dx * t, z = a[1] + br.dz * t; if (boroAt(x, z) === 0) { if (w0 < 0) w0 = t; w1 = t; } }
    br.w0 = w0 < 0 ? len * 0.3 : w0; br.w1 = w1 < 0 ? len * 0.7 : w1;
    br.seg = addSeg(a, c, br.w, SEG_BRIDGE, br);
    BRIDGES.push(br);
  }
}
function bridgeH(br, t) {
  const r = br.ramp; let k = 1;
  if (t < r) k = Math.max(0, t / r); else if (t > br.len - r) k = Math.max(0, (br.len - t) / r);
  k = k * k * (3 - 2 * k);
  return br.H * k;
}

// ---------- rasterise ----------
function mapIdx(x, z) {
  const ix = Math.floor((x - WX0) / MAP_RES), iz = Math.floor((z - WZ0) / MAP_RES);
  if (ix < 0 || iz < 0 || ix >= MW || iz >= MH) return -1;
  return iz * MW + ix;
}
function boroAt(x, z) { const m = mapIdx(x, z); return m < 0 ? 0 : BORO[m]; }
function zoneAt(x, z) { const m = mapIdx(x, z); return m < 0 ? 0 : ZONE[m]; }

const SPECIAL_ZONES = [];
function buildMap() {
  const brd = GEO.BKQ_BORDER.slice().reverse().slice(1, -1);
  fillPoly(BORO, toW(GEO.NJ), 6);
  fillPoly(BORO, toW(GEO.SI), 5);
  fillPoly(BORO, toW(GEO.BKN_SHORE.concat(brd)), 3);
  fillPoly(BORO, toW(GEO.QNS_SHORE.concat(brd)), 4);
  fillPoly(BORO, toW(GEO.ROCKAWAY), 4);
  fillPoly(BORO, toW(GEO.MAN), 1);
  for (const k of ['ROOSEVELT', 'RANDALLS', 'GOVERNORS', 'LIBERTY', 'ELLIS']) fillPoly(BORO, toW(GEO[k]), 1);
  fillPoly(BORO, toW(GEO.BRX), 2);
  for (const z of GEO.ZONES) fillPoly(ZONE, toW(z[1]), z[0], true);
  // grid-aligned Manhattan parks
  const g = GRIDS[1], ins = g.wa / 2 + g.sw;
  fillPoly(ZONE, gRect(g, ins, g.ws / 2 + g.sw, 3 * g.A - ins, 25 * g.S - g.ws / 2 - g.sw), 1, true); // Central Park
  const sq = [[40.7308, -73.9973], [40.7359, -73.9911], [40.7420, -73.9880], [40.7536, -73.9832], [40.7265, -73.9815], [40.8040, -73.9440]];
  for (const s of sq) { const b = blockOf(g, s[0], s[1]); fillPoly(ZONE, blockRect(g, b[0], b[1], 1, 1, -0.01), 1, true); }
  buildRoads();
}

// ---------- tile classification ----------
let LASTU = 0, LASTV = 0, LASTG = null;
function tileAt(x, z) {
  const m = mapIdx(x, z);
  if (m < 0) return T_WATER;
  const b = BORO[m];
  const s = segHit(x, z);
  if (s) {
    if (s.type === SEG_BRIDGE) return T_BRIDGE;
    if (s.type === SEG_RUN) return T_RUNWAY;
    return T_HWY;
  }
  if (b === 0) return T_WATER;
  const zn = ZONE[m];
  if (zn) return zn === 1 ? T_PARK : zn === 2 ? T_SAND : zn === 3 ? T_TARMAC : zn === 4 ? T_CEM : T_PLAZA;
  const g = GRIDS[b]; LASTG = g;
  const rx = x - g.ox, rz = z - g.oz;
  const u = rx * g.ex + rz * g.ez, v = rx * g.dx + rz * g.dz; LASTU = u; LASTV = v;
  const du = Math.abs(u - g.A * Math.round(u / g.A)), dv = Math.abs(v - g.S * Math.round(v / g.S));
  if (du < g.wa / 2 || dv < g.ws / 2) return T_ROAD;
  if (du < g.wa / 2 + g.sw || dv < g.ws / 2 + g.sw) return T_WALK;
  return T_LOT;
}
function drivable(x, z) { return tileAt(x, z) !== T_WATER; }
function isRoadish(t) { return t === T_ROAD || t === T_HWY || t === T_BRIDGE || t === T_RUNWAY; }

// ---------- texel colours for chunk textures ----------
function hash2(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const COL = { water: [70, 170, 226], foam: [196, 236, 252], road: [72, 74, 82], walk: [198, 194, 186], curb: [150, 148, 142], lot: [158, 154, 146],
  grass: [112, 190, 84], grass2: [100, 176, 74], sand: [240, 216, 150], wet: [214, 192, 132], tarmac: [152, 154, 160], run: [62, 64, 70], hwy: [60, 62, 68],
  cem: [120, 172, 92], plaza: [212, 206, 194], yellow: [236, 196, 64], white: [232, 232, 232], yard: [128, 182, 92] };
function texel(x, z, out) {
  let t = tileAt(x, z), c;
  switch (t) {
    case T_WATER: {
      const near = boroAt(x + 1.1, z) || boroAt(x - 1.1, z) || boroAt(x, z + 1.1) || boroAt(x, z - 1.1);
      c = near ? COL.foam : COL.water;
      if (!near) { const w = hash2(Math.floor(x / 3), Math.floor(z / 3)); if (w > 0.965) c = [84, 178, 230]; }
      break;
    }
    case T_BRIDGE: {
      if (boroAt(x, z) === 0) { c = COL.water; break; }
      const a = Math.abs(SH.lat), hw = SH.seg.hw;
      c = a > hw - 0.3 ? COL.curb : (a < 0.1 ? COL.yellow : COL.hwy); break;
    }
    case T_ROAD: {
      const g = LASTG, u = LASTU, v = LASTV;
      const ru = u - g.A * Math.round(u / g.A), rv = v - g.S * Math.round(v / g.S);
      const du = Math.abs(ru), dv = Math.abs(rv);
      const onAve = du < g.wa / 2, onSt = dv < g.ws / 2;
      c = COL.road;
      if (onAve && onSt) { c = COL.road; }
      else if (onAve) {
        if (dv < g.ws / 2 + 0.75 && ((u * 2.6) % 1 + 1) % 1 < 0.5 && du < g.wa / 2 - 0.15) c = COL.white;
        else if (g.style === 'city' ? (du > 0.06 && du < 0.17) : du < 0.07) c = COL.yellow;
        else if (Math.abs(du - g.wa / 4) < 0.05 && (((v / 1.4) % 1 + 1) % 1) < 0.5) c = [180, 180, 184];
      } else if (onSt) {
        if (du < g.wa / 2 + 0.75 && ((v * 2.6) % 1 + 1) % 1 < 0.5 && dv < g.ws / 2 - 0.15) c = COL.white;
        else if (dv < 0.06 && (((u / 1.6) % 1 + 1) % 1) < 0.5) c = COL.white;
      }
      break;
    }
    case T_WALK: {
      const g = LASTG, u = LASTU, v = LASTV;
      const du = Math.abs(u - g.A * Math.round(u / g.A)), dv = Math.abs(v - g.S * Math.round(v / g.S));
      c = COL.walk;
      if ((du >= g.wa / 2 && du < g.wa / 2 + 0.12) || (dv >= g.ws / 2 && dv < g.ws / 2 + 0.12)) c = COL.curb;
      else if (((u / 1.2) % 1 + 1) % 1 < 0.07 || ((v / 1.2) % 1 + 1) % 1 < 0.07) c = [184, 180, 172];
      break;
    }
    case T_LOT: { const b = boroAt(x, z); c = b === 5 ? COL.yard : (b === 4 && x > 330) ? COL.yard : COL.lot; break; }
    case T_PARK: { const h = hash2(Math.floor(x / 2.5), Math.floor(z / 2.5)); c = h > 0.6 ? COL.grass2 : COL.grass; break; }
    case T_SAND: { const near = !boroAt(x + 2, z) || !boroAt(x - 2, z) || !boroAt(x, z + 2) || !boroAt(x, z - 2); c = near ? COL.wet : COL.sand; break; }
    case T_TARMAC: c = COL.tarmac; break;
    case T_CEM: c = COL.cem; break;
    case T_PLAZA: c = COL.plaza; break;
    case T_RUNWAY: case T_HWY: {
      const s = SH.seg, lat = SH.lat, al = SH.t, hw = s.hw;
      c = t === T_RUNWAY ? COL.run : COL.hwy;
      const a = Math.abs(lat);
      if (t === T_RUNWAY) {
        if (a > hw - 0.35 && a < hw - 0.15) c = COL.white;
        else if (a < 0.12 && ((al / 3) % 1) < 0.5) c = COL.white;
      } else if (s.type === SEG_AVE) {
        c = COL.road; if (a < 0.08) c = COL.yellow;
      } else {
        if (a > hw - 0.32 && a < hw - 0.18) c = COL.white;
        else if (a < 0.16 && a > 0.05) c = COL.yellow;
        else if (Math.abs(a - hw * 0.5) < 0.06 && ((al / 2) % 1) < 0.5) c = COL.white;
      }
      if (boroAt(x, z) === 0 && a > hw - 0.12) c = [120, 122, 126];
      break;
    }
    default: c = COL.lot;
  }
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return t;
}

// ---------- minimap colours ----------
function mapColor(b, zn) {
  if (!b) return [44, 120, 190];
  if (zn === 1) return [92, 168, 72];
  if (zn === 2) return [226, 204, 140];
  if (zn === 3) return [150, 152, 158];
  if (zn === 4) return [104, 150, 84];
  if (zn === 5) return [190, 186, 176];
  return [[0], [196, 190, 182], [186, 176, 166], [190, 178, 166], [184, 182, 168], [178, 190, 166], [170, 170, 170]][b];
}
