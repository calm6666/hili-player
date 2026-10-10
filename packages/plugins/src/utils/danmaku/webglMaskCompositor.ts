/**
 * WebGL 遮罩合成器
 * ============================================================
 * 用 WebGL shader 把「弹幕画面纹理」和「防挡遮罩纹理」合成，替代 Canvas 2D 的
 * `destination-in`（读-改-写）全画布合成。
 *
 * 弹幕画布（2D）和遮罩画布（2D）各自作为纹理上传，片元着色器里做 alpha 相乘：
 *   遮罩 alpha = 0 表示人物（隐藏弹幕），= 1 表示背景（显示弹幕）。
 *
 * 弹幕纹理是浏览器 2D 画布输出的预乘 alpha（premultiplied），因此 RGB 也要一起
 * 乘以遮罩 alpha，配 `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`。
 */

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  // 翻转 V：canvas 纹理上传后是上下颠倒的，这里翻转回来
  v_uv = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_danmaku;
uniform sampler2D u_mask;
uniform float u_hasMask;
void main() {
  vec4 d = texture2D(u_danmaku, v_uv);
  if (u_hasMask < 0.5) {
    gl_FragColor = d;
  } else {
    float m = texture2D(u_mask, v_uv).a;
    gl_FragColor = vec4(d.rgb * m, d.a * m);
  }
}
`;

export class WebGLMaskCompositor {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private danmakuTex: WebGLTexture | null = null;
  private maskTex: WebGLTexture | null = null;
  private uDanmaku: WebGLUniformLocation | null = null;
  private uMask: WebGLUniformLocation | null = null;
  private uHasMask: WebGLUniformLocation | null = null;
  private posLoc = -1;

  private width = 0;
  private height = 0;

  constructor(private canvas: HTMLCanvasElement) {}

  /** 初始化 WebGL 上下文 + shader，失败返回 false（调用方回退 2D）。可重复调用（幂等） */
  init(width: number, height: number): boolean {
    this.width = width;
    this.height = height;

    // 已初始化过，只更新尺寸即可
    if (this.gl && this.program) return true;

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return false;
    this.gl = gl;

    const program = this.compile(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return false;
    this.program = program;

    // 全屏 quad（两个三角形）
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    this.quadBuffer = quad;

    this.posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uDanmaku = gl.getUniformLocation(program, 'u_danmaku');
    this.uMask = gl.getUniformLocation(program, 'u_mask');
    this.uHasMask = gl.getUniformLocation(program, 'u_hasMask');

    this.danmakuTex = this.createTexture(gl);
    this.maskTex = this.createTexture(gl);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  /** 更新逻辑尺寸（DPR 变化时用） */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** 合成：把弹幕画布和遮罩画布合成到 WebGL 画布 */
  render(danmakuSource: HTMLCanvasElement, maskSource: HTMLCanvasElement | null): void {
    const gl = this.gl;
    if (!gl || !this.program || this.posLoc < 0) return;

    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);

    // 上传弹幕纹理（2D 画布已是预乘 alpha，这里不要二次预乘）
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.danmakuTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, danmakuSource);
    gl.uniform1i(this.uDanmaku, 0);

    const hasMask = !!maskSource;
    if (hasMask && maskSource) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskSource);
      gl.uniform1i(this.uMask, 1);
    }
    gl.uniform1f(this.uHasMask, hasMask ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
      if (this.danmakuTex) gl.deleteTexture(this.danmakuTex);
      if (this.maskTex) gl.deleteTexture(this.maskTex);
    }
    this.gl = null;
    this.program = null;
  }

  private createTexture(gl: WebGLRenderingContext): WebGLTexture | null {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  private compile(
    gl: WebGLRenderingContext,
    vsSource: string,
    fsSource: string
  ): WebGLProgram | null {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('[WebGLMaskCompositor] VS 编译失败:', gl.getShaderInfoLog(vs));
      return null;
    }

    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('[WebGLMaskCompositor] FS 编译失败:', gl.getShaderInfoLog(fs));
      return null;
    }

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[WebGLMaskCompositor] program 链接失败:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }
}
