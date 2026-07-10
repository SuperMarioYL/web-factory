// ============================================================
// scene: hub-nodes
// ------------------------------------------------------------
// A luminous central core fanning out to N orbiting nodes with
// flowing particles along each connection line + bloom sheen.
// Generalized from the original mcpx hero: node COUNT and accent
// COLORS come from config (scene.nodes + accent). If no nodes are
// given it falls back to a sensible default count of 4.
//
// createScene(canvas, { accent, nodes }) → { setProgress, resize, dispose }
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
  smoothstep,
  makeRunner,
  disposeScene,
} from './common.js';

export function createScene(canvas, opts = {}) {
  const COL = accentColors(opts.accent);
  const nodeNames = Array.isArray(opts.nodes) ? opts.nodes : [];
  // clamp node count to a tasteful range so the object stays legible
  const NODE_LABELS = Math.max(3, Math.min(nodeNames.length || 4, 7));
  // per-node color cycles through the accent list
  const NODE_COLORS = Array.from({ length: NODE_LABELS }, (_, i) => COL.list[i % COL.list.length]);

  const renderer = makeRenderer(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const rig = new THREE.Group();
  const world = new THREE.Group();
  rig.add(world);
  scene.add(rig);

  // ---- central core: layered icosahedron wireframe + inner glow ----
  const coreGeo = new THREE.IcosahedronGeometry(2.05, 1);
  const coreWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(coreGeo),
    new THREE.LineBasicMaterial({ color: COL.primary, transparent: true, opacity: 0.65 })
  );
  world.add(coreWire);

  const coreInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: COL.deep, transparent: true, opacity: 0.16, wireframe: true })
  );
  world.add(coreInner);

  const glowTex = makeGlowTexture();
  const coreGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, color: COL.primary, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  coreGlow.scale.set(5, 5, 1);
  world.add(coreGlow);

  const halo = makeHalo(700, 6.5, COL.list);
  world.add(halo.points);

  // ---- N client nodes on an orbit + connection lines + flow particles ----
  const nodeGroup = new THREE.Group();
  world.add(nodeGroup);

  const nodes = [];
  const radius = 6.2;
  for (let i = 0; i < NODE_LABELS; i++) {
    const ang = (i / NODE_LABELS) * Math.PI * 2 + Math.PI / 4;
    const tilt = (i % 2 === 0 ? 1 : -1) * 1.35;
    const pos = new THREE.Vector3(Math.cos(ang) * radius, tilt + Math.sin(ang) * 1.2, Math.sin(ang) * radius);
    const c = NODE_COLORS[i];

    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.52, 0),
      new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(pos);
    nodeGroup.add(mesh);

    const nglow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    nglow.scale.set(2.2, 2.2, 1);
    nglow.position.copy(pos);
    nodeGroup.add(nglow);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos]);
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.0 })
    );
    nodeGroup.add(line);

    // stagger reveal across scroll for however many nodes there are
    const appearAt = 0.06 + (i / NODE_LABELS) * 0.6;
    nodes.push({ pos, mesh, nglow, line, color: c, baseAng: ang, appearAt });
  }

  // flow particles hub -> node
  const FLOW_PER = 14;
  const flowCount = NODE_LABELS * FLOW_PER;
  const flowGeo = new THREE.BufferGeometry();
  const flowPos = new Float32Array(flowCount * 3);
  const flowCol = new Float32Array(flowCount * 3);
  const flowT = new Float32Array(flowCount);
  const flowNode = new Int32Array(flowCount);
  for (let i = 0; i < flowCount; i++) {
    const ni = Math.floor(i / FLOW_PER);
    flowNode[i] = ni;
    flowT[i] = (i % FLOW_PER) / FLOW_PER;
    const c = nodes[ni].color;
    flowCol[i * 3] = c.r; flowCol[i * 3 + 1] = c.g; flowCol[i * 3 + 2] = c.b;
  }
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  flowGeo.setAttribute('color', new THREE.BufferAttribute(flowCol, 3));
  const flowMat = new THREE.PointsMaterial({
    size: 0.16, vertexColors: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex,
  });
  const flow = new THREE.Points(flowGeo, flowMat);
  nodeGroup.add(flow);

  // ---- bloom — restrained so it reads expensive, not neon ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.68, 0.6, 0.22);
  composer.addPass(bloom);

  let progress = 0;
  const tmp = new THREE.Vector3();

  function setLayout() {
    const w = window.innerWidth;
    if (w >= 1280) { rig.position.set(4.6, -0.6, 0); rig.scale.setScalar(0.98); }
    else if (w >= 1024) { rig.position.set(4.0, -0.6, -0.5); rig.scale.setScalar(0.9); }
    else if (w >= 700) { rig.position.set(2.0, 0.2, -1.8); rig.scale.setScalar(0.82); }
    else { rig.position.set(0, 2.6, -2.6); rig.scale.setScalar(0.68); }
  }

  function tick(dt, t, pointer) {
    world.rotation.y = t * 0.12 + progress * Math.PI * 0.9 + pointer.x * 0.35;
    world.rotation.x = Math.sin(t * 0.15) * 0.06 - pointer.y * 0.22 + progress * 0.12;

    coreWire.rotation.y -= dt * 0.25;
    coreWire.rotation.x += dt * 0.12;
    coreInner.rotation.y += dt * 0.4;
    const pulse = 1 + Math.sin(t * 1.6) * 0.03;
    coreWire.scale.setScalar(pulse);
    coreGlow.material.opacity = 0.52 + Math.sin(t * 1.6) * 0.1;
    halo.points.rotation.y += dt * 0.03;

    camera.position.z = 14 - progress * 3.2;
    camera.position.y = progress * 0.6;
    camera.lookAt(0, 0, 0);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const appear = smoothstep(n.appearAt, n.appearAt + 0.14, progress);
      n.mesh.material.opacity = 0.25 + appear * 0.7;
      n.mesh.rotation.x += dt * 0.9;
      n.mesh.rotation.y += dt * 1.2;
      n.mesh.scale.setScalar(0.6 + appear * 0.6 + Math.sin(t * 2 + i) * 0.04);
      n.nglow.material.opacity = appear * (0.55 + Math.sin(t * 2.4 + i) * 0.12);
      n.line.material.opacity = appear * 0.5;
    }

    const speed = 0.28 + progress * 0.22;
    flowMat.opacity = 0.15 + smoothstep(0.05, 0.4, progress) * 0.75;
    for (let i = 0; i < flowCount; i++) {
      let tt = flowT[i] + dt * speed;
      if (tt > 1) tt -= 1;
      flowT[i] = tt;
      const n = nodes[flowNode[i]];
      const appear = smoothstep(n.appearAt, n.appearAt + 0.14, progress);
      tmp.copy(n.pos).multiplyScalar(tt * appear);
      flowPos[i * 3] = tmp.x;
      flowPos[i * 3 + 1] = tmp.y;
      flowPos[i * 3 + 2] = tmp.z;
    }
    flowGeo.attributes.position.needsUpdate = true;

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

function makeHalo(count, r, palette) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const rr = r * (0.6 + Math.random() * 0.55);
    pos[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = rr * Math.cos(phi) * 0.7;
    pos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
    const c = palette[i % palette.length];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return { points: new THREE.Points(geo, mat) };
}
