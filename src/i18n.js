// ============================================================
// web-factory · i18n
// ------------------------------------------------------------
// Builds a {zh, en} dictionary at runtime from the injected SITE
// config. Every string is repo-specific and comes from site.json —
// there are no hardcoded product names here.
// ============================================================

import { SITE } from './site.generated.js';

// Pull a {zh,en} pair from the config into both dictionaries.
function pair(dict, key, val) {
  dict.zh[key] = val.zh;
  dict.en[key] = val.en;
}

export function buildDict() {
  const d = { zh: {}, en: {} };

  pair(d, 'hero.eyebrow', SITE.hero.eyebrow);
  pair(d, 'hero.sub', SITE.hero.sub);
  pair(d, 'hero.cta', SITE.hero.cta);
  pair(d, 'hero.github', SITE.hero.ctaGithub);
  pair(d, 'hero.scroll', SITE.hero.scroll);

  // hero headline is split into two lines on "\n"
  SITE.advantages.forEach((a, i) => {
    const n = i + 1;
    pair(d, `adv.${n}.h`, a.title);
    pair(d, `adv.${n}.p`, a.body);
  });

  pair(d, 'cta.h', SITE.cta.headline);
  pair(d, 'cta.p', SITE.cta.sub);
  pair(d, 'cta.btn', SITE.cta.button);
  pair(d, 'footer.tag', SITE.footerTag);

  return d;
}

export const DICT = buildDict();
export const GITHUB_URL = SITE.github;
