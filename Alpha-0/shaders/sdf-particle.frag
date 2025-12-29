#version 300 es
precision highp float;

uniform sampler2D u_atlas;
uniform float u_time;
uniform float u_audioLevel;

// SDF rendering params
uniform float u_edgeWidth;      // Softness of edge (default 0.1)
uniform float u_outlineWidth;   // Outline thickness (0 = none)
uniform vec4 u_outlineColor;    // Outline color
uniform float u_glowStrength;   // Glow intensity (0 = none)
uniform vec4 u_glowColor;       // Glow color

in vec2 v_uv;
in vec4 v_color;
in float v_scale;

out vec4 fragColor;

void main() {
    // Sample SDF (distance stored in red channel)
    float dist = texture(u_atlas, v_uv).r;
    
    // Adjust edge width based on scale (thinner at small sizes)
    float edgeWidth = u_edgeWidth / max(v_scale, 0.1);
    edgeWidth = clamp(edgeWidth, 0.02, 0.25);
    
    // Core text alpha (0.5 is the edge in SDF)
    float textAlpha = smoothstep(0.5 - edgeWidth, 0.5 + edgeWidth, dist);
    
    // Outline (ring around text)
    float outlineOuter = 0.5 - u_outlineWidth;
    float outlineAlpha = smoothstep(outlineOuter - edgeWidth, outlineOuter, dist) 
                       - smoothstep(0.5, 0.5 + edgeWidth, dist);
    outlineAlpha = clamp(outlineAlpha, 0.0, 1.0);
    
    // Glow (soft falloff outside text)
    float glowDist = 0.5 - u_outlineWidth - 0.15;
    float glowAlpha = smoothstep(glowDist - 0.2, glowDist + 0.1, dist);
    glowAlpha *= u_glowStrength;
    glowAlpha *= (1.0 - textAlpha);  // Don't glow inside text
    
    // Audio-reactive glow pulse
    float pulse = 1.0 + u_audioLevel * 0.5;
    glowAlpha *= pulse;
    
    // Composite layers: glow -> outline -> text
    vec4 finalColor = vec4(0.0);
    
    // Glow layer
    finalColor = mix(finalColor, u_glowColor, glowAlpha * u_glowColor.a);
    
    // Outline layer
    finalColor = mix(finalColor, u_outlineColor, outlineAlpha * u_outlineColor.a);
    
    // Text layer
    finalColor = mix(finalColor, v_color, textAlpha * v_color.a);
    
    // Final alpha
    float totalAlpha = max(max(textAlpha * v_color.a, outlineAlpha * u_outlineColor.a), 
                          glowAlpha * u_glowColor.a);
    
    fragColor = vec4(finalColor.rgb, totalAlpha);
}
