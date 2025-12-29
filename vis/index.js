/**
 * Visualizer Registry - exports all available visualizers
 */
import { Bars2D } from './basic/bars2d.js';
import { Circle2D } from './basic/circle2d.js';
import { Wave2D } from './basic/wave2d.js';
import { Bars3D } from './basic/bars3d.js';
import { Circle3D } from './basic/circle3d.js';

export const visualizers = [
    Bars2D,
    Circle2D,
    Wave2D,
    Bars3D,
    Circle3D
];

export function getVisualizerById(id) {
    return visualizers.find(v => v.id === id);
}

export function getVisualizersByType(type) {
    return visualizers.filter(v => v.type === type);
}
