// Atlas Manager - Handles sprite sheet loading and region management
// FIXED: Mipmaps now optional (off by default for sprites)

export class AtlasManager {
    constructor(gl, options = {}) {
        this.gl = gl;
        this.texture = null;
        this.regions = new Map();
        this.atlasSize = 2048;
        
        // Options with defaults optimized for sprites
        this.useMipmaps = options.useMipmaps ?? false;  // OFF by default
    }

    // Load atlas texture from image
    async loadAtlas(imagePath) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                this.createTexture(image);
                resolve();
            };
            image.onerror = reject;
            image.src = imagePath;
        });
    }

    createTexture(image, useMipmaps = this.useMipmaps) {
        const gl = this.gl;
        
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        // Upload image to GPU
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        // Texture parameters for sprite atlas
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // FIX: Mipmaps optional - saves ~33% VRAM when off
        if (useMipmaps) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            // No generateMipmap() call
        }
        
        this.atlasSize = image.width;
    }

    // Define regions in the atlas (pixel coordinates)
    defineRegion(name, x, y, width, height) {
        this.regions.set(name, {
            x: x / this.atlasSize,
            y: y / this.atlasSize,
            w: width / this.atlasSize,
            h: height / this.atlasSize,
            // Also store pixel values for reference
            px: x, py: y, pw: width, ph: height
        });
    }

    // Load region definitions from JSON
    loadRegions(jsonData) {
        // Expected format: { "regionName": { x, y, width, height }, ... }
        for (const [name, rect] of Object.entries(jsonData)) {
            this.defineRegion(name, rect.x, rect.y, rect.width, rect.height);
        }
    }

    // Load regions from JSON file
    async loadRegionsFromFile(jsonPath) {
        const response = await fetch(jsonPath);
        const data = await response.json();
        this.loadRegions(data);
    }

    getRegion(name) {
        return this.regions.get(name) || { x: 0, y: 0, w: 1, h: 1 };
    }

    bind(textureUnit = 0) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
}

// Utility: Generate atlas from individual images (run offline/build step)
export async function generateAtlas(images, cellSize = 128, atlasSize = 2048) {
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d');
    
    const cols = Math.floor(atlasSize / cellSize);
    const regions = {};
    
    for (let i = 0; i < images.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellSize;
        const y = row * cellSize;
        
        const img = images[i];
        ctx.drawImage(img.image, x, y, cellSize, cellSize);
        
        regions[img.name] = { x, y, width: cellSize, height: cellSize };
    }
    
    return {
        canvas,
        regions,
        toDataURL: () => canvas.toDataURL('image/png'),
        toBlob: () => new Promise(r => canvas.toBlob(r, 'image/png'))
    };
}
