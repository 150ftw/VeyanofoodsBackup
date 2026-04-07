/**
 * Liquid Ether Background
 * High-performance WebGL shader for a fluid, ethereal aesthetic.
 */

const canvas = document.createElement('canvas');
canvas.id = 'liquid-ether';
document.body.prepend(canvas);

const gl = canvas.getContext('webgl');

if (!gl) {
    console.error('WebGL not supported');
}

const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 a0 = x - floor(x + 0.5);
        float m3 = 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ).z;
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float ratio = u_resolution.x / u_resolution.y;
        uv.x *= ratio;

        vec2 mouse = u_mouse / u_resolution.xy;
        mouse.x *= ratio;

        // Create fluid motion
        float n1 = snoise(uv * 2.0 - u_time * 0.05 + snoise(uv * 0.5 + u_time * 0.02));
        float n2 = snoise(uv * 4.0 + u_time * 0.08 + n1 * 0.5);
        float n3 = snoise(uv * 8.0 - u_time * 0.12 + n2 * 0.3);

        // Mix organic colors
        vec3 color1 = vec3(0.98, 0.96, 0.92); // Base Pearl
        vec3 color2 = vec3(0.92, 0.88, 0.82); // Soft Sand
        vec3 color3 = vec3(1.0, 1.0, 1.0);     // Pure Ether
        
        // Dynamic influence of noise
        float intensity = n1 * 0.4 + n2 * 0.3 + n3 * 0.2;
        intensity = smoothstep(-1.0, 1.0, intensity);

        vec3 finalColor = mix(color1, color2, intensity);
        finalColor = mix(finalColor, color3, n3 * 0.2);

        // Subtle highlight based on mouse
        float dist = distance(uv, mouse);
        float glow = smoothstep(0.5, 0.0, dist) * 0.05;
        finalColor += glow;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, 'position');
const timeLocation = gl.getUniformLocation(program, 'u_time');
const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
const mouseLocation = gl.getUniformLocation(program, 'u_mouse');

let mouseX = 0;
let mouseY = 0;

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = u_resolution.y - e.clientY;
});

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resize);
resize();

function render(time) {
    time *= 0.001; // convert to seconds

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(timeLocation, time);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(mouseLocation, mouseX, mouseY);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
