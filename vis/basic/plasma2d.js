/**
 * Plasma/Lightning Visualizer - Audio-reactive electric arcs
 * Modes: 'arcs' (screen lightning) or 'ball' (center plasma ball)
 */
export const Plasma2D = {
    id: 'plasma2d',
    name: 'Plasma Lightning',
    type: '2d',

    _ctx: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _time: 0,
    _arcs: [],
    _hueOffset: 0,
    _audioParams: null,

    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
        this._audio = services.audio;
        this._arcs = [];
        this._hueOffset = Math.random() * 360;
    },

    resize(w, h) {
        this._width = w;
        this._height = h;
    },

    update(dt, audioFrame) {
        this._time += dt;
        this._audioParams = audioFrame.audioParams;
        
        const bands = this._audio.getLogBands(16, this._audioParams);
        const s = this._settings;
        
        // Spawn new arcs based on amplitude thresholds
        for (let i = 0; i < bands.length; i++) {
            const amp = bands[i];
            const freq = s.freqMin + (s.freqMax - s.freqMin) * (i / bands.length);
            
            // Higher amplitude = more likely to spawn
            if (amp > 0.3 && Math.random() < amp * 0.3) {
                this._spawnArc(amp, freq, i / bands.length);
            }
        }
        
        // Update existing arcs
        for (let i = this._arcs.length - 1; i >= 0; i--) {
            const arc = this._arcs[i];
            arc.life -= dt / arc.duration;
            
            if (arc.life <= 0) {
                this._arcs.splice(i, 1);
            } else {
                // Regenerate path occasionally for flickering effect
                if (Math.random() < 0.3) {
                    arc.points = this._generateLightningPath(arc.start, arc.end, arc.segments);
                }
            }
        }
        
        // Cycle hue for rainbow mode
        this._hueOffset = (this._hueOffset + dt * 50) % 360;
    },

    _spawnArc(amplitude, frequency, freqNorm) {
        const s = this._settings;
        const mode = s.plasmaMode || 'arcs';
        const cx = this._width / 2;
        const cy = this._height / 2;
        
        let start, end;
        
        if (mode === 'ball') {
            // Arcs radiate from center
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.min(this._width, this._height) * (0.3 + amplitude * 0.4);
            start = { x: cx, y: cy };
            end = {
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            };
        } else {
            // Random screen arcs
            const side = Math.floor(Math.random() * 4);
            if (side === 0) start = { x: Math.random() * this._width, y: 0 };
            else if (side === 1) start = { x: this._width, y: Math.random() * this._height };
            else if (side === 2) start = { x: Math.random() * this._width, y: this._height };
            else start = { x: 0, y: Math.random() * this._height };
            
            end = {
                x: this._width * 0.2 + Math.random() * this._width * 0.6,
                y: this._height * 0.2 + Math.random() * this._height * 0.6
            };
        }
        
        // Duration based on frequency: low freq = longer, high freq = shorter
        const baseDuration = 0.1 + (1 - freqNorm) * 0.4;
        const duration = baseDuration * (1 + (1 - s.smoothing) * 2);
        
        // Color based on mode
        let color;
        const colorMode = s.plasmaColorMode || 'cycle';
        
        if (colorMode === 'fixed') {
            color = s.baseColor || '#00ff88';
        } else if (colorMode === 'gradient' && s.gradientEnabled) {
            const idx = Math.floor(freqNorm * s.gradientStops);
            color = s.colorStops[Math.min(idx, s.colorStops.length - 1)];
        } else if (colorMode === 'random') {
            color = `hsl(${Math.random() * 360}, 100%, 60%)`;
        } else {
            // Cycle mode - smooth HSL rotation
            const hue = (this._hueOffset + freqNorm * 120) % 360;
            color = `hsl(${hue}, 100%, 60%)`;
        }
        
        const segments = 8 + Math.floor(amplitude * 12);
        
        this._arcs.push({
            start,
            end,
            points: this._generateLightningPath(start, end, segments),
            life: 1,
            duration,
            color,
            amplitude,
            width: 1 + amplitude * 3,
            segments
        });
    },

    _generateLightningPath(start, end, segments) {
        const points = [{ x: start.x, y: start.y }];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / len;
        const perpY = dx / len;
        
        // Jaggedness decreases with smoothing
        const s = this._settings;
        const jagged = len * 0.15 * (1 - (s.smoothing || 0) * 0.8);
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const baseX = start.x + dx * t;
            const baseY = start.y + dy * t;
            const offset = (Math.random() - 0.5) * 2 * jagged * (1 - Math.abs(t - 0.5) * 2);
            
            points.push({
                x: baseX + perpX * offset,
                y: baseY + perpY * offset
            });
        }
        
        points.push({ x: end.x, y: end.y });
        return points;
    },

    render() {
        const ctx = this._ctx;
        const s = this._settings;
        
        // Clear with background
        ctx.fillStyle = s.bgColor || '#0a0a0f';
        ctx.globalAlpha = s.bgAlpha ?? 1;
        ctx.fillRect(0, 0, this._width, this._height);
        ctx.globalAlpha = 1;
        
        // Heavy glow effect
        const glowAmount = Math.max(s.glowAmount || 0.5, 0.3);
        ctx.shadowBlur = 20 + glowAmount * 40;
        
        // Draw all arcs
        for (const arc of this._arcs) {
            const alpha = arc.life * arc.life; // Ease out
            
            ctx.shadowColor = arc.color;
            ctx.strokeStyle = arc.color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = arc.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Main bolt
            ctx.beginPath();
            ctx.moveTo(arc.points[0].x, arc.points[0].y);
            for (let i = 1; i < arc.points.length; i++) {
                ctx.lineTo(arc.points[i].x, arc.points[i].y);
            }
            ctx.stroke();
            
            // Brighter core
            ctx.lineWidth = arc.width * 0.4;
            ctx.globalAlpha = alpha * 0.8;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            
            // Occasional branches
            if (arc.amplitude > 0.5 && arc.points.length > 4) {
                ctx.lineWidth = arc.width * 0.5;
                ctx.strokeStyle = arc.color;
                ctx.globalAlpha = alpha * 0.6;
                
                const branchIdx = Math.floor(arc.points.length * 0.4 + Math.random() * arc.points.length * 0.3);
                const branchStart = arc.points[branchIdx];
                if (branchStart) {
                    const branchAngle = Math.random() * Math.PI - Math.PI / 2;
                    const branchLen = 30 + arc.amplitude * 50;
                    const branchEnd = {
                        x: branchStart.x + Math.cos(branchAngle) * branchLen,
                        y: branchStart.y + Math.sin(branchAngle) * branchLen
                    };
                    const branchPoints = this._generateLightningPath(branchStart, branchEnd, 4);
                    
                    ctx.beginPath();
                    ctx.moveTo(branchPoints[0].x, branchPoints[0].y);
                    for (let i = 1; i < branchPoints.length; i++) {
                        ctx.lineTo(branchPoints[i].x, branchPoints[i].y);
                    }
                    ctx.stroke();
                }
            }
        }
        
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    },

    dispose() {
        this._arcs = [];
        this._audio = null;
    }
};
