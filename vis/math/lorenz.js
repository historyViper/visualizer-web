/**
 * Lorenz Attractor Visualizer - audio-reactive chaotic system
 */
export const Lorenz = {
    id: 'lorenz',
    name: 'Lorenz Attractor',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _audioParams: null,
    
    // Lorenz state
    _points: [],
    _maxPoints: 5000,
    _x: 0.1,
    _y: 0,
    _z: 0,
    
    // Lorenz parameters (will be audio-modulated)
    _sigma: 10,
    _rho: 28,
    _beta: 8/3,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
        this._points = [];
        this._x = 0.1;
        this._y = 0;
        this._z = 0;
    },
    
    resize(w, h) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        this._audioParams = audioFrame.audioParams;
        const bands = this._audio.getLogBands(8, this._audioParams);
        
        // Modulate Lorenz parameters with audio
        const bass = bands[0] + bands[1];
        const mid = bands[2] + bands[3] + bands[4];
        const high = bands[5] + bands[6] + bands[7];
        
        this._sigma = 10 + bass * 5;
        this._rho = 28 + mid * 10;
        this._beta = 8/3 + high * 2;
        
        // Integrate Lorenz system (multiple steps per frame for smoothness)
        const steps = 10;
        const stepDt = 0.005;
        
        for (let i = 0; i < steps; i++) {
            const dx = this._sigma * (this._y - this._x);
            const dy = this._x * (this._rho - this._z) - this._y;
            const dz = this._x * this._y - this._beta * this._z;
            
            this._x += dx * stepDt;
            this._y += dy * stepDt;
            this._z += dz * stepDt;
            
            this._points.push({ x: this._x, y: this._y, z: this._z });
        }
        
        // Limit trail length
        while (this._points.length > this._maxPoints) {
            this._points.shift();
        }
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) / 60;
        
        if (this._points.length < 2) return;
        
        ctx.save();
        
        if (s.glowAmount > 0) {
            ctx.shadowColor = s.baseColor;
            ctx.shadowBlur = s.glowAmount * 30;
        }
        
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        
        // Draw trail with gradient
        for (let i = 1; i < this._points.length; i++) {
            const p0 = this._points[i - 1];
            const p1 = this._points[i];
            const t = i / this._points.length;
            
            // Project 3D to 2D (simple orthographic with slight rotation based on z)
            const x0 = cx + p0.x * scale;
            const y0 = cy - p0.z * scale + p0.y * scale * 0.3;
            const x1 = cx + p1.x * scale;
            const y1 = cy - p1.z * scale + p1.y * scale * 0.3;
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const colorIndex = Math.floor(t * (s.gradientStops - 1));
                const nextIndex = Math.min(colorIndex + 1, s.gradientStops - 1);
                const localT = (t * (s.gradientStops - 1)) - colorIndex;
                const color = this._lerpColor(s.colorStops[colorIndex], s.colorStops[nextIndex], localT);
                ctx.strokeStyle = this._hexToRgba(color, t * 0.8 + 0.2);
            } else {
                ctx.strokeStyle = this._hexToRgba(s.baseColor, t * 0.8 + 0.2);
            }
            
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }
        
        // Draw current point
        const last = this._points[this._points.length - 1];
        const lx = cx + last.x * scale;
        const ly = cy - last.z * scale + last.y * scale * 0.3;
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    },
    
    dispose() {
        this._ctx = null;
        this._audio = null;
        this._points = [];
    },
    
    _lerpColor(c1, c2, t) {
        const r1 = parseInt(c1.slice(1, 3), 16);
        const g1 = parseInt(c1.slice(3, 5), 16);
        const b1 = parseInt(c1.slice(5, 7), 16);
        const r2 = parseInt(c2.slice(1, 3), 16);
        const g2 = parseInt(c2.slice(3, 5), 16);
        const b2 = parseInt(c2.slice(5, 7), 16);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    },
    
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
};
