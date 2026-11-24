/**
 * Animated liquid in glass (docs/api/glass.md "Liquids"): one InstancedMesh of boxes, each a body of liquid with its own colour,
 * flow and boil. Everything moves in the shaders from uTime, so a frame costs nothing between rebuilds:
 *   - FLOW: streaks run along the flow direction at the flow speed (a tube carrying wash, oil sliding down a coil);
 *   - SHIMMER: a slow caustic ripple through every liquid, so still liquid is never flat paint;
 *   - SURFACE: the top face of a vessel's liquid catches the light and sloshes gently; BOILING churns it, crowns it with
 *     foam and trails bubbles up the sides, harder the hotter the boil;
 *   - DEPTH: liquid darkens towards the bottom of its body.
 * Shared by the distillery (src/render/distill), brewing and essentia: callers `begin()`, `add()` each body, then `end()`.
 */
import * as THREE from 'three';

export interface LiquidStyle {
  /** Direction the liquid moves (any length; zero vector for still liquid). */
  flow?: readonly [number, number, number];
  /** Flow speed, blocks per second (0 still). */
  speed?: number;
  /** 0 still, 1 a rolling boil. */
  boil?: number;
  /** The body has an open top surface (a vessel's level), so it catches light and sloshes. */
  surface?: boolean;
  /** Extra brightness 0..1 (glowing essentia, a lit column band). */
  glow?: number;
}

const VERT = /* glsl */ `
  attribute vec4 aFlow;  // direction xyz, speed
  attribute vec4 aFx;    // boil, surface, seed, glow
  uniform float uTime;
  varying vec3 vColour;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec4 vFlow;
  varying vec4 vFx;
  varying vec3 vNormalW;
  void main() {
    vec3 p = position;
    mat4 m = modelMatrix * instanceMatrix;
    if (p.y > 0.49 && aFx.y > 0.5) {
      vec4 w0 = m * vec4(p, 1.0);
      float wave = sin(w0.x * 11.0 + uTime * 3.1 + aFx.z * 6.0) * sin(w0.z * 9.0 - uTime * 2.7);
      float sy = max(0.02, length(m[1].xyz));
      p.y += ((0.012 + 0.05 * aFx.x) * wave) / sy;
    }
    vec4 wp = m * vec4(p, 1.0);
    vWorld = wp.xyz;
    vLocal = position;
    vColour = instanceColor;
    vFlow = aFlow;
    vFx = aFx;
    vNormalW = normalize(mat3(m) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vColour;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec4 vFlow;
  varying vec4 vFx;
  varying vec3 vNormalW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec3 c = vColour;
    c *= 1.0 - 0.28 * (0.5 - vLocal.y);
    float speed = vFlow.w;
    if (speed > 0.0) {
      vec3 d = normalize(vFlow.xyz);
      float along = dot(vWorld, d) * 9.0 - uTime * speed * 7.0;
      vec3 side = vWorld - d * dot(vWorld, d);
      float n = noise(vec2(along, (side.x + side.y + side.z) * 16.0));
      c = mix(c, c * 1.4 + 0.07, smoothstep(0.55, 0.92, n) * 0.65);
    }
    float sh = sin(vWorld.x * 13.0 + uTime * 1.7 + vFx.z * 5.0) * sin(vWorld.z * 11.0 - uTime * 1.3) * sin(vWorld.y * 7.0 + uTime);
    c *= 1.0 + 0.08 * sh;
    if (vNormalW.y > 0.5 && vFx.y > 0.5) {
      float spec = noise(vWorld.xz * 8.0 + vec2(uTime * 0.4, -uTime * 0.3));
      c = mix(c, vec3(1.0), 0.1 + 0.2 * smoothstep(0.6, 0.95, spec));
      if (vFx.x > 0.0) {
        float foam = noise(vWorld.xz * 22.0 + uTime * vec2(2.3, -1.9)) * noise(vWorld.xz * 9.0 - uTime * 1.1);
        c = mix(c, vec3(0.97, 0.98, 1.0), smoothstep(0.22, 0.5, foam) * vFx.x * 0.85);
      }
    } else if (vFx.x > 0.0) {
      float b = noise(vec2((vWorld.x + vWorld.z) * 20.0, vWorld.y * 14.0 - uTime * (3.0 + 3.0 * vFx.x)));
      c = mix(c, vec3(0.95), smoothstep(0.8, 0.95, b) * vFx.x * 0.75);
    }
    c *= 1.0 + vFx.w;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const tmp = new THREE.Matrix4();
const colour = new THREE.Color();

/** Animation speed of every LiquidBoxes, 1 = full (the graphics setting's liquidRate, set by the renderer each frame). */
let liquidRate = 1;

export function setLiquidRate(rate: number): void {
  liquidRate = Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 1;
}

export class LiquidBoxes {
  readonly mesh: THREE.InstancedMesh;
  private readonly flow: THREE.InstancedBufferAttribute;
  private readonly fx: THREE.InstancedBufferAttribute;
  private readonly material: THREE.ShaderMaterial;
  private n = 0;

  constructor(readonly max: number, name = 'liquids') {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.flow = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.fx = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFlow', this.flow);
    geo.setAttribute('aFx', this.fx);
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime: { value: 0 } } });
    this.mesh = new THREE.InstancedMesh(geo, this.material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate the colour buffer up front so the shader always has instanceColor.
    this.mesh.setColorAt(0, colour.setRGB(1, 1, 1));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = name;
  }

  /** Bodies added since the last `begin()`. */
  get count(): number { return this.n; }

  /** Advances the animation clock (seconds), at the animation rate the graphics setting allows. */
  tick(clock: number): void { this.material.uniforms.uTime.value = clock * liquidRate; }

  begin(): void { this.n = 0; }

  /**
   * One body of liquid: a box from (x - sx/2, y, z - sz/2) to (x + sx/2, y + sy, z + sz/2) in world units, its colour
   * already lit (0xRRGGBB or a THREE.Color), moving and boiling as `style` says.
   */
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, lit: number | THREE.Color, style: LiquidStyle = {}): void {
    if (this.n >= this.max || sy <= 0.004 || sx <= 0 || sz <= 0) return;
    const i = this.n++;
    tmp.makeScale(sx, sy, sz).setPosition(x, y + sy / 2, z);
    this.mesh.setMatrixAt(i, tmp);
    // Raw RGB: the shader writes its colour straight out, so a hex must not be converted from sRGB to linear.
    this.mesh.setColorAt(i, typeof lit === 'number' ? colour.setRGB(((lit >> 16) & 255) / 255, ((lit >> 8) & 255) / 255, (lit & 255) / 255) : lit);
    const f = style.flow ?? [0, 0, 0];
    this.flow.setXYZW(i, f[0], f[1], f[2], style.speed ?? 0);
    this.fx.setXYZW(i, style.boil ?? 0, style.surface ? 1 : 0, ((x * 7.3 + z * 3.1 + y) % 1 + 1) % 1, style.glow ?? 0);
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.flow.needsUpdate = true;
    this.fx.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
