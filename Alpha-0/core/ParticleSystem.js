// Particle System with Instanced Rendering and Sprite Atlas Support
export class ParticleSystem {
    constructor(gl, maxParticles = 20000) {
        this.gl = gl;
        this.maxParticles = maxParticles;
        this.particleCount = 0;
        
        // Per-particle data arrays
        this.positions = new Float32Array(maxParticles * 3);
        this.uvOffsets = new Float32Array(maxParticles * 4);  // atlas region per particle
        this.opacities = new Float32Array(maxParticles);
        this.scales = new Float32Array(maxParticles);
        this.colors = new Float32Array(maxParticles * 3);
        this.velocities = new Float32Array(maxParticles * 3);
        this.lifetimes = new Float32Array(maxParticles);
        
        this.atlasRegions = new Map();  // name -> {x, y, w, h}
        this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;
        
        // Quad geometry (billboard)
        const quadVerts = new Float32Array([
            -0.5, -0.5, 0,  0, 0,
             0.5, -0.5, 0,  1, 0,
             0.5,  0.5, 0,  1, 1,
            -0.5,  0.5, 0,  0, 1
        ]);
        const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        
        // Geometry buffers
        this.quadVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
        
        this.quadEBO = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadEBO);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);
        
        // Instance buffers (DYNAMIC_DRAW for frequent updates)
        this.posBuffer = gl.createBuffer();
        this.uvOffsetBuffer = gl.createBuffer();
        this.opacityBuffer = gl.createBuffer();
        this.scaleBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();
    }

    // Register a sprite region in the atlas
    registerAtlasRegion(name, x, y, width, height, atlasSize = 2048) {
        this.atlasRegions.set(name, {
            x: x / atlasSize,
            y: y / atlasSize,
            w: width / atlasSize,
            h: height / atlasSize
        });
    }

    // Spawn a particle
    spawn(options = {}) {
        if (this.particleCount >= this.maxParticles) return;
        
        const i = this.particleCount;
        const {
            position = [0, 0, 0],
            velocity = [0, 0, 0],
            sprite = 'default',
            opacity = 1.0,
            scale = 1.0,
            color = [1, 1, 1],
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
        
        // Atlas UV offset
        const region = this.atlasRegions.get(sprite) || { x: 0, y: 0, w: 1, h: 1 };
        this.uvOffsets[i * 4] = region.x;
        this.uvOffsets[i * 4 + 1] = region.y;
        this.uvOffsets[i * 4 + 2] = region.w;
        this.uvOffsets[i * 4 + 3] = region.h;
        
        this.opacities[i] = opacity;
        this.scales[i] = scale;
        this.colors[i * 3] = color[0];
        this.colors[i * 3 + 1] = color[1];
        this.colors[i * 3 + 2] = color[2];
        this.lifetimes[i] = lifetime;
        
        this.particleCount++;
    }

    // Update particles (call each frame)
    update(deltaTime, audioLevel = 0) {
        for (let i = 0; i < this.particleCount; i++) {
            // Update lifetime
            this.lifetimes[i] -= deltaTime;
            
            if (this.lifetimes[i] <= 0) {
                this.removeParticle(i);
                i--;
                continue;
            }
            
            // Update position based on velocity
            this.positions[i * 3] += this.velocities[i * 3] * deltaTime;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * deltaTime;
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * deltaTime;
            
            // Fade out as lifetime decreases
            if (this.lifetimes[i] < 0.5) {
                this.opacities[i] = this.lifetimes[i] * 2;
            }
            
            // Audio reactivity - scale pulse
            this.scales[i] *= (1.0 + audioLevel * 0.1);
        }
    }

    removeParticle(index) {
        const last = this.particleCount - 1;
        if (index !== last) {
            // Swap with last particle
            for (let j = 0; j < 3; j++) {
                this.positions[index * 3 + j] = this.positions[last * 3 + j];
                this.velocities[index * 3 + j] = this.velocities[last * 3 + j];
                this.colors[index * 3 + j] = this.colors[last * 3 + j];
            }
            for (let j = 0; j < 4; j++) {
                this.uvOffsets[index * 4 + j] = this.uvOffsets[last * 4 + j];
            }
            this.opacities[index] = this.opacities[last];
            this.scales[index] = this.scales[last];
            this.lifetimes[index] = this.lifetimes[last];
        }
        this.particleCount--;
    }

    // Upload data to GPU and render
    render(shaderProgram) {
        const gl = this.gl;
        
        // Update instance buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions.subarray(0, this.particleCount * 3), gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvOffsetBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvOffsets.subarray(0, this.particleCount * 4), gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.opacityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.opacities.subarray(0, this.particleCount), gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.scaleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.scales.subarray(0, this.particleCount), gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.colors.subarray(0, this.particleCount * 3), gl.DYNAMIC_DRAW);
        
        // Draw instanced
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadEBO);
        gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, this.particleCount);
    }
}
