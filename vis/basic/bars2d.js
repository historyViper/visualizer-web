/**
 * 2D Spectrum Bars Visualizer
 */
export const Bars2D = {
    id: 'bars2d',
    name: '2D Spectrum Bars',
    type: '2d',
    
    // Internal state
    _ctx: null,
    _settings: null,
    _width: 0,
    _height: 0,
    _barCount: 64,
    _smoothedData: null,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._smoothedData = new Float32Array(this._barCount);
    },
    
    resize(w, h, dpr, renderScale) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        const freq = audioFrame.frequencyData;
        if (!freq) return;
        
        // Smooth & downsample frequency data to bar count
        const binSize = Math.floor(freq.length / this._barCount);
        for (let i = 0; i < this._barCount; i++) {
            let sum = 0;
            for (let j = 0; j < binSize; j++) {
                sum += freq[i * binSize + j] / 255;
            }
            const target = sum / binSize;
            // Smooth interpolation
            this._smoothedData[i] += (target - this._smoothedData[i]) * 0.3;
        }
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        
        const barWidth = w / this._barCount * 0.8;
        const gap = w / this._barCount * 0.2;
        
        for (let i = 0; i < this._barCount; i++) {
            const value = this._smoothedData[i];
            const barHeight = value * h * 0.8;
            const x = i * (barWidth + gap) + gap / 2;
            const y = h - barHeight;
            
            // Create gradient if enabled
            if (s.gradientEnabled) {
                const grad = ctx.createLinearGradient(x, h, x, y);
                const baseColor = s.baseColor || '#00ff88';
                const alpha1 = 1 - s.alphaGradient;
                const alpha2 = 1;
                grad.addColorStop(0, this._hexToRgba(baseColor, alpha1));
                grad.addColorStop(1, this._hexToRgba(baseColor, alpha2));
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = s.baseColor || '#00ff88';
            }
            
            // Glow effect (2D shadowBlur)
            if (s.glowAmount > 0) {
                ctx.shadowColor = s.baseColor || '#00ff88';
                ctx.shadowBlur = s.glowAmount * 30;
            } else {
                ctx.shadowBlur = 0;
            }
            
            ctx.fillRect(x, y, barWidth, barHeight);
        }
        
        ctx.shadowBlur = 0;
    },
    
    dispose() {
        this._ctx = null;
        this._smoothedData = null;
    },
    
    // Helper
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
};
