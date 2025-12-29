// SDF Text Particle System - High-performance instanced text particles
// Supports serif + sans-serif, outlines, glow, audio reactivity
// FIXED: exponential scale bug, bufferData reallocation

import { SDFGenerator } from './SDFGenerator.js';

export class SDFParticleSystem {
    constructor(gl, maxParticles = 10000) {
        this.gl = gl;
        this.maxParticles = maxParticles;
        this.particleCount = 0;

        // Per-particle data
        this.positions = new Float32Array(maxParticles * 3);
        this.uvRects = new Float32Array(maxParticles * 4);
        this.colors = new Float32Array(maxParticles * 4);
        this.scales = new Float32Array(maxParticles);
        this.baseScales = new Float32Array(maxParticles);  // FIX: store original scale
        this.rotations = new Float32Array(maxParticles);
        this.velocities = new Float32Array(maxParticles * 3);
        this.lifetimes = new Float32Array(maxParticles);
        this.maxLifetimes = new Float32Array(maxParticles);

        // Atlas data
        this.atlasTexture = null;
        this.regions = {};
        this.generator = new SDFGenerator();

        // Rendering
        this.program = null;
        this.vao = null;
        this.uniforms = {};
        this.buffersAllocated = false;

        this.initBuffers();
    }

    async init(customChars = '') {
        // Generate SDF atlas
        console.log('Generating SDF atlas...');
        const atlas = this.generator.generateAtlas(customChars);
        this.regions = atlas.regions;
        
        // Upload atlas texture (NO mipmaps for sprites)
        const gl = this.gl;
        this.atlasTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);  // No mipmaps
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // NO gl.generateMipmap() - saves ~33% VRAM
        
        console.log('SDF atlas ready:', Object.keys(this.regions).length, 'glyphs');
        return atlas;
    }

    initBuffers() {
        const gl = this.gl;

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        // Quad geometry (billboard)
        const quadVerts = new Float32Array([
            -0.5, -0.5,  0, 0,
             0.5, -0.5,  1, 0,
             0.5,  0.5,  1, 1,
            -0.5, -0.5,  0, 0,
             0.5,  0.5,  1, 1,
            -0.5,  0.5,  0, 1
        ]);

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        // Position (vec2)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        // UV (vec2)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

        // Instance buffers - create handles
        this.posBuffer = gl.createBuffer();
        this.uvRectBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();
        this.scaleBuffer = gl.createBuffer();
        this.rotationBuffer = gl.createBuffer();

        // FIX: Pre-allocate GPU buffers at max size (avoids per-frame realloc)
        this.allocateInstanceBuffers();
    }

    allocateInstanceBuffers() {
        const gl = this.gl;
        
        // Allocate once at max capacity
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions.byteLength, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvRectBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvRects.byteLength, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colors.byteLength, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.scaleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.scales.byteLength, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.rotations.byteLength, gl.DYNAMIC_DRAW);
        
        this.buffersAllocated = true;
    }

    // Get region key for character
    getRegionKey(char, fontType = 'sans') {
        const key = `${fontType}_${char}`;
        if (this.regions[key]) return key;
        // Fallback to other font
        const altKey = `${fontType === 'sans' ? 'serif' : 'sans'}_${char}`;
        if (this.regions[altKey]) return altKey;
        // Ultimate fallback
        return Object.keys(this.regions)[0];
    }

    // Spawn a text particle
    spawn(options = {}) {
        if (this.particleCount >= this.maxParticles) return -1;

        const i = this.particleCount;
        const {
            char = '♪',
            font = 'sans',  // 'sans' or 'serif'
            position = [0, 0, 0],
            velocity = [0, 0.5, 0],
            color = [1, 1, 1, 1],
            scale = 0.5,
            rotation = 0,
            lifetime = 2.0
        } = options;

        // Position
        this.positions[i * 3] = position[0];
        this.positions[i * 3 + 1] = position[1];
        this.positions[i * 3 + 2] = position[2];

        // Velocity
        this.velocities[i * 3] = velocity[0];
        this.velocities[i * 3 + 1] = velocity[1];
        this.velocities[i * 3 + 2] = velocity[2];

        // UV rect from atlas
        const regionKey = this.getRegionKey(char, font);
        const region = this.regions[regionKey];
        const atlasSize = this.generator.atlasSize;
        
        this.uvRects[i * 4] = region.x / atlasSize;
        this.uvRects[i * 4 + 1] = region.y / atlasSize;
        this.uvRects[i * 4 + 2] = region.width / atlasSize;
        this.uvRects[i * 4 + 3] = region.height / atlasSize;

        // Color
        this.colors[i * 4] = color[0];
        this.colors[i * 4 + 1] = color[1];
        this.colors[i * 4 + 2] = color[2];
        this.colors[i * 4 + 3] = color[3];

        // FIX: Store base scale separately
        this.scales[i] = scale;
        this.baseScales[i] = scale;
        
        this.rotations[i] = rotation;
        this.lifetimes[i] = lifetime;
        this.maxLifetimes[i] = lifetime;

        this.particleCount++;
        return i;
    }

    // Spawn musical notes based on audio
    spawnFromAudio(audioLevel, bands, deltaTime) {
        // FIX: Cap spawn rate to prevent spikes
        const MAX_SPAWN_PER_FRAME = 15;
        const spawnRate = Math.min(Math.floor(audioLevel * 30), MAX_SPAWN_PER_FRAME);
        const notes = ['♩', '♪', '♫', '♬', '𝄞'];
        const fonts = ['sans', 'serif'];

        for (let i = 0; i < spawnRate; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.3 + bands.bass * 1.5;
            
            this.spawn({
                char: notes[Math.floor(Math.random() * notes.length)],
                font: fonts[Math.floor(Math.random() * fonts.length)],
                position: [
                    (Math.random() - 0.5) * 2,
                    -1.5,
                    (Math.random() - 0.5) * 0.5
                ],
                velocity: [
                    Math.cos(angle) * speed * 0.3,
                    0.5 + bands.treble * 2,
                    0
                ],
                color: [
                    0.5 + bands.bass * 0.5,
                    0.5 + bands.mid * 0.5,
                    0.5 + bands.treble * 0.5,
                    0.9
                ],
                scale: 0.15 + bands.mid * 0.2,
                rotation: (Math.random() - 0.5) * 0.5,
                lifetime: 2 + Math.random() * 2
            });
        }
    }

    update(deltaTime, audioLevel = 0) {
        for (let i = 0; i < this.particleCount; i++) {
            // Update lifetime
            this.lifetimes[i] -= deltaTime;

            if (this.lifetimes[i] <= 0) {
                this.removeParticle(i);
                i--;
                continue;
            }

            // Update position
            this.positions[i * 3] += this.velocities[i * 3] * deltaTime;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * deltaTime;
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * deltaTime;

            // Gentle rotation
            this.rotations[i] += deltaTime * 0.5;

            // Fade out near end of life
            const lifeRatio = this.lifetimes[i] / this.maxLifetimes[i];
            if (lifeRatio < 0.3) {
                this.colors[i * 4 + 3] = lifeRatio / 0.3;
            }

            // FIX: Audio reactive scale - multiply from BASE, not cumulative
            const pulse = 1.0 + audioLevel * 0.25;
            this.scales[i] = this.baseScales[i] * pulse;
        }
    }

    removeParticle(index) {
        const last = this.particleCount - 1;
        if (index !== last) {
            // Swap with last
            for (let j = 0; j < 3; j++) {
                this.positions[index * 3 + j] = this.positions[last * 3 + j];
                this.velocities[index * 3 + j] = this.velocities[last * 3 + j];
            }
            for (let j = 0; j < 4; j++) {
                this.uvRects[index * 4 + j] = this.uvRects[last * 4 + j];
                this.colors[index * 4 + j] = this.colors[last * 4 + j];
            }
            this.scales[index] = this.scales[last];
            this.baseScales[index] = this.baseScales[last];  // FIX: copy baseScale too
            this.rotations[index] = this.rotations[last];
            this.lifetimes[index] = this.lifetimes[last];
            this.maxLifetimes[index] = this.maxLifetimes[last];
        }
        this.particleCount--;
    }

    uploadBuffers() {
        const gl = this.gl;
        const count = this.particleCount;

        // FIX: Use bufferSubData instead of bufferData (no realloc)
        
        // Position (vec3, location 2)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions.subarray(0, count * 3));
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(2, 1);

        // UV Rect (vec4, location 3)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvRectBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvRects.subarray(0, count * 4));
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(3, 1);

        // Color (vec4, location 4)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colors.subarray(0, count * 4));
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(4, 1);

        // Scale (float, location 5)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.scaleBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.scales.subarray(0, count));
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(5, 1);

        // Rotation (float, location 6)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.rotations.subarray(0, count));
        gl.enableVertexAttribArray(6);
        gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(6, 1);
    }

    render(program, uniforms = {}) {
        if (this.particleCount === 0) return;

        const gl = this.gl;

        gl.useProgram(program);
        gl.bindVertexArray(this.vao);

        // Bind atlas
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);

        // Upload instance data
        this.uploadBuffers();

        // Set uniforms
        const defaultUniforms = {
            u_edgeWidth: 0.1,
            u_outlineWidth: 0.08,
            u_outlineColor: [0, 0, 0, 1],
            u_glowStrength: 0.3,
            u_glowColor: [1, 1, 1, 0.5]
        };

        const finalUniforms = { ...defaultUniforms, ...uniforms };

        for (const [name, value] of Object.entries(finalUniforms)) {
            const loc = gl.getUniformLocation(program, name);
            if (loc === null) continue;

            if (Array.isArray(value)) {
                if (value.length === 4) gl.uniform4fv(loc, value);
                else if (value.length === 3) gl.uniform3fv(loc, value);
                else if (value.length === 2) gl.uniform2fv(loc, value);
            } else {
                gl.uniform1f(loc, value);
            }
        }

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Draw instanced
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.particleCount);
    }
}

export default SDFParticleSystem;
