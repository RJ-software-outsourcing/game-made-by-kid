import * as T from '../vendor/three.module.js'
import { acquireSurfaceMaterial, releaseSurfaceMaterial } from './surface-batch.js'

// One repeating sample contains shot-blasted alloy, longitudinal tool marks,
// a chipped coating pattern, and the wide spots between runs of abrasion.
function finishMap() {
  const size = 128, mask = size - 1, noise = new Uint8Array(size * size)
  let seed = 7619
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(random() * 256)
  const at = (x, y) => noise[(y & mask) * size + (x & mask)]
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4
    let brush = 0
    for (let dx = -8; dx <= 8; dx++) brush += (9 - Math.abs(dx)) * at(x + dx, y)
    pixels[i] = at(x, y)
    pixels[i + 1] = T.MathUtils.clamp(128 + (brush / 81 - 128) * 3.2, 0, 255)
    pixels[i + 2] = .48 * at(x, y) + .28 * at(x >> 1, y >> 1) + .24 * at(x >> 2, y >> 2)
    pixels[i + 3] = .54 * at(x >> 2, y >> 2) + .46 * at(x >> 3, y >> 3)
  }
  const map = new T.DataTexture(pixels, size, size)
  map.name = 'Bead blast, brushing and enamel wear'
  map.wrapS = map.wrapT = T.RepeatWrapping
  map.minFilter = T.LinearMipmapLinearFilter
  map.magFilter = T.LinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  return map
}

// Only baked manufacturing finish tags affect the material. Team paint and
// metal keep their own vertex colors; optics and emissive surfaces pass through.
const classify = `
  float alloy = smoothstep(.46, .65, vSurface.y);
  float coat = smoothstep(.16, .23, vSurface.x) * (1. - smoothstep(.47, .57, vSurface.x))
    * (1. - alloy) * (1. - smoothstep(.08, .3, vSurface.z));
  float elastomer = smoothstep(.66, .82, vSurface.x);
  float satin = vSurface.x + .112 * coat + .024 * alloy;
  float metal = min(.94, vSurface.y + .21 * alloy + .20 * coat);
`
function coatedMaterial(closeup) {
  const base = acquireSurfaceMaterial(), material = base.clone()
  const map = closeup ? finishMap() : null
  material.name = closeup ? 'Workshop powder coat and machined alloys' : 'Ringside powder coat and machined alloys'
  material.customProgramCacheKey = () => closeup ? 'workshop-metal-4' : 'ringside-metal-4'
  material.onBeforeCompile = shader => {
    base.onBeforeCompile(shader)
    if (map) {
      shader.uniforms.finishGrain = { value: map }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGrainUV;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vGrainUV = vec2(position.x * .91 + position.z * .70, position.y + position.z * .37) * 2.35;`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D finishGrain;\nvarying vec2 vGrainUV;')
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('roughnessFactor = vSurface.x;', `${classify}
        ${map ? `vec4 grain = texture2D(finishGrain, vGrainUV);
          float grit = mix(grain.r, grain.g, alloy) - .5;
          // Positive normal curvature picks tight convex folds and rolled lips.
          // Flat panel centers, logos, concave seams and the glass stay intact.
          vec3 tx = dFdx(-vViewPosition), ty = dFdy(-vViewPosition);
          vec3 n = normalize(vNormal);
          float curvature = (dot(dFdx(n),tx) + dot(dFdy(n),ty)) / max(dot(tx,tx)+dot(ty,ty), 1.e-8);
          float rim = max(smoothstep(12., 37., curvature), smoothstep(.61, .97, vSurface.w));
          float scuff = rim * coat * smoothstep(.48,.74,grain.b) * smoothstep(.36,.70,grain.a);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.29,.30,.29), scuff * .83);
          metal = mix(metal,.85,scuff);
          satin += grit * (.11 * coat + .19 * alloy + .15 * elastomer) + scuff * .08;
          float turns = (vSurface.w - 8./255.) * 83.;
          float resolved = 1. - smoothstep(.13, .47, fwidth(turns));
          float lathe = alloy * step(.029, vSurface.w) * resolved * cos(6.2831853 * turns);
          satin += .068 * lathe;
          diffuseColor.rgb *= 1. + grit * (.028 * coat + .06 * alloy + .09 * elastomer);` : `
          // At ringside the exposed alloy averages into a narrow satin rim.
          float rim = .16 * coat * smoothstep(.72,.98,vSurface.w);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.29,.30,.29), rim);
          metal = mix(metal,.85,rim);`}
        roughnessFactor = clamp(satin,.07,.95);`)
      .replace('metalnessFactor = vSurface.y;', 'metalnessFactor = metal;')
    if (map) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 across = cross(ty, normal), along = cross(normal, tx);
      float area = dot(tx, across);
      vec3 slope = dFdx(grit) * across + dFdy(grit) * along;
      float relief = .00027 * coat + .00041 * alloy + .00063 * elastomer;
      normal = normalize(normal - relief * slope * sign(area) / max(abs(area), 1.e-9));`)
  }
  material.addEventListener('dispose', () => { map?.dispose(); releaseSurfaceMaterial() })
  return material
}

export const createWorkshopFinish = () => coatedMaterial(true)
export const createArenaFinish = () => coatedMaterial(false)
