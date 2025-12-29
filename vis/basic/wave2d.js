/**
 * 2D Waveform Oscilloscope Visualizer
 */
export const Wave2D = {
    id: 'wave2d',
    name: '2D Waveform',
    type: '2d',
    
    _ctx: null,
    _settings: null,
    _width: 0,
    _height: 0,
    
    init(ctx, services, settings) {
        this._ctx = ctx.ctx2d;
        this._settings = settings;
    },
    
    resize(w, h, dpr, renderScale) {
        this._width = w;
        this._height = h;
    },
    
    update(dt, audioFrame) {
        // Waveform uses raw data directly in render
        this._waveform = audioFrame.waveformData;
    },
    
    render() {
        const ctx = this._ctx;
        const s = this._settings;
        const w = this._width;
        const h = this._height;
        const waveform = this._waveform;
        
        if (!waveform || waveform.length === 0) return;
        
        ctx.strokeStyle = s.baseColor || '#00ff88';
        ctx.lineWidth = 2;
        
        if (s.glowAmount > 0) {
            ctx.shadowColor = s.baseColor || '#00ff88';
            ctx.shadowBlur = s.glowAmount * 20;
        }
        
        ctx.beginPath();
        
        const sliceWidth = w / waveform.length;
        let x = 0;
        
        for (let i = 0; i < waveform.length; i++) {
            const v = waveform[i] / 128.0;  // 0-255 -> 0-2
            const y = (v * h) / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        
        ctx.stroke();
        ctx.shadowBlur = 0;
    },
    
    dispose() {
        this._ctx = null;
    }
};
