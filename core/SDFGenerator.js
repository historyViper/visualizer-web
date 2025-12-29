// SDF Atlas Generator - Creates signed distance field textures from system fonts
// Generates atlas with both serif and sans-serif characters

export class SDFGenerator {
    constructor(options = {}) {
        this.fontSize = options.fontSize || 64;
        this.padding = options.padding || 8;
        this.radius = options.radius || 8;  // SDF spread radius
        this.cellSize = this.fontSize + this.padding * 2;
        this.atlasSize = options.atlasSize || 2048;
        
        // Font families
        this.fonts = {
            serif: 'Georgia, "Times New Roman", serif',
            sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
        };
        
        // Characters to include
        this.charsets = {
            // Musical notes (Unicode)
            notes: '♩♪♫♬𝄞𝄢',
            // Basic alphanumeric
            alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            // Common emoji-style symbols
            symbols: '★☆♥♦♠♣●○◆◇■□▲△▼▽',
            // Musical emoji (if supported)
            emoji: '🎵🎶🎤🎸🎹🎺🎻🥁',
            // Custom/user defined
            custom: ''
        };
    }

    // Generate SDF for a single character
    generateCharSDF(char, fontFamily) {
        const size = this.cellSize;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Clear
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, size, size);

        // Draw character
        ctx.fillStyle = 'white';
        ctx.font = `${this.fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, size / 2, size / 2);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        // Create binary mask (inside/outside)
        const mask = new Float32Array(size * size);
        for (let i = 0; i < size * size; i++) {
            mask[i] = pixels[i * 4] > 127 ? 1 : 0;
        }

        // Compute SDF using 8SSEDT (fast approximation)
        const sdf = this.computeSDF(mask, size, size);

        // Convert to 8-bit texture data
        const output = new Uint8Array(size * size);
        for (let i = 0; i < sdf.length; i++) {
            // Normalize: 0.5 = edge, 0 = far outside, 1 = far inside
            const normalized = 0.5 + sdf[i] / (this.radius * 2);
            output[i] = Math.max(0, Math.min(255, Math.round(normalized * 255)));
        }

        return { data: output, width: size, height: size };
    }

    // 8-point Signed Sequential Euclidean Distance Transform
    computeSDF(mask, width, height) {
        const INF = 1e10;
        const size = width * height;
        
        // Distance to nearest edge (inside and outside separately)
        const distInside = new Float32Array(size).fill(INF);
        const distOutside = new Float32Array(size).fill(INF);

        // Initialize
        for (let i = 0; i < size; i++) {
            if (mask[i] > 0.5) {
                distInside[i] = 0;
            } else {
                distOutside[i] = 0;
            }
        }

        // Forward pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                this.propagate(distInside, width, height, x, y, -1, 0);
                this.propagate(distInside, width, height, x, y, -1, -1);
                this.propagate(distInside, width, height, x, y, 0, -1);
                this.propagate(distInside, width, height, x, y, 1, -1);
                
                this.propagate(distOutside, width, height, x, y, -1, 0);
                this.propagate(distOutside, width, height, x, y, -1, -1);
                this.propagate(distOutside, width, height, x, y, 0, -1);
                this.propagate(distOutside, width, height, x, y, 1, -1);
            }
        }

        // Backward pass
        for (let y = height - 1; y >= 0; y--) {
            for (let x = width - 1; x >= 0; x--) {
                const i = y * width + x;
                this.propagate(distInside, width, height, x, y, 1, 0);
                this.propagate(distInside, width, height, x, y, 1, 1);
                this.propagate(distInside, width, height, x, y, 0, 1);
                this.propagate(distInside, width, height, x, y, -1, 1);
                
                this.propagate(distOutside, width, height, x, y, 1, 0);
                this.propagate(distOutside, width, height, x, y, 1, 1);
                this.propagate(distOutside, width, height, x, y, 0, 1);
                this.propagate(distOutside, width, height, x, y, -1, 1);
            }
        }

        // Combine: positive inside, negative outside
        const sdf = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            const inside = Math.sqrt(distInside[i]);
            const outside = Math.sqrt(distOutside[i]);
            sdf[i] = mask[i] > 0.5 ? inside : -outside;
        }

        return sdf;
    }

    propagate(dist, width, height, x, y, dx, dy) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;

        const i = y * width + x;
        const ni = ny * width + nx;
        const d = dx * dx + dy * dy;

        if (dist[ni] + d < dist[i]) {
            dist[i] = dist[ni] + d;
        }
    }

    // Generate full atlas with both font families
    generateAtlas(customChars = '') {
        const allChars = 
            this.charsets.notes +
            this.charsets.alpha +
            this.charsets.symbols +
            customChars;

        const cols = Math.floor(this.atlasSize / this.cellSize);
        const canvas = document.createElement('canvas');
        canvas.width = this.atlasSize;
        canvas.height = this.atlasSize;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.atlasSize, this.atlasSize);

        const regions = {};
        let index = 0;

        // Generate for each font family
        for (const [fontKey, fontFamily] of Object.entries(this.fonts)) {
            for (const char of allChars) {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = col * this.cellSize;
                const y = row * this.cellSize;

                if (y + this.cellSize > this.atlasSize) {
                    console.warn('Atlas full, stopping at', index, 'characters');
                    break;
                }

                const sdf = this.generateCharSDF(char, fontFamily);
                
                // Draw SDF to atlas
                const imgData = ctx.createImageData(this.cellSize, this.cellSize);
                for (let i = 0; i < sdf.data.length; i++) {
                    const v = sdf.data[i];
                    imgData.data[i * 4 + 0] = v;  // R
                    imgData.data[i * 4 + 1] = v;  // G
                    imgData.data[i * 4 + 2] = v;  // B
                    imgData.data[i * 4 + 3] = 255; // A
                }
                ctx.putImageData(imgData, x, y);

                // Store region
                const key = `${fontKey}_${char}`;
                regions[key] = {
                    x, y,
                    width: this.cellSize,
                    height: this.cellSize,
                    char,
                    font: fontKey
                };

                index++;
            }
        }

        return {
            canvas,
            regions,
            cellSize: this.cellSize,
            atlasSize: this.atlasSize,
            toDataURL: () => canvas.toDataURL('image/png'),
            toBlob: () => new Promise(r => canvas.toBlob(r, 'image/png'))
        };
    }
}

export default SDFGenerator;
