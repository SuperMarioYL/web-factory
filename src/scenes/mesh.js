// ============================================================
// scene: mesh
// ------------------------------------------------------------
// An abstract flowing gradient blob: a high-poly icosphere whose
// vertices ripple through layered noise, shaded with a custom
// accent-gradient fresnel material + bloom. Reads as a slow,
// liquid "object" behind the copy. Fits any brand.
//
// createScene(canvas, { accent }) → { setProgress, resize, dispose }
// Throws on no-WebGL so the caller shows the CSS fallback.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  accentColors,
  makeRenderer,
  makeGlowTexture,
  makeRunner,
  disposeScene,
} from './common.js';

export function createScene(canvas, opts = {}) {
  const COL = accentColors(opts.accent);
  const renderer = makeRenderer(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const rig = new THREE.Group();
  const world = new THREE.Group();
  rig.add(world);
  scene.add(rig);

  const glowTex = makeGlowTexture();

  // gradient-fresnel shader: mixes accent colors by view fresnel + noise band
  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uC0: { value: COL.list[0].clone() },
    uC1: { value: COL.list[1].clone() },
    uC2: { value: COL.list[2].clone() },
  };

  const blobMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vBand;

      // cheap 3D-ish noise from sines
      float n(vec3 p){
        return sin(p.x*1.7 + uTime*0.6)
             + sin(p.y*2.1 - uTime*0.5)
             + sin(p.z*1.9 + uTime*0.4);
      }
      void main(){
        vec3 p = position;
        float d = n(p*1.3) * 0.16 + n(p*2.7) * 0.06;
        p += normal * d;
        vBand = d;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = normalize(-mv.xyz);
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uC0, uC1, uC2;
      uniform float uProgress;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vBand;
      void main(){
        // fresnel rim-light: interior stays dim, edges glow — keeps bright
        // accents (yellow/orange) from blowing out the whole blob.
        float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
        float t = clamp(0.5 + vBand*0.9, 0.0, 1.0);
        vec3 c = t < 0.5 ? mix(uC0, uC1, t/0.5) : mix(uC1, uC2, (t-0.5)/0.5);
        float a = (0.06 + fres * 0.6) * (0.72 + uProgress*0.28);
        gl_FragColor = vec4(c, a);
      }
    `,
  });

  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 24), blobMat);
  world.add(blob);

  // a wireframe shell for extra structure
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.55, 2)),
    new THREE.LineBasicMaterial({ color: COL.list[1], transparent: true, opacity: 0.18 })
  );
  world.add(shell);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, color: COL.list[1], transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.scale.set(7.5, 7.5, 1);
  world.add(glow);

  // bloom — restrained so it reads expensive, not neon
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.65, 0.4);
  composer.addPass(bloom);

  let progress = 0;

  function setLayout() {
    const w = window.innerWidth;
    if (w >= 1280) { rig.position.set(2.4, -0.2, 0); rig.scale.setScalar(1.0); }
    else if (w >= 1024) { rig.position.set(2.0, -0.2, -0.3); rig.scale.setScalar(0.92); }
    else if (w >= 700) { rig.position.set(1.0, 0.3, -1.2); rig.scale.setScalar(0.82); }
    else { rig.position.set(0, 1.6, -1.8); rig.scale.setScalar(0.7); }
  }

  function tick(dt, t, pointer) {
    uniforms.uTime.value = t;
    uniforms.uProgress.value = progress;
    world.rotation.y = t * 0.14 + pointer.x * 0.4 + progress * 0.6;
    world.rotation.x = Math.sin(t * 0.13) * 0.12 - pointer.y * 0.25;
    shell.rotation.y -= dt * 0.08;
    glow.material.opacity = 0.24 + Math.sin(t * 1.2) * 0.06;
    camera.position.z = 7.2 - progress * 1.4;
    composer.render();
  }

  const runner = makeRunner({
    canvas,
    renderer,
    camera,
    tick,
    onResize: (w, h) => {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      setLayout();
    },
    extraDispose: () => {
      composer.dispose?.();
      glowTex.dispose();
    },
  });

  return {
    setProgress(p) { progress = Math.max(0, Math.min(1, p)); },
    resize: runner.resize,
    dispose() {
      runner.stop();
      disposeScene(scene, renderer);
    },
  };
}
