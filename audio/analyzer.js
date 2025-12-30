// Audio Analyzer - Advanced frequency extraction with perceptual weighting
export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.floatArray = null;
        this.source = null;
        this.isInitialized = false;
        this.sampleRate = 44100;
        
        // Preallocated buffers (avoid per-frame alloc)
        this._rawBands = new Map();      // bandCount -> Float32Array
        this._smoothedBands = new Map(); // bandCount -> Float32Array
        this._peakBands = new Map();     // bandCount -> Float32Array (for attack/release)
    }

    async init(audioSource = 'microphone') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sampleRate = this.audioContext.sampleRate;
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 4096; // High resolution
        this.analyser.smoothingTimeConstant = 0.1; // Minimal - we handle smoothing
        
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.floatArray = new Float32Array(bufferLength);

        if (audioSource === 'microphone') {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.source = this.audioContext.createMediaStreamSource(stream);
        } else if (audioSource instanceof HTMLAudioElement) {
            this.source = this.audioContext.createMediaElementSource(audioSource);
            this.source.connect(this.audioContext.destination);
        }
        
        this.source.connect(this.analyser);
        this.isInitialized = true;
    }

    getLevel() {
        if (!this.isInitialized) return 0;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
        return sum / (this.dataArray.length * 255);
    }

    getBands() {
        if (!this.isInitialized) return { bass: 0, mid: 0, treble: 0 };
        this.analyser.getByteFrequencyData(this.dataArray);
        const third = Math.floor(this.dataArray.length / 3);
        let bass = 0, mid = 0, treble = 0;
        for (let i = 0; i < third; i++) bass += this.dataArray[i];
        for (let i = third; i < third * 2; i++) mid += this.dataArray[i];
        for (let i = third * 2; i < this.dataArray.length; i++) treble += this.dataArray[i];
        return {
            bass: bass / (third * 255),
            mid: mid / (third * 255),
            treble: treble / ((this.dataArray.length - third * 2) * 255)
        };
    }

    /**
     * Advanced log-spaced frequency bands with perceptual weighting
     */
    getLogBands(bandCount, params = {}) {
        const {
            freqMin = 80,
            freqMax = 18000,
            tilt = 0.35,           // Perceptual tilt: gain *= (f/fMin)^tilt
            bassTame = 0.5,        // Compress first ~15% of bands
            bassTameRange = 0.15,  // What % of bands are "bass"
            gain = 1.5,            // Overall gain multiplier
            compress = 0.8,        // Compression exponent (< 1 = more compression)
            attack = 0.8,          // Fast attack (0-1, higher = faster)
            release = 0.15,        // Slower release (0-1, higher = faster)
            smoothing = 0.3,       // Additional global smoothing
            noiseFloor = 0.015
        } = params;
        
        // Ensure buffers exist
        if (!this._rawBands.has(bandCount)) {
            this._rawBands.set(bandCount, new Float32Array(bandCount));
            this._smoothedBands.set(bandCount, new Float32Array(bandCount));
            this._peakBands.set(bandCount, new Float32Array(bandCount));
        }
        
        const raw = this._rawBands.get(bandCount);
        const smoothed = this._smoothedBands.get(bandCount);
        const peaks = this._peakBands.get(bandCount);
        
        if (!this.isInitialized) return smoothed;
        
        this.analyser.getFloatFrequencyData(this.floatArray);
        
        const fftSize = this.analyser.fftSize;
        const binCount = this.analyser.frequencyBinCount;
        const hzPerBin = this.sampleRate / fftSize;
        
        const minBin = Math.max(1, Math.floor(freqMin / hzPerBin));
        const maxBin = Math.min(binCount - 1, Math.ceil(freqMax / hzPerBin));
        
        const lnMin = Math.log(freqMin);
        const lnMax = Math.log(freqMax);
        const lnRange = lnMax - lnMin;
        
        for (let j = 0; j < bandCount; j++) {
            // Log-spaced frequency mapping
            const t = j / Math.max(1, bandCount - 1);
            const fTarget = Math.exp(lnMin + t * lnRange);
            const centerBin = Math.round(fTarget / hzPerBin);
            
            // Wider window for low frequencies, narrower for high
            const windowSize = Math.max(1, Math.floor(3 - t * 2));
            
            let energy = 0;
            let count = 0;
            for (let k = -windowSize; k <= windowSize; k++) {
                const bin = centerBin + k;
                if (bin >= minBin && bin <= maxBin) {
                    const db = this.floatArray[bin];
                    // dB to linear with floor at -80dB
                    const linear = Math.pow(10, Math.max(db, -80) / 20);
                    energy += linear;
                    count++;
                }
            }
            
            if (count > 0) energy /= count;
            
            // Perceptual tilt: boost highs relative to lows
            const tiltGain = Math.pow(fTarget / freqMin, tilt);
            energy *= tiltGain;
            
            // Bass taming: compress low bands more
            const bandPos = j / Math.max(1, bandCount - 1);
            if (bandPos < bassTameRange) {
                const tameAmount = 1 - (bandPos / bassTameRange);
                const tameGamma = 1 + tameAmount * bassTame * 0.8;
                energy = Math.pow(energy, tameGamma);
            }
            
            // Apply gain
            energy *= gain;
            
            // Noise floor
            energy = Math.max(0, energy - noiseFloor);
            
            // Global compression with soft knee
            if (compress !== 1.0) {
                energy = Math.pow(energy, compress);
            }
            
            // Soft limiter (smooth clipping at 1.0)
            if (energy > 0.8) {
                energy = 0.8 + (energy - 0.8) / (1 + (energy - 0.8) * 2);
            }
            energy = Math.min(1.0, energy);
            
            raw[j] = energy;
        }
        
        // Attack/Release envelope per band
        for (let j = 0; j < bandCount; j++) {
            if (raw[j] > peaks[j]) {
                // Attack: fast rise
                peaks[j] += (raw[j] - peaks[j]) * attack;
            } else {
                // Release: slow fall
                peaks[j] += (raw[j] - peaks[j]) * release;
            }
            
            // Additional smoothing
            smoothed[j] += (peaks[j] - smoothed[j]) * (1 - smoothing);
        }
        
        return smoothed;
    }

    getFrequencyData() {
        if (!this.isInitialized) return this.dataArray || new Uint8Array(0);
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }
    
    getWaveformData() {
        if (!this.isInitialized) return new Uint8Array(0);
        const waveform = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(waveform);
        return waveform;
    }
}
