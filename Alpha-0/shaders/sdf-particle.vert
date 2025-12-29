#version 300 es
precision highp float;

// Quad geometry
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;

// Per-instance attributes
layout(location = 2) in vec3 i_position;    // world position
layout(location = 3) in vec4 i_uvRect;      // atlas region (x, y, w, h) normalized
layout(location = 4) in vec4 i_color;       // RGBA color
layout(location = 5) in float i_scale;      // size multiplier
layout(location = 6) in float i_rotation;   // rotation in radians

uniform mat4 u_viewProjection;
uniform float u_time;
uniform float u_audioLevel;

out vec2 v_uv;
out vec4 v_color;
out float v_scale;

void main() {
    // Rotate quad
    float c = cos(i_rotation);
    float s = sin(i_rotation);
    vec2 rotated = vec2(
        a_pos.x * c - a_pos.y * s,
        a_pos.x * s + a_pos.y * c
    );
    
    // Scale and position
    float scale = i_scale * (1.0 + u_audioLevel * 0.15);
    vec3 worldPos = i_position + vec3(rotated * scale, 0.0);
    
    // Calculate atlas UV
    v_uv = i_uvRect.xy + a_uv * i_uvRect.zw;
    v_color = i_color;
    v_scale = scale;
    
    gl_Position = u_viewProjection * vec4(worldPos, 1.0);
}
