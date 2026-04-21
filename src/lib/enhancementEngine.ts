/**
 * LumenAI Enhancement Engine
 * ---------------------------
 * A WebGL2 fragment shader inspired by Zero-DCE (Zero-reference Deep Curve
 * Estimation) and Retinex-based pack/unpack low-light enhancement.
 *
 * The "pack/unpack" idea from your Python project:
 *   pack:   take a noisy low-light image and split into spatial sub-bands
 *           (we approximate this with multi-scale sampling in the shader)
 *   unpack: reconstruct after applying learned light-enhancement curves
 *
 * Here we apply, per-pixel and entirely on the GPU:
 *   1. Multi-iteration LE curve:  I_n = I + alpha * I * (1 - I)
 *      (Zero-DCE Eq. 2 — high-order curve that keeps gradients monotonic)
 *   2. A lightweight single-scale Retinex contrast lift on the luminance.
 *   3. White-balance (temperature/tint) and saturation in linear space.
 *   4. Soft denoise via a tiny separable bilateral approximation.
 *
 * Runs on any <canvas> at native frame rate, so the same pipeline powers
 * the photo preview, the video player, AND the live webcam feed.
 */

export interface EnhancementSettings {
  /** Curve strength α — overall brightening of dark regions (0..1) */
  alpha: number;
  /** Number of LE-curve iterations (1..8). More = stronger lift on shadows. */
  iterations: number;
  /** Retinex contrast lift (0..1) */
  retinex: number;
  /** Saturation multiplier (0..2, 1 = neutral) */
  saturation: number;
  /** Color temperature shift (-1..1, warm → cool) */
  temperature: number;
  /** Denoise strength (0..1) */
  denoise: number;
  /** Output gamma (0.4..1.6, 1 = neutral) */
  gamma: number;
}

export const DEFAULT_SETTINGS: EnhancementSettings = {
  alpha: 0.45,
  iterations: 4,
  retinex: 0.35,
  saturation: 1.15,
  temperature: 0.05,
  denoise: 0.25,
  gamma: 0.95,
};

const VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform vec2  u_texel;       // 1/width, 1/height
uniform float u_alpha;
uniform int   u_iters;
uniform float u_retinex;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_denoise;
uniform float u_gamma;

// sRGB <-> linear
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSRGB  (vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

// Zero-DCE high-order light-enhancement curve: LE(I) = I + alpha * I * (1 - I)
vec3 leCurve(vec3 c, float a) { return c + a * c * (1.0 - c); }

// Tiny 5-tap bilateral denoise on luminance (separable approximation)
vec3 bilateral(sampler2D tex, vec2 uv, vec2 texel, float strength) {
  if (strength <= 0.001) return texture(tex, uv).rgb;
  vec3 center = texture(tex, uv).rgb;
  float lc = dot(center, vec3(0.2126, 0.7152, 0.0722));
  vec3 sum = center; float wsum = 1.0;
  vec2 offs[4] = vec2[4](
    vec2( texel.x, 0.0), vec2(-texel.x, 0.0),
    vec2(0.0,  texel.y), vec2(0.0, -texel.y)
  );
  for (int i = 0; i < 4; i++) {
    vec3 s = texture(tex, uv + offs[i] * 2.0).rgb;
    float ls = dot(s, vec3(0.2126, 0.7152, 0.0722));
    float w = exp(-abs(ls - lc) * 12.0);
    sum += s * w; wsum += w;
  }
  return mix(center, sum / wsum, clamp(strength, 0.0, 1.0));
}

void main() {
  vec3 c = bilateral(u_tex, v_uv, u_texel, u_denoise);
  c = clamp(c, 0.0, 1.0);
  c = toLinear(c);

  // 1) Iterated LE curve (pack/unpack analog: iterative refinement)
  for (int i = 0; i < 8; i++) {
    if (i >= u_iters) break;
    c = leCurve(c, u_alpha);
  }

  // 2) Retinex-style local contrast on luminance
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 blurApprox = vec3(0.0);
  vec2 r = u_texel * 6.0;
  blurApprox += texture(u_tex, v_uv + vec2( r.x,  r.y)).rgb;
  blurApprox += texture(u_tex, v_uv + vec2(-r.x,  r.y)).rgb;
  blurApprox += texture(u_tex, v_uv + vec2( r.x, -r.y)).rgb;
  blurApprox += texture(u_tex, v_uv + vec2(-r.x, -r.y)).rgb;
  blurApprox = toLinear(blurApprox * 0.25);
  float Lblur = max(dot(blurApprox, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
  float retinexL = clamp(L / Lblur, 0.5, 2.0);
  c *= mix(1.0, retinexL, u_retinex);

  // 3) Saturation in linear space
  float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(gray), c, u_saturation);

  // 4) Temperature: shift R/B
  c.r += u_temperature * 0.08;
  c.b -= u_temperature * 0.08;

  // 5) Tone map (Reinhard) to keep highlights in range
  c = c / (1.0 + c);
  c *= 1.4;

  c = toSRGB(c);
  c = pow(max(c, 0.0), vec3(u_gamma));
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class EnhancementEngine {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private width = 0;
  private height = 0;
  public settings: EnhancementSettings = { ...DEFAULT_SETTINGS };

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error("WebGL2 is not supported in this browser");
    this.gl = gl;

    const vs = this.compile(gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "a_pos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Program link failed: " + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    for (const name of [
      "u_tex","u_texel","u_alpha","u_iters","u_retinex",
      "u_saturation","u_temperature","u_denoise","u_gamma",
    ]) {
      this.uniforms[name] = gl.getUniformLocation(prog, name);
    }
  }

  private compile(type: number, src: string): WebGLShader {
    const s = this.gl.createShader(type)!;
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(s);
      throw new Error("Shader compile failed: " + log);
    }
    return s;
  }

  /** Upload a frame source (image, video, or canvas) and resize the canvas. */
  upload(src: TexImageSource, w: number, h: number) {
    const gl = this.gl;
    if (w !== this.width || h !== this.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.width = w;
      this.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  render() {
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.uniforms.u_tex, 0);
    gl.uniform2f(this.uniforms.u_texel, 1 / Math.max(1, this.width), 1 / Math.max(1, this.height));
    gl.uniform1f(this.uniforms.u_alpha, this.settings.alpha);
    gl.uniform1i(this.uniforms.u_iters, Math.round(this.settings.iterations));
    gl.uniform1f(this.uniforms.u_retinex, this.settings.retinex);
    gl.uniform1f(this.uniforms.u_saturation, this.settings.saturation);
    gl.uniform1f(this.uniforms.u_temperature, this.settings.temperature);
    gl.uniform1f(this.uniforms.u_denoise, this.settings.denoise);
    gl.uniform1f(this.uniforms.u_gamma, this.settings.gamma);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Convenience: upload + render in one call. */
  process(src: TexImageSource, w: number, h: number) {
    this.upload(src, w, h);
    this.render();
  }

  /** Export current canvas as a Blob (PNG by default). */
  toBlob(type = "image/png", quality = 0.92): Promise<Blob | null> {
    return new Promise((res) => this.canvas.toBlob(res, type, quality));
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.tex);
    gl.deleteProgram(this.prog);
    gl.deleteVertexArray(this.vao);
  }
}
