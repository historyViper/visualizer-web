/**
 * Audio Visualizer - Main Application Shell
 * Single canvas, single RAF loop, visualizer module loader
 */
import { AudioAnalyzer } from './audio/analyzer.js';
import { visualizers, getVisualizerById } from './vis/index.js';

class VisualizerApp {
    constructor() {
        this.canvas = document.getElementById('visualizer-canvas');
        this.gl = null;
        this.ctx2d = null;
        
        // Settings (shared, read by visualizers)
        this.settings = {
            // Color & Style
            baseColor: '#00ff88',
            gradientEnabled: false,
            alphaGradient: 0,
            bgColor: '#0a0a0f',
            bgAlpha: 1,
            glowAmount: 0,
            // Performance
            targetFPS: 60,
            renderScale: 1.0,
            maxDPR: 2,
            autoQuality: false,
            // Overlay
            logoImage: null,
            albumImage: null,
            songTitle: '',
            artist: '',
            album: '',
            overlayPosition: 'bottom-left'
        };
        
        this.audio = new AudioAnalyzer();
        this.currentVisualizer = null;
        this.currentVisId = 'bars2d';
        
        this.frameTimes = [];
        this.lastTime = 0;
        this.focusMode = false;
        
        // Frequency/waveform buffers
        this.frequencyData = null;
        this.waveformData = null;
        
        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.toggleFocusMode();
        });
        
        this.setupUI();
        this.loadVisualizer(this.currentVisId);
        
        this.lastTime = performance.now();
        this.render();
    }

    setupUI() {
        // Focus Mode toggle
        const focusBtn = document.getElementById('focus-btn');
        focusBtn?.addEventListener('click', () => this.toggleFocusMode());
        
        // Accordion toggles
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                section.classList.toggle('open');
            });
        });
        
        // Audio controls
        document.getElementById('btn-mic')?.addEventListener('click', () => this.startMic());
        document.getElementById('btn-file')?.addEventListener('click', () => this.loadAudioFile());
        
        // Visualizer selector
        const visSel = document.getElementById('vis-select');
        if (visSel) {
            visualizers.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = v.name;
                visSel.appendChild(opt);
            });
            visSel.value = this.currentVisId;
            visSel.addEventListener('change', () => this.loadVisualizer(visSel.value));
        }
        
        // Color picker
        const colorPicker = document.getElementById('base-color');
        if (colorPicker) {
            colorPicker.value = this.settings.baseColor;
            colorPicker.addEventListener('input', (e) => this.settings.baseColor = e.target.value);
        }
        
        // Gradient toggle
        const gradToggle = document.getElementById('gradient-toggle');
        if (gradToggle) {
            gradToggle.addEventListener('change', (e) => this.settings.gradientEnabled = e.target.checked);
        }
        
        // Alpha gradient slider
        const alphaSlider = document.getElementById('alpha-gradient');
        if (alphaSlider) {
            alphaSlider.addEventListener('input', (e) => this.settings.alphaGradient = parseFloat(e.target.value));
        }
        
        // Background color
        const bgPicker = document.getElementById('bg-color');
        if (bgPicker) {
            bgPicker.value = this.settings.bgColor;
            bgPicker.addEventListener('input', (e) => this.settings.bgColor = e.target.value);
        }
        
        // Glow slider
        const glowSlider = document.getElementById('glow-amount');
        if (glowSlider) {
            glowSlider.addEventListener('input', (e) => this.settings.glowAmount = parseFloat(e.target.value));
        }
        
        // Render scale
        const scaleSlider = document.getElementById('render-scale');
        if (scaleSlider) {
            scaleSlider.value = this.settings.renderScale;
            scaleSlider.addEventListener('input', (e) => {
                this.settings.renderScale = parseFloat(e.target.value);
                this.resize();
            });
        }
        
        // Text inputs
        document.getElementById('song-title')?.addEventListener('input', (e) => this.settings.songTitle = e.target.value);
        document.getElementById('artist')?.addEventListener('input', (e) => this.settings.artist = e.target.value);
        document.getElementById('album-name')?.addEventListener('input', (e) => this.settings.album = e.target.value);
        
        // Position preset
        document.getElementById('overlay-position')?.addEventListener('change', (e) => this.settings.overlayPosition = e.target.value);
        
        // Image uploads
        document.getElementById('logo-upload')?.addEventListener('change', (e) => this.loadImage(e, 'logoImage'));
        document.getElementById('album-upload')?.addEventListener('change', (e) => this.loadImage(e, 'albumImage'));
    }

    loadImage(event, settingKey) {
        const file = event.target.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            this.settings[settingKey] = img;
        };
        img.src = URL.createObjectURL(file);
    }

    toggleFocusMode() {
        this.focusMode = !this.focusMode;
        document.body.classList.toggle('focus-mode', this.focusMode);
        const focusBtn = document.getElementById('focus-btn');
        if (focusBtn) {
            focusBtn.classList.toggle('active', this.focusMode);
        }
    }

    loadVisualizer(id) {
        // Dispose current
        if (this.currentVisualizer) {
            this.currentVisualizer.dispose();
            this.currentVisualizer = null;
        }
        
        const vis = getVisualizerById(id);
        if (!vis) {
            this.setStatus('Visualizer not found: ' + id);
            return;
        }
        
        this.currentVisId = id;
        
        // Setup context based on type
        if (vis.type === 'webgl2') {
            this.ctx2d = null;
            if (!this.gl) {
                this.gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false });
            }
            if (!this.gl) {
                this.setStatus('WebGL2 not supported');
                return;
            }
            vis.init({ gl: this.gl }, { audio: this.audio }, this.settings);
        } else {
            this.gl = null;
            this.ctx2d = this.canvas.getContext('2d');
            vis.init({ ctx2d: this.ctx2d }, { audio: this.audio }, this.settings);
        }
        
        this.currentVisualizer = vis;
        
        // Initialize audio buffers
        const fftSize = this.audio.analyser?.fftSize || 2048;
        this.frequencyData = new Uint8Array(fftSize / 2);
        this.waveformData = new Uint8Array(fftSize);
        
        this.resize();
        this.setStatus('Loaded: ' + vis.name);
    }

    resize() {
        const dpr = Math.min(devicePixelRatio, this.settings.maxDPR);
        const scale = this.settings.renderScale;
        this.canvas.width = window.innerWidth * dpr * scale;
        this.canvas.height = window.innerHeight * dpr * scale;
        
        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
        
        if (this.currentVisualizer) {
            this.currentVisualizer.resize(this.canvas.width, this.canvas.height, dpr, scale);
        }
    }

    setStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    async startMic() {
        try {
            await this.audio.init('microphone');
            this.frequencyData = new Uint8Array(this.audio.analyser.frequencyBinCount);
            this.waveformData = new Uint8Array(this.audio.analyser.fftSize);
            this.setStatus('Mic connected');
        } catch (e) {
            this.setStatus('Mic access denied');
        }
    }

    loadAudioFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const audioEl = new Audio(URL.createObjectURL(file));
            audioEl.play();
            await this.audio.init(audioEl);
            this.frequencyData = new Uint8Array(this.audio.analyser.frequencyBinCount);
            this.waveformData = new Uint8Array(this.audio.analyser.fftSize);
            this.setStatus('Playing: ' + file.name);
            
            // Auto-fill song title from filename
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
        
        // Track frame time
        this.frameTimes.push(dt * 1000);
        if (this.frameTimes.length > 60) this.frameTimes.shift();
        
        // Get audio data
        if (this.audio.analyser) {
            this.audio.analyser.getByteFrequencyData(this.frequencyData);
            this.audio.analyser.getByteTimeDomainData(this.waveformData);
        }
        
        const audioFrame = {
            level: this.audio.getLevel(),
            bands: this.audio.getBands(),
            frequencyData: this.frequencyData,
            waveformData: this.waveformData
        };
        
        // Clear canvas
        if (this.gl) {
            const c = this._hexToRgb(this.settings.bgColor);
            this.gl.clearColor(c.r, c.g, c.b, this.settings.bgAlpha);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        } else if (this.ctx2d) {
            this.ctx2d.fillStyle = this.settings.bgColor;
            this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Update & render visualizer
        if (this.currentVisualizer) {
            this.currentVisualizer.update(dt, audioFrame);
            this.currentVisualizer.render();
        }
        
        // Draw overlay (text & images) - 2D only
        this.drawOverlay();
        
        requestAnimationFrame(() => this.render());
    }

    drawOverlay() {
        // For WebGL, we need a separate 2D overlay canvas
        // For simplicity, skip overlay on WebGL for now (can add overlay canvas later)
        if (!this.ctx2d) return;
        
        const ctx = this.ctx2d;
        const s = this.settings;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Calculate position
        let x, y, align;
        const margin = 30;
        
        switch (s.overlayPosition) {
            case 'top-left': x = margin; y = margin; align = 'left'; break;
            case 'top-center': x = w / 2; y = margin; align = 'center'; break;
            case 'top-right': x = w - margin; y = margin; align = 'right'; break;
            case 'bottom-left': x = margin; y = h - margin - 80; align = 'left'; break;
            case 'bottom-center': x = w / 2; y = h - margin - 80; align = 'center'; break;
            case 'bottom-right': x = w - margin; y = h - margin - 80; align = 'right'; break;
            default: x = margin; y = h - margin - 80; align = 'left';
        }
        
        ctx.save();
        ctx.textAlign = align;
        
        // Draw album art
        if (s.albumImage) {
            const imgSize = 80;
            let imgX = x;
            if (align === 'center') imgX = x - imgSize / 2;
            else if (align === 'right') imgX = x - imgSize;
            ctx.drawImage(s.albumImage, imgX, y, imgSize, imgSize);
            if (align === 'left') x += imgSize + 15;
            else if (align === 'right') x -= imgSize + 15;
        }
        
        // Draw logo (small, offset)
        if (s.logoImage) {
            const logoSize = 40;
            ctx.drawImage(s.logoImage, w - logoSize - 20, 20, logoSize, logoSize);
        }
        
        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        
        if (s.songTitle) {
            ctx.font = 'bold 24px system-ui, sans-serif';
            ctx.fillText(s.songTitle, x, y + 30);
        }
        
        if (s.artist) {
            ctx.font = '18px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(s.artist, x, y + 55);
        }
        
        if (s.album) {
            ctx.font = '14px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(s.album, x, y + 75);
        }
        
        ctx.restore();
    }

    getAverageFrameTime() {
        if (this.frameTimes.length === 0) return 16.67;
        return this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
    }

    // Used by particleSystem reference in UI
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
