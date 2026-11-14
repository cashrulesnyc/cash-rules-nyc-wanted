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
const NEARL = new Uint8Array(MW * MH); // 1 where land is within ~4 cells (shore band); built in buildMap
const LANDB = new Uint8Array(MW * MH); // land mask blurred with a 5-tap binomial kernel (0..255); smooth coastlines

// tile codes
const T_WATER = 0, T_ROAD = 1, T_WALK = 2, T_LOT = 3, T_PARK = 4, T_SAND = 5, T_TARMAC = 6,
  T_HWY = 7, T_BRIDGE = 8, T_CEM = 9, T_PLAZA = 10, T_RUNWAY = 11, T_MARSH = 12, T_PARKING = 13;

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
// Roads were widened for arcade driving: every avenue +ROAD_WA, every street +ROAD_WS (taken out of the
// blocks), sidewalks GRID_SW wide. GRID_SW is also baked into the ground shader (gl.js).
const GRID_SW = 0.6, ROAD_WA = 1.2, ROAD_WS = 0.8, HWY_K = 1.25, BRIDGE_K = 1.2;
function mkGrid(boro, thDeg, A, S, wa, ws, oLat, oLon, style) {
  const th = thDeg * Math.PI / 180, o = P(oLat, oLon);
  wa += ROAD_WA; ws += ROAD_WS;
  return { boro, A, S, wa, ws, sw: GRID_SW, ox: o[0], oz: o[1], dx: Math.sin(th), dz: -Math.cos(th), ex: Math.cos(th), ez: Math.sin(th), th, style };
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
    for (let i = 0; i + 1 < pts.length; i++) { const sg = addSeg(pts[i], pts[i + 1], r[1] * HWY_K, r[0] === 1 ? SEG_HWY : r[0] === 2 ? SEG_AVE : SEG_RUN); if (r[3]) sg.name = r[3]; }
  }
  for (const b of GEO.BRIDGES) {
    const a = PL(b[5]), c = PL(b[6]);
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const br = { name: b[0], style: b[1], w: b[2] * BRIDGE_K, H: b[3], color: b[4], a, b: c, len, ramp: Math.min(16, len * 0.28) };
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
// Smooth coastline: the raster is 2 units/px, so nearest-cell lookups give stair-stepped
// shores. We bilinearly interpolate a land mask between cell centres and threshold it at 0.5,
// which turns the steps into smooth diagonals. Physics (tileAt) and the ground texture both
// go through landIdx(), so where it looks like water is exactly where the car sinks.
function landVal(x, z) {
  const fx = (x - WX0) / MAP_RES - 0.5, fz = (z - WZ0) / MAP_RES - 0.5;
  const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  if (ix < 0 || iz < 0 || ix >= MW - 1 || iz >= MH - 1) { const m = mapIdx(x, z); return m >= 0 && BORO[m] ? 1 : 0; }
  const m = iz * MW + ix;
  return ((LANDB[m] * (1 - tx) + LANDB[m + 1] * tx) * (1 - tz) + (LANDB[m + MW] * (1 - tx) + LANDB[m + MW + 1] * tx) * tz) * (1 / 255);
}
function landIdx(x, z) {
  const mn = mapIdx(x, z);
  if (mn < 0) return -1;
  const fx = (x - WX0) / MAP_RES - 0.5, fz = (z - WZ0) / MAP_RES - 0.5;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= MW - 1 || iz >= MH - 1) return BORO[mn] ? mn : -1;
  const m = iz * MW + ix;
  const a = LANDB[m], b = LANDB[m + 1], c = LANDB[m + MW], d = LANDB[m + MW + 1];
  if (a === 255 && b === 255 && c === 255 && d === 255) return BORO[mn] ? mn : nearLand(mn);
  if (a === 0 && b === 0 && c === 0 && d === 0) return -1;
  const tx = fx - ix, tz = fz - iz;
  if ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz < 127.5) return -1;
  return BORO[mn] ? mn : nearLand(mn);
}
function nearLand(mn) { // smoothed land over a raw water cell: borrow the closest raw land cell's borough/zone
  const iy = (mn / MW) | 0, ix = mn - iy * MW;
  for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const y = iy + dy, x = ix + dx; if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const k = y * MW + x; if (BORO[k]) return k;
  }
  return -1;
}
function boroAt(x, z) { const m = landIdx(x, z); return m < 0 ? 0 : BORO[m]; }
function zoneAt(x, z) { const m = landIdx(x, z); return m < 0 ? 0 : ZONE[m]; }

const SPECIAL_ZONES = [];
// ---- Bloomfield logistics park (Staten Island west shore, Gulf Ave): site frame aligned to the West Shore Expwy ----
// s = units south along the expressway from its north end, t = units west of its centre line (toward the Arthur Kill).
// site frames: o = origin, d = unit "down the road" direction (a -> b), e = unit "west" (90deg right of d), yaw for boxes
function mkFrame(a, b, o) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; return { a: o || a, d, e: [-d[1], d[0]], yaw: Math.atan2(d[0], d[1]) }; }
function fW(F, s, t) { return [F.a[0] + F.d[0] * s + F.e[0] * t, F.a[1] + F.d[1] * s + F.e[1] * t]; }
function fRect(F, s0, t0, s1, t1) { return [fW(F, s0, t0), fW(F, s1, t0), fW(F, s1, t1), fW(F, s0, t1)]; }
function fLocal(F, x, z) { const rx = x - F.a[0], rz = z - F.a[1]; return [rx * F.d[0] + rz * F.d[1], rx * F.e[0] + rz * F.e[1]]; }
const BF = mkFrame(P(40.6300, -74.1850), P(40.6000, -74.1900));                     // Bloomfield: along the West Shore Expwy
// Richmond Ave runs N-S at about -74.169 past the mall (OSM). The mall sits on the EAST side, the big-box plazas across on the WEST side.
const SM = mkFrame(P(40.5748, -74.1700), P(40.5872, -74.1684), P(40.5815, -74.16914)); // Staten Island Mall: s = north along Richmond Ave, t = east (into the mall)
const PZ = mkFrame(P(40.5872, -74.1684), P(40.5748, -74.1700), P(40.5953, -74.16735)); // Richmond Ave plazas: s = south along the avenue, t = west (into the plazas)
function bfW(s, t) { return fW(BF, s, t); }
function bfRect(s0, t0, s1, t1) { return fRect(BF, s0, t0, s1, t1); }
// striped lots: frame, extent, stall phase (bands of [2.6 stalls][2.6 stalls][3.4 aisle] starting at tb)
const LOTS = [{ F: BF, s0: 4, s1: 118, t0: 3.2, t1: 15, tb: 3.2 }, { F: SM, s0: -42, s1: 42, t0: 2.4, t1: 72, tb: 10.0 }];
function lotAt(x, z) { for (const L of LOTS) { const q = fLocal(L.F, x, z); if (q[0] > L.s0 - 3 && q[0] < L.s1 + 3 && q[1] > L.t0 - 3 && q[1] < L.t1 + 3) return L; } return LOTS[0]; }
// mall Ring Road (a loop inside the lot) as avenue segments, overlapping at the corners
const MALL_RING = { s0: -38, s1: 38, t0: 8, t1: 66, w: 2.8 };
// zone codes: 6 marsh (drivable, splashy), 7 striped parking lot
// Snug Harbor (row of Greek Revival buildings facing Richmond Terrace): grounds are park
const CAMPUS_BB = [];   // [x0, z0, x1, z1] of each GEO.CAMPUS polygon (filled by buildMap)
const SNUG = P(40.6437, -74.1027);
const SNUG_RECT = [[SNUG[0] - 24, SNUG[1] - 7.5], [SNUG[0] + 32, SNUG[1] - 7.5], [SNUG[0] + 32, SNUG[1] + 22], [SNUG[0] - 24, SNUG[1] + 22]];
// Howland Hook container terminal: quay along the shore (s along the quay, t inland)
const HH = (() => { const F = mkFrame(P(40.6430, -74.1850), P(40.6362, -74.1957)); return F; })();
// St. George waterfront: ferry terminal (slips point NE at the ferry berth), Empire Outlets + ballpark along the north shore
const SG = mkFrame(P(40.6437, -74.0728), P(40.6452, -74.0708));        // s = seaward toward the berth, t = 90deg right of that
const SGW = mkFrame(P(40.6447, -74.0742), P(40.6466, -74.0800));       // along the shore heading WNW (outlets, ballpark); t = inland
const BF_ZONES = [[6, bfRect(-26, 3.2, 150, 90)], [3, bfRect(4, 15, 118, 50)], [7, bfRect(4, 3.2, 118, 15)], [7, fRect(SM, -42, 2.4, 42, 72)], [7, fRect(PZ, 48, 2.4, 132, 62)], [1, SNUG_RECT], [3, fRect(HH, -4, 2, 64, -31)], [5, fRect(SG, -14, -12, 2, 12)], [5, fRect(SGW, -2, 1, 36, -15)]];  // SGW: inland is -t  // land is on the -e side of this quay
// smooth value noise (marsh pools / reed beds)
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
function marshWet(x, z) { return vnoise(x / 7, z / 7) * 0.65 + vnoise(x / 2.6 + 17, z / 2.6 - 5) * 0.35; } // > 0.58: open water pool
// ---- gas stations: snap each real location to the road it fronts, cut a concrete apron (zone 3) into the block ----
// GAS_SITES: {x, z, yaw, big, accent}; yaw puts local +z along the road and local -x toward it (see gasStation in chunkgen.js)
const GAS_SITES = [];
const GAS_ACCENTS = ['#2f6f9f', '#b5452f', '#2e8b57', '#d4a017', '#5b3f8f', '#1f4e79', '#c0392b', '#127369'];
function placeGas() {
  GAS_SITES.length = 0;
  for (const q of GEO.GAS) {
    const p = P(q[0], q[1]), b = boroAt(p[0], p[1]); if (!b) continue;
    if (zoneAt(p[0], p[1]) === 7) continue;                 // inside a site lot that builds its own pumps
    const big = !!q[2], depth = 3.7, far = big ? 5.6 : 4.9, half = (big ? 4.5 : 3.5) + 0.9;
    let x, z, yaw, back;                                      // back = distance from origin to the road edge
    // 1) a mapped avenue/highway close by: face it
    let best = null, bd = 9;
    for (const sg of SEGS) { if (sg.type !== SEG_AVE && sg.type !== SEG_HWY) continue;
      let t = (p[0] - sg.ax) * sg.dx + (p[1] - sg.az) * sg.dz; if (t < 2 || t > sg.len - 2) continue;
      const fx = sg.ax + sg.dx * t, fz = sg.az + sg.dz * t, d = Math.hypot(p[0] - fx, p[1] - fz) - sg.hw;
      if (d < bd) { bd = d; best = { sg, fx, fz }; } }
    if (best) {
      const sg = best.sg; let nx = sg.dz, nz = -sg.dx; yaw = Math.atan2(sg.dx, sg.dz);
      if ((p[0] - best.fx) * nx + (p[1] - best.fz) * nz < 0) { nx = -nx; nz = -nz; yaw += Math.PI; }
      const off = sg.hw + 0.3 + depth; x = best.fx + nx * off; z = best.fz + nz * off; back = depth + 0.3;
    } else {
      // 2) the borough grid: the nearer of the avenue / street lines, centred on the block face
      const g = GRIDS[b]; if (!g) continue;
      const l = gLocal(g, p[0], p[1]), ua = g.A * Math.round(l[0] / g.A), vs = g.S * Math.round(l[1] / g.S);
      const du = Math.abs(l[0] - ua) - g.wa / 2, dv = Math.abs(l[1] - vs) - g.ws / 2;
      let u, v, dir;
      if (du <= dv + 2) { const sgn = l[0] >= ua ? 1 : -1; u = ua + sgn * (g.wa / 2 + g.sw + depth); v = g.S * Math.floor(l[1] / g.S) + g.S / 2; dir = [g.dx, g.dz]; back = g.sw + depth;
        yaw = Math.atan2(dir[0], dir[1]); if (sgn < 0) yaw += Math.PI; }
      else { const sgn = l[1] >= vs ? 1 : -1; v = vs + sgn * (g.ws / 2 + g.sw + depth); u = g.A * Math.floor(l[0] / g.A) + g.A / 2; dir = [g.ex, g.ez]; back = g.sw + depth;
        yaw = Math.atan2(dir[0], dir[1]); if (sgn > 0) yaw += Math.PI; }
      const w = gWorld(g, u, v); x = w[0]; z = w[1];
    }
    if (GAS_SITES.some(o => Math.hypot(o.x - x, o.z - z) < 8)) continue;
    if (boroAt(x, z) !== b) continue;                         // snapped into the water
    const c = Math.cos(yaw), sn = Math.sin(yaw), L = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
    GAS_SITES.push({ x, z, yaw, big, accent: GAS_ACCENTS[(Math.abs(Math.round(x * 7 + z * 13))) % GAS_ACCENTS.length],
      apron: [L(-back - 0.05, -half), L(far, -half), L(far, half), L(-back - 0.05, half)] });
  }
}
// civic sites: CIVIC_SITES {type, x, z, yaw, name, sub}; pads (zone 5) clear the procedural block underneath
const CIVIC_SITES = [];
function placeCivic() {
  CIVIC_SITES.length = 0;
  for (const c of GEO.CIVIC) {
    const p = P(c[1], c[2]), b = boroAt(p[0], p[1]) || 5, g = GRIDS[b];
    let x = p[0], z = p[1], yaw = g ? -g.th : 0;
    if (c[5]) { let best = null, bd = 12;                                     // face a named avenue
      for (const sg of SEGS) { if (sg.type !== SEG_AVE || !sg.name) continue; const t = (x - sg.ax) * sg.dx + (z - sg.az) * sg.dz; if (t < 0 || t > sg.len) continue;
        const fx = sg.ax + sg.dx * t, fz = sg.az + sg.dz * t, d = Math.hypot(x - fx, z - fz); if (d < bd) { bd = d; best = { sg, fx, fz }; } }
      if (best) { const sg = best.sg; let nx = sg.dz, nz = -sg.dx; yaw = Math.atan2(sg.dx, sg.dz) + Math.PI / 2; if ((x - best.fx) * nx + (z - best.fz) * nz < 0) { nx = -nx; nz = -nz; yaw += Math.PI; } x = best.fx + nx * (sg.hw + 5); z = best.fz + nz * (sg.hw + 5); } }
    const big = c[0] === 'hospital_big' ? 1.35 : 1, R = c[0].startsWith('hospital') ? 13 * big : c[0] === 'energy' ? 9 : c[0] === 'boroughhall' ? 7 : 6.5;
    const cs = Math.cos(yaw), sn = Math.sin(yaw), L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    CIVIC_SITES.push({ type: c[0], x, z, yaw, name: c[3], sub: c[4], R, pad: [L(-R, -R), L(R, -R), L(R, R), L(-R, R)] });
  }
}
function buildMap() {
  const brd = GEO.BKQ_BORDER.slice().reverse().slice(1, -1);
  fillPoly(BORO, toW(GEO.NJ), 6);
  fillPoly(BORO, toW(GEO.SI), 5);
  fillPoly(BORO, toW(GEO.SILVER_LAKE), 0); // inland lake
  fillPoly(BORO, toW(GEO.BKN_SHORE.concat(brd)), 3);
  fillPoly(BORO, toW(GEO.QNS_SHORE.concat(brd)), 4);
  fillPoly(BORO, toW(GEO.ROCKAWAY), 4);
  fillPoly(BORO, toW(GEO.MAN), 1);
  for (const k of ['ROOSEVELT', 'RANDALLS', 'GOVERNORS', 'LIBERTY', 'ELLIS']) fillPoly(BORO, toW(GEO[k]), 1);
  fillPoly(BORO, toW(GEO.BRX), 2);
  for (const z of GEO.ZONES) fillPoly(ZONE, toW(z[1]), z[0], true);
  for (const z of BF_ZONES) fillPoly(ZONE, z[1], z[0], true);
  CAMPUS_BB.length = 0;   // housing campuses: lawn (park zone) with sparse trees between the towers (placeOpenProps)
  for (const c of GEO.CAMPUS) { const w = toW(c[2]); fillPoly(ZONE, w, 1, true); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const q of w) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); } CAMPUS_BB.push([x0, z0, x1, z1]); }
  for (const r of GEO.PAVE) fillPoly(ZONE, toW([[r[0], r[2]], [r[0], r[3]], [r[1], r[3]], [r[1], r[2]]]), 3, true);
  // grid-aligned Manhattan parks
  const g = GRIDS[1], ins = g.wa / 2 + g.sw;
  fillPoly(ZONE, gRect(g, ins, g.ws / 2 + g.sw, 3 * g.A - ins, 25 * g.S - g.ws / 2 - g.sw), 1, true); // Central Park
  const sq = [[40.7308, -73.9973], [40.7359, -73.9911], [40.7420, -73.9880], [40.7536, -73.9832], [40.7265, -73.9815], [40.8040, -73.9440]];
  for (const s of sq) { const b = blockOf(g, s[0], s[1]); fillPoly(ZONE, blockRect(g, b[0], b[1], 1, 1, -0.01), 1, true); }
  buildRoads();
  placeGas(); for (const g of GAS_SITES) fillPoly(ZONE, g.apron, 3, true);
  placeCivic(); for (const c of CIVIC_SITES) fillPoly(ZONE, c.pad, c.type === 'energy' ? 3 : 5, true);
  { const R = MALL_RING, h = R.w / 2, c = [[R.s0, R.t0], [R.s1, R.t0], [R.s1, R.t1], [R.s0, R.t1]];
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4], ds = Math.sign(b[0] - a[0]) * h, dt = Math.sign(b[1] - a[1]) * h;
      addSeg(fW(SM, a[0] - ds, a[1] - dt), fW(SM, b[0] + ds, b[1] + dt), R.w, SEG_AVE).name = 'RING RD'; }
    for (const s0 of [-20, 20]) addSeg(fW(SM, s0, 1), fW(SM, s0, R.t0 + h), 2.6, SEG_AVE).name = 'RING RD'; // entrances off Richmond Ave
    // Richmond Hill Rd leaves Richmond Ave just north of the mall and bends south-east around its corner (OSM shape)
    { const pts = [fW(SM, 46, 1.5), fW(SM, 46, 62), fW(SM, 40, 74), fW(SM, 0, 80), P(40.5733, -74.1470)];
      for (let i = 0; i + 1 < pts.length; i++) addSeg(pts[i], pts[i + 1], 3.0, SEG_AVE).name = 'RICHMOND HILL RD'; } }
  // blurred land mask (separable 1-4-6-4-1) for smooth coastlines
  { const K = [1, 4, 6, 4, 1], t1 = new Uint16Array(MW * MH);
    for (let y = 0; y < MH; y++) { const row = y * MW; for (let x = 0; x < MW; x++) { let v = 0; for (let k = -2; k <= 2; k++) { const xx = Math.min(MW - 1, Math.max(0, x + k)); v += (BORO[row + xx] ? 255 : 0) * K[k + 2]; } t1[row + x] = v >> 4; } }
    for (let x = 0; x < MW; x++) for (let y = 0; y < MH; y++) { let v = 0; for (let k = -2; k <= 2; k++) { const yy = Math.min(MH - 1, Math.max(0, y + k)); v += t1[yy * MW + x] * K[k + 2]; } LANDB[y * MW + x] = Math.min(255, (v + 8) >> 4); } }
  // shore band mask (separable dilation of the land raster by 4 cells)
  const tmp = new Uint8Array(MW * MH), R = 4;
  for (let y = 0; y < MH; y++) { const row = y * MW; let last = -1e9; for (let x = 0; x < MW; x++) { if (BORO[row + x]) last = x; if (x - last <= R) tmp[row + x] = 1; } last = 1e9; for (let x = MW - 1; x >= 0; x--) { if (BORO[row + x]) last = x; if (last - x <= R) tmp[row + x] = 1; } }
  for (let x = 0; x < MW; x++) { let last = -1e9; for (let y = 0; y < MH; y++) { if (tmp[y * MW + x]) last = y; if (y - last <= R) NEARL[y * MW + x] = 1; } last = 1e9; for (let y = MH - 1; y >= 0; y--) { if (tmp[y * MW + x]) last = y; if (last - y <= R) NEARL[y * MW + x] = 1; } }
}

// ---------- tile classification ----------
let LASTU = 0, LASTV = 0, LASTG = null;
function tileAt(x, z) {
  if (mapIdx(x, z) < 0) return T_WATER;
  const m = landIdx(x, z);
  const b = m < 0 ? 0 : BORO[m];
  const s = segHit(x, z);
  if (s) {
    if (s.type === SEG_BRIDGE) return T_BRIDGE;
    if (s.type === SEG_RUN) return T_RUNWAY;
    return T_HWY;
  }
  if (b === 0) return T_WATER;
  const zn = ZONE[m];
  if (zn) return zn === 1 ? T_PARK : zn === 2 ? T_SAND : zn === 3 ? T_TARMAC : zn === 4 ? T_CEM : zn === 6 ? T_MARSH : zn === 7 ? T_PARKING : T_PLAZA;
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
const COL = { water: [62, 158, 216], shallow: [92, 186, 226], foam: [214, 240, 250], road: [66, 68, 76], walk: [196, 192, 184], curb: [138, 136, 130], lot: [150, 146, 138],
  grass: [104, 178, 78], grass2: [94, 166, 70], sand: [238, 214, 152], wet: [212, 190, 134], tarmac: [146, 148, 154], run: [58, 60, 66], hwy: [56, 58, 64],
  cem: [114, 164, 88], marsh: [112, 128, 66], reed: [150, 146, 84], mud: [92, 82, 58], pool: [84, 128, 128], park: [74, 76, 82], plaza: [208, 202, 190], yellow: [240, 196, 56], white: [236, 236, 236], yard: [120, 174, 88], gut: [40, 41, 46], edge: [120, 122, 126] };
// Markings are sized for 256 px / 48 units (0.19 units per texel): every line is at least one
// texel wide so it doesn't break up into specks, and dash/zebra periods are several texels long.
const fr = (a) => a - Math.floor(a);
function shade(c, k, out) { out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k; return out; }
const _sc = [0, 0, 0];
// Anti-aliased line painting: coverage of a stripe of half-width hw at distance d, one texel soft.
const TXS = 48 / 256;
function cov(d, hw) { const k = (hw - d) / TXS + 0.5; return k <= 0 ? 0 : k >= 1 ? 1 : k; }
function paint(c, col, k) { if (k <= 0) return c; if (c !== _sc) { _sc[0] = c[0]; _sc[1] = c[1]; _sc[2] = c[2]; } _sc[0] += (col[0] - _sc[0]) * k; _sc[1] += (col[1] - _sc[1]) * k; _sc[2] += (col[2] - _sc[2]) * k; return _sc; }
// dash coverage along a line: period p, duty 0.5, soft ends
function dash(a, p) { const f = fr(a / p) * p, h = p * 0.25; return cov(Math.abs(f - p * 0.5), h); }
function texel(x, z, out) {
  let t = tileAt(x, z), c;
  const n = hash2(Math.floor(x * 5.33), Math.floor(z * 5.33)); // per-texel grain
  switch (t) {
    case T_WATER: {
      // the blurred land field doubles as distance-to-shore: shallows fade in, then a thin foam line
      const mi = mapIdx(x, z);
      if (mi < 0 || !NEARL[mi]) { c = COL.water; break; }
      const v = landVal(x, z);
      c = paint(COL.water, COL.shallow, Math.min(1, v * 6));
      c = paint(c, COL.foam, Math.max(0, Math.min(1, (v - 0.3) * 7)));
      break;
    }
    case T_BRIDGE: {
      if (boroAt(x, z) === 0) { c = COL.water; break; }
      const a = Math.abs(SH.lat), hw = SH.seg.hw;
      c = a > hw - 0.35 ? COL.curb : (a < 0.12 ? COL.yellow : COL.hwy); break;
    }
    case T_ROAD: {
      const g = LASTG, u = LASTU, v = LASTV;
      const ru = u - g.A * Math.round(u / g.A), rv = v - g.S * Math.round(v / g.S);
      const du = Math.abs(ru), dv = Math.abs(rv);
      const onAve = du < g.wa / 2, onSt = dv < g.ws / 2;
      c = shade(COL.road, 0.94 + 0.12 * n, _sc);
      if (onAve && !onSt) {
        const fromX = dv - g.ws / 2; // distance past the crossing street's edge
        if (fromX < 1.4) {
          if (du < g.wa / 2 - 0.25) c = paint(c, COL.white, Math.min(cov(Math.abs(fromX - 0.55), 0.4), dash(u, 0.9)));      // zebra
          if (du > 0.3 && du < g.wa / 2 - 0.25) c = paint(c, COL.white, cov(Math.abs(fromX - 1.22), 0.12));               // stop bar
        } else {
          c = paint(c, COL.white, Math.min(cov(Math.abs(du - g.wa / 4 - 0.08), 0.1), dash(v, 2.2)));                     // lane dashes
        }
        c = paint(c, COL.yellow, cov(Math.abs(du - 0.16), 0.08));                                                           // double yellow
        c = paint(c, COL.gut, cov(g.wa / 2 - du, 0.2) * 0.35);                                                          // gutter
      } else if (onSt && !onAve) {
        const fromX = du - g.wa / 2;
        if (fromX < 1.1) { if (dv < g.ws / 2 - 0.25) c = paint(c, COL.white, Math.min(cov(Math.abs(fromX - 0.55), 0.4), dash(v, 0.9))); }
        else c = paint(c, COL.white, Math.min(cov(dv, 0.09), dash(u, 2.0)));
        c = paint(c, COL.gut, cov(g.ws / 2 - dv, 0.2) * 0.35);
      }
      break;
    }
    case T_WALK: {
      const g = LASTG, u = LASTU, v = LASTV;
      const du = Math.abs(u - g.A * Math.round(u / g.A)), dv = Math.abs(v - g.S * Math.round(v / g.S));
      c = shade(COL.walk, 0.96 + 0.07 * n, _sc);
      if ((du >= g.wa / 2 && du < g.wa / 2 + 0.2) || (dv >= g.ws / 2 && dv < g.ws / 2 + 0.2)) c = COL.curb;
      else if (fr(u / 1.4) < 0.13 || fr(v / 1.4) < 0.13) c = shade(COL.walk, 0.9, _sc);
      // building-side shadow line (fake AO where the sidewalk meets the lot)
      else if ((du > g.wa / 2 + g.sw - 0.2 && du < g.wa / 2 + g.sw) || (dv > g.ws / 2 + g.sw - 0.2 && dv < g.ws / 2 + g.sw)) c = shade(COL.walk, 0.84, _sc);
      break;
    }
    case T_LOT: { const b = boroAt(x, z); c = shade(b === 5 ? COL.yard : (b === 4 && x > 330) ? COL.yard : COL.lot, 0.96 + 0.06 * n, _sc); break; }
    case T_PARK: { const h = hash2(Math.floor(x / 2.5), Math.floor(z / 2.5)); c = shade(h > 0.6 ? COL.grass2 : COL.grass, 0.94 + 0.1 * n, _sc); break; }
    case T_SAND: {
      const lv = Math.min(landVal(x + 1.6, z), landVal(x - 1.6, z), landVal(x, z + 1.6), landVal(x, z - 1.6));
      c = shade(lv < 0.5 ? COL.wet : COL.sand, 0.96 + 0.06 * n, _sc); break;
    }
    case T_TARMAC: c = shade(COL.tarmac, 0.96 + 0.06 * n, _sc); break;
    case T_MARSH: { // salt marsh: grass + reed beds + mud flats + shallow pools (all drivable)
      const w = marshWet(x, z), r = vnoise(x / 1.3 - 40, z / 1.3 + 9);
      c = shade(r > 0.6 ? COL.reed : COL.marsh, 0.9 + 0.16 * n, _sc);
      c = paint(c, COL.mud, Math.max(0, Math.min(1, (w - 0.5) * 10)));
      c = paint(c, COL.pool, Math.max(0, Math.min(1, (w - 0.58) * 14)));
      if (w > 0.6 && n > 0.93) c = paint(c, COL.foam, 0.35);
      break;
    }
    case T_PARKING: { // striped lot in the site frame: [stalls 2.6][stalls 2.6][aisle 3.4], stalls 1.4 wide
      const L = lotAt(x, z), q = fLocal(L.F, x, z), s = q[0], t = q[1];
      c = shade(COL.park, 0.94 + 0.1 * n, _sc);
      const tp = t - L.tb, m = tp - 8.8 * Math.floor(tp / 8.8);
      if (m < 5.2) { c = paint(c, COL.white, cov(Math.abs(s / 1.4 - Math.round(s / 1.4)) * 1.4, 0.07)); c = paint(c, COL.white, cov(Math.abs(m - 2.6), 0.07)); }
      else c = paint(c, COL.white, Math.min(cov(Math.abs(m - 7.0), 0.08), dash(s, 2.4)) * 0.6);
      break;
    }
    case T_CEM: c = shade(COL.cem, 0.95 + 0.08 * n, _sc); break;
    case T_PLAZA: { const u = x * 0.9 + z * 0.4, v = z * 0.9 - x * 0.4; c = shade(COL.plaza, (fr(u / 1.2) < 0.1 || fr(v / 1.2) < 0.1) ? 0.9 : 0.97 + 0.05 * n, _sc); break; }
    case T_RUNWAY: case T_HWY: {
      const sg = SH.seg, lat = SH.lat, al = SH.t, hw = sg.hw;
      c = shade(t === T_RUNWAY ? COL.run : COL.hwy, 0.94 + 0.12 * n, _sc);
      const a = Math.abs(lat);
      if (t === T_RUNWAY) {
        c = paint(c, COL.white, cov(Math.abs(a - (hw - 0.32)), 0.12));
        c = paint(c, COL.white, Math.min(cov(a, 0.14), dash(al, 3)));
      } else if (sg.type === SEG_AVE) {
        c = shade(COL.road, 0.94 + 0.12 * n, _sc);
        c = paint(c, COL.yellow, cov(Math.abs(a - 0.16), 0.08));
        c = paint(c, COL.white, Math.min(cov(Math.abs(a - hw * 0.5), 0.09), dash(al, 2.2)));
      } else {
        c = paint(c, COL.white, cov(Math.abs(a - (hw - 0.3)), 0.1));
        c = paint(c, COL.yellow, cov(Math.abs(a - 0.16), 0.08));
        c = paint(c, COL.white, Math.min(cov(Math.abs(a - hw * 0.5), 0.09), dash(al, 2.4)));
      }
      if (boroAt(x, z) === 0) c = paint(c, COL.edge, cov(hw - a, 0.18));
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
  if (zn === 6) return [118, 134, 76];
  if (zn === 7) return [96, 98, 104];
  return [[0], [196, 190, 182], [186, 176, 166], [190, 178, 166], [184, 182, 168], [178, 190, 166], [170, 170, 170]][b];
}
