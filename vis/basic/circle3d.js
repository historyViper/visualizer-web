/**
 * 3D Circle Spectrum Visualizer (WebGL2 Instanced) - uses logarithmic frequency mapping
 */
export const Circle3D = {
    id: 'circle3d',
    name: '3D Circle Spectrum',
    type: 'webgl2',
    
    _gl: null,
    _settings: null,
    _audio: null,
    _width: 0,
    _height: 0,
    _program: null,
    _vao: null,
    _instanceBuffer: null,
    _barCount: 48,
    _instanceData: null,
    _time: 0,
    _audioParams: null,
    
    init(ctx, services, settings) {
        this._gl = ctx.gl;
        this._settings = settings;
        this._audio = services.audio;
        this._instanceData = new Float32Array(this._barCount * 4);
        
        this._setupShaders();
        this._setupGeometry();
    },
    
    _setupShaders() {
        const gl = this._gl;
        
        const vsSource = `#version 300 es
            layout(location=0) in vec3 a_pos;
            layout(location=1) in vec3 a_normal;
            layout(location=2) in vec4 a_instance;
            
            uniform mat4 u_proj;
            uniform mat4 u_view;
            uniform vec3 u_baseColor;
            
            out vec3 v_normal;
            out vec3 v_color;
            out float v_height;
            
            void main() {
                float angle = a_instance.x;
                float radius = a_instance.y;
                float height = a_instance.w;
                
                vec3 pos = a_pos;
                pos.y *= height;
                
                float c = cos(angle);
                float s = sin(angle);
                
                vec3 rotated;
                rotated.x = pos.x * c + pos.z * s + radius * c;
                rotated.y = pos.y;
                rotated.z = -pos.x * s + pos.z * c + radius * s;
                
                gl_Position = u_proj * u_view * vec4(rotated, 1.0);
                
                vec3 rn;
                rn.x = a_normal.x * c + a_normal.z * s;
                rn.y = a_normal.y;
                rn.z = -a_normal.x * s + a_normal.z * c;
                v_normal = rn;
                
                v_height = height / 5.0;
                v_color = u_baseColor;
            }`;
        
        const fsSource = `#version 300 es
            precision highp float;
            
            in vec3 v_normal;
            in vec3 v_color;
            in float v_height;
            
            uniform float u_glowAmount;
            uniform float u_alphaGradient;
            
            out vec4 fragColor;
            
            void main() {
                vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
                float diff = max(dot(normalize(v_normal), lightDir), 0.0);
                
                vec3 col = v_color * (0.3 + diff * 0.7);
                col *= 0.5 + v_height * 0.5;
                col += v_color * u_glowAmount * v_height * 0.5;
                
                float alpha = 1.0 - u_alphaGradient * (1.0 - v_height);
                fragColor = vec4(col, alpha);
            }`;
        
        const vs = this._compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSource);
        
        this._program = gl.createProgram();
        gl.attachShader(this._program, vs);
        gl.attachShader(this._program, fs);
        gl.linkProgram(this._program);
        
        this._uniforms = {
            proj: gl.getUniformLocation(this._program, 'u_proj'),
            view: gl.getUniformLocation(this._program, 'u_view'),
            baseColor: gl.getUniformLocation(this._program, 'u_baseColor'),
            glowAmount: gl.getUniformLocation(this._program, 'u_glowAmount'),
            alphaGradient: gl.getUniformLocation(this._program, 'u_alphaGradient')
        };
    },
    
    _compileShader(type, source) {
        const gl = this._gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader error:', gl.getShaderInfoLog(shader));
        }
        return shader;
    },
    
    _setupGeometry() {
        const gl = this._gl;
        
        const boxVerts = new Float32Array([
            -0.3,0,0.3, 0,0,1,  0.3,0,0.3, 0,0,1,  0.3,1,0.3, 0,0,1,
            -0.3,0,0.3, 0,0,1,  0.3,1,0.3, 0,0,1, -0.3,1,0.3, 0,0,1,
            0.3,0,-0.3, 0,0,-1, -0.3,0,-0.3, 0,0,-1, -0.3,1,-0.3, 0,0,-1,
            0.3,0,-0.3, 0,0,-1, -0.3,1,-0.3, 0,0,-1,  0.3,1,-0.3, 0,0,-1,
            0.3,0,0.3, 1,0,0,  0.3,0,-0.3, 1,0,0,  0.3,1,-0.3, 1,0,0,
            0.3,0,0.3, 1,0,0,  0.3,1,-0.3, 1,0,0,  0.3,1,0.3, 1,0,0,
            -0.3,0,-0.3, -1,0,0, -0.3,0,0.3, -1,0,0, -0.3,1,0.3, -1,0,0,
            -0.3,0,-0.3, -1,0,0, -0.3,1,0.3, -1,0,0, -0.3,1,-0.3, -1,0,0,
            -0.3,1,0.3, 0,1,0,  0.3,1,0.3, 0,1,0,  0.3,1,-0.3, 0,1,0,
            -0.3,1,0.3, 0,1,0,  0.3,1,-0.3, 0,1,0, -0.3,1,-0.3, 0,1,0,
        ]);
        
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
        
        const geomBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, geomBuf);
        gl.bufferData(gl.ARRAY_BUFFER, boxVerts, gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        
        this._instanceBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._instanceData.byteLength, gl.DYNAMIC_DRAW);
        
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(2, 1);
        
        gl.bindVertexArray(null);
        
        this._vertexCount = boxVerts.length / 6;
    },
    
    resize(w, h, dpr, renderScale) {
        this._width = w;
        this._height = h;
        this._aspect = w / h;
    },
    
    update(dt, audioFrame) {
        this._time += dt;
        this._audioParams = audioFrame.audioParams;
        
        // Get log-mapped bands
        const bands = this._audio.getLogBands(this._barCount, this._audioParams);
        
        const radius = 8;
        for (let i = 0; i < this._barCount; i++) {
            const angle = (i / this._barCount) * Math.PI * 2;
            const idx = i * 4;
            this._instanceData[idx] = angle;
            this._instanceData[idx + 1] = radius;
            this._instanceData[idx + 2] = 0;
            this._instanceData[idx + 3] = bands[i] * 5 + 0.2;
        }
    },
    
    render() {
        const gl = this._gl;
        const s = this._settings;
        
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        gl.useProgram(this._program);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._instanceData);
        
        const proj = this._perspective(45 * Math.PI / 180, this._aspect, 0.1, 100);
        const camY = 15 + Math.sin(this._time * 0.3) * 3;
        const camDist = 25;
        const camAngle = this._time * 0.2;
        const view = this._lookAt(
            [Math.sin(camAngle) * camDist, camY, Math.cos(camAngle) * camDist],
            [0, 2, 0],
            [0, 1, 0]
        );
        
        gl.uniformMatrix4fv(this._uniforms.proj, false, proj);
        gl.uniformMatrix4fv(this._uniforms.view, false, view);
        
        const col = this._hexToRgb(s.baseColor || '#00ff88');
        gl.uniform3f(this._uniforms.baseColor, col.r, col.g, col.b);
        gl.uniform1f(this._uniforms.glowAmount, s.glowAmount || 0);
        gl.uniform1f(this._uniforms.alphaGradient, s.alphaGradient || 0);
        
        gl.bindVertexArray(this._vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, this._vertexCount, this._barCount);
        
        gl.disable(gl.DEPTH_TEST);
    },
    
    dispose() {
        const gl = this._gl;
        if (this._vao) gl.deleteVertexArray(this._vao);
        if (this._instanceBuffer) gl.deleteBuffer(this._instanceBuffer);
        if (this._program) gl.deleteProgram(this._program);
        this._audio = null;
    },
    
    _hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { r, g, b };
    },
    
    _perspective(fov, aspect, near, far) {
        const f = 1 / Math.tan(fov / 2);
        const nf = 1 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0
        ]);
    },
    
    _lookAt(eye, center, up) {
        const z = this._normalize([eye[0]-center[0], eye[1]-center[1], eye[2]-center[2]]);
        const x = this._normalize(this._cross(up, z));
        const y = this._cross(z, x);
        return new Float32Array([
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -this._dot(x, eye), -this._dot(y, eye), -this._dot(z, eye), 1
        ]);
    },
    
    _normalize(v) {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        return [v[0]/len, v[1]/len, v[2]/len];
    },
    _cross(a, b) {
        return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    },
    _dot(a, b) {
        return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    }
};
