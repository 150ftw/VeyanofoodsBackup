import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Liquid Ether - Antigravity Edition
 * A high-performance GPGPU fluid simulation modified for upward energy flow.
 * Changes marked with 🔥 are specific requests from the user.
 */

// --- SHADERS ---

const base_vert = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// 🔥 Modified externalForce_frag (User Requested)
const externalForce_frag = `
precision highp float;

uniform vec2 force;
uniform vec2 center;
uniform vec2 scale;
uniform float gravity;
uniform bool antiGravity;

varying vec2 vUv;

void main(){
    vec2 circle = (vUv - 0.5) * 2.0;
    float d = 1.0 - min(length(circle), 1.0);
    d *= d;

    vec2 f = force * d;

    // 🔥 Antigravity upward force
    if (antiGravity) {
        f += vec2(0.0, gravity);
    }

    // ✨ Swirl effect (ether feel)
    f += vec2(-circle.y, circle.x) * 0.08;

    gl_FragColor = vec4(f, 0.0, 1.0);
}
`;

const advection_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D source;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
varying vec2 vUv;

void main() {
    vec2 coord = vUv - dt * texture2D(velocity, vUv).xy * texelSize;
    gl_FragColor = dissipation * texture2D(source, coord);
}
`;

const divergence_frag = `
precision highp float;
uniform sampler2D velocity;
uniform vec2 texelSize;
varying vec2 vUv;

void main() {
    float L = texture2D(velocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(velocity, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(velocity, vUv + vec2(0.0, texelSize.y)).y;
    float B = texture2D(velocity, vUv - vec2(0.0, texelSize.y)).y;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

const pressure_frag = `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform vec2 texelSize;
varying vec2 vUv;

void main() {
    float L = texture2D(pressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(pressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(pressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(pressure, vUv - vec2(0.0, texelSize.y)).x;
    float div = texture2D(divergence, vUv).x;
    float p = (L + R + B + T - div) * 0.25;
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
}
`;

const project_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D pressure;
uniform vec2 texelSize;
varying vec2 vUv;

void main() {
    float L = texture2D(pressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(pressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(pressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(pressure, vUv - vec2(0.0, texelSize.y)).x;
    vec2 vel = texture2D(velocity, vUv).xy;
    vel -= vec2(R - L, T - B) * 0.5;
    gl_FragColor = vec4(vel, 0.0, 1.0);
}
`;

const dye_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D dye;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
varying vec2 vUv;

void main() {
    float d = texture2D(dye, vUv).r;
    vec2 v = texture2D(velocity, vUv).xy;
    
    // Mix colors based on density and velocity
    vec3 color = mix(color1, color2, clamp(length(v) * 5.0, 0.0, 1.0));
    color = mix(color, color3, d);
    
    gl_FragColor = vec4(color, d);
}
`;

// --- UTILITY CLASSES ---

class FBO {
    constructor(w, h, type = THREE.HalfFloatType) {
        this.w = w;
        this.h = h;
        this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
            type,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            stencilBuffer: false,
        });
        this.read = this.renderTarget.clone();
        this.write = this.renderTarget.clone();
    }

    swap() {
        let tmp = this.read;
        this.read = this.write;
        this.write = tmp;
    }
}

class GPGPUPass {
    constructor(fragmentShader, uniforms = {}) {
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                ...uniforms,
                texelSize: { value: new THREE.Vector2() }
            },
            vertexShader: base_vert,
            fragmentShader,
            depthWrite: false,
            depthTest: false,
        });
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(this.mesh);
    }

    render(renderer, writeBuffer) {
        renderer.setRenderTarget(writeBuffer);
        renderer.render(this.scene, this.camera);
    }
}

// 🔥 Updated ExternalForce Class (User Requested)
class ExternalForce extends GPGPUPass {
    constructor() {
        super(externalForce_frag, {
            force: { value: new THREE.Vector2() },
            center: { value: new THREE.Vector2() },
            scale: { value: new THREE.Vector2() },
            // 🔥 User requested uniforms
            gravity: { value: 0.2 },
            antiGravity: { value: true }
        });
    }

    update(props) {
        const { force, center, scale, gravityStrength, antiGravity } = props;
        if (force) this.material.uniforms.force.value.copy(force);
        if (center) this.material.uniforms.center.value.copy(center);
        if (scale) this.material.uniforms.scale.value.copy(scale);
        
        // 🔥 User requested Logic in update()
        this.material.uniforms.gravity.value = gravityStrength;
        this.material.uniforms.antiGravity.value = antiGravity;
    }
}

// --- SIMULATION CONTROLLER ---

class Simulation {
  constructor(renderer, size = 256) {
    this.renderer = renderer;
    this.size = size;
    
    // 🔥 User requested Simulation options
    this.options = {
      cursor_size: 100,
      mouse_force: 20,
      antiGravity: true,
      gravityStrength: 0.2,
      dissipation: 0.98,
      viscous: 30,
    };

    this.texelSize = new THREE.Vector2(1 / size, 1 / size);
    this.velocity = new FBO(size, size);
    this.dye = new FBO(size, size);
    this.pressure = new FBO(size, size);
    this.divergence = new FBO(size, size);

    this.advection = new GPGPUPass(advection_frag, {
      velocity: { value: null },
      source: { value: null },
      dt: { value: 0.016 },
      dissipation: { value: 0.98 }
    });

    this.externalForce = new ExternalForce();
    
    this.divergencePass = new GPGPUPass(divergence_frag, {
      velocity: { value: null }
    });

    this.pressurePass = new GPGPUPass(pressure_frag, {
      pressure: { value: null },
      divergence: { value: null }
    });

    this.projectPass = new GPGPUPass(project_frag, {
      velocity: { value: null },
      pressure: { value: null }
    });
  }

  update(mouse, dt) {
    // 1. Advection
    this.advection.material.uniforms.dt.value = dt;
    this.advection.material.uniforms.velocity.value = this.velocity.read.texture;
    this.advection.material.uniforms.source.value = this.velocity.read.texture;
    this.advection.material.uniforms.dissipation.value = this.options.dissipation;
    this.advection.render(this.renderer, this.velocity.write);
    this.velocity.swap();

    // 2. 🔥 External Force (Upward Antigravity + Mouse)
    const forceDirection = new THREE.Vector2(mouse.vx, mouse.vy).multiplyScalar(this.options.mouse_force);
    
    // 🔥 User requested call to externalForce
    this.externalForce.update({
      force: forceDirection,
      center: new THREE.Vector2(mouse.x, mouse.y),
      scale: new THREE.Vector2(this.options.cursor_size, this.options.cursor_size),
      gravityStrength: this.options.gravityStrength,
      antiGravity: this.options.antiGravity
    });
    
    // Apply force to velocity
    this.renderer.autoClear = false;
    this.externalForce.render(this.renderer, this.velocity.write);
    this.velocity.swap();

    // 3. Pressure / Divergence
    this.divergencePass.material.uniforms.velocity.value = this.velocity.read.texture;
    this.divergencePass.render(this.renderer, this.divergence.renderTarget);

    for (let i = 0; i < 20; i++) {
      this.pressurePass.material.uniforms.pressure.value = this.pressure.read.texture;
      this.pressurePass.material.uniforms.divergence.value = this.divergence.renderTarget.texture;
      this.pressurePass.render(this.renderer, this.pressure.write);
      this.pressure.swap();
    }

    // 4. Projection
    this.projectPass.material.uniforms.velocity.value = this.velocity.read.texture;
    this.projectPass.material.uniforms.pressure.value = this.pressure.read.texture;
    this.projectPass.render(this.renderer, this.velocity.write);
    this.velocity.swap();

    // 5. Dye Advection
    this.advection.material.uniforms.source.value = this.dye.read.texture;
    this.advection.material.uniforms.dissipation.value = 0.99; // Lower dissipation for dye
    this.advection.render(this.renderer, this.dye.write);
    this.dye.swap();
  }
}

// --- MAIN COMPONENT ---

const LiquidEther = ({
  colors = ['#5227FF', '#FF9FFC', '#B19EEF'],
  mouseForce = 20,
  cursorSize = 100,
  antiGravity = true,
  gravityStrength = 0.2,
  resolution = 0.5,
  dissipation = 0.98,
}) => {
  const meshRef = useRef();
  const { gl, size } = useThree();
  
  const simulation = useMemo(() => {
    const simSize = Math.floor(Math.min(size.width, size.height) * resolution);
    return new Simulation(gl, simSize);
  }, [gl, resolution, size.width, size.height]);

  const mouse = useRef({ x: 0.5, y: 0.5, lx: 0.5, ly: 0.5, vx: 0, vy: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;
      mouse.current.vx = x - mouse.current.x;
      mouse.current.vy = y - mouse.current.y;
      mouse.current.x = x;
      mouse.current.y = y;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        velocity: { value: null },
        dye: { value: null },
        color1: { value: new THREE.Color(colors[0]) },
        color2: { value: new THREE.Color(colors[1]) },
        color3: { value: new THREE.Color(colors[2]) },
      },
      vertexShader: base_vert,
      fragmentShader: dye_frag,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
  }, [colors]);

  useFrame((state, delta) => {
    // 🔥 Sync props to simulation options
    simulation.options.mouse_force = mouseForce;
    simulation.options.cursor_size = cursorSize;
    simulation.options.antiGravity = antiGravity;
    simulation.options.gravityStrength = gravityStrength;
    simulation.options.dissipation = dissipation;

    // Run simulation step
    simulation.update(mouse.current, Math.min(delta, 0.033));

    // Update screen material
    material.uniforms.velocity.value = simulation.velocity.read.texture;
    material.uniforms.dye.value = simulation.dye.read.texture;
    
    // Decay velocity
    mouse.current.vx *= 0.9;
    mouse.current.vy *= 0.9;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export default LiquidEther;
