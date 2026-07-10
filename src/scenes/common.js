// ============================================================
// web-factory · scene common helpers
// ------------------------------------------------------------
// Shared perf rules + primitives for every scene:
//   - pixelRatio cap (≤2)
//   - pause on hidden tab
//   - dispose() that frees geometry/material/texture
//   - accent → THREE.Color palette
// Each scene wires its own tick() through makeRunner().
// ============================================================

import * as THREE from 'three';

// accent[0] is THE accent (drives the scene's dominant color);
// accent[1] / accent[2] are quiet scene tints (derived siblings of
// the accent when the site.json gives only one color, or whatever an
// older 3-color config provided — either way they only tint the 3D).
export function accentColors(accent) {
  const src = accent && accent.length ? accent : ['#e6a144', '#f2cd8b', '#9c6420'];
  const primary = new THREE.Color(src[0]);
  const tint = new THREE.Color(src[1] || src[0]);
  const deep = new THREE.Color(src[2] || src[0]);
  return {
    primary,
    tint,
    deep,
    list: [primary, tint, deep],
  };
}

// throws on no-WebGL so the caller can show the CSS fallback
export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  if (!renderer.getContext()) throw new Error('no-webgl');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  // transparent clear: the page's tinted ink shows through, so the
  // canvas ground matches the CSS canvas on every color pipeline
  renderer.setClearColor(0x06070c, 0);
  return renderer;
}

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function makeGlowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Wires the RAF loop + visibility pause + pointer easing + resize.
// tick(dt, t) is supplied by the scene. Returns lifecycle controls.
export function makeRunner({ canvas, renderer, camera, tick, onResize, extraDispose }) {
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    onResize?.(w, h);
  }
  resize();

  function onPointer(e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      clock.getDelta(); // drop the elapsed gap
      loop();
    }
  }

  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    // ease pointer
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    tick(dt, clock.elapsedTime, pointer);
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  loop();

  return {
    resize,
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      extraDispose?.();
    },
  };
}

// Deep-dispose all geometry/material/textures under a scene graph.
export function disposeScene(scene, renderer, extras = []) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
  extras.forEach((e) => e?.dispose?.());
  renderer.dispose();
}
