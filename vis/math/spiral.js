/**
 * Spiral Visualizer - audio-reactive logarithmic/golden spiral
 */
export const Spiral = {
    id: 'spiral',
    name: 'Audio Spiral',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _audioParams: null,
    _rotation: 0,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
        this._rotation = 0;
    },
    
    resize(w, h) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        this._audioParams = audioFrame.audioParams;
        const level = audioFrame.level || 0;
        this._rotation += dt * (0.5 + level * 2);
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        const cx = w / 2;
        const cy = h / 2;
        
        const bands = this._audio.getLogBands(64, this._audioParams);
        const maxRadius = Math.min(w, h) * 0.45;
        const goldenRatio = 1.618033988749;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this._rotation);
        
        if (s.glowAmount > 0) {
            ctx.shadowColor = s.baseColor;
            ctx.shadowBlur = s.glowAmount * 25;
        }
        
        // Draw spiral arms
        const arms = 2;
        for (let arm = 0; arm < arms; arm++) {
            const armOffset = (arm / arms) * Math.PI * 2;
            
            ctx.beginPath();
            let firstPoint = true;
            
            for (let i = 0; i < 200; i++) {
                const t = i / 200;
                const bandIndex = Math.floor(t * 63);
                const audioMod = 1 + bands[bandIndex] * 0.5;
                
                // Golden spiral: r = a * e^(b*theta)
                const theta = t * Math.PI * 6 + armOffset;
                const b = Math.log(goldenRatio) / (Math.PI / 2);
                const r = (5 + t * maxRadius * 0.8) * audioMod;
                
                const x = Math.cos(theta) * r;
                const y = Math.sin(theta) * r;
                
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxRadius);
                for (let i = 0; i < s.gradientStops; i++) {
                    const pos = Math.pow(i / (s.gradientStops - 1), 1 / s.gradientScalar);
                    grad.addColorStop(pos, s.colorStops[i]);
                }
                ctx.strokeStyle = grad;
            } else {
                ctx.strokeStyle = s.baseColor;
            }
            
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Draw audio-reactive dots along spiral
        for (let i = 0; i < 64; i++) {
            const t = i / 64;
            const theta = t * Math.PI * 6 + this._rotation * 0.5;
            const r = 20 + t * maxRadius * 0.7;
            const x = Math.cos(theta) * r;
            const y = Math.sin(theta) * r;
            
            const size = 3 + bands[i] * 15;
            const alpha = 0.3 + bands[i] * 0.7;
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const colorIndex = Math.floor(t * (s.gradientStops - 1));
                ctx.fillStyle = this._hexToRgba(s.colorStops[colorIndex], alpha);
            } else {
                ctx.fillStyle = this._hexToRgba(s.baseColor, alpha);
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
