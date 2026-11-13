// ============================================================
//  Minimal WebGL2 voxel renderer (no external libraries)
// ============================================================
const MINST = 16; // floats per vehicle-mesh instance
const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(o, a, b) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
    } return o;
  },
  persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2); o.fill(0);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  ortho(o, l, r, b, t, n, f) {
    o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  },
  look(o, e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]); o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1; return o;
  },
  planes(m) { // frustum planes from view-proj
    const p = [];
    const r = (a, b, c, d) => { const l = Math.hypot(a, b, c); p.push([a / l, b / l, c / l, d / l]); };
    r(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    r(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    r(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    r(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    r(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
    r(m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
    return p;
  },
  boxVisible(pl, x0, y0, z0, x1, y1, z1) {
    for (const p of pl) {
      const x = p[0] > 0 ? x1 : x0, y = p[1] > 0 ? y1 : y0, z = p[2] > 0 ? z1 : z0;
      if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false;
    } return true;
  }
};

// Box vertex shader.
//  * Bevel: the mesh is a chamfered cube. aIn marks which axes a vertex is pulled in on, so the
//    chamfer is a fixed world size (uBevel, capped by the box's thinnest side) instead of
//    scaling with the box. Everything gets soft edges for free.
//  * Slice: buildings between the camera and the player are capped in height (solid, with a
//    roof) instead of being dithered see-through. The cap rises with distance toward the camera
//    at the slope of the camera ray, so only what would actually hide the car gets cut, and it
//    grows back smoothly as you drive past. Shadows still come from the full-height city.
const BOX_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=6) in vec3 aIn;
layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScl; layout(location=4) in vec4 iRot; layout(location=5) in vec4 iCol;
uniform mat4 uVP; uniform mat4 uLVP; uniform float uBevel; uniform vec4 uSlice; uniform vec3 uSliceDir; uniform float uSliceOn;
out vec3 vN; out vec3 vCol; out vec3 vL; out vec3 vW; out vec4 vS; out vec3 vLN; out vec3 vScl; flat out float vMat; flat out float vSeed; out float vCutTop;
vec3 qr(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  float bv = min(uBevel, 0.22 * min(iScl.x, min(iScl.y, iScl.z)));
  vec3 lp = aPos * iScl - aIn * bv;
  vec3 scl = iScl;
  vCutTop = 0.0;
  float lmF = step(15.5, iCol.a); // landmark: sliced more leniently so it keeps its silhouette
  if (uSliceOn > 0.5 && uSlice.w > 0.5) {
    float top = iPos.y + 0.5 * iScl.y;
    if (top > uSlice.z) {
      vec2 rel = iPos.xz - uSlice.xy;
      float along = dot(rel, uSliceDir.xy);              // >0: beyond the car, away from camera
      float lat = abs(dot(rel, vec2(-uSliceDir.y, uSliceDir.x)));
      float rad = 0.5 * max(iScl.x, iScl.z);
      if (along < rad + 1.0) {
        float a = max(0.0, -along - rad);                 // gap from the car to the box, toward camera
        float l = max(0.0, lat - rad - 1.6 - 1.5 * lmF);
        float cap = uSlice.z + 5.0 * lmF + (a + 2.2 * l) * uSliceDir.z;
        if (cap < top) {
          float bot = iPos.y - 0.5 * iScl.y;
          if (bot >= cap - 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // fully above cut: drop it
          float ly = cap - iPos.y;                          // cap in local (scaled) space
          if (lp.y > ly) { lp.y = ly; vCutTop = 1.0; }
          scl.y = ly + 0.5 * iScl.y;                       // window rows think the box ends at the cut
        }
      }
    }
  }
  vec3 w = qr(iRot, lp) + iPos;
  vN = qr(iRot, aNrm); vCol = iCol.rgb; vMat = iCol.a - 16.0 * lmF; vL = vec3(lp.x, lp.y + 0.5 * (iScl.y - scl.y), lp.z); vLN = aNrm; vScl = scl; vW = w;
  vSeed = fract(iPos.x*0.1231 + iPos.z*0.3117 + iPos.y*0.071);
  vS = uLVP * vec4(w, 1.0);
  gl_Position = uVP * vec4(w, 1.0);
}`;
const LIGHT_FS = `
uniform highp sampler2DShadow uShadow; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFogCol; uniform vec2 uFog; uniform vec3 uCam; uniform float uNight; uniform float uShadowOn; uniform float uTime;
float shadowAt(vec4 s){
  if (uShadowOn < 0.5) return 1.0;
  vec3 p = s.xyz / s.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  p.z -= 0.0012;
  float t = 1.0 / float(textureSize(uShadow, 0).x);
  float r = texture(uShadow, p) * 0.4;
  r += texture(uShadow, p + vec3(t, 0.0, 0.0)) * 0.15; r += texture(uShadow, p + vec3(-t, 0.0, 0.0)) * 0.15;
  r += texture(uShadow, p + vec3(0.0, t, 0.0)) * 0.15; r += texture(uShadow, p + vec3(0.0, -t, 0.0)) * 0.15;
  return r;
}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec3 fogit(vec3 c, vec3 w){ float f = smoothstep(uFog.x, uFog.y, distance(w, uCam)); return mix(c, uFogCol, f); }
`;
const BOX_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vCol; in vec3 vL; in vec3 vW; in vec4 vS; in vec3 vLN; in vec3 vScl; flat in float vMat; flat in float vSeed; in float vCutTop;
out vec4 o;
${LIGHT_FS}
void main(){
  vec3 base = vCol; vec3 emi = vec3(0.0); float m = vMat; vec3 n = normalize(vN);
  bool win = (m > 0.5 && m < 1.5) || (m > 3.5 && m < 4.5);
  if (win && abs(vLN.y) < 0.5) {
    float sp = m < 1.5 ? 1.0 : 0.62;
    float hz = abs(vLN.x) > 0.5 ? vL.z : vL.x;
    float y = vL.y + vScl.y * 0.5;
    float gy = m < 1.5 ? 0.85 : 0.22;
    float cw = hz / sp + 0.5, cy = y / (sp * 1.15);
    float fh = fract(cw), fy = fract(cy);
    float edge = m < 1.5 ? 0.3 : 0.2;
    if (fh > 0.24 && fh < 0.76 && fy > 0.32 && fy < 0.82 && y > gy && y < vScl.y - edge) {
      base = mix(vec3(0.20, 0.27, 0.36), vec3(0.55, 0.70, 0.85), 0.35 + 0.3 * h21(vec2(floor(cw), floor(cy)) + vSeed * 91.0));
      if (uNight > 0.5) { float r = h21(vec2(floor(cw) + dot(vLN, vec3(3.0, 7.0, 11.0)), floor(cy)) + vSeed * 57.0); if (r > 0.52) emi = mix(vec3(1.0, 0.82, 0.45), vec3(0.75, 0.9, 1.0), step(0.85, r)) * 0.85; }
    } else if (m < 1.5 && y < gy && uNight > 0.5 && fh > 0.15 && fh < 0.85 && y > 0.15) { emi = vec3(0.9, 0.7, 0.4) * 0.35; }
  }
  float spec = 0.0;
  if (m > 6.5 && m < 7.5 && abs(vLN.y) < 0.5) { // glass curtain wall: mullion grid, sky reflection, sun glint
    float hz = abs(vLN.x) > 0.5 ? vL.z : vL.x, y = vL.y + vScl.y * 0.5;
    float cu = hz / 0.42, cv = y / 0.52;
    vec3 vd = normalize(uCam - vW); float fres = pow(1.0 - abs(dot(vd, n)), 2.0);
    vec3 sky = mix(vec3(0.62, 0.74, 0.86), vec3(0.92, 0.96, 1.0), fres) * (1.0 - 0.85 * uNight);
    float pv = 0.9 + 0.16 * h21(vec2(floor(cu), floor(cv)) + vSeed * 31.0);
    base = mix(vCol * pv * 1.08, sky, 0.34 + 0.4 * fres);
    if (fract(cu) < 0.08 || fract(cv) < 0.1 || y > vScl.y - 0.25) base = vCol * 0.45 + vec3(0.32);
    else if (uNight > 0.5) { float r = h21(vec2(floor(cu * 0.5), floor(cv)) + vSeed * 13.0); if (r > 0.6) emi = vec3(0.95, 0.85, 0.6) * 0.6; }
    spec = 0.6;
  }
  if (m > 8.5 && m < 9.5 && abs(vLN.y) < 0.5) { // art deco: continuous vertical window strips between stone piers
    float hz = abs(vLN.x) > 0.5 ? vL.z : vL.x, y = vL.y + vScl.y * 0.5;
    float cu = hz / 0.44, f = fract(cu), row = floor(y / 0.5);
    if (f > 0.32 && f < 0.68 && y > 0.3 && y < vScl.y - 0.25) {
      base = mix(vec3(0.24, 0.29, 0.35), vec3(0.42, 0.52, 0.62), 0.3 + 0.3 * h21(vec2(floor(cu), row) + vSeed * 17.0));
      if (fract(y / 0.5) < 0.16) base = vCol * 0.62;             // spandrel panels
      else if (uNight > 0.5 && h21(vec2(floor(cu) * 1.7, row) + vSeed * 7.0) > 0.5) emi = vec3(1.0, 0.86, 0.55) * 0.75;
    } else base = vCol * (0.95 + 0.08 * step(0.85, f));
  }
  if (m > 7.5 && m < 8.5) { // storefront band: lit shop glass under a coloured fascia
    float y = vL.y + vScl.y * 0.5, hz = abs(vLN.x) > 0.5 ? vL.z : vL.x;
    if (abs(vLN.y) < 0.5 && y < vScl.y * 0.72) {
      base = fract(hz / 0.7) < 0.07 ? vec3(0.12) : vec3(0.18, 0.22, 0.28);
      emi = uNight > 0.5 ? vec3(1.0, 0.82, 0.55) * 0.7 : vec3(0.05, 0.05, 0.04);
      spec = 0.4;
    } else if (n.y > 0.5) base = vec3(0.32, 0.33, 0.35);
  }
  if (m > 1.5 && m < 2.5) emi = base * (uNight > 0.5 ? 1.0 : 0.55);
  if (m > 4.5 && m < 5.5 && uNight > 0.5) emi = vec3(1.0, 0.9, 0.6);
  if (vCutTop > 0.5 && n.y > 0.5) { base = base * 0.72 + vec3(0.04); emi = vec3(0.0); } // sliced roof: flat, a touch darker
  float sh = shadowAt(vS);
  float ndl = max(dot(n, uSun), 0.0);
  // hemisphere ambient (sky from above, warm city bounce from below) + contact darkening near the ground
  vec3 hemi = mix(vec3(0.62, 0.58, 0.54), vec3(1.04, 1.04, 1.08), n.y * 0.5 + 0.5);
  float ao = 0.7 + 0.3 * smoothstep(0.0, 1.1, vW.y);
  float wallGrad = (abs(n.y) < 0.5 && vScl.y > 3.0) ? 0.93 + 0.07 * clamp(vW.y / 14.0, 0.0, 1.0) : 1.0;
  vec3 c = base * (uAmb * hemi * ao * wallGrad + uSunCol * ndl * sh * (0.85 + 0.15 * ao)) + emi;
  if (m > 5.5 && m < 6.5) spec = 0.35;
  if (spec > 0.0) { vec3 v = normalize(uCam - vW); c += spec * pow(max(dot(reflect(-uSun, n), v), 0.0), 14.0) * sh * (1.0 - 0.7 * uNight); }
  if (m > 2.5 && m < 3.5) c = base; // unlit flat (UI-ish markers)
  o = vec4(fogit(c, vW), 1.0);
}`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScl; layout(location=4) in vec4 iRot; layout(location=6) in vec3 aIn;
uniform mat4 uVP; uniform float uBevel;
vec3 qr(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){ float bv = min(uBevel, 0.22 * min(iScl.x, min(iScl.y, iScl.z))); gl_Position = uVP * vec4(qr(iRot, aPos * iScl - aIn * bv) + iPos, 1.0); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; void main(){}`;
const SIL_FS = `#version 300 es
precision mediump float; uniform vec4 uSil; out vec4 o; void main(){ o = uSil; }`;
// ---------- vehicle meshes ----------
// Dedicated (non-box) geometry for vehicles: each mesh is a flat-shaded triangle list built once in
// vehicles.js, drawn instanced (one draw per mesh type). Vertex: pos3 nrm3 col3 mat paint.
// Instance (MINST = 16 floats): pos3 quat4 scale3 rgb3 flags3 (siren, dim, brake).
// paint > 0 means "use the instance colour × paint" (body paint, rims); mat as BOX_FS plus
// 10 siren red · 11 siren blue · 12 headlight · 13 taillight.
const MESH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec3 aCol; layout(location=3) in vec2 aMat;
layout(location=4) in vec3 iPos; layout(location=5) in vec4 iRot; layout(location=6) in vec3 iScl; layout(location=7) in vec3 iCol; layout(location=8) in vec3 iFlg;
uniform mat4 uVP; uniform mat4 uLVP;
out vec3 vN; out vec3 vCol; out vec3 vW; out vec4 vS; flat out float vMat; flat out vec3 vFlg; flat out float vPaint;
vec3 qr(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  vec3 w = qr(iRot, aPos * iScl) + iPos;
  vN = qr(iRot, normalize(aNrm / iScl)); vCol = aMat.y > 0.0 ? iCol * aMat.y : aCol; vMat = aMat.x; vFlg = iFlg; vW = w; vPaint = aMat.y;
  vS = uLVP * vec4(w, 1.0); gl_Position = uVP * vec4(w, 1.0);
}`;
const MESH_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vCol; in vec3 vW; in vec4 vS; flat in float vMat; flat in vec3 vFlg; flat in float vPaint; out vec4 o;
${LIGHT_FS}
// cheap environment: sky above, dark ground below, soft studio light streaks; darker at night
uniform float uStudio;
vec3 envRef(vec3 R){
  if (uStudio > 0.5) { // showroom: dark room, big overhead softbox + vertical light strips
    vec3 e = mix(vec3(0.02, 0.022, 0.026), vec3(0.09, 0.095, 0.11), smoothstep(-0.2, 0.5, R.y));
    e += vec3(1.0, 0.98, 0.95) * 1.1 * smoothstep(0.72, 0.86, R.y);
    e += vec3(0.9, 0.95, 1.0) * 0.7 * smoothstep(0.88, 0.97, abs(sin(atan(R.z, R.x) * 2.0))) * smoothstep(-0.05, 0.25, R.y) * (1.0 - smoothstep(0.6, 0.8, R.y));
    return e;
  }
  // street: crisp horizon (the classic car-paint reflection line), sky above, dark ground below
  vec3 sky = mix(mix(vec3(0.78, 0.86, 0.95), vec3(0.5, 0.66, 0.88), smoothstep(0.05, 0.7, R.y)), vec3(0.06, 0.08, 0.14), uNight);
  vec3 gnd = mix(vec3(0.2, 0.2, 0.22), vec3(0.02), uNight);
  vec3 e = mix(gnd, sky, smoothstep(-0.03, 0.06, R.y));
  e += vec3(1.0, 0.98, 0.95) * smoothstep(0.93, 1.0, sin(R.x * 6.0 + R.z * 2.5) * 0.5 + 0.5) * smoothstep(0.0, 0.5, R.y) * (0.45 - 0.3 * uNight);
  return e;
}
void main(){
  vec3 n = normalize(vN), base = vCol, emi = vec3(0.0); float m = vMat, spec = 0.0, shin = 18.0;
  vec3 V = normalize(uCam - vW), R = reflect(-V, n); float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);
  int kind = 0; // 1 paint, 2 glass, 3 chrome
  if (m > 5.5 && m < 6.5) kind = 2;
  else if (m > 13.5 && m < 14.5) kind = 3;
  else if (m > 9.5 && m < 10.5) { if (vFlg.x > 0.5 && vFlg.x < 1.5) emi = vec3(1.0, 0.12, 0.1) * 1.4; else base = vec3(0.35, 0.08, 0.08); }
  else if (m > 10.5 && m < 11.5) { if (vFlg.x > 1.5) emi = vec3(0.15, 0.35, 1.0) * 1.5; else base = vec3(0.08, 0.12, 0.35); }
  else if (m > 11.5 && m < 12.5) { emi = vec3(1.0, 0.97, 0.9) * (uNight > 0.5 ? 1.15 : 0.35); spec = 0.6; shin = 40.0; }
  else if (m > 12.5 && m < 13.5) { emi = vec3(1.0, 0.12, 0.08) * (vFlg.z > 0.5 ? 1.3 : (uNight > 0.5 ? 0.8 : 0.5)); spec = 0.4; shin = 40.0; }
  else if (m > 1.5 && m < 2.5) emi = base * (uNight > 0.5 ? 1.0 : 0.6);
  else if (vPaint > 0.0) kind = 1;
  if (vFlg.y > 0.0) { base *= vFlg.y; emi = vec3(0.0); kind = 0; }
  float sh = shadowAt(vS), ndl = max(dot(n, uSun), 0.0);
  vec3 hemi = mix(vec3(0.62, 0.58, 0.54), vec3(1.04, 1.04, 1.08), n.y * 0.5 + 0.5);
  float ao = 0.72 + 0.28 * smoothstep(0.05, 0.6, vW.y);
  vec3 env = envRef(R);
  vec3 c = base * (uAmb * hemi * ao + uSunCol * ndl * sh) + emi;
  if (kind == 1) { // clear-coat paint: keep the colour, add a glossy reflection that grows at glancing angles
    c = c * (1.0 - 0.3 * fres) + env * (0.08 + 0.55 * fres) * (0.6 + 0.4 * sh);
    spec = 0.9; shin = 70.0;
  } else if (kind == 2) { // tinted glass: dark, very reflective at grazing angles
    vec3 tint = mix(vec3(0.025, 0.035, 0.05), vec3(0.09, 0.12, 0.16), clamp(n.y * 0.8 + 0.3, 0.0, 1.0)); // darker low, lighter toward the roof
    c = mix(tint + base * 0.2 * (uAmb + uSunCol * ndl * sh), env, 0.25 + 0.65 * fres);
    spec = 1.1; shin = 90.0;
  } else if (kind == 3) { // chrome / polished metal
    c = env * mix(vec3(0.9), base, 0.35) * (0.7 + 0.3 * sh) + base * 0.08;
    spec = 1.2; shin = 60.0;
  }
  if (spec > 0.0) c += spec * pow(max(dot(R, uSun), 0.0), shin) * sh * uSunCol * 1.6 * (1.0 - 0.7 * uNight);
  o = vec4(fogit(c, vW), 1.0);
}`;
const MESH_DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=4) in vec3 iPos; layout(location=5) in vec4 iRot; layout(location=6) in vec3 iScl;
uniform mat4 uVP;
vec3 qr(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){ gl_Position = uVP * vec4(qr(iRot, aPos * iScl) + iPos, 1.0); }`;
const GROUND_VS = `#version 300 es
layout(location=0) in vec2 aQ;
uniform mat4 uVP; uniform mat4 uLVP; uniform vec4 uChunk;
out vec2 vUV; out vec3 vW; out vec4 vS;
void main(){ vec3 w = vec3(uChunk.x + aQ.x * uChunk.z, uChunk.w, uChunk.y + aQ.y * uChunk.z); vUV = aQ; vW = w; vS = uLVP * vec4(w, 1.0); gl_Position = uVP * vec4(w, 1.0); }`;
// Ground: chunk texture for everything, except street-grid tiles (alpha = 32*borough), where roads,
// sidewalks and markings are computed from the grid maths per pixel with derivative anti-aliasing.
// That keeps them razor sharp on 3x phone screens instead of a stretched 256px texture.
const GROUND_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vW; in vec4 vS; out vec4 o;
uniform sampler2D uTex; uniform vec3 uFlat; uniform float uUseTex;
uniform vec4 uGa[7]; uniform vec4 uGb[7];
uniform vec4 uSegA[32]; uniform vec4 uSegB[32]; uniform int uSegN; // nearby highway/avenue/runway segments
${LIGHT_FS}
float cov(float d, float hw, float f){ return clamp((hw - d) / f + 0.5, 0.0, 1.0) * clamp(2.0 * hw / f, 0.0, 1.0); }
float dsh(float a, float p, float f){ float x = fract(a / p) * p; return cov(abs(x - p * 0.5), p * 0.25, f); }
vec3 C(float r, float g, float b){ return vec3(r, g, b) / 255.0; }
vec3 gridColor(int bo, vec3 lot){
  vec4 ga = uGa[bo], gb = uGb[bo];
  vec2 r = vW.xz - ga.xy;
  float u = dot(r, ga.zw), v = dot(r, vec2(ga.w, -ga.z));
  float A = gb.x, S = gb.y, wa = gb.z, ws = gb.w, sw = ${GRID_SW.toFixed(3)};
  float fu = max(fwidth(u), 1e-3), fv = max(fwidth(v), 1e-3);
  float du = abs(u - A * floor(u / A + 0.5)), dv = abs(v - S * floor(v / S + 0.5));
  float n = h21(floor(vW.xz * 5.33));
  // sidewalk
  vec3 walk = C(196.0, 192.0, 184.0) * (0.96 + 0.07 * n);
  float joint = max(cov(abs(fract(u / 1.4) - 0.5) * 1.4, 0.09, fu), cov(abs(fract(v / 1.4) - 0.5) * 1.4, 0.09, fv));
  walk *= 1.0 - 0.08 * joint;
  float inner = max(cov(abs(du - (wa * 0.5 + sw - 0.1)), 0.1, fu), cov(abs(dv - (ws * 0.5 + sw - 0.1)), 0.1, fv));
  walk *= 1.0 - 0.14 * inner; // shade where the sidewalk meets the building line
  float curb = max(cov(abs(du - wa * 0.5 - 0.1), 0.1, fu), cov(abs(dv - ws * 0.5 - 0.1), 0.1, fv));
  walk = mix(walk, C(138.0, 136.0, 130.0), curb);
  // asphalt + markings
  vec3 road = C(66.0, 68.0, 76.0) * (0.94 + 0.12 * n);
  vec3 W = C(236.0, 236.0, 236.0), Y = C(240.0, 196.0, 56.0);
  bool onAve = du < wa * 0.5, onSt = dv < ws * 0.5;
  if (onAve && !onSt) {
    float fx = dv - ws * 0.5;
    if (fx < 1.4) {
      road = mix(road, W, cov(abs(fx - 0.55), 0.4, fv) * dsh(u, 0.9, fu) * step(du, wa * 0.5 - 0.25));
      road = mix(road, W, cov(abs(fx - 1.22), 0.12, fv) * step(0.3, du) * step(du, wa * 0.5 - 0.25));
    } else road = mix(road, W, cov(abs(du - wa * 0.25 - 0.08), 0.09, fu) * dsh(v, 2.2, fv));
    road = mix(road, Y, cov(abs(du - 0.16), 0.08, fu));
    road *= 1.0 - 0.3 * cov(wa * 0.5 - du, 0.2, fu);
  } else if (onSt && !onAve) {
    float fx = du - wa * 0.5;
    if (fx < 1.1) road = mix(road, W, cov(abs(fx - 0.55), 0.4, fu) * dsh(v, 0.9, fv) * step(dv, ws * 0.5 - 0.25));
    else road = mix(road, W, cov(dv, 0.09, fv) * dsh(u, 2.0, fu));
    road *= 1.0 - 0.3 * cov(ws * 0.5 - dv, 0.2, fv);
  }
  float roadM = max(cov(du, wa * 0.5, fu), cov(dv, ws * 0.5, fv));
  float walkM = max(cov(du, wa * 0.5 + sw, fu), cov(dv, ws * 0.5 + sw, fv));
  return mix(mix(lot, walk, walkM), road, roadM);
}
// highways (type 1), avenues like Broadway (2) and runways (3), same priority rule as segHit()
vec3 segColor(vec3 base){
  int best = -1; float bp = 0.0, bt = 0.0, bl = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uSegN) break;
    vec4 A = uSegA[i], B = uSegB[i];
    vec2 r = vW.xz - A.xy; float t = dot(r, A.zw), lat = r.x * A.w - r.y * A.z;
    if (t < -B.y * 0.3 || t > B.x + B.y * 0.3 || abs(lat) > B.y) continue;
    float pr = B.z > 1.5 && B.z < 2.5 ? 1.0 : B.z > 2.5 ? 1.0 : 2.0;
    if (pr > bp) { bp = pr; best = i; bt = t; bl = lat; }
  }
  if (best < 0) return base;
  vec4 B = uSegB[best]; float hw = B.y, a = abs(bl), ty = B.z;
  float fa = max(fwidth(bl), 1e-3), ft = max(fwidth(bt), 1e-3), n = h21(floor(vW.xz * 5.33));
  vec3 W = vec3(236.0) / 255.0, Y = vec3(240.0, 196.0, 56.0) / 255.0;
  vec3 c;
  if (ty > 2.5) { // runway
    c = vec3(58.0, 60.0, 66.0) / 255.0 * (0.94 + 0.12 * n);
    c = mix(c, W, cov(abs(a - (hw - 0.32)), 0.12, fa));
    c = mix(c, W, cov(a, 0.14, fa) * dsh(bt, 3.0, ft));
  } else if (ty > 1.5) { // avenue
    c = vec3(66.0, 68.0, 76.0) / 255.0 * (0.94 + 0.12 * n);
    c = mix(c, Y, cov(abs(a - 0.16), 0.08, fa));
    c = mix(c, W, cov(abs(a - hw * 0.5), 0.09, fa) * dsh(bt, 2.2, ft));
  } else { // highway
    c = vec3(56.0, 58.0, 64.0) / 255.0 * (0.94 + 0.12 * n);
    c = mix(c, W, cov(abs(a - (hw - 0.3)), 0.1, fa));
    c = mix(c, Y, cov(abs(a - 0.16), 0.08, fa));
    c = mix(c, W, cov(abs(a - hw * 0.5), 0.09, fa) * dsh(bt, 2.4, ft));
  }
  return mix(base, c, cov(a, hw, fa));
}
void main(){
  vec3 base = uUseTex > 0.5 ? texture(uTex, vUV).rgb : uFlat;
  if (uUseTex > 0.5) {
    float a = texelFetch(uTex, clamp(ivec2(vUV * 256.0), ivec2(0), ivec2(255)), 0).a * 255.0;
    if (a < 210.0) base = gridColor(int(a / 32.0 + 0.5), base);
    else if (a < 240.0) base = segColor(base);
  }
  float sh = shadowAt(vS);
  vec3 c = base * (uAmb + uSunCol * uSun.y * sh);
  bool water = base.b > base.r * 1.6 && base.b > 0.55;
  if (water) { float w = sin(vW.x * 0.9 + uTime * 1.3) * sin(vW.z * 0.8 - uTime * 1.1); c += vec3(0.05, 0.06, 0.07) * step(0.86, w) * (1.0 - uNight * 0.7); }
  o = vec4(fogit(c, vW), 1.0);
}`;
const BILL_VS = `#version 300 es
layout(location=0) in vec2 aQ;
uniform mat4 uVP; uniform vec3 uPos; uniform vec2 uSize; uniform vec2 uN; uniform vec4 uUV; uniform vec4 uSlice; uniform vec3 uSliceDir; uniform float uBillSlice;
out vec2 vUV; out vec3 vW;
void main(){
  if (uSlice.w > 0.5 && uBillSlice > 0.5) { // same cap as BOX_VS: hide signs on buildings that are being sliced down
    vec2 rel = uPos.xz - uSlice.xy; float along = dot(rel, uSliceDir.xy), lat = abs(dot(rel, vec2(-uSliceDir.y, uSliceDir.x)));
    if (along < 1.0) { float cap = uSlice.z + (max(0.0, -along - 0.5) + 2.2 * max(0.0, lat - 1.6)) * uSliceDir.z; if (uPos.y + 0.5 * uSize.y > cap) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  }
  vec3 r = vec3(uN.y, 0.0, -uN.x); vec3 w = uPos + r * (aQ.x - 0.5) * uSize.x + vec3(0.0, (aQ.y - 0.5) * uSize.y, 0.0) + vec3(uN.x, 0.0, uN.y) * 0.02;
  vUV = vec2(uUV.x + aQ.x * uUV.z, uUV.y + (1.0 - aQ.y) * uUV.w); vW = w; gl_Position = uVP * vec4(w, 1.0); }`;
const BILL_FS = `#version 300 es
precision highp float; in vec2 vUV; in vec3 vW; out vec4 o; uniform sampler2D uTex; uniform vec3 uFogCol; uniform vec2 uFog; uniform vec3 uCam; uniform float uNight;
void main(){ vec3 c = texture(uTex, vUV).rgb * (uNight > 0.5 ? 1.15 : 0.95); float f = smoothstep(uFog.x, uFog.y, distance(vW, uCam)); o = vec4(mix(c, uFogCol, f), 1.0); }`;

const GFX = {
  gl: null, ok: false, shadowSize: 2048, shadowOn: true, night: 0, bevel: 0.13,
  init(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return false;
    this.gl = gl; this.canvas = canvas;
    const mk = (vs, fs) => {
      const p = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    this.pBox = mk(BOX_VS, BOX_FS); this.pDepth = mk(DEPTH_VS, DEPTH_FS); this.pSil = mk(BOX_VS, SIL_FS);
    this.pGround = mk(GROUND_VS, GROUND_FS); this.pBill = mk(BILL_VS, BILL_FS);
    this.pMesh = mk(MESH_VS, MESH_FS); this.pMeshD = mk(MESH_DEPTH_VS, DEPTH_FS); this.pMeshS = mk(MESH_VS, SIL_FS); this.meshes = {};
    // chamfered cube: 6 faces + 12 edge strips + 8 corner tris (44 tris). Vertex = pos, normal, inset-mask.
    const V = [], I = [];
    const vert = (p, n, inn) => { V.push(p[0], p[1], p[2], n[0], n[1], n[2], inn[0], inn[1], inn[2]); return V.length / 9 - 1; };
    const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    const tri = (a, b, c) => {
      // orient CCW from outside using a sample bevel
      const P3 = (k) => [V[k * 9] - V[k * 9 + 6] * 0.1, V[k * 9 + 1] - V[k * 9 + 7] * 0.1, V[k * 9 + 2] - V[k * 9 + 8] * 0.1];
      const A = P3(a), B = P3(b), C = P3(c);
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * V[a * 9 + 3] + cr[1] * V[a * 9 + 4] + cr[2] * V[a * 9 + 5] < 0) I.push(a, c, b); else I.push(a, b, c);
    };
    const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
    const ax = (k, v) => { const r = [0, 0, 0]; r[k] = v; return r; };
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { // faces
      const i = (k + 1) % 3, j = (k + 2) % 3, q = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0], m = [0, 0, 0]; p[k] = s * 0.5; p[i] = a * 0.5; p[j] = b * 0.5; m[i] = a; m[j] = b; q.push(vert(p, ax(k, s), m)); }
      quad(q[0], q[1], q[2], q[3]);
    }
    for (let k = 0; k < 3; k++) { // edges running along axis k
      const i = (k + 1) % 3, j = (k + 2) % 3;
      for (const si of [-1, 1]) for (const sj of [-1, 1]) {
        const n = [0, 0, 0]; n[i] = si; n[j] = sj; const nn = nrm(n), q = [];
        for (const [face, sk] of [[i, -1], [i, 1], [j, 1], [j, -1]]) {
          const p = [0, 0, 0], m = [0, 0, 0]; p[i] = si * 0.5; p[j] = sj * 0.5; p[k] = sk * 0.5; m[k] = sk;
          if (face === i) m[j] = sj; else m[i] = si;
          q.push(vert(p, nn, m));
        }
        quad(q[0], q[1], q[2], q[3]);
      }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { // corners
      const p = [sx * 0.5, sy * 0.5, sz * 0.5], n = nrm([sx, sy, sz]);
      tri(vert(p, n, [0, sy, sz]), vert(p, n, [sx, 0, sz]), vert(p, n, [sx, sy, 0]));
    }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    this.cubeVB = vb; this.cubeIB = ib; this.cubeN = I.length;
    // plain 12-tri cube (same vertex layout, no inset) for the shadow pass: bevels don't show in shadows
    { const PV = [], PI = []; let n = 0;
      for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) { const i = (k + 1) % 3, j = (k + 2) % 3;
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[k] = sg * 0.5; p[i] = a * 0.5; p[j] = b * 0.5; PV.push(p[0], p[1], p[2], 0, 0, 0, 0, 0, 0); }
        PI.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; }
      this.flatVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.flatVB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(PV), gl.STATIC_DRAW);
      this.flatIB = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.flatIB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(PI), gl.STATIC_DRAW); }
    // quad
    this.quadVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    this.quadVAO = gl.createVertexArray(); gl.bindVertexArray(this.quadVAO); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    // shadow map
    this.setShadowSize(this.shadowSize);
    // dynamic instance buffer
    this.dyn = this.makeInst(new Float32Array(INST * 4096), gl.DYNAMIC_DRAW); this.dynCap = 4096;
    this.pl = this.makeInst(new Float32Array(INST * 64), gl.DYNAMIC_DRAW); this.pl.count = 0;
    this.VP = M4.create(); this.LVP = M4.create(); this.V = M4.create(); this.Pm = M4.create(); this.LV = M4.create(); this.LP = M4.create();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    this.ok = true; return true;
  },
  setShadowSize(sz) {
    const gl = this.gl; this.shadowSize = sz;
    if (this.shTex) { gl.deleteTexture(this.shTex); gl.deleteFramebuffer(this.shFB); }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, sz, sz);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shTex = t; this.shFB = fb;
  },
  makeInst(data, usage) {
    const gl = this.gl;
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    const S = INST * 4;
    const mkVao = (vb, ib) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 3, gl.FLOAT, false, 36, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const at = (loc, n, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off); gl.vertexAttribDivisor(loc, 1); };
      at(2, 3, 0); at(3, 3, 12); at(4, 4, 24); at(5, 4, 40);
      gl.bindVertexArray(null);
      return vao;
    };
    return { vao: mkVao(this.cubeVB, this.cubeIB), svao: mkVao(this.flatVB, this.flatIB), buf, count: data.length / INST };
  },
  updateInst(obj, startInst, data) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, obj.buf); gl.bufferSubData(gl.ARRAY_BUFFER, startInst * INST * 4, data); },
  freeInst(obj) { const gl = this.gl; gl.deleteBuffer(obj.buf); gl.deleteVertexArray(obj.vao); gl.deleteVertexArray(obj.svao); },
  makeTex(data, w, h, nearest, mips) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (data instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    if (mips) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext && mips) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  },
  resize(scale) {
    const c = this.canvas, w = Math.max(1, Math.round(c.clientWidth * scale)), h = Math.max(1, Math.round(c.clientHeight * scale));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  },
  setDyn(data, count, pn) {
    const gl = this.gl; pn = Math.min(pn || 0, 64);
    const rest = count - pn;
    if (rest > this.dynCap) { this.freeInst(this.dyn); this.dynCap = Math.ceil(rest * 1.5); this.dyn = this.makeInst(new Float32Array(this.dynCap * INST), gl.DYNAMIC_DRAW); }
    if (rest > 0) { gl.bindBuffer(gl.ARRAY_BUFFER, this.dyn.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, pn * INST, rest * INST); }
    this.dyn.count = Math.max(0, rest);
    if (pn > 0) { gl.bindBuffer(gl.ARRAY_BUFFER, this.pl.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, pn * INST); }
    this.pl.count = pn;
  },
  // cam: {eye, target, fov, near, far}; light: {dir, center, half}
  // ---- vehicle meshes ----
  addMesh(name, verts) {
    const gl = this.gl, vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const mk = () => {
      const buf = gl.createBuffer(), cap = 64; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, cap * MINST * 4, gl.DYNAMIC_DRAW);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      const A = (loc, n, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 44, off); };
      A(0, 3, 0); A(1, 3, 12); A(2, 3, 24); A(3, 2, 36);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const I = (loc, n, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, MINST * 4, off); gl.vertexAttribDivisor(loc, 1); };
      I(4, 3, 0); I(5, 4, 12); I(6, 3, 28); I(7, 3, 40); I(8, 3, 52);
      gl.bindVertexArray(null);
      return { vao, buf, cap, data: new Float32Array(cap * MINST), n: 0 };
    };
    this.meshes[name] = { vb, nv: verts.length / 11, all: mk(), pl: mk() };
  },
  meshReset() { for (const k in this.meshes) { this.meshes[k].all.n = 0; this.meshes[k].pl.n = 0; } },
  // push one instance: pos, quat, scale, colour, flags (siren, dim, brake); player instances also get the silhouette pass
  meshPush(name, player, x, y, z, q, sx, sy, sz, col, f0, f1, f2) {
    const M = this.meshes[name]; if (!M) return;
    const L = player ? M.pl : M.all;
    if (L.n >= L.cap) { const nd = new Float32Array(L.cap * 2 * MINST); nd.set(L.data); L.data = nd; L.cap *= 2; L.grow = true; }
    const d = L.data, o = L.n * MINST;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = q[0]; d[o + 4] = q[1]; d[o + 5] = q[2]; d[o + 6] = q[3];
    d[o + 7] = sx; d[o + 8] = sy; d[o + 9] = sz; d[o + 10] = col[0]; d[o + 11] = col[1]; d[o + 12] = col[2]; d[o + 13] = f0 || 0; d[o + 14] = f1 || 0; d[o + 15] = f2 || 0;
    L.n++;
  },
  meshUpload() {
    const gl = this.gl;
    for (const k in this.meshes) for (const L of [this.meshes[k].all, this.meshes[k].pl]) {
      if (!L.n) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
      if (L.grow) { gl.bufferData(gl.ARRAY_BUFFER, L.cap * MINST * 4, gl.DYNAMIC_DRAW); L.grow = false; }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, L.data, 0, L.n * MINST);
    }
  },
  meshDraw(which) { // which: 'all' | 'pl' | 'both'
    const gl = this.gl;
    for (const k in this.meshes) { const M = this.meshes[k];
      for (const L of which === 'both' ? [M.all, M.pl] : [M[which]]) { if (!L.n) continue; gl.bindVertexArray(L.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, M.nv, L.n); this.stat.calls++; this.stat.tris = (this.stat.tris || 0) + M.nv / 3 * L.n; } }
  },
  render(S) {
    const gl = this.gl, c = this.canvas;
    const asp = c.width / c.height;
    M4.persp(this.Pm, S.fov, asp, S.near, S.far); M4.look(this.V, S.eye, S.target, [0, 1, 0]); M4.mul(this.VP, this.Pm, this.V);
    const planes = M4.planes(this.VP);
    // light
    const L = S.sunDir, hc = S.shadowHalf;
    const ctr = S.shadowCenter;
    const le = [ctr[0] + L[0] * 120, ctr[1] + L[1] * 120, ctr[2] + L[2] * 120];
    M4.look(this.LV, le, ctr, [0, 1, 0]);
    // texel snapping
    const ts = hc * 2 / this.shadowSize;
    const lx = this.LV[0] * ctr[0] + this.LV[4] * ctr[1] + this.LV[8] * ctr[2], ly = this.LV[1] * ctr[0] + this.LV[5] * ctr[1] + this.LV[9] * ctr[2];
    const sx = (Math.round(lx / ts) * ts - lx), sy = (Math.round(ly / ts) * ts - ly);
    M4.ortho(this.LP, -hc - sx, hc - sx, -hc - sy, hc - sy, 20, 240);
    M4.mul(this.LVP, this.LP, this.LV);
    const lplanes = M4.planes(this.LVP);
    let SH = false; // shadow pass: plain cube
    this.stat = this.stat || { inst: 0, calls: 0 }; if (!SH) { this.stat.inst = 0; this.stat.calls = 0; this.stat.tris = 0; }
    const draw = (o) => { if (!SH) { this.stat.inst += o.count; this.stat.calls++; } gl.bindVertexArray(SH ? o.svao : o.vao); gl.drawElementsInstanced(gl.TRIANGLES, SH ? 36 : this.cubeN, gl.UNSIGNED_SHORT, 0, o.count); };
    const drawPlayer = () => { if (this.pl.count) draw(this.pl); };
    const sliceU = (prog, on) => { if (prog.u.uSliceOn) gl.uniform1f(prog.u.uSliceOn, on); };
    const drawBoxes = (prog, pl, isShadow) => {
      sliceU(prog, 1);
      for (const ch of S.chunks) {
        if (!ch.gfx || !ch.gfx.count) continue;
        if (!M4.boxVisible(pl, ch.x0, -1, ch.z0, ch.x0 + CH, ch.maxH || 40, ch.z0 + CH)) continue;
        draw(ch.gfx);
      }
      sliceU(prog, 0);
      for (const st of S.statics) { if (st.count) draw(st); }
      if (this.dyn.count) draw(this.dyn);
      if (isShadow) drawPlayer();
    };
    // ---- shadow pass ----
    if (this.shadowOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFB); gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(this.pDepth.p); gl.uniformMatrix4fv(this.pDepth.u.uVP, false, this.LVP); gl.uniform1f(this.pDepth.u.uBevel, this.bevel);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); gl.disable(gl.CULL_FACE);
      SH = true; drawBoxes(this.pDepth, lplanes, true); SH = false;
      this.meshUpload(); gl.useProgram(this.pMeshD.p); gl.uniformMatrix4fv(this.pMeshD.u.uVP, false, this.LVP); this.meshDraw('both');
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.enable(gl.CULL_FACE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // ---- main pass ----
    gl.viewport(0, 0, c.width, c.height);
    const fc = S.fogCol; gl.clearColor(fc[0], fc[1], fc[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const setCommon = (pr) => {
      const u = pr.u;
      gl.uniformMatrix4fv(u.uVP, false, this.VP); if (u.uLVP) gl.uniformMatrix4fv(u.uLVP, false, this.LVP);
      if (u.uSun) gl.uniform3fv(u.uSun, S.sunDir); if (u.uSunCol) gl.uniform3fv(u.uSunCol, S.sunCol); if (u.uAmb) gl.uniform3fv(u.uAmb, S.amb);
      if (u.uFogCol) gl.uniform3fv(u.uFogCol, S.fogCol); if (u.uFog) gl.uniform2f(u.uFog, S.fog[0], S.fog[1]); if (u.uCam) gl.uniform3fv(u.uCam, S.eye);
      if (u.uNight) gl.uniform1f(u.uNight, this.night); if (u.uShadowOn) gl.uniform1f(u.uShadowOn, this.shadowOn ? 1 : 0); if (u.uTime) gl.uniform1f(u.uTime, S.time); if (u.uStudio) gl.uniform1f(u.uStudio, S.studio ? 1 : 0);
      if (u.uBevel) gl.uniform1f(u.uBevel, this.bevel);
      if (u.uSlice) { const sl = S.slice; gl.uniform4f(u.uSlice, sl ? sl.x : 0, sl ? sl.z : 0, sl ? sl.minH : 0, sl ? 1 : 0); gl.uniform3f(u.uSliceDir, sl ? sl.fx : 0, sl ? sl.fz : 1, sl ? sl.slope : 1); gl.uniform1f(u.uSliceOn, 0); }
      if (u.uShadow) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(u.uShadow, 1); }
    };
    // ground
    const pg = this.pGround; gl.useProgram(pg.p); setCommon(pg);
    if (!this.gridA && typeof GRIDS !== 'undefined') {
      this.gridA = new Float32Array(28); this.gridB = new Float32Array(28);
      for (let i = 1; i < 7; i++) { const g = GRIDS[i]; if (!g) continue; this.gridA.set([g.ox, g.oz, g.ex, g.ez], i * 4); this.gridB.set([g.A, g.S, g.wa, g.ws], i * 4); }
    }
    if (this.gridA) { gl.uniform4fv(pg.u['uGa[0]'] || pg.u.uGa, this.gridA); gl.uniform4fv(pg.u['uGb[0]'] || pg.u.uGb, this.gridB); }
    // nearest 32 non-bridge segments to the view centre (refreshed when the view moves 8+ units)
    if (typeof SEGS !== 'undefined') {
      const tx = S.target[0], tz = S.target[2];
      if (!this.segA || Math.hypot(tx - this.segX, tz - this.segZ) > 8) {
        this.segX = tx; this.segZ = tz; this.segA = new Float32Array(128); this.segB = new Float32Array(128);
        const near = [];
        for (const sg of SEGS) {
          if (sg.type === SEG_BRIDGE) continue;
          let t = (tx - sg.ax) * sg.dx + (tz - sg.az) * sg.dz; t = Math.max(0, Math.min(sg.len, t));
          const d = Math.hypot(tx - sg.ax - sg.dx * t, tz - sg.az - sg.dz * t) - sg.hw;
          if (d < 140) near.push([d, sg]);
        }
        near.sort((a, b) => a[0] - b[0]);
        this.segN = Math.min(32, near.length);
        for (let i = 0; i < this.segN; i++) { const sg = near[i][1]; this.segA.set([sg.ax, sg.az, sg.dx, sg.dz], i * 4); this.segB.set([sg.len, sg.hw, sg.type === SEG_HWY ? 1 : sg.type === SEG_AVE ? 2 : 3, 0], i * 4); }
      }
      gl.uniform4fv(pg.u['uSegA[0]'], this.segA); gl.uniform4fv(pg.u['uSegB[0]'], this.segB); gl.uniform1i(pg.u.uSegN, this.segN);
    }
    gl.bindVertexArray(this.quadVAO); gl.uniform1i(pg.u.uTex, 0); gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(pg.u.uUseTex, 0); gl.uniform3fv(pg.u.uFlat, S.waterCol);
    gl.disable(gl.CULL_FACE);
    gl.uniform4f(pg.u.uChunk, S.target[0] - 1500, S.target[2] - 1500, 3000, -0.02); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.uniform1f(pg.u.uUseTex, 1);
    for (const ch of S.chunks) {
      if (!ch.tex) continue;
      if (!M4.boxVisible(planes, ch.x0, -0.1, ch.z0, ch.x0 + CH, 0.1, ch.z0 + CH)) continue;
      gl.bindTexture(gl.TEXTURE_2D, ch.tex); gl.uniform4f(pg.u.uChunk, ch.x0, ch.z0, CH, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.enable(gl.CULL_FACE);
    // boxes
    if (!this.shadowOn) this.meshUpload();
    const pb = this.pBox; gl.useProgram(pb.p); setCommon(pb);
    drawBoxes(pb, planes, false);
    const pm = this.pMesh; gl.useProgram(pm.p); setCommon(pm); this.meshDraw('all');
    // billboards
    if (S.bills.length) {
      const pl = this.pBill; gl.useProgram(pl.p); gl.uniformMatrix4fv(pl.u.uVP, false, this.VP);
      gl.uniform3fv(pl.u.uFogCol, S.fogCol); gl.uniform2f(pl.u.uFog, S.fog[0], S.fog[1]); gl.uniform3fv(pl.u.uCam, S.eye); gl.uniform1f(pl.u.uNight, this.night);
      { const sl = S.slice; gl.uniform4f(pl.u.uSlice, sl ? sl.x : 0, sl ? sl.z : 0, sl ? sl.minH : 0, sl ? 1 : 0); gl.uniform3f(pl.u.uSliceDir, sl ? sl.fx : 0, sl ? sl.fz : 1, sl ? sl.slope : 1); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.billTex); gl.uniform1i(pl.u.uTex, 0);
      gl.bindVertexArray(this.quadVAO); gl.disable(gl.CULL_FACE);
      for (const b of S.bills) {
        gl.uniform3f(pl.u.uPos, b[0], b[1], b[2]); gl.uniform2f(pl.u.uSize, b[3], b[4]); gl.uniform2f(pl.u.uN, b[5], b[6]);
        const k = b[7] | 0, col = k % 2, row = k >> 1; gl.uniform4f(pl.u.uUV, col * 0.5, row * 0.25, 0.5, 0.25);
        gl.uniform1f(pl.u.uBillSlice, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.enable(gl.CULL_FACE);
    }
    // player: silhouette where hidden by the world, then the car itself
    if (S.sil) {
      const ps = this.pSil; gl.useProgram(ps.p); setCommon(ps);
      gl.uniform4fv(ps.u.uSil, S.sil.col);
      gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (this.pl.count) drawPlayer();
      const pms = this.pMeshS; gl.useProgram(pms.p); gl.uniformMatrix4fv(pms.u.uVP, false, this.VP); gl.uniform4fv(pms.u.uSil, S.sil.col); this.meshDraw('pl');
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (this.pl.count) { gl.useProgram(pb.p); drawPlayer(); }
    gl.useProgram(pm.p); this.meshDraw('pl');
    gl.bindVertexArray(null);
  }
};
