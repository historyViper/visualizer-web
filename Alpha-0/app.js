import { AudioAnalyzer } from './audio/analyzer.js';

// Minimal test version - renders without full shader pipeline
class VisualizerApp {
    constructor() {
        this.canvas = document.getElementById('visualizer-canvas');
        this.gl = this.canvas.getContext('webgl2');
        this.status = document.getElementById('status');
        
        if (!this.gl) {
            this.setStatus('WebGL2 not supported');
            return;
        }
        
        this.audio = new AudioAnalyzer();
        this.particles = { particleCount: 0 };  // Placeholder for UI
        
        this.frameTimes = [];
        this.lastTime = 0;
        
        // Settings
        this.settings = {
            maxDPR: 2,
            renderScale: 1.0
        };
        
        this.init();
    }

    setStatus(msg) {
        if (this.status) this.status.textContent = msg;
        console.log('[Status]', msg);
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.setupShaders();
        
        // Setup UI
        document.getElementById('btn-mic').onclick = () => this.startMic();
        document.getElementById('btn-file').onclick = () => this.loadAudioFile();
        
        this.setStatus('Ready - Click Mic or File');
        
        // Start render loop
        this.lastTime = performance.now();
        this.render();
    }

    setupShaders() {
        const gl = this.gl;
        
        // Simple fullscreen quad shader for audio visualization
        const vsSource = `#version 300 es
            in vec2 a_pos;
            out vec2 v_uv;
            void main() {
                v_uv = a_pos * 0.5 + 0.5;
                gl_Position = vec4(a_pos, 0.0, 1.0);
            }`;
        
        const fsSource = `#version 300 es
            precision highp float;
            in vec2 v_uv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform float u_audio;
            uniform vec3 u_bands;  // bass, mid, treble
            uniform vec2 u_res;
            
            void main() {
                vec2 uv = v_uv;
                vec2 p = (uv * 2.0 - 1.0);
                p.x *= u_res.x / u_res.y;
                
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Audio-reactive ring
                float ring = exp(-pow((r - 0.4 - u_bands.x * 0.2) * 5.0, 2.0));
                
                // Spiral pattern
                float spiral = sin(a * 6.0 - u_time * 2.0 + r * 10.0);
                spiral = spiral * 0.5 + 0.5;
                
                // Color from audio bands
                vec3 col = vec3(
                    0.2 + u_bands.x * 0.8,
                    0.1 + u_bands.y * 0.6,
                    0.3 + u_bands.z * 0.7
                );
                
                // Combine
                float intensity = ring * (0.5 + spiral * 0.5) * (0.3 + u_audio * 0.7);
                col *= intensity * 2.0;
                
                // Center glow
                float glow = exp(-r * 3.0) * u_audio;
                col += vec3(1.0, 0.8, 0.5) * glow;
                
                // Vignette
                col *= 1.0 - r * 0.5;
                
                fragColor = vec4(col, 1.0);
            }`;
        
        // Compile shaders
        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        
        if (!vs || !fs) {
            this.setStatus('Shader compile failed');
            return;
        }
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            this.setStatus('Shader link failed');
            return;
        }
        
        // Get uniform locations
        this.uniforms = {
            time: gl.getUniformLocation(this.program, 'u_time'),
            audio: gl.getUniformLocation(this.program, 'u_audio'),
            bands: gl.getUniformLocation(this.program, 'u_bands'),
            res: gl.getUniformLocation(this.program, 'u_res')
        };
        
        // Fullscreen quad
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  1, -1, -1, 1,
            -1,  1,  1, -1,  1, 1
        ]), gl.STATIC_DRAW);
        
        const loc = gl.getAttribLocation(this.program, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        
        this.setStatus('Shaders ready');
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    resize() {
        // FIX: Clamp DPR to prevent accidental 4K on mobile
        const dpr = Math.min(devicePixelRatio, this.settings.maxDPR);
        this.canvas.width = window.innerWidth * dpr * this.settings.renderScale;
        this.canvas.height = window.innerHeight * dpr * this.settings.renderScale;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    async startMic() {
        try {
            await this.audio.init('microphone');
            this.setStatus('Mic connected');
        } catch (e) {
            this.setStatus('Mic access denied');
        }
    }

    loadAudioFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const audioEl = new Audio(URL.createObjectURL(file));
            audioEl.play();
            await this.audio.init(audioEl);
            this.setStatus('Playing: ' + file.name);
        };
        input.click();
    }

    render() {
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        // Track frame time
        this.frameTimes.push(deltaTime * 1000);
        if (this.frameTimes.length > 60) this.frameTimes.shift();
        
        const gl = this.gl;
        
        // Get audio data
        const audioLevel = this.audio.getLevel();
        const bands = this.audio.getBands();
        
        // Render
        if (this.program) {
            gl.useProgram(this.program);
            gl.bindVertexArray(this.vao);
            
            gl.uniform1f(this.uniforms.time, now * 0.001);
            gl.uniform1f(this.uniforms.audio, audioLevel);
            gl.uniform3f(this.uniforms.bands, bands.bass, bands.mid, bands.treble);
            gl.uniform2f(this.uniforms.res, this.canvas.width, this.canvas.height);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        
        requestAnimationFrame(() => this.render());
    }

    getAverageFrameTime() {
        if (this.frameTimes.length === 0) return 16.67;
        return this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
    }
}

// Export for UI access
window.app = new VisualizerApp();
