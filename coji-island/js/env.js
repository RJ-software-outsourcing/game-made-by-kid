// The sky as light. A soft environment map (bright sky above, a warm glow toward the sun, the green
// and sandy ground below) gives every PBR material its fill light and its reflections. It is made
// once at load time, so it costs nothing per frame.
import * as THREE from 'three'

// Where the sun is (a unit vector toward it). Shared by the light, the sky, the sea and the map.
export const SUN_DIR = new THREE.Vector3(50, 50, 34).normalize()

export function skyEnvironment(renderer, { top, horizon, ground, sun }) {
  const scene = new THREE.Scene()
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: top.clone() },
      horizon: { value: horizon.clone() },
      ground: { value: ground.clone() },
      sun: { value: sun.clone() },
      sunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sun; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 sky = mix(horizon, top, pow(max(y, 0.), 0.5));
        vec3 below = mix(horizon * 0.75, ground, smoothstep(0., 0.25, -y));
        vec3 c = y > 0. ? sky : below;
        float s = max(dot(d, sunDir), 0.);
        // a warm glow around the sun so rough things get a little sunny fill from that side
        c += sun * (pow(s, 4.) * 0.35 + pow(s, 48.) * 1.5) * smoothstep(-0.05, 0.1, y);
        gl_FragColor = vec4(c, 1.);
      }`,
  })
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat))
  const pm = new THREE.PMREMGenerator(renderer)
  const rt = pm.fromScene(scene, 0, 0.1, 100)
  pm.dispose()
  mat.dispose()
  return rt.texture
}
