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

// ---------- apply THE accent from config → CSS variable ----------
// accent[0] is the one page accent; any extra entries only tint the
// 3D scene (passed to createScene below), never the UI.
(function applyAccent() {
  document.documentElement.style.setProperty('--accent', SITE.accent[0]);
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

// Locale by visitor timezone: UTC+8 (Shanghai/Taipei/HK/Singapore/…) → zh, else en.
// The manual .lang-toggle still lets either audience switch; SITE.lang.primary is
// the fallback if the timezone can't be read.
function pickLang() {
  try {
    if (new Date().getTimezoneOffset() === -480) return 'zh'; // UTC+8
  } catch (e) {}
  return SITE.lang.primary === 'en' ? 'en' : 'zh';
}
let lang = pickLang();

function applyLang(l) {
  lang = l;
  const d = DICT[l];
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (d[key] == null) return;
    const v = d[key];
    // middle-dot chains (本地·无账号·单二进制) must break AT the dots, never
    // mid-word: escape, then add <wbr> after each dot + scope keep-all via .kd
    if (el.tagName === 'H2' && v.includes('·')) {
      // bind the dot to the word before it (nbsp), allow a break only after it
      el.innerHTML = escapeHtml(v).replace(/\s*·\s*/g, '\u00A0·<wbr> ');
      el.classList.add('kd');
    } else {
      el.textContent = v;
    }
  });
  // headline lines from config
  const hl = splitHeadline(SITE.hero.headline[l]);
  const l1 = document.querySelector('#hero .l1');
  const l2 = document.querySelector('#hero .l2');
  if (l1) l1.textContent = hl.l1;
  if (l2) l2.textContent = hl.l2;
  // scale wordy headlines down so the hero always fits the viewport.
  // CJK glyphs are ~2x the advance of latin, so weight them double.
  const units = (s) =>
    [...String(s)].reduce((n, ch) => n + (ch.codePointAt(0) > 0x2e7f ? 2 : 1), 0);
  const longest = Math.max(units(hl.l1), units(hl.l2));
  const h1 = document.querySelector('#hero h1');
  if (h1) h1.classList.toggle('long', longest > 26);
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
    copyBtn.style.color = 'var(--accent)';
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
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.09,
    delay: 0.15,
  });
  document.querySelectorAll('.reveal:not(#hero .reveal)').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
    // stagger the chips inside a card so nothing mounts all at once
    const chips = el.querySelectorAll('.chip');
    if (chips.length) {
      gsap.from(chips, {
        opacity: 0,
        y: 10,
        duration: 0.7,
        ease: 'expo.out',
        stagger: 0.07,
        scrollTrigger: { trigger: el, start: 'top 78%' },
      });
    }
  });
}

// ---------- spotlight border — advantage cards track the cursor ----------
function setupSpotlight() {
  if (REDUCED) return;
  document.querySelectorAll('.adv-card').forEach((card) => {
    card.addEventListener(
      'pointermove',
      (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      },
      { passive: true }
    );
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
setupSpotlight();
bootScene();

window.addEventListener('beforeunload', () => scene?.dispose());
