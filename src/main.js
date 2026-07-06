import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SITE } from './site.generated.js';
import { DICT } from './i18n.js';
import { buildDOM } from './template.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// expose for headless verification / debugging (harmless in prod)
if (typeof window !== 'undefined') {
  window.__site = { gsap, ScrollTrigger, config: SITE };
}

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- apply accent colors from config → CSS variables ----------
(function applyAccent() {
  const [violet, blue, cyan] = SITE.accent;
  const r = document.documentElement.style;
  r.setProperty('--violet', violet);
  r.setProperty('--blue', blue);
  r.setProperty('--cyan', cyan);
  r.setProperty('--grad', `linear-gradient(105deg, ${violet} 0%, ${blue} 48%, ${cyan} 100%)`);
})();

// ---------- mount markup ----------
const app = document.getElementById('app');
app.innerHTML = buildDOM();

// ---------- i18n ----------
// headline (may contain "\n") is applied specially into .l1/.l2.
function splitHeadline(text) {
  const parts = String(text || '').split('\n');
  return { l1: parts[0] || '', l2: parts.slice(1).join(' ') || '' };
}

let lang = SITE.lang.primary === 'en' ? 'en' : 'zh';

function applyLang(l) {
  lang = l;
  const d = DICT[l];
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (d[key] != null) el.textContent = d[key];
  });
  // headline lines from config
  const hl = splitHeadline(SITE.hero.headline[l]);
  const l1 = document.querySelector('#hero .l1');
  const l2 = document.querySelector('#hero .l2');
  if (l1) l1.textContent = hl.l1;
  if (l2) l2.textContent = hl.l2;
  document.querySelectorAll('.lang-toggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === l);
  });
  ScrollTrigger.refresh();
}
applyLang(lang);

document.querySelectorAll('.lang-toggle button').forEach((b) => {
  b.addEventListener('click', () => applyLang(b.dataset.lang));
});

// ---------- copy command (only present if config.hero.command) ----------
const copyBtn = document.getElementById('copyBtn');
copyBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(SITE.hero.command || '');
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    copyBtn.style.color = 'var(--cyan)';
    setTimeout(() => {
      copyBtn.innerHTML = orig;
      copyBtn.style.color = '';
    }, 1400);
  } catch {
    /* clipboard blocked — no-op */
  }
});

// ---------- topbar scrolled state ----------
const topbar = document.getElementById('topbar');
ScrollTrigger.create({
  start: 'top -40',
  end: 99999,
  onUpdate: (self) => topbar.classList.toggle('scrolled', self.scroll() > 40),
});

// ---------- smooth in-page anchors ----------
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#' || id === '#top') {
      e.preventDefault();
      gsap.to(window, { duration: REDUCED ? 0 : 0.9, scrollTo: 0, ease: 'power2.inOut' });
      return;
    }
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      gsap.to(window, {
        duration: REDUCED ? 0 : 1.0,
        scrollTo: { y: target, offsetY: 0 },
        ease: 'power2.inOut',
      });
    }
  });
});

// ---------- reveal animations ----------
function setupReveals() {
  if (REDUCED) {
    gsap.set('.reveal', { opacity: 1, y: 0 });
    return;
  }
  const heroReveals = document.querySelectorAll('#hero .reveal');
  gsap.to(heroReveals, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: 'power3.out',
    stagger: 0.09,
    delay: 0.15,
  });
  document.querySelectorAll('.reveal:not(#hero .reveal)').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
  });
}

// ---------- 3D scene boot with graceful fallback ----------
let scene = null;

function showFallback() {
  const canvas = document.getElementById('bg-canvas');
  if (canvas) canvas.remove();
  if (!document.querySelector('.bg-fallback')) {
    const f = document.createElement('div');
    f.className = 'bg-fallback';
    document.body.prepend(f);
  }
}

// Scene registry: kind → async loader. Unknown/missing kind is normalized
// to particle-field by the config layer, so this map is always hit.
const SCENES = {
  'hub-nodes': () => import('./scenes/hub-nodes.js'),
  'particle-field': () => import('./scenes/particle-field.js'),
  mesh: () => import('./scenes/mesh.js'),
};

async function bootScene() {
  const canvas = document.getElementById('bg-canvas');
  if (REDUCED || !canvas) {
    showFallback();
    return;
  }
  // quick WebGL capability probe
  try {
    const test = document.createElement('canvas');
    const gl = test.getContext('webgl2') || test.getContext('webgl');
    if (!gl) throw new Error('no-webgl');
  } catch {
    showFallback();
    return;
  }

  const loader = SCENES[SITE.scene.kind] || SCENES['particle-field'];
  try {
    const mod = await loader();
    scene = mod.createScene(canvas, {
      accent: SITE.accent,
      nodes: SITE.scene.nodes,
    });
  } catch (err) {
    console.warn('[web-factory] 3D scene unavailable, using fallback:', err?.message || err);
    showFallback();
    return;
  }

  // drive scene.progress from overall scroll through the scrolly stretch
  const scrolly = document.querySelector('.scrolly');
  ScrollTrigger.create({
    trigger: scrolly,
    start: 'top bottom',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => scene.setProgress(self.progress),
  });
}

// ---------- go ----------
setupReveals();
bootScene();

window.addEventListener('beforeunload', () => scene?.dispose());
