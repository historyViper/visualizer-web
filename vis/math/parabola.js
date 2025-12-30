/**
 * Parabola/Lissajous Visualizer - audio-reactive parametric curves
 */
export const Parabola = {
    id: 'parabola',
    name: 'Lissajous Curves',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _audioParams: null,
    _phase: 0,
    _freqX: 3,
    _freqY: 2,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
        this._phase = 0;
    },
    
    resize(w, h) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        this._audioParams = audioFrame.audioParams;
        const bands = this._audio.getLogBands(8, this._audioParams);
        
        // Audio modulates the phase and frequencies
        const bass = (bands[0] + bands[1]) / 2;
        const mid = (bands[2] + bands[3] + bands[4]) / 3;
        const high = (bands[5] + bands[6] + bands[7]) / 3;
        
        this._phase += dt * (1 + mid * 3);
        this._freqX = 3 + Math.floor(bass * 4);
        this._freqY = 2 + Math.floor(high * 3);
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        const cx = w / 2;
        const cy = h / 2;
        
        const bands = this._audio.getLogBands(32, this._audioParams);
        const avgLevel = bands.reduce((a, b) => a + b, 0) / bands.length;
        
        const scaleX = w * 0.35 * (0.8 + avgLevel * 0.4);
        const scaleY = h * 0.35 * (0.8 + avgLevel * 0.4);
        
        ctx.save();
        
        if (s.glowAmount > 0) {
            ctx.shadowColor = s.baseColor;
            ctx.shadowBlur = s.glowAmount * 30;
        }
        
        // Draw multiple Lissajous curves with slight variations
        const curves = 3;
        for (let c = 0; c < curves; c++) {
            const phaseOffset = c * 0.3;
            const freqOffset = c * 0.1;
            
            ctx.beginPath();
            let firstPoint = true;
            
            const points = 500;
            for (let i = 0; i <= points; i++) {
                const t = (i / points) * Math.PI * 2;
                const bandIdx = Math.floor((i / points) * 31);
                const audioMod = 1 + bands[bandIdx] * 0.2;
                
                // Lissajous: x = A*sin(a*t + delta), y = B*sin(b*t)
                const a = this._freqX + freqOffset;
                const b = this._freqY + freqOffset;
                const delta = this._phase + phaseOffset;
                
                const x = cx + Math.sin(a * t + delta) * scaleX * audioMod;
                const y = cy + Math.sin(b * t) * scaleY * audioMod;
                
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.closePath();
            
            const alpha = 1 - c * 0.25;
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const grad = ctx.createLinearGradient(cx - scaleX, cy, cx + scaleX, cy);
                for (let i = 0; i < s.gradientStops; i++) {
                    const pos = i / (s.gradientStops - 1);
                    grad.addColorStop(pos, this._hexToRgba(s.colorStops[i], alpha));
                }
                ctx.strokeStyle = grad;
            } else {
                ctx.strokeStyle = this._hexToRgba(s.baseColor, alpha);
            }
            
            ctx.lineWidth = 2 - c * 0.5;
            ctx.stroke();
        }
        
        // Draw reactive nodes at key points
        const nodeCount = 8;
        for (let i = 0; i < nodeCount; i++) {
            const t = (i / nodeCount) * Math.PI * 2;
            const x = cx + Math.sin(this._freqX * t + this._phase) * scaleX;
            const y = cy + Math.sin(this._freqY * t) * scaleY;
            
            const bandIdx = Math.floor((i / nodeCount) * 7);
            const size = 4 + bands[bandIdx] * 20;
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const colorIdx = Math.floor((i / nodeCount) * (s.gradientStops - 1));
                ctx.fillStyle = s.colorStops[colorIdx];
            } else {
                ctx.fillStyle = s.baseColor;
            }
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    },
    
    dispose() {
        this._ctx = null;
        this._audio = null;
    },
    
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
};
