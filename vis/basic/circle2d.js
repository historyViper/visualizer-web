/**
 * 2D Circle Spectrum Visualizer
 */
export const Circle2D = {
    id: 'circle2d',
    name: '2D Circle Spectrum',
    type: '2d',
    
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
        
        const binSize = Math.floor(freq.length / this._barCount);
        for (let i = 0; i < this._barCount; i++) {
            let sum = 0;
            for (let j = 0; j < binSize; j++) {
                sum += freq[i * binSize + j] / 255;
            }
            const target = sum / binSize;
            this._smoothedData[i] += (target - this._smoothedData[i]) * 0.3;
        }
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = Math.min(w, h) * 0.2;
        const maxBarLength = Math.min(w, h) * 0.25;
        
        ctx.save();
        ctx.translate(cx, cy);
        
        for (let i = 0; i < this._barCount; i++) {
            const angle = (i / this._barCount) * Math.PI * 2 - Math.PI / 2;
            const value = this._smoothedData[i];
            const barLength = value * maxBarLength;
            
            const x1 = Math.cos(angle) * baseRadius;
            const y1 = Math.sin(angle) * baseRadius;
            const x2 = Math.cos(angle) * (baseRadius + barLength);
            const y2 = Math.sin(angle) * (baseRadius + barLength);
            
            // Gradient from inner to outer
            if (s.gradientEnabled) {
                const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                const baseColor = s.baseColor || '#00ff88';
                grad.addColorStop(0, this._hexToRgba(baseColor, 1 - s.alphaGradient));
                grad.addColorStop(1, this._hexToRgba(baseColor, 1));
                ctx.strokeStyle = grad;
            } else {
                ctx.strokeStyle = s.baseColor || '#00ff88';
            }
            
            if (s.glowAmount > 0) {
                ctx.shadowColor = s.baseColor || '#00ff88';
                ctx.shadowBlur = s.glowAmount * 20;
            } else {
                ctx.shadowBlur = 0;
            }
            
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        ctx.restore();
        ctx.shadowBlur = 0;
    },
    
    dispose() {
        this._ctx = null;
        this._smoothedData = null;
    },
    
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
};
