// ============================================================
//  Minimal WebGL2 voxel renderer (no external libraries)
// ============================================================
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

const BOX_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScl; layout(location=4) in vec4 iRot; layout(location=5) in vec4 iCol;
uniform mat4 uVP; uniform mat4 uLVP;
out vec3 vN; out vec3 vCol; out vec3 vL; out vec3 vW; out vec4 vS; out vec3 vLN; out vec3 vScl; flat out float vMat; flat out float vSeed;
vec3 qr(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  vec3 lp = aPos * iScl; vec3 w = qr(iRot, lp) + iPos;
  vN = qr(iRot, aNrm); vCol = iCol.rgb; vMat = iCol.a; vL = lp; vLN = aNrm; vScl = iScl; vW = w;
  vSeed = fract(iPos.x*0.1231 + iPos.z*0.3117 + iPos.y*0.071);
  vS = uLVP * vec4(w, 1.0);
  gl_Position = uVP * vec4(w, 1.0);
}`;
const LIGHT_FS = `
uniform highp sampler2DShadow uShadow; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFogCol; uniform vec2 uFog; uniform vec3 uCam; uniform float uNight; uniform float uShadowOn; uniform float uTime;
uniform vec4 uCut;
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
in vec3 vN; in vec3 vCol; in vec3 vL; in vec3 vW; in vec4 vS; in vec3 vLN; in vec3 vScl; flat in float vMat; flat in float vSeed;
out vec4 o;
${LIGHT_FS}
void main(){
  if (uCut.w > 0.0 && vW.y > 0.7 && (vScl.y > 1.5 || vMat > 0.5 && vMat < 1.5)) {
    vec3 cp = uCut.xyz - uCam; float t = dot(vW - uCam, cp) / dot(cp, cp);
    if (t > 0.05 && t < 0.97) {
      float d = length(vW - (uCam + cp * t)); float r = uCut.w * smoothstep(0.25, 0.9, t);
      if (d < r) {
        float bx = mod(floor(gl_FragCoord.x), 2.0), by = mod(floor(gl_FragCoord.y), 2.0);
        if (d < r * 0.7) { if (bx + by > 0.5) discard; } else if (bx == by) discard;
      }
    }
  }
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
  if (m > 1.5 && m < 2.5) emi = base * (uNight > 0.5 ? 1.0 : 0.55);
  if (m > 4.5 && m < 5.5 && uNight > 0.5) emi = vec3(1.0, 0.9, 0.6);
  float sh = shadowAt(vS);
  float ndl = max(dot(n, uSun), 0.0);
  float side = 0.92 + 0.08 * n.y;
  vec3 c = base * (uAmb * side + uSunCol * ndl * sh) + emi;
  if (m > 5.5 && m < 6.5) { vec3 v = normalize(uCam - vW); c += 0.35 * pow(max(dot(reflect(-uSun, n), v), 0.0), 12.0) * sh; }
  if (m > 2.5 && m < 3.5) c = base; // unlit flat (UI-ish markers)
  o = vec4(fogit(c, vW), 1.0);
}`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScl; layout(location=4) in vec4 iRot;
uniform mat4 uVP;
vec3 qr(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){ gl_Position = uVP * vec4(qr(iRot, aPos * iScl) + iPos, 1.0); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; void main(){}`;
const SIL_FS = `#version 300 es
precision mediump float; uniform vec4 uSil; out vec4 o; void main(){ o = uSil; }`;
const GROUND_VS = `#version 300 es
layout(location=0) in vec2 aQ;
uniform mat4 uVP; uniform mat4 uLVP; uniform vec4 uChunk;
out vec2 vUV; out vec3 vW; out vec4 vS;
void main(){ vec3 w = vec3(uChunk.x + aQ.x * uChunk.z, uChunk.w, uChunk.y + aQ.y * uChunk.z); vUV = aQ; vW = w; vS = uLVP * vec4(w, 1.0); gl_Position = uVP * vec4(w, 1.0); }`;
const GROUND_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vW; in vec4 vS; out vec4 o;
uniform sampler2D uTex; uniform vec3 uFlat; uniform float uUseTex;
${LIGHT_FS}
void main(){
  vec3 base = uUseTex > 0.5 ? texture(uTex, vUV).rgb : uFlat;
  float sh = shadowAt(vS);
  vec3 c = base * (uAmb + uSunCol * uSun.y * sh);
  bool water = base.b > base.r * 1.6 && base.b > 0.55;
  if (water) { float w = sin(vW.x * 0.9 + uTime * 1.3) * sin(vW.z * 0.8 - uTime * 1.1); c += vec3(0.05, 0.06, 0.07) * step(0.86, w) * (1.0 - uNight * 0.7); }
  o = vec4(fogit(c, vW), 1.0);
}`;
const BILL_VS = `#version 300 es
layout(location=0) in vec2 aQ;
uniform mat4 uVP; uniform vec3 uPos; uniform vec2 uSize; uniform vec2 uN; uniform vec4 uUV;
out vec2 vUV; out vec3 vW;
void main(){ vec3 r = vec3(uN.y, 0.0, -uN.x); vec3 w = uPos + r * (aQ.x - 0.5) * uSize.x + vec3(0.0, (aQ.y - 0.5) * uSize.y, 0.0) + vec3(uN.x, 0.0, uN.y) * 0.02;
  vUV = vec2(uUV.x + aQ.x * uUV.z, uUV.y + (1.0 - aQ.y) * uUV.w); vW = w; gl_Position = uVP * vec4(w, 1.0); }`;
const BILL_FS = `#version 300 es
precision highp float; in vec2 vUV; in vec3 vW; out vec4 o; uniform sampler2D uTex; uniform vec3 uFogCol; uniform vec2 uFog; uniform vec3 uCam; uniform float uNight;
void main(){ vec3 c = texture(uTex, vUV).rgb * (uNight > 0.5 ? 1.15 : 0.95); float f = smoothstep(uFog.x, uFog.y, distance(vW, uCam)); o = vec4(mix(c, uFogCol, f), 1.0); }`;

const GFX = {
  gl: null, ok: false, shadowSize: 2048, shadowOn: true, night: 0,
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
    // cube
    const P = [], N = [], I = [];
    const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const f of faces) {
      const [nx, ny, nz] = f; const u = ny !== 0 ? [1, 0, 0] : [0, 1, 0]; const v = [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]];
      const b = P.length / 3;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        P.push(nx * 0.5 + (u[0] * a + v[0] * c) * 0.5, ny * 0.5 + (u[1] * a + v[1] * c) * 0.5, nz * 0.5 + (u[2] * a + v[2] * c) * 0.5); N.push(nx, ny, nz);
      }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    // ensure CCW from outside
    for (let k = 0; k < I.length; k += 3) {
      const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * N[a] + cr[1] * N[a + 1] + cr[2] * N[a + 2] < 0) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
    }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    const inter = new Float32Array(24 * 6); for (let i = 0; i < 24; i++) { inter.set(P.slice(i * 3, i * 3 + 3), i * 6); inter.set(N.slice(i * 3, i * 3 + 3), i * 6 + 3); }
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    this.cubeVB = vb; this.cubeIB = ib;
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
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVB);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIB);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    const S = INST * 4;
    const at = (loc, n, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off); gl.vertexAttribDivisor(loc, 1); };
    at(2, 3, 0); at(3, 3, 12); at(4, 4, 24); at(5, 4, 40);
    gl.bindVertexArray(null);
    return { vao, buf, count: data.length / INST };
  },
  updateInst(obj, startInst, data) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, obj.buf); gl.bufferSubData(gl.ARRAY_BUFFER, startInst * INST * 4, data); },
  freeInst(obj) { const gl = this.gl; gl.deleteBuffer(obj.buf); gl.deleteVertexArray(obj.vao); },
  makeTex(data, w, h, nearest, mips) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (data instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    if (mips) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext && mips) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
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
    const drawPlayer = () => { if (this.pl.count) { gl.bindVertexArray(this.pl.vao); gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, this.pl.count); } };
    const drawBoxes = (prog, pl, isShadow) => {
      for (const ch of S.chunks) {
        if (!ch.gfx || !ch.gfx.count) continue;
        if (!M4.boxVisible(pl, ch.x0, -1, ch.z0, ch.x0 + CH, ch.maxH || 40, ch.z0 + CH)) continue;
        gl.bindVertexArray(ch.gfx.vao); gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, ch.gfx.count);
      }
      for (const st of S.statics) { if (!st.count) continue; gl.bindVertexArray(st.vao); gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, st.count); }
      if (this.dyn.count) { gl.bindVertexArray(this.dyn.vao); gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, this.dyn.count); }
      if (isShadow) drawPlayer();
    };
    // ---- shadow pass ----
    if (this.shadowOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFB); gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(this.pDepth.p); gl.uniformMatrix4fv(this.pDepth.u.uVP, false, this.LVP);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); gl.disable(gl.CULL_FACE);
      drawBoxes(this.pDepth, lplanes, true);
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
      if (u.uNight) gl.uniform1f(u.uNight, this.night); if (u.uShadowOn) gl.uniform1f(u.uShadowOn, this.shadowOn ? 1 : 0); if (u.uTime) gl.uniform1f(u.uTime, S.time); if (u.uCut) gl.uniform4fv(u.uCut, S.cut || [0, 0, 0, 0]);
      if (u.uShadow) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(u.uShadow, 1); }
    };
    // ground
    const pg = this.pGround; gl.useProgram(pg.p); setCommon(pg);
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
    const pb = this.pBox; gl.useProgram(pb.p); setCommon(pb);
    drawBoxes(pb, planes, false);
    // billboards
    if (S.bills.length) {
      const pl = this.pBill; gl.useProgram(pl.p); gl.uniformMatrix4fv(pl.u.uVP, false, this.VP);
      gl.uniform3fv(pl.u.uFogCol, S.fogCol); gl.uniform2f(pl.u.uFog, S.fog[0], S.fog[1]); gl.uniform3fv(pl.u.uCam, S.eye); gl.uniform1f(pl.u.uNight, this.night);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.billTex); gl.uniform1i(pl.u.uTex, 0);
      gl.bindVertexArray(this.quadVAO); gl.disable(gl.CULL_FACE);
      for (const b of S.bills) {
        gl.uniform3f(pl.u.uPos, b[0], b[1], b[2]); gl.uniform2f(pl.u.uSize, b[3], b[4]); gl.uniform2f(pl.u.uN, b[5], b[6]);
        const k = b[7] | 0, col = k % 2, row = k >> 1; gl.uniform4f(pl.u.uUV, col * 0.5, row * 0.25, 0.5, 0.25);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.enable(gl.CULL_FACE);
    }
    // player: silhouette where hidden by the world, then the car itself
    if (S.sil && this.pl.count) {
      const ps = this.pSil; gl.useProgram(ps.p); gl.uniformMatrix4fv(ps.u.uVP, false, this.VP); gl.uniformMatrix4fv(ps.u.uLVP, false, this.LVP);
      gl.uniform4fv(ps.u.uSil, S.sil.col);
      gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawPlayer();
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (this.pl.count) { gl.useProgram(pb.p); drawPlayer(); }
    gl.bindVertexArray(null);
  }
};
