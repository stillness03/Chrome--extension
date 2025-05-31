document.addEventListener("DOMContentLoaded", function () {
  const toggleEnhancement = document.getElementById("toggleEnhancement");
  const sharpnessSlider = document.getElementById("sharpnessSlider");
  const edgeSlider = document.getElementById("edgeSlider");
  const noiseSlider = document.getElementById("noiseSlider");
  const upscaleSlider = document.getElementById("upscaleSlider");
  const gammaSlider = document.getElementById("gammaSlider");
  const colorSlider = document.getElementById("colorSlider");
  const bandingSlider = document.getElementById("bandingSlider");

  const sharpnessValue = document.getElementById("sharpnessValue");
  const edgeValue = document.getElementById("edgeValue");
  const noiseValue = document.getElementById("noiseValue");
  const upscaleValue = document.getElementById("upscaleValue");
  const gammaValue = document.getElementById("gammaValue");
  const colorValue = document.getElementById("colorValue");
  const bandingValue = document.getElementById("bandingValue");

  const applyBtn = document.getElementById("applyBtn");
  const advancedBtn = document.getElementById("advancedBtn");
  const saveAdvancedBtn = document.getElementById("saveAdvancedBtn");
  const presetBtns = document.querySelectorAll(".preset-btn");

  const noVideo = document.getElementById("noVideo");
  const videoControls = document.getElementById("videoControls");
  const advancedSettings = document.getElementById("advancedSettings");
  const videoInfo = document.getElementById("videoInfo");
  const videoSource = document.getElementById("videoSource");
  const videoResolution = document.getElementById("videoResolution");
  const statusActive = document.getElementById("statusActive");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "checkVideo" },
      function (response) {
        if (response && response.hasVideo) {
          noVideo.classList.add("hidden");
          videoControls.classList.remove("hidden");
          videoInfo.classList.add("active");

          if (response.videoSource) {
            videoSource.textContent = response.videoSource;
          }

          if (response.videoResolution) {
            videoResolution.textContent = response.videoResolution;
          }

          chrome.storage.sync.get(
            [
              "sharpness",
              "edgeEnhance",
              "noiseReduction",
              "upscaling",
              "gamma",
              "colorBoost",
              "debanding",
              "enhancementEnabled",
            ],
            function (settings) {
              if (settings.sharpness !== undefined) {
                sharpnessSlider.value = settings.sharpness;
                sharpnessValue.textContent = settings.sharpness;
              }

              if (settings.edgeEnhance !== undefined) {
                edgeSlider.value = settings.edgeEnhance;
                edgeValue.textContent = settings.edgeEnhance;
              }

              if (settings.noiseReduction !== undefined) {
                noiseSlider.value = settings.noiseReduction;
                noiseValue.textContent = settings.noiseReduction;
              }

              if (settings.upscaling !== undefined) {
                upscaleSlider.value = settings.upscaling;
                upscaleValue.textContent =
                  settings.upscaling === "0"
                    ? "Off"
                    : settings.upscaling === "1"
                    ? "2x"
                    : "4x";
              }

              if (settings.gamma !== undefined) {
                gammaSlider.value = settings.gamma;
                gammaValue.textContent = settings.gamma;
              }

              if (settings.colorBoost !== undefined) {
                colorSlider.value = settings.colorBoost;
                colorValue.textContent = settings.colorBoost;
              }

              if (settings.debanding !== undefined) {
                bandingSlider.value = settings.debanding;
                bandingValue.textContent = settings.debanding;
              }

              if (settings.enhancementEnabled !== undefined) {
                toggleEnhancement.checked = settings.enhancementEnabled;
                document.getElementById("enhancementControls").style.opacity =
                  settings.enhancementEnabled ? "1" : "0.5";
              }
            }
          );
        }
      }
    );
  });

  sharpnessSlider.addEventListener("input", function () {
    sharpnessValue.textContent = this.value;
  });

  edgeSlider.addEventListener("input", function () {
    edgeValue.textContent = this.value;
  });

  noiseSlider.addEventListener("input", function () {
    noiseValue.textContent = this.value;
  });

  upscaleSlider.addEventListener("input", function () {
    upscaleValue.textContent =
      this.value === "0" ? "Off" : this.value === "1" ? "2x" : "4x";
  });

  gammaSlider.addEventListener("input", function () {
    gammaValue.textContent = this.value;
  });

  colorSlider.addEventListener("input", function () {
    colorValue.textContent = this.value;
  });

  bandingSlider.addEventListener("input", function () {
    bandingValue.textContent = this.value;
  });

  toggleEnhancement.addEventListener("change", function () {
    const enabled = this.checked;
    document.getElementById("enhancementControls").style.opacity = enabled
      ? "1"
      : "0.5";

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleEnhancement",
        enabled: enabled,
      });
    });

    chrome.storage.sync.set({ enhancementEnabled: enabled });
  });

  applyBtn.addEventListener("click", function () {
    const settings = {
      sharpness: parseFloat(sharpnessSlider.value),
      edgeEnhance: parseFloat(edgeSlider.value),
      noiseReduction: parseFloat(noiseSlider.value),
      upscaling: upscaleSlider.value,
      gamma: parseFloat(gammaSlider.value),
      colorBoost: parseFloat(colorSlider.value),
      debanding: parseFloat(bandingSlider.value),
    };

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "applySettings",
        settings: settings,
      });
    });

    chrome.storage.sync.set(settings);
    statusActive.classList.add("active");
    setTimeout(() => statusActive.classList.remove("active"), 2000);
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const preset = this.dataset.preset;
      let settings = {};

      switch (preset) {
        case "oldAnime":
          settings = {
            sharpness: 1.2,
            edgeEnhance: 0.9,
            noiseReduction: 0.8,
            upscaling: 1,
            gamma: 0.8,
            colorBoost: 1.0,
            debanding: 0.7,
          };
          break;

        case "lowQuality":
          settings = {
            sharpness: 1.7,
            edgeEnhance: 0.7,
            noiseReduction: 0.9,
            upscaling: 1,
            gamma: 0.9,
            colorBoost: 1.1,
            debanding: 0.8,
          };
          break;

        case "highQuality":
          settings = {
            sharpness: 1.0,
            edgeEnhance: 0.5,
            noiseReduction: 0.3,
            upscaling: 2,
            gamma: 1.0,
            colorBoost: 1.2,
            debanding: 0.3,
          };
          break;

        default: // default
          settings = {
            sharpness: 1.5,
            edgeEnhance: 0.8,
            noiseReduction: 0.5,
            upscaling: 0,
            gamma: 0.9,
            colorBoost: 1.1,
            debanding: 0.5,
          };
      }

      sharpnessSlider.value = settings.sharpness;
      sharpnessValue.textContent = settings.sharpness;
      edgeSlider.value = settings.edgeEnhance;
      edgeValue.textContent = settings.edgeEnhance;
      noiseSlider.value = settings.noiseReduction;
      noiseValue.textContent = settings.noiseReduction;
      upscaleSlider.value = settings.upscaling;
      upscaleValue.textContent =
        settings.upscaling === 0
          ? "Off"
          : settings.upscaling === 1
          ? "2x"
          : "4x";
      gammaSlider.value = settings.gamma;
      gammaValue.textContent = settings.gamma;
      colorSlider.value = settings.colorBoost;
      colorValue.textContent = settings.colorBoost;
      bandingSlider.value = settings.debanding;
      bandingValue.textContent = settings.debanding;

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "applySettings",
          settings: settings,
        });
      });

      chrome.storage.sync.set(settings);
      statusActive.classList.add("active");
      setTimeout(() => statusActive.classList.remove("active"), 2000);
    });
  });

  advancedBtn.addEventListener("click", function () {
    advancedSettings.classList.remove("hidden");
    this.classList.add("hidden");
  });

  saveAdvancedBtn.addEventListener("click", function () {
    advancedSettings.classList.add("hidden");
    advancedBtn.classList.remove("hidden");
  });
});
