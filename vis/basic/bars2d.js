/**
 * 2D Spectrum Bars Visualizer with block mode and gradient support
 */
export const Bars2D = {
    id: 'bars2d',
    name: '2D Spectrum Bars',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _barCount: 64,
    _audioParams: null,
    _time: 0,
    _hueOffset: 0,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
        this._hueOffset = Math.random() * 360;
    },
    
    resize(w, h) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        this._audioParams = audioFrame.audioParams;
        this._time += dt;
        this._hueOffset = (this._hueOffset + dt * 30) % 360;
    },
    
    _getColorForPosition(t, index) {
        const s = this._settings;
        const colorMode = s.colorMode || 'fixed';
        
        if (colorMode === 'gradient' && s.gradientStops >= 2) {
            const colorIndex = Math.floor(t * (s.gradientStops - 1));
            const nextIndex = Math.min(colorIndex + 1, s.gradientStops - 1);
            const localT = (t * (s.gradientStops - 1)) - colorIndex;
            return this._lerpColor(s.colorStops[colorIndex], s.colorStops[nextIndex], localT);
        } else if (colorMode === 'cycle') {
            const hue = (this._hueOffset + index * 5 + t * 60) % 360;
            return `hsl(${hue}, 100%, 55%)`;
        } else if (colorMode === 'random') {
            const hue = (index * 137.5 + this._time * 20) % 360;
            return `hsl(${hue}, 100%, 55%)`;
        }
        return s.baseColor || '#00ff88';
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        
        const bands = this._audio.getLogBands(this._barCount, this._audioParams);
        const barWidth = w / this._barCount * 0.8;
        const gap = w / this._barCount * 0.2;
        
        for (let i = 0; i < this._barCount; i++) {
            const value = bands[i];
            const barHeight = value * h * 0.85;
            const x = i * (barWidth + gap) + gap / 2;
            const y = h - barHeight;
            
            if (s.glowAmount > 0) {
                ctx.shadowColor = s.baseColor;
                ctx.shadowBlur = s.glowAmount * 30;
            } else {
                ctx.shadowBlur = 0;
            }
            
            if (s.barMode === 'blocks' && barHeight > 0) {
                this._renderBlocks(ctx, x, y, barWidth, barHeight, i);
            } else {
                this._renderSolidBar(ctx, x, y, barWidth, barHeight, i);
            }
        }
        
        ctx.shadowBlur = 0;
    },
    
    _renderSolidBar(ctx, x, y, w, h, index) {
        const s = this._settings;
        const colorMode = s.colorMode || 'fixed';
        
        if (colorMode === 'gradient' && s.gradientStops >= 2) {
            const grad = ctx.createLinearGradient(x, this._height, x, y);
            const stops = s.gradientStops;
            for (let i = 0; i < stops; i++) {
                const pos = Math.pow(i / (stops - 1), 1 / s.gradientScalar);
                const alpha = this._getAlphaAt(pos);
                grad.addColorStop(pos, this._hexToRgba(s.colorStops[i], alpha));
            }
            ctx.fillStyle = grad;
        } else {
            const color = this._getColorForPosition(0.5, index);
            ctx.fillStyle = this._hexToRgba(color, this._getAlphaAt(0.5));
        }
        
        ctx.fillRect(x, y, w, h);
    },
    
    _renderBlocks(ctx, x, y, barW, barH, index) {
        const s = this._settings;
        const segH = s.segmentHeight || 8;
        const segGap = s.segmentGap || 2;
        const segments = Math.ceil(barH / (segH + segGap));
        const colorMode = s.colorMode || 'fixed';
        
        for (let seg = 0; seg < segments; seg++) {
            const segY = this._height - (seg + 1) * (segH + segGap);
            if (segY < y) continue;
            
            const t = seg / Math.max(segments - 1, 1);
            const color = this._getColorForPosition(t, index);
            ctx.fillStyle = this._hexToRgba(color, this._getAlphaAt(t));
            
            if (s.roundedBlocks) {
                this._roundRect(ctx, x, segY, barW, segH, 2);
            } else {
                ctx.fillRect(x, segY, barW, segH);
            }
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
    
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
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
    
    _hexToRgba(color, alpha) {
        if (color.startsWith('hsl')) {
            // Extract HSL values and convert to HSLA
            return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
        }
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
};
