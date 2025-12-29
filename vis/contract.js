/**
 * Visualizer Module Contract
 * 
 * Every visualizer module must export an object implementing this interface:
 * 
 * {
 *   id: string,           // Unique identifier (e.g., 'bars2d')
 *   name: string,         // Display name (e.g., '2D Spectrum Bars')
 *   type: '2d' | 'webgl2',// Rendering context type
 *   
 *   init(ctx, services, settings): void
 *     - ctx: { ctx2d } for 2d, { gl } for webgl2
 *     - services: { audio, overlayCanvas, getFrequencyData, getWaveformData }
 *     - settings: shared settings object (read-only reference)
 *   
 *   resize(width, height, dpr, renderScale): void
 *     - Called on window resize
 *   
 *   update(dt, audioFrame): void
 *     - dt: delta time in seconds
 *     - audioFrame: { level, bands, frequencyData, waveformData }
 *   
 *   render(): void
 *     - Draw current frame (canvas already cleared by app shell)
 *   
 *   dispose(): void
 *     - Cleanup WebGL resources, buffers, etc.
 * }
 * 
 * RULES:
 * - Do NOT create your own canvas or RAF loop
 * - Do NOT create your own AudioAnalyzer
 * - Reuse buffers; avoid per-frame allocations
 * - Use gl.bufferSubData() not gl.bufferData() for dynamic updates
 */

export const VisualizerContract = {
    id: '',
    name: '',
    type: '2d',
    init: (ctx, services, settings) => {},
    resize: (w, h, dpr, renderScale) => {},
    update: (dt, audioFrame) => {},
    render: () => {},
    dispose: () => {}
};
