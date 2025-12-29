#version 300 es
precision highp float;

uniform sampler2D u_atlas;
uniform float u_audioLevel;      // 0.0 - 1.0 from audio analyzer
uniform float u_fadeEdge;        // Enable soft edge fade (0 or 1)

in vec2 v_uv;
in float v_opacity;
in vec3 v_color;

out vec4 fragColor;

void main() {
    vec4 texColor = texture(u_atlas, v_uv);
    
    // Apply per-particle color tint
    vec3 finalColor = texColor.rgb * v_color;
    
    // Base opacity from texture alpha and per-particle opacity
    float alpha = texColor.a * v_opacity;
    
    // Optional: radial fade for soft edges (computed, not baked)
    if (u_fadeEdge > 0.5) {
        vec2 centered = fract(v_uv) - vec2(0.5);
        float dist = length(centered);
        float fade = 1.0 - smoothstep(0.3, 0.5, dist);
        alpha *= fade;
    }
    
    // Audio reactivity - pulse opacity
    alpha *= 0.7 + (u_audioLevel * 0.3);
    
    fragColor = vec4(finalColor, alpha);
}
