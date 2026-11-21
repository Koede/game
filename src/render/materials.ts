/**
 * The three chunk materials. They share one uniform set, so the sky/fog/time update is a handful of writes per
 * frame no matter how many chunks are drawn.
 */
import * as THREE from 'three';
import { CHUNK_FRAGMENT, CHUNK_VERTEX } from './shaders/chunk';

export interface WorldUniforms {
  [name: string]: THREE.IUniform;
  uAtlas: THREE.IUniform<THREE.Texture | null>;
  uTime: THREE.IUniform<number>;
  /** Colour of a fully sky-lit surface (time of day). */
  uSkyLight: THREE.IUniform<THREE.Vector3>;
  /** Colour of full block light (firelight). */
  uBlockLight: THREE.IUniform<THREE.Vector3>;
  /** Darkest any lit surface gets (a sealed cave without a torch). */
  uAmbient: THREE.IUniform<number>;
  uFogColor: THREE.IUniform<THREE.Vector3>;
  /** Added to the fog towards the sun at dawn and dusk. */
  uFogGlow: THREE.IUniform<THREE.Vector3>;
  uSunDir: THREE.IUniform<THREE.Vector3>;
  /** Fog start and end distance in blocks. */
  uFog: THREE.IUniform<THREE.Vector2>;
}

export function createWorldUniforms(atlas: THREE.Texture | null): WorldUniforms {
  return {
    uAtlas: { value: atlas },
    uTime: { value: 0 },
    uSkyLight: { value: new THREE.Vector3(1, 1, 1) },
    uBlockLight: { value: new THREE.Vector3(1.0, 0.74, 0.46) },
    uAmbient: { value: 0.035 },
    uFogColor: { value: new THREE.Vector3(0.7, 0.8, 0.9) },
    uFogGlow: { value: new THREE.Vector3(0, 0, 0) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uFog: { value: new THREE.Vector2(40, 90) },
  };
}

export interface ChunkMaterials {
  opaque: THREE.ShaderMaterial;
  cutout: THREE.ShaderMaterial;
  translucent: THREE.ShaderMaterial;
  dispose(): void;
}

function chunkMaterial(uniforms: WorldUniforms, kind: 'opaque' | 'cutout' | 'translucent'): THREE.ShaderMaterial {
  const translucent = kind === 'translucent';
  // Per-material uniforms are copied by reference to the shared objects; only uOpacity is private.
  const own: Record<string, THREE.IUniform> = { ...uniforms, uOpacity: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    name: `chunk-${kind}`,
    glslVersion: THREE.GLSL3,
    uniforms: own,
    vertexShader: CHUNK_VERTEX,
    fragmentShader: CHUNK_FRAGMENT,
    defines: kind === 'cutout' ? { CUTOUT: 1 } : translucent ? { TRANSLUCENT: 1 } : {},
    transparent: translucent,
    depthWrite: !translucent,
    // Water surfaces must also be seen from below; the mesher emits them single-sided.
    side: translucent ? THREE.DoubleSide : THREE.FrontSide,
  });
  return material;
}

export function createChunkMaterials(uniforms: WorldUniforms): ChunkMaterials {
  const opaque = chunkMaterial(uniforms, 'opaque');
  const cutout = chunkMaterial(uniforms, 'cutout');
  const translucent = chunkMaterial(uniforms, 'translucent');
  return {
    opaque,
    cutout,
    translucent,
    dispose(): void {
      opaque.dispose();
      cutout.dispose();
      translucent.dispose();
    },
  };
}
