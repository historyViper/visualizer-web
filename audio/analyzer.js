// Audio Analyzer - Extracts frequency data for visualization
export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.isInitialized = false;
    }

    async init(audioSource = 'microphone') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

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

    // Get overall audio level (0-1)
    getLevel() {
        if (!this.isInitialized) return 0;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        const sum = this.dataArray.reduce((a, b) => a + b, 0);
        return sum / (this.dataArray.length * 255);
    }

    // Get frequency bands: bass, mid, treble (each 0-1)
    getBands() {
        if (!this.isInitialized) return { bass: 0, mid: 0, treble: 0 };
        
        this.analyser.getByteFrequencyData(this.dataArray);
        const third = Math.floor(this.dataArray.length / 3);
        
        const bass = this.dataArray.slice(0, third).reduce((a, b) => a + b, 0) / (third * 255);
        const mid = this.dataArray.slice(third, third * 2).reduce((a, b) => a + b, 0) / (third * 255);
        const treble = this.dataArray.slice(third * 2).reduce((a, b) => a + b, 0) / (third * 255);
        
        return { bass, mid, treble };
    }

    // Get raw frequency data for custom analysis
    getFrequencyData() {
        if (!this.isInitialized) return new Uint8Array(0);
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }
}
