// ============================================================
// web-factory · site.json loader + validator + normalizer
// ------------------------------------------------------------
// The SINGLE source of truth for how a repo's site.json is read,
// validated, and expanded into the full runtime config object.
// Used by both the prebuild script (scripts/prebuild.js) and the
// Vite plugin (vite.config.js) so there is exactly one contract.
//
// Fails LOUD (throws SiteConfigError) on any missing required field
// or malformed input, with a message a build log can act on.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

export class SiteConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'SiteConfigError';
  }
}

// ---- brand default: a single amber-phosphor accent ---------
// accent[0] is THE accent (UI color). accent[1] / accent[2] only
// tint the 3D scene; when absent they are derived from accent[0].
export const DEFAULT_ACCENT = ['#e6a144'];
export const KNOWN_SCENES = ['hub-nodes', 'particle-field', 'mesh'];
const DEFAULT_SCENE = 'particle-field';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function fail(msg) {
  throw new SiteConfigError(
    `[web-factory] Invalid site.json — ${msg}\n` +
      `  See the site.json contract in README.md. Required: name, github, hero.headline, ≥1 advantage.`
  );
}

// ---- tiny color helpers for deriving scene tints -----------
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// Derive two quiet scene tints from the single accent: a lighter,
// slightly cooler sibling and a deeper ember of the same hue. These
// only feed the WebGL scene — the page UI uses accent[0] alone.
export function deriveSceneTints(accentHex) {
  const [h, s, l] = rgbToHsl(hexToRgb(accentHex));
  // both tints lean the SAME way around the wheel (slightly warmer /
  // deeper) so additive blending in the scene never drifts toward a
  // clashing neighbor hue
  const lighter = rgbToHex(
    hslToRgb([(h - 0.012 + 1) % 1, Math.max(0, s * 0.75), Math.min(0.88, l + 0.17)])
  );
  const deeper = rgbToHex(
    hslToRgb([(h - 0.03 + 1) % 1, Math.min(1, s * 0.9), Math.max(0.12, l - 0.24)])
  );
  return [lighter, deeper];
}

// Accept either a bare string (applied to both langs) or a {zh,en} pair.
// Returns a normalized {zh, en} with sensible fallbacks between the two.
function normLangText(val, where, { required = false } = {}) {
  if (val == null || val === '') {
    if (required) fail(`${where} is required`);
    return { zh: '', en: '' };
  }
  if (typeof val === 'string') return { zh: val, en: val };
  if (typeof val === 'object') {
    const zh = typeof val.zh === 'string' ? val.zh : '';
    const en = typeof val.en === 'string' ? val.en : '';
    if (required && !zh && !en) fail(`${where} is required (both zh and en empty)`);
    // cross-fill so a single-language site still renders in both toggles
    return { zh: zh || en, en: en || zh };
  }
  fail(`${where} must be a string or a {zh,en} object`);
}

function normAccent(accent) {
  const src = accent == null ? [...DEFAULT_ACCENT] : accent;
  if (!Array.isArray(src) || src.length < 1) {
    fail('accent must be an array of at least one hex color');
  }
  const out = src.map((c, i) => {
    if (typeof c !== 'string' || !HEX.test(c.trim())) {
      fail(`accent[${i}] "${c}" is not a valid hex color (e.g. "#e6a144")`);
    }
    return c.trim();
  });
  // accent[0] is THE accent; pad missing scene tints by deriving quiet
  // siblings of the same hue (backward compatible: an old 3-color array
  // still builds — entries beyond [0] only tint the 3D scene).
  if (out.length < 3) {
    const [lighter, deeper] = deriveSceneTints(out[0]);
    if (out.length === 1) out.push(lighter, deeper);
    else out.push(deeper);
  }
  return out.slice(0, 3);
}

// ------------------------------------------------------------
// Load + validate + expand → the runtime config object that the
// browser bundle consumes as window.__SITE / import.meta config.
// ------------------------------------------------------------
export function loadSiteConfig(siteJsonPath) {
  const abs = path.resolve(siteJsonPath);
  if (!fs.existsSync(abs)) {
    fail(`file not found at "${abs}" (set SITE_JSON or place site.json at project root)`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    fail(`could not parse JSON: ${e.message}`);
  }
  return normalizeSiteConfig(raw, abs);
}

export function normalizeSiteConfig(raw, sourcePath = '<inline>') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('top-level value must be an object');
  }

  // ---- required: name ----
  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    fail('"name" is required and must be a non-empty string');
  }
  const name = raw.name.trim();

  // ---- required: github ----
  if (typeof raw.github !== 'string' || !/^https?:\/\/github\.com\/[^/]+\/[^/]+/.test(raw.github)) {
    fail('"github" is required and must look like https://github.com/OWNER/REPO');
  }
  const github = raw.github.replace(/\/+$/, '');
  const ghDisplay = github.replace(/^https?:\/\//, '');

  // ---- host (optional; drives canonical/robots/sitemap) ----
  const host =
    typeof raw.host === 'string' && raw.host.trim()
      ? raw.host.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
      : '';
  const origin = host ? `https://${host}` : '';

  // ---- lang ----
  const langRaw = raw.lang && typeof raw.lang === 'object' ? raw.lang : {};
  const primary = langRaw.primary === 'en' ? 'en' : 'zh';
  const toggle = langRaw.toggle === false ? false : true;

  // ---- hero (headline required) ----
  const heroRaw = raw.hero && typeof raw.hero === 'object' ? raw.hero : {};
  const headline = normLangText(heroRaw.headline, 'hero.headline', { required: true });
  const hero = {
    eyebrow: normLangText(heroRaw.eyebrow, 'hero.eyebrow'),
    headline, // may contain "\n" to split into two lines
    sub: normLangText(heroRaw.sub, 'hero.sub'),
    // command is optional → null hides the command pill entirely
    command:
      typeof heroRaw.command === 'string' && heroRaw.command.trim()
        ? heroRaw.command.trim()
        : null,
    cta: normLangText(heroRaw.cta || { zh: '开始使用', en: 'Get started' }, 'hero.cta'),
    ctaGithub: normLangText(
      heroRaw.ctaGithub || { zh: '在 GitHub 查看', en: 'View on GitHub' },
      'hero.ctaGithub'
    ),
    scroll: normLangText(
      heroRaw.scroll || { zh: '下拉了解更多', en: 'Scroll to explore' },
      'hero.scroll'
    ),
  };

  // ---- advantages (≥1 required) ----
  if (!Array.isArray(raw.advantages) || raw.advantages.length < 1) {
    fail('"advantages" is required and must be a non-empty array (≥1 item)');
  }
  const advantages = raw.advantages.map((a, i) => {
    if (!a || typeof a !== 'object') fail(`advantages[${i}] must be an object`);
    const chips = Array.isArray(a.chips)
      ? a.chips.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())
      : [];
    return {
      title: normLangText(a.title, `advantages[${i}].title`, { required: true }),
      body: normLangText(a.body, `advantages[${i}].body`, { required: true }),
      chips, // array of already-formatted strings, e.g. "› detects 4 clients"
    };
  });

  // ---- accent ----
  const accent = normAccent(raw.accent);

  // ---- scene ----
  const sceneRaw = raw.scene && typeof raw.scene === 'object' ? raw.scene : {};
  let kind = typeof sceneRaw.kind === 'string' ? sceneRaw.kind.trim() : '';
  if (!KNOWN_SCENES.includes(kind)) {
    if (kind) {
      // unknown kind is not fatal — warn and fall back so a typo never breaks a build
      console.warn(
        `[web-factory] scene.kind "${kind}" is unknown; falling back to "${DEFAULT_SCENE}". ` +
          `Known: ${KNOWN_SCENES.join(', ')}.`
      );
    }
    kind = DEFAULT_SCENE;
  }
  const nodes = Array.isArray(sceneRaw.nodes)
    ? sceneRaw.nodes.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
    : [];
  const scene = { kind, nodes };

  // ---- optional: cta band ----
  const ctaRaw = raw.cta && typeof raw.cta === 'object' ? raw.cta : {};
  const cta = {
    headline: normLangText(
      ctaRaw.headline || headline,
      'cta.headline'
    ),
    sub: normLangText(ctaRaw.sub || hero.sub, 'cta.sub'),
    button: normLangText(
      ctaRaw.button || { zh: '在 GitHub 上开始', en: 'Get started on GitHub' },
      'cta.button'
    ),
  };

  // ---- optional: footer tagline ----
  const footerTag = normLangText(
    (raw.footer && raw.footer.tag) || hero.sub,
    'footer.tag'
  );

  // ---- derived SEO strings ----
  const seoTitle = {
    zh: `${name} · ${firstLine(headline.zh)}`,
    en: `${name} · ${firstLine(headline.en)}`,
  };
  const seoDesc = {
    zh: hero.sub.zh || firstLine(headline.zh),
    en: hero.sub.en || firstLine(headline.en),
  };

  return {
    schema: 1,
    name,
    github,
    ghDisplay,
    host,
    origin,
    lang: { primary, toggle },
    hero,
    advantages,
    accent,
    scene,
    cta,
    footerTag,
    seo: { title: seoTitle, desc: seoDesc },
    _source: sourcePath,
  };
}

function firstLine(s) {
  return String(s || '').split('\n')[0].trim();
}

// Collect every CJK codepoint used anywhere in the config text, so the
// prebuild can subset Noto Sans SC down to only the glyphs this site needs.
// When the language toggle is OFF, only the primary language's strings can
// ever render, so we ignore the other language's text (avoids pulling in the
// Chinese default labels on an en-only site, etc.).
export function collectCjkText(cfg) {
  const onlyLang = cfg.lang.toggle ? null : cfg.lang.primary;
  const bag = [];
  const push = (v) => {
    if (typeof v === 'string') {
      bag.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(push);
    } else if (v && typeof v === 'object') {
      // a {zh,en} localized pair: keep only the visible language(s)
      if (('zh' in v || 'en' in v) && onlyLang) {
        if (onlyLang in v) push(v[onlyLang]);
      } else {
        Object.values(v).forEach(push);
      }
    }
  };
  push(cfg.hero);
  push(cfg.advantages);
  push(cfg.cta);
  push(cfg.footerTag);
  push(cfg.seo);
  push(cfg.name);
  push(cfg.scene.nodes);
  const joined = bag.join('');
  // keep CJK unified ideographs + common CJK punctuation/fullwidth ranges
  const cjk = new Set();
  for (const ch of joined) {
    const cp = ch.codePointAt(0);
    if (
      (cp >= 0x2e80 && cp <= 0x9fff) || // CJK radicals + unified
      (cp >= 0x3000 && cp <= 0x30ff) || // CJK punctuation + kana
      (cp >= 0xff00 && cp <= 0xffef) || // fullwidth forms
      (cp >= 0x3400 && cp <= 0x4dbf) // ext-A
    ) {
      cjk.add(ch);
    }
  }
  return [...cjk].join('');
}
