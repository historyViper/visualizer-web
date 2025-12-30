/**
 * Audio Visualizer - Main Application Shell
 * Dual canvas system: main (2D or WebGL) + overlay (always 2D)
 */
import { AudioAnalyzer } from './audio/analyzer.js';
import { visualizers, getVisualizerById } from './vis/index.js';

class VisualizerApp {
  constructor() {
    this.canvasContainer = document.getElementById('canvas-container');
    this.canvasWrapper = document.getElementById('canvas-wrapper');
    this.mainCanvas = null;
    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.overlayCtx = this.overlayCanvas?.getContext('2d');

    this.gl = null;
    this.ctx2d = null;
    this.currentContextType = null; // '2d' or 'webgl2'

    // Settings (shared, read by visualizers)
    this.settings = {
      // Canvas
      aspectRatio: 'fit',   // 'fit' | '16:9' | '9:16' | '1:1'
      qualityScale: 0.5,    // 0..1 maps ~1080p..2160p internal baseline (see resize())

      // Color & Style (base)
      baseColor: '#00ff88',
      bgColor: '#0a0a0f',
      bgAlpha: 1,
      glowAmount: 0,

      // Color Gradient
      gradientEnabled: false,
      gradientStops: 2, // 2..5
      colorStops: ['#00ff88', '#0088ff', '#ff0088', '#ffff00', '#ff0000'],
      gradientMode: 'linear', // 'linear' | 'radial' (visualizers decide)
      gradientScalar: 1.0,    // strength / mixing scalar

      // Alpha Gradient
      alphaStart: 1.0,
      alphaEnd: 0.3,
      alphaScalar: 1.0,

      // Visualizer bars
      barMode: 'solid',     // 'solid' | 'blocks' | 'texture' etc. (visualizers decide)
      segmentHeight: 8,
      segmentGap: 2,
      roundedBlocks: false,

      // Audio / Frequency mapping
      freqMin: 30,
      freqMax: 16000,
      logCurve: 1.0,
      bassTame: 0.6,
      smoothing: 0.75,

      // Audio dynamics
      gain: 1.5,
      compress: 0.8,
      tilt: 0.3,
      attack: 0.8,
      release: 0.92,

      // Performance
      targetFPS: 60,
      renderScale: 1.0, // still supported (DPR+scale)
      maxDPR: 2,
      autoQuality: false,

      // Overlay
      logoImage: null,
      albumImage: null,
      songTitle: '',
      artist: '',
      album: '',
      overlayPosition: 'bottom-left',

      // Overlay sizes (UI sliders)
      logoSize: 60,
      albumSize: 100
    };

    this.audio = new AudioAnalyzer();

    this.currentVisualizer = null;
    this.currentVisId = 'bars2d';

    this.frameTimes = [];
    this.lastTime = 0;
    this.focusMode = false;

    this.init();
  }

  async init() {
    this.createMainCanvas('2d'); // Start with 2D
    this.resize();

    window.addEventListener('resize', () => this.resize());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggleFocusMode();
    });

    this.setupUI();
    this.loadVisualizer(this.currentVisId);

    this.lastTime = performance.now();
    this.render();
  }

  /**
   * Create/replace main canvas with the requested context type.
   * Falls back to 2D if WebGL2 isn't available.
   */
  createMainCanvas(type) {
    // Remove old canvas if exists
    if (this.mainCanvas) {
      this.mainCanvas.remove();
      this.gl = null;
      this.ctx2d = null;
    }

    // Create new canvas
    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.id = 'visualizer-canvas';
    // Insert before overlay, or append if overlay not a child
    if (this.overlayCanvas && this.overlayCanvas.parentNode === this.canvasWrapper) {
      this.canvasWrapper.insertBefore(this.mainCanvas, this.overlayCanvas);
    } else {
      this.canvasWrapper.appendChild(this.mainCanvas);
    }

    // Get appropriate context
    if (type === 'webgl2') {
      this.gl = this.mainCanvas.getContext('webgl2', { alpha: false, antialias: false });
      if (!this.gl) {
        console.error('WebGL2 not supported');
        this.setStatus('WebGL2 not supported - using 2D');
        this.ctx2d = this.mainCanvas.getContext('2d');
        this.currentContextType = '2d';
        return '2d';
      }
      this.ctx2d = null;
      this.currentContextType = 'webgl2';
      return 'webgl2';
    } else {
      this.ctx2d = this.mainCanvas.getContext('2d');
      this.gl = null;
      this.currentContextType = '2d';
      return '2d';
    }
  }

  setupUI() {
    // Focus Mode toggle
    document.getElementById('focus-btn')?.addEventListener('click', () => this.toggleFocusMode());

    // Accordion toggles
    document.querySelectorAll('.accordion-header').forEach((header) => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('open');
      });
    });

    // Audio controls
    document.getElementById('btn-mic')?.addEventListener('click', () => this.startMic());
    document.getElementById('btn-file')?.addEventListener('click', () => this.loadAudioFile());

    // Visualizer selector
    const visSel = document.getElementById('vis-select');
    if (visSel) {
      visualizers.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        visSel.appendChild(opt);
      });
      visSel.value = this.currentVisId;
      visSel.addEventListener('change', () => this.loadVisualizer(visSel.value));
    }

    // Canvas settings
    document.getElementById('aspect-ratio')?.addEventListener('change', (e) => {
      this.settings.aspectRatio = e.target.value;
      this.resize();
    });

    const qualitySlider = document.getElementById('quality-scale');
    const qualityVal = document.getElementById('quality-val');
    if (qualitySlider) {
      // initialize label
      const initH = Math.round(1080 + this.settings.qualityScale * 1080);
      if (qualityVal) qualityVal.textContent = initH >= 2160 ? '4K' : `${initH}p`;

      qualitySlider.value = this.settings.qualityScale;
      qualitySlider.addEventListener('input', (e) => {
        this.settings.qualityScale = parseFloat(e.target.value);
        const h = Math.round(1080 + this.settings.qualityScale * 1080);
        if (qualityVal) qualityVal.textContent = h >= 2160 ? '4K' : `${h}p`;
        this.resize();
      });
    }

    // Visualizer bar mode
    this._bindSelect('bar-mode', 'barMode');
    this._bindSlider('seg-height', 'segmentHeight', 'seg-height-val');
    this._bindSlider('seg-gap', 'segmentGap', 'seg-gap-val');
    this._bindCheckbox('rounded-blocks', 'roundedBlocks');

    // Color & Style bindings (existing)
    this._bindInput('base-color', 'baseColor', 'value');
    this._bindInput('bg-color', 'bgColor', 'value');

    // Gradient
    this._bindCheckbox('gradient-toggle', 'gradientEnabled');

    document.getElementById('gradient-stops')?.addEventListener('change', (e) => {
      this.settings.gradientStops = parseInt(e.target.value, 10);
      this.updateColorStopVisibility();
    });

    for (let i = 0; i < 5; i++) {
      const el = document.getElementById(`color-stop-${i}`);
      if (el) {
        el.value = this.settings.colorStops[i] || '#ffffff';
        el.addEventListener('input', (e) => (this.settings.colorStops[i] = e.target.value));
      }
    }

    this._bindSelect('gradient-mode', 'gradientMode');
    this._bindSlider('grad-scalar', 'gradientScalar', 'grad-scalar-val');

    // Alpha gradient
    this._bindSlider('alpha-start', 'alphaStart', 'alpha-start-val');
    this._bindSlider('alpha-end', 'alphaEnd', 'alpha-end-val');
    this._bindSlider('alpha-scalar', 'alphaScalar', 'alpha-scalar-val');

    // Glow
    this._bindSlider('glow-amount', 'glowAmount', 'glow-val');

    // Audio settings bindings
    this._bindSlider('freq-min', 'freqMin', 'freq-min-val');
    this._bindSlider('freq-max', 'freqMax', 'freq-max-val');
    this._bindSlider('log-curve', 'logCurve', 'log-curve-val');
    this._bindSlider('bass-tame', 'bassTame', 'bass-tame-val');
    this._bindSlider('smoothing', 'smoothing', 'smoothing-val');

    // Audio dynamics bindings
    this._bindSlider('audio-gain', 'gain', 'gain-val');
    this._bindSlider('audio-compress', 'compress', 'compress-val');
    this._bindSlider('audio-tilt', 'tilt', 'tilt-val');
    this._bindSlider('audio-attack', 'attack', 'attack-val');
    this._bindSlider('audio-release', 'release', 'release-val');

    // Performance
    this._bindSlider('render-scale', 'renderScale', 'scale-val', () => this.resize());

    // Overlay sizes
    this._bindSlider('logo-size', 'logoSize', 'logo-size-val');
    this._bindSlider('album-size', 'albumSize', 'album-size-val');

    // Text inputs
    document.getElementById('song-title')?.addEventListener('input', (e) => (this.settings.songTitle = e.target.value));
    document.getElementById('artist')?.addEventListener('input', (e) => (this.settings.artist = e.target.value));
    document.getElementById('album-name')?.addEventListener('input', (e) => (this.settings.album = e.target.value));
    document
      .getElementById('overlay-position')
      ?.addEventListener('change', (e) => (this.settings.overlayPosition = e.target.value));

    // Image uploads
    document.getElementById('logo-upload')?.addEventListener('change', (e) => this.loadImage(e, 'logoImage'));
    document.getElementById('album-upload')?.addEventListener('change', (e) => this.loadImage(e, 'albumImage'));

    // Make sure correct stop inputs are visible at load
    this.updateColorStopVisibility();
  }

  _bindInput(elId, settingKey, prop) {
    const el = document.getElementById(elId);
    if (el) {
      el[prop] = this.settings[settingKey];
      el.addEventListener('input', (e) => (this.settings[settingKey] = e.target[prop]));
    }
  }

  _bindCheckbox(elId, settingKey) {
    const el = document.getElementById(elId);
    if (el) {
      el.checked = this.settings[settingKey];
      el.addEventListener('change', (e) => (this.settings[settingKey] = e.target.checked));
    }
  }

  _bindSlider(elId, settingKey, valElId, callback) {
    const el = document.getElementById(elId);
    const valEl = document.getElementById(valElId);
    if (el) {
      el.value = this.settings[settingKey];
      if (valEl) valEl.textContent = this.settings[settingKey];

      el.addEventListener('input', (e) => {
        this.settings[settingKey] = parseFloat(e.target.value);
        if (valEl) valEl.textContent = e.target.value;
        if (callback) callback();
      });
    }
  }

  _bindSelect(elId, settingKey) {
    const el = document.getElementById(elId);
    if (el) {
      el.value = this.settings[settingKey];
      el.addEventListener('change', (e) => (this.settings[settingKey] = e.target.value));
    }
  }

  updateColorStopVisibility() {
    for (let i = 0; i < 5; i++) {
      const el = document.getElementById(`color-stop-${i}`);
      if (!el) continue;
      el.style.display = i < this.settings.gradientStops ? 'block' : 'none';
    }
  }

  loadImage(event, settingKey) {
    const file = event.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => (this.settings[settingKey] = img);
    img.src = URL.createObjectURL(file);
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    document.body.classList.toggle('focus-mode', this.focusMode);
    document.getElementById('focus-btn')?.classList.toggle('active', this.focusMode);
  }

  loadVisualizer(id) {
    // Dispose current
    if (this.currentVisualizer) {
      try {
        this.currentVisualizer.dispose();
      } catch (_) {}
      this.currentVisualizer = null;
    }

    const vis = getVisualizerById(id);
    if (!vis) {
      this.setStatus('Visualizer not found: ' + id);
      return;
    }

    this.currentVisId = id;

    // Recreate canvas if context type changes
    const needsType = vis.type === 'webgl2' ? 'webgl2' : '2d';
    if (this.currentContextType !== needsType) {
      const actual = this.createMainCanvas(needsType);
      this.resize();

      // If WebGL2 requested but fell back to 2D, do not init a WebGL visualizer
      if (needsType === 'webgl2' && actual !== 'webgl2') {
        this.setStatus('WebGL2 not supported - pick a 2D visualizer');
        return;
      }
    }

    // Initialize visualizer
    const ctx = vis.type === 'webgl2' ? { gl: this.gl } : { ctx2d: this.ctx2d };
    try {
      vis.init(ctx, { audio: this.audio }, this.settings);
    } catch (e) {
      console.error(e);
      this.setStatus('Visualizer init failed: ' + vis.name);
      return;
    }

    this.currentVisualizer = vis;
    this.resize();
    this.setStatus('Loaded: ' + vis.name);
  }

  /**
   * Compute internal render size:
   * - Supports fixed aspect ratios via "max fit"
   * - Uses DPR * renderScale
   * - Uses qualityScale to bias toward 1080p..2160p internal resolution baseline
   */
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, this.settings.maxDPR);
    const rs = this.settings.renderScale;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine target CSS-fit size for aspect ratio (in CSS pixels)
    let cssW = vw;
    let cssH = vh;

    const ar = this.settings.aspectRatio;
    let targetAR = null;
    if (ar === '16:9') targetAR = 16 / 9;
    else if (ar === '9:16') targetAR = 9 / 16;
    else if (ar === '1:1') targetAR = 1;

    if (targetAR) {
      const vwAR = vw / vh;
      if (vwAR > targetAR) {
        // window too wide -> limit by height
        cssH = vh;
        cssW = Math.round(vh * targetAR);
      } else {
        // window too tall -> limit by width
        cssW = vw;
        cssH = Math.round(vw / targetAR);
      }
    }

    // qualityScale maps baseline height 1080..2160; scale internal size accordingly
    const baselineH = 1080 + this.settings.qualityScale * 1080; // 1080..2160
    const baselineScale = baselineH / 1080; // 1..2

    const w = Math.round(cssW * dpr * rs * baselineScale);
    const h = Math.round(cssH * dpr * rs * baselineScale);

    if (this.mainCanvas) {
      this.mainCanvas.width = w;
      this.mainCanvas.height = h;
      // Keep canvas visually filling container; your CSS should handle actual positioning
    }

    if (this.overlayCanvas) {
      this.overlayCanvas.width = w;
      this.overlayCanvas.height = h;
    }

    if (this.gl) {
      this.gl.viewport(0, 0, w, h);
    }

    if (this.currentVisualizer) {
      this.currentVisualizer.resize(w, h, dpr, rs);
    }
  }

  setStatus(msg) {
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
  }

  async startMic() {
    try {
      await this.audio.init('microphone');
      this.setStatus('Mic connected');
    } catch (e) {
      console.error(e);
      this.setStatus('Mic access denied');
    }
  }

  loadAudioFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const audioEl = new Audio(URL.createObjectURL(file));
      try {
        await audioEl.play();
      } catch (_) {
        // If autoplay blocks, user can hit play in browser; analyzer will still init after play starts
      }

      await this.audio.init(audioEl);
      this.setStatus('Playing: ' + file.name);

      if (!this.settings.songTitle) {
        this.settings.songTitle = file.name.replace(/\.[^/.]+$/, '');
        const titleInput = document.getElementById('song-title');
        if (titleInput) titleInput.value = this.settings.songTitle;
      }
    };

    input.click();
  }

  render() {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 60) this.frameTimes.shift();

    // Build audio frame with bands + params
    const audioFrame = {
      level: this.audio.getLevel(),
      bands: this.audio.getBands(),
      audioParams: {
        freqMin: this.settings.freqMin,
        freqMax: this.settings.freqMax,
        logCurve: this.settings.logCurve,
        bassTame: this.settings.bassTame,
        smoothing: this.settings.smoothing,
        gain: this.settings.gain,
        compress: this.settings.compress,
        tilt: this.settings.tilt,
        attack: this.settings.attack,
        release: this.settings.release
      }
    };

    // Clear main canvas
    if (this.gl) {
      const c = this._hexToRgb(this.settings.bgColor);
      this.gl.clearColor(c.r, c.g, c.b, this.settings.bgAlpha);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    } else if (this.ctx2d) {
      this.ctx2d.fillStyle = this.settings.bgColor;
      this.ctx2d.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    }

    // Update & render visualizer
    if (this.currentVisualizer) {
      try {
        this.currentVisualizer.update(dt, audioFrame);
        this.currentVisualizer.render();
      } catch (e) {
        console.error(e);
        this.setStatus('Render error (see console)');
      }
    }

    // Draw overlay on separate canvas (works for both 2D and WebGL)
    this.drawOverlay();

    requestAnimationFrame(() => this.render());
  }

  drawOverlay() {
    const ctx = this.overlayCtx;
    if (!ctx) return;

    const s = this.settings;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    // Clear overlay
    ctx.clearRect(0, 0, w, h);

    // Skip if nothing to draw
    if (!s.songTitle && !s.artist && !s.album && !s.albumImage && !s.logoImage) return;

    let x, y, align;
    const margin = 30;

    switch (s.overlayPosition) {
      case 'top-left':
        x = margin;
        y = margin;
        align = 'left';
        break;
      case 'top-center':
        x = w / 2;
        y = margin;
        align = 'center';
        break;
      case 'top-right':
        x = w - margin;
        y = margin;
        align = 'right';
        break;
      case 'bottom-left':
        x = margin;
        y = h - margin - 80;
        align = 'left';
        break;
      case 'bottom-center':
        x = w / 2;
        y = h - margin - 80;
        align = 'center';
        break;
      case 'bottom-right':
        x = w - margin;
        y = h - margin - 80;
        align = 'right';
        break;
      default:
        x = margin;
        y = h - margin - 80;
        align = 'left';
    }

    // Scale overlays slightly with resolution so they feel consistent
    const scale = w / 1920;
    const albumSize = (this.settings.albumSize || 100) * scale;
    const logoSize = (this.settings.logoSize || 60) * scale;

    ctx.save();
    ctx.textAlign = align;

    if (s.albumImage) {
      let imgX = x;
      if (align === 'center') imgX = x - albumSize / 2;
      else if (align === 'right') imgX = x - albumSize;

      ctx.drawImage(s.albumImage, imgX, y, albumSize, albumSize);

      if (align === 'left') x += albumSize + 15;
      else if (align === 'right') x -= albumSize + 15;
    }

    if (s.logoImage) {
      ctx.drawImage(s.logoImage, w - logoSize - 20, 20, logoSize, logoSize);
    }

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;

    if (s.songTitle) {
      ctx.font = `bold ${Math.max(18, 24 * scale)}px system-ui, sans-serif`;
      ctx.fillText(s.songTitle, x, y + 30 * scale);
    }
    if (s.artist) {
      ctx.font = `${Math.max(14, 18 * scale)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(s.artist, x, y + 55 * scale);
    }
    if (s.album) {
      ctx.font = `${Math.max(12, 14 * scale)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(s.album, x, y + 75 * scale);
    }

    ctx.restore();
  }

  getAverageFrameTime() {
    if (this.frameTimes.length === 0) return 16.67;
    return this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
  }

  get particleSystem() {
    return { particleCount: this.currentVisualizer ? 1 : 0 };
  }

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }
}

window.app = new VisualizerApp();
