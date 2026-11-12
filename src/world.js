// ============================================================
//  World manager: streaming chunks (workers), collision queries,
//  bridges, boats, particles
// ============================================================
const CELL = 6, CELLN = CH / CELL;
const WORLD = {
  chunks: new Map(), pending: new Map(), workers: [], ready: 0, wantR: 2.4, inflight: 0, fallback: false,
  statics: [], bridgeGfx: null, stamp: 1,
  key(cx, cz) { return cx * 100000 + cz; },
  initWorkers(src) {
    const n = (navigator.hardwareConcurrency || 2) >= 4 ? 2 : 1;
    try {
      const glue = `\n;onmessage=function(e){var m=e.data;if(m.t==='init'){buildMap();initWorldData();postMessage({t:'ready'});}else if(m.t==='gen'){var c=genChunk(m.cx,m.cz);postMessage({t:'chunk',c:c},[c.tex.buffer,c.boxes.buffer,c.cols.buffer,c.props.buffer,c.bills.buffer]);}};`;
      const url = URL.createObjectURL(new Blob([src + glue], { type: 'text/javascript' }));
      for (let i = 0; i < n; i++) {
        const w = new Worker(url); w.busy = 0; w.ok = false;
        w.onmessage = (e) => {
          const m = e.data;
          if (m.t === 'ready') { w.ok = true; this.ready++; }
          else if (m.t === 'chunk') { w.busy--; this.inflight--; this.onChunk(m.c); }
        };
        w.onerror = (e) => { console.warn('worker error, falling back', e.message); this.fallback = true; this.pending.clear(); this.inflight = 0; };
        w.postMessage({ t: 'init' });
        this.workers.push(w);
      }
    } catch (err) { console.warn('no workers', err); this.fallback = true; }
    setTimeout(() => { if (!this.ready) { this.fallback = true; this.pending.clear(); this.inflight = 0; } }, 5000);
  },
  onChunk(c) {
    const k = this.key(c.cx, c.cz);
    if (!this.pending.has(k)) return;
    this.pending.delete(k);
    const ch = { cx: c.cx, cz: c.cz, x0: c.cx * CH, z0: c.cz * CH, boxes: c.boxes, cols: c.cols, props: c.props, bills: c.bills, land: c.land };
    const nc = c.cols.length / COLF, np = c.props.length / PROPF;
    ch.colStamp = new Uint32Array(nc); ch.propStamp = new Uint32Array(np); ch.alive = new Uint8Array(np).fill(1);
    // spatial cells
    ch.cellC = []; ch.cellP = []; for (let i = 0; i < CELLN * CELLN; i++) { ch.cellC.push([]); ch.cellP.push([]); }
    let maxH = 2;
    for (let i = 0; i < nc; i++) {
      const o = i * COLF, x = c.cols[o], z = c.cols[o + 1], r = Math.hypot(c.cols[o + 4], c.cols[o + 5]);
      if (c.cols[o + 6] < 39) maxH = Math.max(maxH, c.cols[o + 6]); // block force fields (h 40) are invisible
      this.cellsFor(ch, x, z, r, (ci) => ch.cellC[ci].push(i));
    }
    for (let i = 0; i < np; i++) { const o = i * PROPF; this.cellsFor(ch, c.props[o], c.props[o + 1], c.props[o + 2], (ci) => ch.cellP[ci].push(i)); }
    ch.maxH = maxH + 12;
    if (GFX.ok) {
      ch.tex = GFX.makeTex(c.tex, CTEX, CTEX, false, true);
      if (c.boxes.length) ch.gfx = GFX.makeInst(c.boxes);
    }
    const bl = []; for (let i = 0; i < c.bills.length; i += 8) bl.push(Array.from(c.bills.subarray(i, i + 8)));
    ch.billList = bl;
    this.chunks.set(k, ch);
  },
  cellsFor(ch, x, z, r, fn) {
    const a0 = Math.max(0, Math.floor((x - r - ch.x0) / CELL)), a1 = Math.min(CELLN - 1, Math.floor((x + r - ch.x0) / CELL));
    const b0 = Math.max(0, Math.floor((z - r - ch.z0) / CELL)), b1 = Math.min(CELLN - 1, Math.floor((z + r - ch.z0) / CELL));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) fn(b * CELLN + a);
  },
  get(cx, cz) { return this.chunks.get(this.key(cx, cz)); },
  update(px, pz, radius) {
    const R = radius || this.wantR;
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
    const need = [];
    const ri = Math.ceil(R);
    for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      const ccx = (cx + 0.5) * CH, ccz = (cz + 0.5) * CH, d = Math.hypot(ccx - px, ccz - pz) / CH;
      if (d > R + 0.3) continue;
      const k = this.key(cx, cz);
      if (this.chunks.has(k) || this.pending.has(k)) continue;
      need.push([d, cx, cz, k]);
    }
    need.sort((a, b) => a[0] - b[0]);
    for (const n of need) {
      if (this.fallback || !this.ready) {
        if (!this.fallback) break;
        // main-thread generation, one per frame
        this.pending.set(n[3], 1); const c = genChunk(n[1], n[2]); this.onChunk(c); break;
      }
      const w = this.workers.filter(w => w.ok).sort((a, b) => a.busy - b.busy)[0];
      if (!w || w.busy >= 4) break;
      w.busy++; this.inflight++; this.pending.set(n[3], 1); w.postMessage({ t: 'gen', cx: n[1], cz: n[2] });
    }
    // unload far chunks
    for (const [k, ch] of this.chunks) {
      const d = Math.hypot((ch.cx + 0.5) * CH - px, (ch.cz + 0.5) * CH - pz) / CH;
      if (d > R + 1.8) {
        if (ch.gfx) GFX.freeInst(ch.gfx); if (ch.tex) GFX.gl.deleteTexture(ch.tex);
        this.chunks.delete(k);
      }
    }
  },
  loadedAround(px, pz, R) {
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH); let need = 0, have = 0; const ri = Math.ceil(R);
    for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) { const d = Math.hypot((pcx + dx + 0.5) * CH - px, (pcz + dz + 0.5) * CH - pz) / CH; if (d > R) continue; need++; if (this.get(pcx + dx, pcz + dz)) have++; }
    return have / Math.max(1, need);
  },
  // iterate colliders near (x,z) within r: fn(cols, offset) ; returns early if fn returns true
  forCols(x, z, r, fn) {
    const st = ++this.stamp;
    const c0 = Math.floor((x - r) / CH), c1 = Math.floor((x + r) / CH), d0 = Math.floor((z - r) / CH), d1 = Math.floor((z + r) / CH);
    for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) {
      const ch = this.get(cx, cz); if (!ch) continue;
      const a0 = Math.max(0, Math.floor((x - r - ch.x0) / CELL)), a1 = Math.min(CELLN - 1, Math.floor((x + r - ch.x0) / CELL));
      const b0 = Math.max(0, Math.floor((z - r - ch.z0) / CELL)), b1 = Math.min(CELLN - 1, Math.floor((z + r - ch.z0) / CELL));
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
        const L = ch.cellC[b * CELLN + a];
        for (let i = 0; i < L.length; i++) { const id = L[i]; if (ch.colStamp[id] === st) continue; ch.colStamp[id] = st; if (fn(ch.cols, id * COLF)) return true; }
      }
    }
    for (const d of DYNCOLS) if (d.on && Math.abs(d.c[0] - x) < r + 6 && Math.abs(d.c[1] - z) < r + 6) if (fn(d.c, 0)) return true;
    return false;
  },
  forProps(x, z, r, fn) {
    const st = ++this.stamp;
    const c0 = Math.floor((x - r) / CH), c1 = Math.floor((x + r) / CH), d0 = Math.floor((z - r) / CH), d1 = Math.floor((z + r) / CH);
    for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) {
      const ch = this.get(cx, cz); if (!ch) continue;
      const a0 = Math.max(0, Math.floor((x - r - ch.x0) / CELL)), a1 = Math.min(CELLN - 1, Math.floor((x + r - ch.x0) / CELL));
      const b0 = Math.max(0, Math.floor((z - r - ch.z0) / CELL)), b1 = Math.min(CELLN - 1, Math.floor((z + r - ch.z0) / CELL));
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
        const L = ch.cellP[b * CELLN + a];
        for (let i = 0; i < L.length; i++) { const id = L[i]; if (ch.propStamp[id] === st || !ch.alive[id]) continue; ch.propStamp[id] = st; fn(ch, id); }
      }
    }
  },
  pointBlocked(x, z, pad) {
    return this.forCols(x, z, pad + 1, (c, o) => {
      const dx = x - c[o], dz = z - c[o + 1], ax = c[o + 2], az = c[o + 3];
      const lu = dx * ax + dz * az, lv = -dx * az + dz * ax;
      return Math.abs(lu) < c[o + 4] + pad && Math.abs(lv) < c[o + 5] + pad;
    });
  },
  killProp(ch, id) {
    ch.alive[id] = 0;
    const o = id * PROPF, s = ch.props[o + 4] | 0, n = ch.props[o + 5] | 0;
    const out = [];
    for (let k = 0; k < n; k++) { const b = (s + k) * INST; out.push(ch.boxes.slice(b, b + INST)); }
    if (ch.gfx) { const z = new Float32Array(n * INST); for (let k = 0; k < n; k++) { z.set(ch.boxes.subarray((s + k) * INST, (s + k + 1) * INST), k * INST); z[k * INST + 3] = z[k * INST + 4] = z[k * INST + 5] = 0; } GFX.updateInst(ch.gfx, s, z); }
    return out;
  },
  bills() { const out = []; for (const ch of this.chunks.values()) if (ch.billList) for (const b of ch.billList) out.push(b); return out; },
};
// dynamic colliders (shop doors)
const DYNCOLS = [];

// ---------- quaternion helpers ----------
function qYaw(a) { return [0, Math.sin(a / 2), 0, Math.cos(a / 2)]; }
function qMul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
function qAxis(x, y, z, a) { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; }
function qRot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const cx = y * vz - z * vy + w * vx, cy = z * vx - x * vz + w * vy, cz = x * vy - y * vx + w * vz;
  return [vx + 2 * (y * cz - z * cy), vy + 2 * (z * cx - x * cz), vz + 2 * (x * cy - y * cx)];
}
function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }

// ---------- bridges (static global geometry) ----------
function seg3(a, b, th, col, mat) { // box between two 3D points
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); if (L < 1e-4) return;
  const yaw = Math.atan2(dx, dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const q = qMul(qYaw(yaw), qAxis(1, 0, 0, -pitch));
  boxQ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, th, th, L + th * 0.5, q, col, mat || 0);
}
function buildBridgeGeometry() {
  OB = [];
  const deck = hex('#4b4e55'), line = hex('#e8c040');
  for (const br of BRIDGES) {
    const col = hex(br.color), dx = br.dx, dz = br.dz, rx = dz, rz = -dx; // right vector (lateral +)
    const at = (t, lat, y) => [br.a[0] + dx * t + rx * lat, y, br.a[1] + dz * t + rz * lat];
    const n = Math.max(2, Math.ceil(br.len / 2.5));
    for (let k = 0; k < n; k++) {
      const t0 = k * br.len / n, t1 = (k + 1) * br.len / n, h0 = bridgeH(br, t0), h1 = bridgeH(br, t1);
      const yaw = Math.atan2(dx, dz), pitch = Math.atan2(h1 - h0, t1 - t0);
      const q = qMul(qYaw(yaw), qAxis(1, 0, 0, -pitch));
      const L = Math.hypot(t1 - t0, h1 - h0) + 0.06, m = at((t0 + t1) / 2, 0, (h0 + h1) / 2);
      boxQ(m[0], m[1] - 0.22, m[2], br.w, 0.44, L, q, deck, 0);
      if ((h0 + h1) / 2 > 0.15) {
        for (const s of [-1, 1]) { const p = at((t0 + t1) / 2, s * (br.w / 2 - 0.08), (h0 + h1) / 2 + 0.22); boxQ(p[0], p[1], p[2], 0.14, 0.44, L, q, col, 0); }
        if (k % 2 === 0) { const p = at((t0 + t1) / 2, 0, (h0 + h1) / 2 + 0.005); boxQ(p[0], p[1], p[2], 0.1, 0.02, L * 0.5, q, line, 0); }
      }
    }
    const w0 = br.w0, w1 = br.w1, span = w1 - w0; if (span <= 0) continue;
    // piers
    for (let t = w0 + 6; t < w1 - 3; t += 11) { const h = bridgeH(br, t); const p = at(t, 0, 0); box(p[0], (h - 0.4) / 2 - 0.3, p[2], br.w * 0.7, h - 0.4 + 0.6, 1.0, Math.atan2(dx, dz), hex('#77756f')); }
    const style = br.style;
    if (style === 'susp' || style === 'gothic') {
      const big = br.H >= 3.2, TH = br.H + (big ? 10 : 7);
      const tA = w0 + span * (big ? 0.18 : 0.22), tB = w1 - span * (big ? 0.18 : 0.22);
      for (const tt of [tA, tB]) {
        const h = bridgeH(br, tt);
        if (style === 'gothic') {
          // stone tower: two outer piers, a pointed gothic arch over the roadway, blind arches on the piers
          const yw = Math.atan2(dx, dz), hw = br.w / 2, pw = 1.1, dark = hex('#4a4136');
          for (const s of [-1, 1]) {
            const p = at(tt, s * (hw + pw / 2), 0); box(p[0], TH / 2, p[2], pw, TH, 1.8, yw, col);
            for (const f of [-1, 1]) { const q = at(tt + f * 0.92, s * (hw + pw / 2), 0); box(q[0], h + 3.6, q[2], 0.45, 3.2, 0.06, yw, dark); }
          }
          const spring = h + 2.4, peak = h + 4.2;
          for (const s of [-1, 1]) seg3(at(tt, s * hw, spring), at(tt, 0, peak), 0.9, col);
          const pm = at(tt, 0, 0); box(pm[0], peak + (TH - peak) / 2 - 0.3, pm[2], br.w + 0.2, TH - peak + 0.6, 1.6, yw, col);
          for (const f of [-1, 1]) { const q = at(tt + f * 0.82, 0, 0); box(q[0], peak + 1.4, q[2], br.w * 0.6, 1.6, 0.06, yw, dark); }
          box(pm[0], TH + 0.25, pm[2], br.w + 2 * pw + 0.6, 0.5, 2.1, yw, col);
          box(pm[0], (h - 0.4) / 2, pm[2], br.w + 1.2, h - 0.4 + 0.6, 1.5, yw, col);
          // diagonal stays fanning from the tower top (the Brooklyn Bridge web)
          for (const s of [-1, 1]) for (const f of [-1, 1]) for (let k = 1; k <= 5; k++) {
            const t2 = tt + f * k * 2.6; if (t2 < 0 || t2 > br.len) continue;
            seg3(at(tt, s * (hw + 0.1), TH - 1.0), at(t2, s * (hw - 0.05), bridgeH(br, t2) + 0.35), 0.05, hex('#8a7f6a'));
          }
        } else {
          for (const s of [-1, 1]) { const p = at(tt, s * (br.w / 2 + 0.25), 0); box(p[0], TH / 2, p[2], 0.55, TH, 0.7, Math.atan2(dx, dz), col); }
          for (const yy of [h + 2.8, TH - 1.2, TH - 0.2]) { const pm = at(tt, 0, yy); box(pm[0], yy, pm[2], br.w + 1.0, 0.45, 0.6, Math.atan2(dx, dz), col); }
        }
      }
      // main cables
      const ccol = style === 'gothic' ? hex('#8a7f6a') : col;
      for (const s of [-1, 1]) {
        const lat = s * (br.w / 2 + 0.2);
        const pts = [];
        const cy = (t) => {
          const h = bridgeH(br, t);
          if (t < tA) return h + 0.4 + (TH - 0.2 - h - 0.4) * Math.max(0, (t - w0 + 4) / (tA - w0 + 4));
          if (t > tB) return h + 0.4 + (TH - 0.2 - h - 0.4) * Math.max(0, (w1 + 4 - t) / (w1 + 4 - tB));
          const u = (t - tA) / (tB - tA) * 2 - 1; return h + 0.6 + (TH - 0.2 - h - 0.6) * u * u;
        };
        for (let t = Math.max(0, w0 - 4); t <= Math.min(br.len, w1 + 4) + 0.01; t += 2.5) pts.push([t, cy(t)]);
        for (let i = 0; i + 1 < pts.length; i++) seg3(at(pts[i][0], lat, pts[i][1]), at(pts[i + 1][0], lat, pts[i + 1][1]), 0.16, ccol);
        for (let i = 1; i < pts.length - 1; i += 1) { const t = pts[i][0], h = bridgeH(br, t); if (pts[i][1] - h > 0.8) seg3(at(t, lat, h + 0.4), at(t, lat, pts[i][1]), 0.05, ccol); }
      }
    } else if (style === 'cant' || style === 'truss') {
      for (const s of [-1, 1]) {
        const lat = s * (br.w / 2 + 0.05);
        let prev = null;
        const step = 2.5, nseg = Math.ceil(span / step);
        for (let i = 0; i <= nseg; i++) {
          const t = w0 + i * span / nseg, h = bridgeH(br, t);
          const top = style === 'cant' ? h + 1.8 + 2.6 * Math.abs(Math.sin(i / nseg * Math.PI * 3)) : h + 1.8;
          const p = at(t, lat, top);
          seg3(at(t, lat, h + 0.3), p, 0.14, col);
          if (prev) { seg3(prev[0], p, 0.18, col); seg3(prev[1], p, 0.08, col); }
          prev = [p, at(t, lat, h + 0.3)];
        }
      }
      if (style === 'cant') for (let i = 0; i < 4; i++) { const t = w0 + span * (0.12 + i * 0.25), h = bridgeH(br, t); const p = at(t, 0, 0); box(p[0], (h + 4) / 2, p[2], br.w + 1.4, h + 4, 1.4, Math.atan2(dx, dz), hex('#9a8f80')); }
    } else if (style === 'arch') {
      const AH = br.H + Math.min(8, span * 0.12 + 2);
      for (const s of [-1, 1]) {
        const lat = s * (br.w / 2 + 0.1); let prev = null;
        const ns = 16;
        for (let i = 0; i <= ns; i++) {
          const t = w0 + span * i / ns, u = i / ns * 2 - 1, h = bridgeH(br, t);
          const y = h - 0.2 + (AH - h + 0.2) * (1 - u * u);
          const p = at(t, lat, y);
          if (prev) seg3(prev, p, 0.28, col);
          if (i > 0 && i < ns && y - h > 0.6) seg3(at(t, lat, h + 0.3), p, 0.06, col);
          prev = p;
        }
      }
    }
  }
  const data = new Float32Array(OB); OB = null; return data;
}

// ---------- boats ----------
const BOATS = [];
function initBoats() {
  const path = (pts) => { const w = pts.map(PL); const L = [0]; for (let i = 1; i < w.length; i++) L.push(L[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1])); return { w, L, total: L[L.length - 1] }; };
  const ferry = path([[40.6998, -74.0128], [40.6930, -74.0200], [40.6750, -74.0420], [40.6560, -74.0640], [40.6452, -74.0708]]);
  BOATS.push({ p: ferry, s: 0, v: 7, kind: 'ferry', dir: 1, wait: 0 }, { p: ferry, s: ferry.total, v: 7, kind: 'ferry', dir: -1, wait: 0 });
  BOATS.push({ p: path([[40.8500, -73.9540], [40.8000, -73.9820], [40.7600, -74.0110], [40.7200, -74.0240], [40.6950, -74.0300]]), s: 40, v: 5, kind: 'tug', dir: 1, wait: 0 });
  BOATS.push({ p: path([[40.7990, -73.9330], [40.7700, -73.9460], [40.7450, -73.9650], [40.7230, -73.9690], [40.7050, -73.9950], [40.6990, -74.0060]]), s: 10, v: 4.5, kind: 'barge', dir: 1, wait: 0 });
  BOATS.push({ p: path([[40.6950, -74.0250], [40.6880, -74.0380], [40.6830, -74.0480], [40.6900, -74.0520], [40.6990, -74.0400]]), s: 0, v: 3.5, kind: 'cruise', dir: 1, wait: 0, loop: true });
}
function updateBoats(dt) {
  for (const b of BOATS) {
    if (b.wait > 0) { b.wait -= dt; continue; }
    b.s += b.v * b.dir * dt;
    if (b.loop) { if (b.s > b.p.total) b.s -= b.p.total; }
    else if (b.s > b.p.total) { b.s = b.p.total; b.dir = -1; b.wait = 6; }
    else if (b.s < 0) { b.s = 0; b.dir = 1; b.wait = 6; }
    const L = b.p.L, w = b.p.w; let i = 1; while (i < L.length - 1 && L[i] < b.s) i++;
    const t = (b.s - L[i - 1]) / (L[i] - L[i - 1] || 1);
    b.x = w[i - 1][0] + (w[i][0] - w[i - 1][0]) * t; b.z = w[i - 1][1] + (w[i][1] - w[i - 1][1]) * t;
    const hd = Math.atan2(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]) + (b.dir < 0 ? Math.PI : 0);
    b.yaw = b.yaw === undefined ? hd : b.yaw + ((((hd - b.yaw) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * Math.min(1, dt * 1.5);
  }
}
function pushBoats(push) {
  const orange = hex('#f47a20'), white = C.white, dark = C.dark, red = hex('#b8322a'), blk = hex('#202226');
  for (const b of BOATS) {
    if (b.x === undefined) continue;
    const q = qYaw(b.yaw), bob = Math.sin(performance.now() / 700 + b.s) * 0.05;
    const P = (lx, ly, lz, sx, sy, sz, col, m) => { const v = qRot(q, [lx, ly, lz]); push(b.x + v[0], ly + bob, b.z + v[2], sx, sy, sz, q, col, m || 0); };
    if (b.kind === 'ferry') { P(0, 0.2, 0, 2.6, 0.9, 8.5, orange); P(0, 0.95, 0, 2.3, 0.6, 7.2, white, 1); P(0, 1.45, 0, 2.1, 0.4, 6.4, orange, 0); P(0, 1.85, 0, 1.4, 0.4, 2.2, white); }
    else if (b.kind === 'tug') { P(0, 0.2, 0, 1.4, 0.7, 3.2, red); P(0, 0.9, -0.3, 0.9, 0.7, 1.2, white); P(0, 1.5, -0.3, 0.3, 0.6, 0.3, blk); P(0, 0.2, -4.4, 2.2, 0.6, 4.6, dark); }
    else if (b.kind === 'barge') { P(0, 0.2, 0, 2.6, 0.6, 7, hex('#5b4a3b')); P(0, 0.8, 0.5, 2.2, 0.6, 4.5, hex('#8a6a4a')); }
    else { P(0, 0.2, 0, 1.6, 0.7, 5, white); P(0, 0.8, -0.2, 1.4, 0.5, 3.6, hex('#2b4a7a'), 1); P(0, 1.2, -0.4, 1.2, 0.3, 2.4, white); }
  }
}
