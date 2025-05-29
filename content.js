class AnimeEnhancer {
  static init() {
    this.enhanceAllVideos();
    new MutationObserver(this.handleMutations.bind(this)).observe(
      document.body,
      { childList: true, subtree: true }
    );
  }

  static handleMutations(mutations) {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === "VIDEO" || node.querySelector("video")) {
          this.enhanceAllVideos();
        }
      });
    });
  }

  static enhanceAllVideos() {
    document.querySelectorAll("video").forEach((video) => {
      if (!video.dataset.animeEnhanced && this.isAnimeContent(video)) {
        video.dataset.animeEnhanced = "true";
        new AnimeVideoProcessor(video);
      }
    });
  }

  static isAnimeContent(video) {
    const src = video.src || video.currentSrc || "";
    const animeKeywords = [
      "anime",
      "manga",
      "otaku",
      "crunchyroll",
      "funimation",
      "hidive",
      "wakanim",
      "9anime",
    ];
    const isAnimeSource = animeKeywords.some(
      (kw) => kw && src.toLowerCase().includes(kw.toLowerCase())
    );

    const pageContent = document.body.innerText.toLowerCase();
    const isAnimePage = animeKeywords.some((kw) =>
      pageContent.includes(kw.toLowerCase())
    );

    return isAnimeSource || isAnimePage || this.detectArtStyle(video);
  }

  static async detectArtStyle(video) {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth || 100;
      canvas.height = video.videoHeight || 100;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return this.isAnimeStyle(imageData);
    } catch (e) {
      console.error("Art style detection error:", e);
      return false;
    }
  }

  // maybe I revriten isAnimeStyle
  static isAnimeStyle(imageData) {
    const data = imageData.data;
    let edgeCount = 0;
    let flatAreas = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];

      if (i > 4) {
        const prevR = data[i - 4],
          prevG = data[i - 3],
          prevB = data[i - 2];
        const diff =
          Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
        if (diff > 100) edgeCount++;
      }

      const nextR = data[i + 4],
        nextG = data[i + 5],
        nextB = data[i + 6];
      if (
        Math.abs(r - nextR) < 10 &&
        Math.abs(g - nextG) < 10 &&
        Math.abs(b - nextB) < 10
      ) {
        flatAreas++;
      }
    }

    return edgeCount > 100 && flatAreas > 50;
  }
}

class AnimeVideoProcessor {
  constructor(video) {
    this.video = video;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.outputCanvas = document.createElement("canvas");
    this.outputCtx = this.outputCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    this.setupVideo();
    this.initWebGL();
    this.loadModels().then(() => {
      this.startProcessing();
    });
  }

  setupVideo() {
    this.video.style.display = "none";
    this.video.parentNode.insertBefore(this.outputCanvas, this.video);

    this.video.addEventListener("resize", this.updateCanvasSize.bind(this));
    this.updateCanvasSize();
  }

  updateCanvasSize() {
    const width = this.video.videoWidth || this.video.clientWidth;
    const height = this.video.videoHeight || this.video.clientHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;

    this.outputCanvas.style.width = "100%";
    this.outputCanvas.style.height = "100%";
    this.outputCanvas.style.objectFit = "contain";
  }

  renderWebGL() {
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.video
    );

    this.gl.useProgram(this.program);

    this.gl.uniform1i(this.uniformLocations.u_image, 0);
    this.gl.uniform2f(
      this.uniformLocations.u_resolution,
      this.gl.canvas.width,
      this.gl.canvas.height
    );
    this.gl.uniform1f(
      this.uniformLocations.u_sharpness,
      this.settings.sharpness
    );
    this.gl.uniform1f(
      this.uniformLocations.u_edgeEnhance,
      this.settings.edgeEnhance
    );
    this.gl.uniform1f(this.uniformLocations.u_time, performance.now() / 1000);

    this.gl.enableVertexAttribArray(this.positionAttributeLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.vertexAttribPointer(
      this.positionAttributeLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    this.gl.enableVertexAttribArray(this.texCoordAttributeLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.vertexAttribPointer(
      this.texCoordAttributeLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  async initWebGL() {
    try {
      this.glCanvas = document.createElement("canvas");
      this.gl =
        this.glCanvas.getContext("webgl2") ||
        this.glCanvas.getContext("experimental-webgl2");

      if (!this.gl) {
        console.warn("WebGL2 not available, falling back to canvas");
        this.useWebGL = false;
        return;
      }

      this.useWebGL = true;
      this.initShaders();
    } catch (e) {
      console.error("WebGL init failed:", e);
      this.useWebGL = false;
    }
  }

  initShaders() {
    const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord = a_texCoord;
            }
        `;

    const fragmentShaderSource = `
           precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform float u_sharpness; 
            uniform float u_edgeEnhance; 

            float isAnimeColor(vec3 color) {
            
                vec3 diff = abs(color - pow(color, vec3(0.9)));
                return step(0.2, max(diff.r, max(diff.g, diff.b));
            }

            vec4 edgeDetect(vec2 coord) {
                vec2 pixelSize = 1.0 / u_resolution;
                float edgeStrength = 0.0;

                float kernel[9];
                kernel[0] = -1.0; kernel[1] = -2.0; kernel[2] = -1.0;
                kernel[3] =  0.0; kernel[4] =  0.0; kernel[5] =  0.0;
                kernel[6] =  1.0; kernel[7] =  2.0; kernel[8] =  1.0;

                float gray[9];
                    for (int i = 0; i < 9; i++) {
                        int x = i % 3 - 1;
                        int y = i / 3 - 1;
                        vec2 offset = vec2(float(x), float(y)) * pixelSize * 2.0;
                        vec3 col = texture2D(u_image, coord + offset).rgb;
                        gray[i] = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
                    }

                    float gx = 0.0;
                    float gy = 0.0;
                    for (int i = 0; i < 9; i++) {
                        gx += kernel[i] * gray[i];
                        gy += kernel[(i/3)*3 + (i%3)] * gray[i];
                    }
                    
                    edgeStrength = length(vec2(gx, gy)) * u_edgeEnhance;
                    return vec4(vec3(edgeStrength), 1.0);
                    }

                    void main() {
                        vec4 originalColor = texture2D(u_image, v_texCoord);
                        vec3 color = originalColor.rgb;

                        color = pow(color, vec3(0.9));

                        if (u_edgeEnhance > 0.01) {
                            vec4 edges = edgeDetect(v_texCoord);
                            color = mix(color, edges.rgb, edges.a * 0.5);
                        }
                        
                        if (u_sharpness > 0.01 && isAnimeColor(color) > 0.5) {
                            vec2 pixelSize = 1.0 / u_resolution;
                            vec4 sharp = -1.0 * texture2D(u_image, v_texCoord + vec2(-pixelSize.x, -pixelSize.y));
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(0.0, -pixelSize.y));
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(pixelSize.x, -pixelSize.y));
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(-pixelSize.x, 0.0));
                            sharp += 9.0 * texture2D(u_image, v_texCoord);
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(pixelSize.x, 0.0));
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(-pixelSize.x, pixelSize.y));
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(0.0, pixelSize.y));
                            sharp += -1.0 * texture2D(u_image, v_texCoord + vec2(pixelSize.x, pixelSize.y));

                            color = mix(color, sharp.rgb, u_sharpness * 0.1);
                    }
                    
                    float noise = (fract(sin(dot(v_texCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
                    color += vec3(noise);
            
                    gl_FragColor = vec4(color, originalColor.a);
                }
            `;

    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vertexShaderSource);
    this.gl.compileShader(vertexShader);

    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Vertex shader error:",
        this.gl.getShaderInfoLog(vertexShader)
      );
      return;
    }

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fragmentShaderSource);
    this.gl.compileShader(fragmentShader);

    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      console.error(
        "Fragment shader error:",
        this.gl.getShaderInfoLog(fragmentShader)
      );
      return;
    }

    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error(
        "Program linking error:",
        this.gl.getProgramInfoLog(this.program)
      );
      return;
    }

    this.positionAttributeLocation = this.gl.getAttribLocation(
      this.program,
      "a_position"
    );
    this.texCoordAttributeLocation = this.gl.getAttribLocation(
      this.program,
      "a_texCoord"
    );

    this.uniformLocations = {
      u_image: this.gl.getUniformLocation(this.program, "u_image"),
      u_resolution: this.gl.getUniformLocation(this.program, "u_resolution"),
      u_sharpness: this.gl.getUniformLocation(this.program, "u_sharpness"),
      u_edgeEnhance: this.gl.getUniformLocation(this.program, "u_edgeEnhance"),
      u_time: this.gl.getUniformLocation(this.program, "u_time"),
    };

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0,
        -1.0, // bottom-left
        1.0,
        -1.0, // bottom-right
        -1.0,
        1.0, // top-left
        1.0,
        1.0, // top-right
      ]),
      this.gl.STATIC_DRAW
    );

    this.texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        0.0,
        0.0, // bottom-left
        1.0,
        0.0, // bottom-right
        0.0,
        1.0, // top-left
        1.0,
        1.0, // top-right
      ]),
      this.gl.STATIC_DRAW
    );

    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
  }

  async loadModels() {
    try {
      // loader WASM-models for Waifu2x
      this.upscaler = await this.loadWASMModel("waifu2x");
      this.denoiser = await this.loadWASMModel("anime_denoise");
    } catch (e) {
      console.error("Failed to load models:", e);
    }
  }

  async loadWASMModel(name) {
    const response = await fetch(chrome.runtime.getURL(`wasm/${name}.wasm`));
    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module);

    return {
      enhance: (imageData) => {
        return imageData;
      },
    };
  }

  startProcessing() {
    if (this.video.readyState >= 2) {
      this.processFrame();
    } else {
      this.video.addEventListener("loadeddata", this.processFrame.bind(this));
    }
  }

  processFrame() {
    if (this.video.paused || this.video.ended) return;

    try {
      this.updateCanvasSize();
      this.ctx.drawImage(
        this.video,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      let imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      imageData = this.applyEnhancements(imageData);

      this.outputCtx.putImageData(imageData, 0, 0);

      requestAnimationFrame(this.processFrame.bind(this));
    } catch (e) {
      console.error("Frame processing error:", e);
    }
  }

  applyEnhancements(imageData) {
    //(Canvas/WebGL)
    imageData = this.applyBasicEnhancements(imageData);
    imageData = this.applyAnimeFilters(imageData);

    //(WASM)
    if (this.upscaler) {
      imageData = this.upscaler.enhance(imageData);
    }

    return imageData;
  }

  applyBasicEnhancements(imageData) {
    if (this.useWebGL) {
      return this.applyWebGLEnhancements(imageData);
    }
    const data = imageData.data;
    const contrast = 1.2;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128; // R
      data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
      data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
    }

    // 2. Легкое увеличение резкости
    this.outputCtx.putImageData(imageData, 0, 0);
    this.outputCtx.filter = "contrast(1.1) brightness(1.05) saturate(1.1)";
    this.outputCtx.drawImage(this.outputCanvas, 0, 0);
    return this.outputCtx.getImageData(0, 0, imageData.width, imageData.height);
  }

  applyAnimeFilters(imageData) {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 50 && data[i + 1] < 50 && data[i + 2] < 50) {
        const noise = Math.random() * 5;
        data[i] += noise;
        data[i + 1] += noise;
        data[i + 2] += noise;
      }
    }

    return imageData;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  AnimeEnhancer.init();
});

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  AnimeEnhancer.init();
}
