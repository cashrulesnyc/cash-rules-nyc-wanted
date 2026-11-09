// node test: render master map + a detail crop to PNG
const fs = require('fs'), zlib = require('zlib'), vm = require('vm');
fs.mkdirSync(__dirname + '/out', { recursive: true });
const ctx = {}; vm.createContext(ctx);
const src = fs.readFileSync(__dirname + '/../src/data.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/../src/map.js', 'utf8') +
  '\n;this.API={buildMap,MW,MH,BORO,ZONE,mapColor,texel,P,BRIDGES,SEGS,WX0,WZ0,MAP_RES,tileAt,GRIDS};';
vm.runInContext(src, ctx);
const A = ctx.API;
let t0 = Date.now(); A.buildMap(); console.log('buildMap ms', Date.now() - t0, 'segs', A.SEGS.length);
function png(w, h, rgb, file) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// full map
{
  const w = A.MW, h = A.MH, b = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { const c = A.mapColor(A.BORO[i], A.ZONE[i]); b[i * 3] = c[0]; b[i * 3 + 1] = c[1]; b[i * 3 + 2] = c[2]; }
  // draw segs
  for (const s of A.SEGS) { for (let t = 0; t <= s.len; t += 0.5) { const x = Math.floor((s.ax + s.dx * t - A.WX0) / 2), z = Math.floor((s.az + s.dz * t - A.WZ0) / 2); if (x >= 0 && z >= 0 && x < w && z < h) { const k = (z * w + x) * 3; const col = s.type === 4 ? [255, 60, 60] : s.type === 1 ? [250, 200, 60] : [255, 255, 255]; b[k] = col[0]; b[k + 1] = col[1]; b[k + 2] = col[2]; } } }
  png(w, h, b, __dirname + '/out/map_full.png');
}
// detail crops
function crop(lat, lon, size, res, file) {
  const c = A.P(lat, lon), n = Math.round(size / res), b = Buffer.alloc(n * n * 3), o = [0, 0, 0];
  t0 = Date.now();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { A.texel(c[0] - size / 2 + (i + 0.5) * res, c[1] - size / 2 + (j + 0.5) * res, o); const k = (j * n + i) * 3; b[k] = o[0]; b[k + 1] = o[1]; b[k + 2] = o[2]; }
  console.log(file, 'texel ms', Date.now() - t0, 'px', n * n);
  png(n, n, b, __dirname + '/out/' + file);
}
crop(40.712, -73.995, 360, 0.5, 'crop_lowerman.png');
crop(40.775, -73.965, 400, 0.6, 'crop_cp.png');
crop(40.607, -74.045, 300, 0.5, 'crop_verrazzano.png');
