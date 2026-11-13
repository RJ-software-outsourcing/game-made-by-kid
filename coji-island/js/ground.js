// Ground shading: the painted vertex colors of the terrain (and roads) get fine detail from a small
// seamless texture, sampled at three sizes so it never looks tiled, plus a little bump so grass, sand
// and stones catch the low sun. Two or three texture reads per pixel: cheap enough for an iPad.
import * as THREE from 'three'
import { groundDetail } from './textures.js'

let DETAIL = null
export function detailTexture() {
  if (!DETAIL) DETAIL = groundDetail(512)
  return DETAIL
}

const BUMP = /* glsl */ `
  vec3 cojiBump(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
    vec3 sx = normalize(dFdx(surfPos));
    vec3 sy = normalize(dFdy(surfPos));
    vec3 r1 = cross(sy, surfNorm);
    vec3 r2 = cross(surfNorm, sx);
    float det = dot(sx, r1) * faceDir;
    vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
    return normalize(abs(det) * surfNorm - grad);
  }
`

// weights: per-vertex `tmat` attribute (grass, sand, rock) when null, else a fixed vec3.
// scale: how big the detail is (1 = terrain size). bump: how strong the relief looks.
export function patchGround(mat, { weights = null, scale = 1, bump = 1, key = 'ground' } = {}) {
  const uniforms = {
    uDetail: { value: detailTexture() },
    uScale: { value: scale },
    uBump: { value: bump },
    uW: { value: weights ? new THREE.Vector3(...weights) : new THREE.Vector3(1, 0, 0) },
  }
  mat.userData.ground = uniforms
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader =
      (weights ? '' : 'attribute vec3 tmat;\n') +
      'varying vec3 vTW;\nvarying vec3 vTmat;\nuniform vec3 uW;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTmat = ${weights ? 'uW' : 'tmat'};`,
      )
    sh.fragmentShader =
      'uniform sampler2D uDetail; uniform float uScale; uniform float uBump;\nvarying vec3 vTW;\nvarying vec3 vTmat;\n' +
      BUMP +
      sh.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 gp = vTW.xz / uScale;
          vec4 dA = texture2D(uDetail, gp * 0.31);
          vec4 dB = texture2D(uDetail, gp * 0.083 + vec2(0.31, 0.57));
          vec4 dM = texture2D(uDetail, gp * 0.011 + vec2(0.71, 0.13));
          vec3 gw = vTmat / max(0.001, vTmat.x + vTmat.y + vTmat.z);
          float gFine = dot(dA.rgb, gw);
          float gMid = dot(dB.rgb, gw);
          float gH = gFine * 0.62 + gMid * 0.38;
          diffuseColor.rgb *= (0.6 + gH * 0.8) * (0.86 + dM.a * 0.28);
          // dry, yellower patches in the grass and darker damp patches in the sand
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.04, 0.74), gw.x * smoothstep(0.52, 0.78, dB.a) * 0.55);
          diffuseColor.rgb *= 1.0 - gw.y * smoothstep(0.6, 0.85, dM.a) * 0.12;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float gFade = 1.0 - smoothstep(14.0, 55.0, length(vViewPosition));
          if (gFade > 0.0) normal = cojiBump(-vViewPosition, normal, vec2(dFdx(gH), dFdy(gH)) * uBump * gFade * 1.6, faceDirection);`,
        )
  }
  mat.customProgramCacheKey = () => key + (weights ? '-u' : '-a')
  return mat
}
