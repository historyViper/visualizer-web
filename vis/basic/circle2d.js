/**
 * 2D Circle Spectrum Visualizer with block mode and gradient support
 */
export const Circle2D = {
    id: 'circle2d',
    name: '2D Circle Spectrum',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _barCount: 64,
    _audioParams: null,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
    },
    
    resize(w, h) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        this._audioParams = audioFrame.audioParams;
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
        
        const bands = this._audio.getLogBands(this._barCount, this._audioParams);
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // Draw center logo if position is 'center'
        if (s.overlayPosition === 'center' && s.logoImage) {
            const logoSize = (s.logoSize || 60) * (w / 1920);
            ctx.drawImage(s.logoImage, -logoSize/2, -logoSize/2, logoSize, logoSize);
        }
        
        for (let i = 0; i < this._barCount; i++) {
            const angle = (i / this._barCount) * Math.PI * 2 - Math.PI / 2;
            const value = bands[i];
            const barLength = value * maxBarLength;
            
            if (s.glowAmount > 0) {
                ctx.shadowColor = s.baseColor;
                ctx.shadowBlur = s.glowAmount * 20;
            } else {
                ctx.shadowBlur = 0;
            }
            
            if (s.barMode === 'blocks' && barLength > 0) {
                this._renderBlocks(ctx, angle, baseRadius, barLength, i);
            } else {
                this._renderSolidBar(ctx, angle, baseRadius, barLength, i);
            }
        }
        
        ctx.restore();
        ctx.shadowBlur = 0;
    },
    
    _renderSolidBar(ctx, angle, baseR, length, index) {
        const s = this._settings;
        const x1 = Math.cos(angle) * baseR;
        const y1 = Math.sin(angle) * baseR;
        const x2 = Math.cos(angle) * (baseR + length);
        const y2 = Math.sin(angle) * (baseR + length);
        
        if (s.gradientEnabled && s.gradientStops >= 2) {
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            for (let i = 0; i < s.gradientStops; i++) {
                const pos = Math.pow(i / (s.gradientStops - 1), 1 / (s.gradientScalar || 1));
                const alpha = this._getAlphaAt(pos);
                grad.addColorStop(pos, this._hexToRgba(s.colorStops[i], alpha));
            }
            ctx.strokeStyle = grad;
        } else {
            ctx.strokeStyle = this._hexToRgba(s.baseColor, this._getAlphaAt(0.5));
        }
        
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    },
    
    _renderBlocks(ctx, angle, baseR, length, index) {
        const s = this._settings;
        const segH = s.segmentHeight || 8;
        const segGap = s.segmentGap || 2;
        const segments = Math.ceil(length / (segH + segGap));
        
        for (let seg = 0; seg < segments; seg++) {
            const r1 = baseR + seg * (segH + segGap);
            const r2 = r1 + segH;
            if (r2 > baseR + length) continue;
            
            const t = seg / Math.max(segments - 1, 1);
            
            if (s.gradientEnabled && s.gradientStops >= 2) {
                const colorIndex = Math.floor(t * (s.gradientStops - 1));
                const nextIndex = Math.min(colorIndex + 1, s.gradientStops - 1);
                const localT = (t * (s.gradientStops - 1)) - colorIndex;
                const color = this._lerpColor(s.colorStops[colorIndex], s.colorStops[nextIndex], localT);
                ctx.fillStyle = this._hexToRgba(color, this._getAlphaAt(t));
            } else {
                ctx.fillStyle = this._hexToRgba(s.baseColor, this._getAlphaAt(t));
            }
            
            const arcWidth = (Math.PI * 2 / this._barCount) * 0.7;
            ctx.beginPath();
            ctx.arc(0, 0, r1, angle - arcWidth/2, angle + arcWidth/2);
            ctx.arc(0, 0, r2, angle + arcWidth/2, angle - arcWidth/2, true);
            ctx.closePath();
            ctx.fill();
        }
    },
    
    _getAlphaAt(t) {
        const s = this._settings;
        const start = s.alphaStart !== undefined ? s.alphaStart : 1;
        const end = s.alphaEnd !== undefined ? s.alphaEnd : 0.3;
        const scalar = s.alphaScalar || 1;
        const scaledT = Math.pow(t, 1 / scalar);
        return start + (end - start) * scaledT;
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
