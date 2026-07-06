# web-factory

A data-driven **Vite + Three.js + GSAP** renderer that builds any repo's
Apple-style single-page product site from **one `site.json`**. Point it at a
config, get a polished animated site with a 3D hero, GSAP scrollytelling, a
bilingual (中/EN) toggle, self-hosted fonts, SEO metas, `robots.txt` +
`sitemap.xml`, and reduced-motion / no-WebGL fallbacks.

It mirrors the reusable **site-factory** pattern — a central renderer + a tiny
per-repo content package + a reusable GitHub Actions workflow — but for the
Vite/Three stack, so a pipeline can auto-generate a site per repo with a
minimal per-repo footprint (just `web/site.json` + a ~12-line caller).

---

## How a repo onboards

1. Add **`web/site.json`** to your repo (the only per-repo input — see the
   contract below).
2. Copy **[`examples/pages.yml`](examples/pages.yml)** to
   `.github/workflows/pages.yml`.
3. In your repo settings, enable **Pages → Source: “GitHub Actions”**.

On the next push that touches `web/**`, the reusable workflow renders your
`site.json` through web-factory and deploys the result to GitHub Pages.

```
your-repo/
├─ web/
│  ├─ site.json          ← the only required file
│  └─ assets/            ← optional; copied to /assets in the built site
└─ .github/workflows/
   └─ pages.yml          ← the ~12-line caller
```

---

## The `site.json` contract

`site.json` is the single source of truth. Everything repo-specific comes from
here — the renderer contains **no** hardcoded product strings.

```jsonc
{
  "schema": 1,

  // ── REQUIRED ──────────────────────────────────────────────
  "name": "mcpx",                                   // wordmark + favicon glyph
  "github": "https://github.com/OWNER/REPO",        // all GitHub links + footer
  "hero": {
    "headline": {                                   // "\n" splits into 2 lines,
      "zh": "line 1\nline 2",                        //   the 2nd gradient-tinted
      "en": "line 1\nline 2"
    }
  },
  "advantages": [                                    // ≥ 1 required
    {
      "title": { "zh": "…", "en": "…" },
      "body":  { "zh": "…", "en": "…" },
      "chips": ["› short fact", "another"]           // optional; rendered as pills
    }
  ],

  // ── OPTIONAL (sensible defaults) ──────────────────────────
  "host": "mcpx.lei6393.com",                       // → canonical, robots, sitemap
  "lang": { "primary": "zh", "toggle": true },      // default primary "zh", toggle true
  "accent": ["#8b7cf6", "#4d9bff", "#34e5d0"],      // brand violet/blue/cyan default
  "hero": {
    "eyebrow":   { "zh": "…", "en": "…" },
    "sub":       { "zh": "…", "en": "…" },
    "command":   "mcpx add filesystem",             // omit → command pill hidden
    "cta":       { "zh": "开始使用", "en": "Get started" },
    "ctaGithub": { "zh": "在 GitHub 查看", "en": "View on GitHub" },
    "scroll":    { "zh": "下拉了解更多", "en": "Scroll to explore" }
  },
  "scene": {
    "kind": "hub-nodes",                            // scene library, see below
    "nodes": ["Claude Code", "Claude Desktop", "Codex", "Cursor"]
  },
  "cta":    { "headline": {…}, "sub": {…}, "button": {…} },  // final CTA band
  "footer": { "tag": { "zh": "…", "en": "…" } }
}
```

### Localized fields

Any localized field accepts **either** a bare string (applied to both
languages) **or** a `{ "zh": "…", "en": "…" }` pair. A single language is
cross-filled into the other so a one-language site still renders in both toggle
states.

### Defaults

| Field | Default |
|-------|---------|
| `lang.primary` | `"zh"` |
| `lang.toggle` | `true` |
| `accent` | `["#8b7cf6", "#4d9bff", "#34e5d0"]` (brand violet/blue/cyan) |
| `hero.command` | absent → the command pill is hidden |
| `scene.kind` | `"particle-field"` if unspecified or unknown |
| `hero.cta` / `ctaGithub` / `scroll`, `cta.*`, `footer.tag` | reasonable bilingual defaults |

### Fail-loud rules

The build **fails with a clear message** (non-zero exit) if any required field
is missing or malformed:

- `name` — non-empty string
- `github` — `https://github.com/OWNER/REPO`
- `hero.headline` — non-empty (either language)
- `advantages` — non-empty array (≥ 1), each with `title` + `body`
- `accent[i]` — valid hex (`#8b7cf6` or `#abc`)

An **unknown `scene.kind`** is *not* fatal — it warns and falls back to
`particle-field`, so a typo never breaks a build.

---

## Scene library (`scene.kind`)

Each scene obeys the same perf rules (pixelRatio capped at 2, pauses on hidden
tab, disposes GPU resources) and the same reduced-motion / no-WebGL fallback (a
static accent-gradient background). Scenes are code-split — only the selected
one is downloaded.

| `kind` | Description |
|--------|-------------|
| **`hub-nodes`** | A luminous central core fanning out to *N* orbiting nodes with particles flowing along each connection line + bloom. Node **count** comes from `scene.nodes`; node **colors** cycle through `accent`. Great for “installs into many clients / integrations”. |
| **`particle-field`** | A premium flowing particle cloud tinted across the accent gradient — the **universal fallback** that fits any project. Selected when `scene.kind` is missing or unknown. |
| **`mesh`** | An abstract flowing gradient blob (a rippling icosphere with a fresnel accent shader + wire shell + bloom). A slow, liquid ambient object. |

Add a new scene by dropping `src/scenes/<kind>.js` that exports
`createScene(canvas, { accent, nodes }) → { setProgress, resize, dispose }`
and registering it in the `SCENES` map in `src/main.js`.

---

## Local build & preview

```bash
npm install

# build the mcpx example (reproduces the reference site)
SITE_JSON=examples/mcpx.site.json npm run build      # → dist/

# live dev server
SITE_JSON=examples/mcpx.site.json npm run dev

# preview the production build
SITE_JSON=examples/mcpx.site.json npm run preview
```

`npm run build` runs the **prebuild** (`scripts/prebuild.js`) first, then
`vite build`:

```
site.json ──► scripts/prebuild.js ──► src/site.generated.js   (runtime config)
          │                       ├─► public/robots.txt        (host-derived)
          │                       ├─► public/sitemap.xml       (host-derived)
          │                       └─► public/fonts/cjk.woff2    (subset, if CJK)
          │
          └─► vite.config.js plugin ──► index.html title/meta/canonical/lang
                                        + accent-derived favicon
          ▼
        vite build ──► dist/  (self-contained: three/gsap bundled, fonts local)
```

`SITE_JSON` defaults to `./site.json` if unset.

### Fonts

- **Inter** (weights 400/500/600/700) is vendored under `public/fonts/` and
  always shipped for Latin text.
- **Noto Sans SC** for CJK is **not** vendored (the full font is ~17 MB).
  Instead the prebuild collects the exact CJK glyphs used in `site.json` and
  runs `pyftsubset` on a source Noto Sans SC **variable** TTF to a tiny
  `public/fonts/cjk.woff2` (typically tens of KB), keeping the `wght` axis.
  If `site.json` has no CJK text (an en-only site with the toggle off), the
  subset step is skipped gracefully and no `cjk.woff2` is emitted.
- The CJK source TTF is resolved from `NOTO_SC_TTF` (a cached path) or
  downloaded once from `NOTO_SC_URL`. **CI installs `fonttools` + `brotli`**
  (`pip install fonttools brotli`) so the subsetter can run.

---

## Reusable workflow

[`.github/workflows/build-site.yml`](.github/workflows/build-site.yml) is
`workflow_call`-triggered and stable at **`@v1`**. It:

1. checks out the **caller** repo (has `web/site.json` + optional `web/assets`),
2. checks out **web-factory** into `_factory`,
3. sets up Node 22 + Python and `pip install fonttools brotli`,
4. copies the caller's `web/site.json` (+ assets) into `_factory`,
5. `npm ci` + `npm run build` in `_factory` with `SITE_JSON=./site.json`,
6. uploads `_factory/dist` and deploys to GitHub Pages
   (`configure-pages@v5` + `upload-pages-artifact@v3` + `deploy-pages@v4`).

The caller supplies content and permissions; the interface needs no inputs
beyond the defaults.

---

## Layout

```
web-factory/
├─ index.html                 # template — %TITLE%/%DESC%/%LANG%/%CANONICAL%/… injected
├─ vite.config.js             # loads+validates site.json; HTML-inject plugin
├─ package.json               # build = prebuild → vite build
├─ scripts/
│  ├─ site-config.js          # the ONE loader/validator/normalizer + CJK collector
│  └─ prebuild.js             # emits runtime config + SEO files + CJK subset
├─ src/
│  ├─ main.js                 # boot, i18n toggle, accent→CSS vars, scene select
│  ├─ template.js             # data-driven DOM from the injected config
│  ├─ i18n.js                 # builds the {zh,en} dict from config
│  ├─ styles.css              # Apple layout; accent as CSS vars
│  └─ scenes/
│     ├─ common.js            # shared perf rules, renderer, runner, dispose
│     ├─ hub-nodes.js         # central hub → N nodes (generalized mcpx hero)
│     ├─ particle-field.js    # universal flowing particle cloud (fallback)
│     └─ mesh.js              # abstract flowing gradient blob
├─ public/fonts/inter-latin-*.woff2   # vendored Inter (Latin base)
├─ examples/
│  ├─ mcpx.site.json          # the reference mcpx content
│  └─ pages.yml               # the ~12-line caller
└─ .github/workflows/
   └─ build-site.yml          # reusable build + Pages deploy (@v1)
```

---

## License

MIT.
