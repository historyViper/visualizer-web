#version 300 es
precision highp float;

// Geometry
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_uv;

// Per-instance attributes
layout(location = 2) in vec3 a_instancePos;
layout(location = 3) in vec4 a_uvOffset;    // x, y, width, height in atlas (0-1 range)
layout(location = 4) in float a_opacity;
layout(location = 5) in float a_scale;
layout(location = 6) in vec3 a_color;

uniform mat4 u_viewProjection;
uniform float u_time;

out vec2 v_uv;
out float v_opacity;
out vec3 v_color;

void main() {
    // Calculate atlas UV coordinates
    v_uv = a_uvOffset.xy + a_uv * a_uvOffset.zw;
    v_opacity = a_opacity;
    v_color = a_color;
    
    // Billboard scaling
    vec3 scaledPos = a_position * a_scale;
    vec3 worldPos = scaledPos + a_instancePos;
    
    gl_Position = u_viewProjection * vec4(worldPos, 1.0);
}
