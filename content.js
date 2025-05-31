const videoProcessors = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkVideo") {
    const video = document.querySelector("video");
    if (video) {
      sendResponse({
        hasVideo: true,
        videoSource: video.currentSrc || video.src,
        videoResolution: `${video.videoWidth}x${video.videoHeight}`,
      });
    } else {
      sendResponse({ hasVideo: false });
    }
  } else if (request.action === "applySettings") {
    const settings = request.settings;
    console.log("Get settings popup:", settings);

    videoProcessors.forEach((processor) => {
      processor.updateSettings(settings);
    });
  }
});

class AnimeVideoDetector {
  constructor() {
    this.videoElements = new Set();
    this.setupObservers();
    this.checkExistingVideos();
    this.setupPortConnection();
  }

  setupPortConnection() {
    this.port = chrome.runtime.connect({ name: "videoDetector" });

    this.port.onMessage.addListener((msg) => {
      if (msg.action === "forceCheck") {
        this.checkExistingVideos();
      }
    });

    this.port.onDisconnect.addListener(() => {
      console.log("Background connection closed");
      this.port = null;
    });
  }

  setupObservers() {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.tagName === "VIDEO") {
              this.processVideoElement(node);
            } else if (node.querySelector) {
              const videos = node.querySelectorAll("video");
              videos.forEach((video) => this.processVideoElement(video));
            }
          }
        });
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.processVideoElement(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
  }

  checkExistingVideos() {
    const videos = document.querySelectorAll("video:not([data-enhanced])");
    videos.forEach((video) => this.processVideoElement(video));
  }

  processVideoElement(video) {
    if (this.videoElements.has(video) || !this.isVideoValid(video)) return;

    console.log("Processing new video element:", video);
    this.videoElements.add(video);
    this.intersectionObserver.observe(video);

    const srcObserver = new MutationObserver(() => {
      if (this.isVideoValid(video)) {
        this.enhanceVideo(video);
      }
    });
    srcObserver.observe(video, { attributes: true, attributeFilter: ["src"] });

    this.enhanceVideo(video);

    if (this.port) {
      this.port.postMessage({
        action: "videoDetected",
        src: video.src || video.currentSrc,
        dimensions: { width: video.videoWidth, height: video.videoHeight },
      });
    }
  }

  isVideoValid(video) {
    return (
      video &&
      video.tagName === "VIDEO" &&
      (video.src || video.currentSrc || video.querySelector("source"))
    );
  }

  enhanceVideo(video) {
    try {
      video.dataset.enhanced = "true";
      new AnimeVideoProcessor(video);
    } catch (error) {
      console.error("Video enhancement failed:", error);
    }
  }
}

class AnimeVideoProcessor {
  constructor(video, settings = {}) {
    this.video = video;
    this.settings = {
      contrast: 1.2,
      brightness: 1.05,
      saturation: 1.1,
      ...settings,
    };
    this.setupProcessing();
    this.applyInitialStyles();
    this.startProcessing();
  }

  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings,
    };
  }

  setupProcessing() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.outputCanvas = document.createElement("canvas");
    this.outputCtx = this.outputCanvas.getContext("2d");

    this.video.parentNode.insertBefore(
      this.outputCanvas,
      this.video.nextSibling
    );

    this.video.style.opacity = "0";
    this.video.style.position = "absolute";
    this.video.style.zIndex = "-1";

    this.updateCanvasSize();

    this.resizeObserver = new ResizeObserver(() => this.updateCanvasSize());
    this.resizeObserver.observe(this.video);
  }

  updateCanvasSize() {
    const width = this.video.videoWidth || this.video.clientWidth;
    const height = this.video.videoHeight || this.video.clientHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;

    this.outputCanvas.style.width = `${this.video.clientWidth}px`;
    this.outputCanvas.style.height = `${this.video.clientHeight}px`;
    this.outputCanvas.style.objectFit = "contain";
  }

  applyInitialStyles() {
    this.outputCanvas.style.display = "block";
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
    } catch (error) {
      console.error("Frame processing error:", error);
    }
  }

  applyEnhancements(imageData) {
    const data = imageData.data;
    const { contrast, brightness, saturation } = this.settings;

    const factor =
      (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = this.clamp(factor * (data[i] - 128) + 128);
      data[i + 1] = this.clamp(factor * (data[i + 1] - 128) + 128);
      data[i + 2] = this.clamp(factor * (data[i + 2] - 128) + 128);
    }

    this.ctx.filter = `contrast(${contrast}) brightness(${brightness}) saturate(${saturation})`;
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  clamp(value, min = 0, max = 255) {
    return Math.min(max, Math.max(min, value));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AnimeVideoDetector();
});

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  new AnimeVideoDetector();
}
