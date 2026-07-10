// ============================================================
// scene: particle-field  (the universal fallback)
// ------------------------------------------------------------
// A premium flowing particle cloud tinted across the accent
// gradient, drifting through curl-like noise with a gentle bloom.
// Fits ANY project — selected when scene.kind is missing/unknown.
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
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  const world = new THREE.Group();
  scene.add(world);

  const glowTex = makeGlowTexture();

  // ---- particle cloud filling a soft ellipsoid volume ----
  const COUNT = 2600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT); // per-particle phase
  const speed = new Float32Array(COUNT);
  const home = new Float32Array(COUNT * 3);

  const c0 = COL.list[0], c1 = COL.list[1], c2 = COL.list[2];
  const mixColor = (t) => {
    // 3-stop gradient across the accent
    const c = new THREE.Color();
    if (t < 0.5) c.copy(c0).lerp(c1, t / 0.5);
    else c.copy(c1).lerp(c2, (t - 0.5) / 0.5);
    return c;
  };

  for (let i = 0; i < COUNT; i++) {
    // point inside a flattened ellipsoid shell
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const rr = 9 * (0.35 + Math.random() * 0.75);
    const x = rr * Math.sin(phi) * Math.cos(theta) * 1.25;
    const y = rr * Math.cos(phi) * 0.62;
    const z = rr * Math.sin(phi) * Math.sin(theta);
    home[i * 3] = x; home[i * 3 + 1] = y; home[i * 3 + 2] = z;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const c = mixColor(Math.random());
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    seed[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.5 + Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex,
  });
  const points = new THREE.Points(geo, mat);
  world.add(points);

  // a faint larger halo of dust behind
  const dust = makeDust(900, COL.list, glowTex);
  world.add(dust);

  // ---- bloom — restrained so it reads expensive, not neon ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.65, 0.3);
  composer.addPass(bloom);

  let progress = 0;

  function tick(dt, t, pointer) {
    // gentle whole-cloud rotation + parallax + scroll drift
    world.rotation.y = t * 0.05 + pointer.x * 0.3 + progress * 0.5;
    world.rotation.x = Math.sin(t * 0.11) * 0.05 - pointer.y * 0.18;

    // flowing displacement — cheap pseudo-curl using sines around home
    const p = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      const hx = home[i * 3], hy = home[i * 3 + 1], hz = home[i * 3 + 2];
      const s = seed[i];
      const sp = speed[i];
      const amp = 0.55;
      p[i * 3] = hx + Math.sin(t * 0.4 * sp + s) * amp;
      p[i * 3 + 1] = hy + Math.cos(t * 0.33 * sp + s * 1.3) * amp;
      p[i * 3 + 2] = hz + Math.sin(t * 0.37 * sp + s * 0.7) * amp;
    }
    geo.attributes.position.needsUpdate = true;

    // subtle push-in + brighten on scroll
    camera.position.z = 16 - progress * 3.5;
    mat.opacity = 0.78 + progress * 0.18;
    dust.rotation.y -= dt * 0.02;

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

function makeDust(count, palette, glowTex) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 6;
    const c = palette[i % palette.length];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.06, vertexColors: true, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex,
  });
  return new THREE.Points(geo, mat);
}
