/**
 * Visualizer Registry - exports all available visualizers
 */
import { Bars2D } from './basic/bars2d.js';
import { Circle2D } from './basic/circle2d.js';
import { Plasma2D } from './basic/plasma2d.js';
import { Bars3D } from './basic/bars3d.js';
import { Circle3D } from './basic/circle3d.js';

// Math visualizers
import { Lorenz } from './math/lorenz.js';
import { Spiral } from './math/spiral.js';
import { Mandelbrot } from './math/mandelbrot.js';
import { Parabola } from './math/parabola.js';

export const visualizers = [
    Bars2D,
    Circle2D,
    Plasma2D,
    Bars3D,
    Circle3D,
    // Math
    Lorenz,
    Spiral,
    Mandelbrot,
    Parabola
];

export function getVisualizerById(id) {
    return visualizers.find(v => v.id === id);
}

export function getVisualizersByType(type) {
    return visualizers.filter(v => v.type === type);
}
