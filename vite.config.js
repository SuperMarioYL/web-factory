import { defineConfig } from 'vite';
import { loadSiteConfig } from './scripts/site-config.js';
import path from 'node:path';

// site.json path: env SITE_JSON, else ./site.json
const SITE_JSON = process.env.SITE_JSON || path.resolve(process.cwd(), 'site.json');

// Load + validate once at config time. Throws LOUD if invalid/missing —
// which is exactly what we want: the build should not proceed.
const SITE = loadSiteConfig(SITE_JSON);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Vite plugin: transform index.html placeholders from site.json.
function htmlFromSite() {
  return {
    name: 'web-factory-html',
    transformIndexHtml(html) {
      const p = SITE.lang.primary;
      const htmlLang = p === 'zh' ? 'zh-CN' : 'en';
      const title = SITE.seo.title[p];
      const desc = SITE.seo.desc[p];
      const canonical = SITE.origin ? `${SITE.origin}/` : '';
      const accent0 = SITE.accent[0];
      const themeColor = '#06070c';

      const canonicalTag = canonical
        ? `<link rel="canonical" href="${esc(canonical)}" />`
        : '';
      const ogUrl = canonical
        ? `<meta property="og:url" content="${esc(canonical)}" />`
        : '';

      const favicon = faviconDataUri(SITE.name, SITE.accent);

      const replacements = {
        '%LANG%': htmlLang,
        '%TITLE%': esc(title),
        '%DESC%': esc(desc),
        '%CANONICAL%': canonicalTag,
        '%OG_URL%': ogUrl,
        '%OG_TITLE%': esc(title),
        '%OG_DESC%': esc(desc),
        '%THEME_COLOR%': themeColor,
        '%FAVICON%': favicon,
        '%ACCENT0%': accent0,
      };
      let out = html;
      for (const [k, v] of Object.entries(replacements)) {
        out = out.split(k).join(v);
      }
      return out;
    },
  };
}

// small gradient monogram favicon derived from name + accent
function faviconDataUri(name, accent) {
  const glyph = (name.trim()[0] || 'x').toLowerCase();
  const [a, b, c] = accent;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
    `<rect width='64' height='64' rx='15' fill='%23090b13'/>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${a.replace('#', '%23')}'/>` +
    `<stop offset='.5' stop-color='${b.replace('#', '%23')}'/>` +
    `<stop offset='1' stop-color='${c.replace('#', '%23')}'/>` +
    `</linearGradient></defs>` +
    `<text x='32' y='45' font-family='-apple-system,SF Pro Display,system-ui,sans-serif' ` +
    `font-size='40' font-weight='700' text-anchor='middle' fill='url(%23g)'>${glyph}</text></svg>`;
  return `data:image/svg+xml,${svg}`;
}

export default defineConfig({
  base: '/',
  plugins: [htmlFromSite()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
});
