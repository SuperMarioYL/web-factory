// ============================================================
// web-factory · DOM template
// ------------------------------------------------------------
// Builds the whole single page from the injected SITE config.
// Every label, count, and node name is data-driven; nothing here
// is specific to any one repo.
// ============================================================

import { SITE } from './site.generated.js';

const GITHUB_URL = SITE.github;
export { GITHUB_URL };

const ghIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z"/></svg>`;

const copyIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;

const check = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-1px"><path d="M20 6L9 17l-5-5"/></svg>`;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Advantage section — a true-glass card with a cursor spotlight border.
// Cards alternate left/right down the page (zig-zag via CSS nth-of-type).
// Chips come from the config (already-formatted strings).
function advantage(n, adv) {
  const chips = (adv.chips || [])
    .map(
      (c) =>
        `<span class="chip">${
          c.startsWith('›') ? '' : '<span class="k">›</span> '
        }${esc(c)}</span>`
    )
    .join('\n          ');
  return `
  <section class="advantage" data-adv="${n}">
    <div class="wrap adv-row">
      <div class="adv-card reveal">
        <h2 data-i18n="adv.${n}.h"></h2>
        <p data-i18n="adv.${n}.p"></p>
        ${chips ? `<div class="adv-meta">\n          ${chips}\n        </div>` : ''}
      </div>
    </div>
  </section>`;
}

// The hero headline may contain "\n" → two lines, the 2nd accent-tinted.
function heroHeadline() {
  return `
        <h1>
          <span class="l1 reveal" data-i18n="hero.l1"></span>
          <span class="l2 reveal" data-i18n="hero.l2"></span>
        </h1>`;
}

// Optional command pill (hidden entirely if hero.command is null).
function heroCommand() {
  if (!SITE.hero.command) return '';
  return `
        <div class="hero-cmd reveal">
          <span><span class="prompt">$</span> ${esc(SITE.hero.command)}</span>
          <button class="cmd-copy" id="copyBtn" aria-label="copy command">${copyIcon}</button>
        </div>`;
}

// Optional node strip (rendered only when scene.nodes is non-empty).
function nodeStrip() {
  const nodes = SITE.scene.nodes || [];
  if (!nodes.length) return '';
  const cells = nodes
    .map(
      (name) => `
          <div class="client-cell">
            <span class="cname">${esc(name)}</span>
            <span class="cstatus">${check} ${connectedLabel()}</span>
          </div>`
    )
    .join('');
  return `
    <section class="clients ground">
      <div class="wrap">
        <p class="lead reveal">${esc(stripLead())}</p>
        <div class="client-grid reveal">${cells}
        </div>
      </div>
    </section>`;
}

function connectedLabel() {
  return SITE.lang.primary === 'en' ? 'connected' : '已连接';
}
function stripLead() {
  const n = (SITE.scene.nodes || []).length;
  return SITE.lang.primary === 'en'
    ? `${n} integration${n === 1 ? '' : 's'}, wired in one pass.`
    : `${n} 个集成，一次接通。`;
}

export function buildDOM() {
  const wordmark = `${esc(SITE.name)}<span class="dot"></span>`;
  const advSections = SITE.advantages.map((a, i) => advantage(i + 1, a)).join('\n');

  const langToggle = SITE.lang.toggle
    ? `
      <div class="lang-toggle" role="group" aria-label="language">
        <button data-lang="zh"${SITE.lang.primary === 'zh' ? ' class="active"' : ''}>中</button>
        <button data-lang="en"${SITE.lang.primary === 'en' ? ' class="active"' : ''}>EN</button>
      </div>`
    : '';

  return `
  <canvas id="bg-canvas"></canvas>
  <div class="grain" aria-hidden="true"></div>

  <header class="topbar" id="topbar">
    <a class="wordmark" href="#top" aria-label="${esc(SITE.name)} home">${wordmark}</a>
    <nav class="nav-right">${langToggle}
      <a class="icon-link" href="${GITHUB_URL}" target="_blank" rel="noopener" aria-label="GitHub repository">${ghIcon}</a>
    </nav>
  </header>

  <main id="top">
    <!-- HERO -->
    <section class="hero" id="hero">
      <div class="wrap hero-inner">
        <div class="eyebrow reveal" data-i18n="hero.eyebrow"></div>
        ${heroHeadline()}
        <p class="hero-sub reveal" data-i18n="hero.sub"></p>
        ${heroCommand()}
        <div class="hero-actions reveal">
          <a class="btn btn-primary" href="${GITHUB_URL}" target="_blank" rel="noopener">
            <span data-i18n="hero.cta"></span>
          </a>
          <a class="btn btn-ghost" href="${GITHUB_URL}" target="_blank" rel="noopener">
            ${ghIcon}<span data-i18n="hero.github"></span>
          </a>
        </div>
      </div>
    </section>

    <!-- SCROLLYTELLING ADVANTAGES -->
    <div class="scrolly ground">
      <span id="adv-1"></span>
${advSections}
    </div>

    ${nodeStrip()}

    <!-- FINAL CTA -->
    <section class="cta ground">
      <div class="cta-inner reveal">
        <h2 data-i18n="cta.h"></h2>
        <p data-i18n="cta.p"></p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="${GITHUB_URL}" target="_blank" rel="noopener">
            ${ghIcon}<span data-i18n="cta.btn"></span>
          </a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <span class="wordmark">${wordmark}</span>
    <span class="fmono" data-i18n="footer.tag"></span>
    <a href="${GITHUB_URL}" target="_blank" rel="noopener" class="fmono">${esc(SITE.ghDisplay)} →</a>
  </footer>
  `;
}
