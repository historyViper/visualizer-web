/**
 * Mandelbrot Zoom Visualizer - audio-reactive fractal exploration
 */
export const Mandelbrot = {
    id: 'mandelbrot',
    name: 'Mandelbrot Zoom',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _audioParams: null,
    
    // Zoom state
    _zoom: 1,
    _centerX: -0.5,
    _centerY: 0,
    _targetX: -0.743643887037158,
    _targetY: 0.131825904205330,
    _maxIter: 100,
    _imageData: null,
    _needsRender: true,
    _time: 0,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
        this._zoom = 1;
        this._centerX = -0.5;
        this._centerY = 0;
        this._time = 0;
        this._needsRender = true;
    },
    
    resize(w, h) {
        this._width = w;
        this._height = h;
        this._imageData = this._ctx.createImageData(w, h);
        this._needsRender = true;
    },
    
    update(dt, audioFrame) {
        this._audioParams = audioFrame.audioParams;
        const bands = this._audio.getLogBands(8, this._audioParams);
        const level = bands.reduce((a, b) => a + b, 0) / 8;
        
        this._time += dt;
        
        // Continuous zoom modulated by audio
        const zoomSpeed = 0.3 + level * 0.5;
        this._zoom *= (1 + zoomSpeed * dt);
        
        // Slowly approach target point
        const approach = 1 - Math.exp(-dt * 0.5);
        this._centerX += (this._targetX - this._centerX) * approach;
        this._centerY += (this._targetY - this._centerY) * approach;
        
        // Adjust iterations based on zoom
        this._maxIter = Math.floor(100 + Math.log2(this._zoom) * 20);
        
        // Reset zoom periodically
        if (this._zoom > 1e12) {
            this._zoom = 1;
            this._centerX = -0.5;
            this._centerY = 0;
        }
        
        this._needsRender = true;
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        
        if (!this._imageData || w === 0 || h === 0) return;
        
        // Render at lower resolution for performance
        const scale = 4;
        const sw = Math.floor(w / scale);
        const sh = Math.floor(h / scale);
        
        const aspect = w / h;
        const rangeY = 2 / this._zoom;
        const rangeX = rangeY * aspect;
        
        const minX = this._centerX - rangeX / 2;
        const minY = this._centerY - rangeY / 2;
        
        const bands = this._audio.getLogBands(8, this._audioParams);
        const colorShift = this._time * 50 + bands[0] * 100;
        
        // Build color palette
        const palette = this._buildPalette(s, colorShift);
        
        // Clear with background
        ctx.fillStyle = s.bgColor;
        ctx.fillRect(0, 0, w, h);
        
        // Render Mandelbrot
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tempCtx = tempCanvas.getContext('2d');
        const imgData = tempCtx.createImageData(sw, sh);
        const data = imgData.data;
        
        for (let py = 0; py < sh; py++) {
            for (let px = 0; px < sw; px++) {
                const x0 = minX + (px / sw) * rangeX;
                const y0 = minY + (py / sh) * rangeY;
                
                let x = 0, y = 0;
                let iter = 0;
                
                while (x*x + y*y <= 4 && iter < this._maxIter) {
                    const xtemp = x*x - y*y + x0;
                    y = 2*x*y + y0;
                    x = xtemp;
                    iter++;
                }
                
                const idx = (py * sw + px) * 4;
                
                if (iter === this._maxIter) {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                } else {
                    const smooth = iter + 1 - Math.log2(Math.log2(x*x + y*y));
                    const colorIdx = Math.floor(smooth * 3 + colorShift) % 256;
                    const color = palette[Math.abs(colorIdx)];
                    data[idx] = color.r;
                    data[idx + 1] = color.g;
                    data[idx + 2] = color.b;
                }
                data[idx + 3] = 255;
            }
        }
        
        tempCtx.putImageData(imgData, 0, 0);
        
        // Scale up to full size
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tempCanvas, 0, 0, w, h);
        
        // Add glow effect if enabled
        if (s.glowAmount > 0) {
            ctx.globalCompositeOperation = 'screen';
            ctx.filter = `blur(${s.glowAmount * 10}px)`;
            ctx.globalAlpha = s.glowAmount * 0.5;
            ctx.drawImage(tempCanvas, 0, 0, w, h);
            ctx.globalAlpha = 1;
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
        }
    },
    
    _buildPalette(s, shift) {
        const palette = [];
        for (let i = 0; i < 256; i++) {
            const t = i / 256;
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const colorIndex = Math.floor(t * (s.gradientStops - 1));
                const nextIndex = Math.min(colorIndex + 1, s.gradientStops - 1);
                const localT = (t * (s.gradientStops - 1)) - colorIndex;
                const c1 = this._hexToRgbObj(s.colorStops[colorIndex]);
                const c2 = this._hexToRgbObj(s.colorStops[nextIndex]);
                palette.push({
                    r: Math.round(c1.r + (c2.r - c1.r) * localT),
                    g: Math.round(c1.g + (c2.g - c1.g) * localT),
                    b: Math.round(c1.b + (c2.b - c1.b) * localT)
                });
            } else {
                const c = this._hexToRgbObj(s.baseColor);
                const brightness = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
                palette.push({
                    r: Math.round(c.r * brightness),
                    g: Math.round(c.g * brightness),
                    b: Math.round(c.b * brightness)
                });
            }
        }
        return palette;
    },
    
    dispose() {
        this._ctx = null;
        this._audio = null;
        this._imageData = null;
    },
    
    _hexToRgbObj(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    }
};
