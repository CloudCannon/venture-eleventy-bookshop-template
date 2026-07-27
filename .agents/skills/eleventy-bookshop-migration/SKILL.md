# Bookshop → CloudCannon Editable Regions (Eleventy)

Learnings from migrating this Eleventy starter off **Bookshop** onto CloudCannon's
**editable regions** system (`@cloudcannon/editable-regions`). Written as source
material for future CloudCannon skills on *11ty editable regions* and *Bookshop →
editable-regions migration*. Everything below was verified against
`@cloudcannon/editable-regions@0.0.18` and a clean `npm run build` + `npx @cloudcannon/cli validate`.

> Terminology note: the SSG-agnostic editable-regions vocabulary
> (`data-editable`, region types, `data-prop`, `@content`/`@data`/`@file` paths)
> is documented in the `cloudcannon-visual-editing` skill. This doc is the
> **Eleventy-specific** layer that skill is missing.

---

## 1. What Bookshop was doing, and what replaces it

| Concern | Bookshop (before) | Editable regions (after) |
| --- | --- | --- |
| Eleventy plugin | `@bookshop/eleventy-bookshop` | `@cloudcannon/editable-regions/eleventy` |
| Component location | `component-library/**/*.eleventy.liquid` | `src/_includes/components/**/*.liquid` (normal includes) |
| Render a component | `{% bookshop "hero" bind: block %}` | `{% includeWith "components/hero", block %}` |
| Render a nested component | `{% bookshop "image" bind: image image_sizes:"…" %}` | `{% include "components/image", image_path: …, image_sizes: "…" %}` |
| Page builder loop | `content_blocks[]` → `{% bookshop block._bookshop_name bind: block %}` | `data-editable="array"` wrapper + `data-editable="array-item"` per block |
| Block discriminator | `_bookshop_name` (e.g. `hero`, `buttons/primary`) | `_type` = **component include path** (e.g. `components/hero`) |
| Component schema/inputs | per-component `*.bookshop.yml` (`spec`/`blueprint`/`_inputs`) | per-component `*.cloudcannon.structure-value.yml` + `_structures`/`_inputs` in `cloudcannon.config.yml` |
| Structures | implied by `spec.structures` | `_structures.<name>.values_from_glob` (split co-located) |
| Live-editor detection | `env_bookshop_live` | `ENV_CLIENT` global (true only in the editor bundle) |
| Markdown in components | `renderContent` filter (Bookshop plugin) | a **renamed** `renderMarkdown` filter (see gotcha #1) |
| Markdown snippets | `_snippets` w/ `eleventy_liquid_bookshop_component` | real Eleventy shortcodes + `_snippets` (raw snippets) |
| Component CSS build | `bookshop-sass` → `bookshop.css` | folded into the normal `sass` pipeline → `main.css` |

Net effect: **components are just Liquid partials**; CloudCannon config (not
`.bookshop.yml`) owns the CMS schema; the browser Visual Editor re-renders each
component client-side from its data.

---

## 2. How the Eleventy integration actually works

Verified from the package source (`integrations/eleventy/index.mjs`,
`integrations/liquid/*`). This is undocumented in the public skill, so it's the
highest-value part of this doc.

**Setup** (one line — Liquid is the default and only language needed):

```js
// .eleventy.js
const editableRegions = require("@cloudcannon/editable-regions/eleventy");
eleventyConfig.addPlugin(editableRegions, {
  liquid: { browserStub: ["@11ty/eleventy-img"] }, // see gotcha #2
});
```

The plugin does two things:

1. Registers the **`includeWith`** Liquid tag (server-side *and* in the browser
   engine) — spreads an object's fields into an include like Astro's `{...props}`.
2. On `eleventy.after`, esbuild-bundles a **`register-components.js`** into
   `dir.output`. That bundle:
   - **auto-mirrors your `.eleventy.js`** — it imports and *replays* your real
     config in the browser, capturing every `addFilter` / `addShortcode` /
     `addPairedShortcode` / `addLiquidTag` with closures intact. Node built-ins
     and `@11ty/eleventy*` are stubbed automatically.
   - **discovers components** — every `.liquid`/`.html` under `dir.includes` +
     `dir.input` becomes a resolvable component.
   - exposes globals to editor-rendered templates: `page`, `collections`,
     `eleventy`, `pkg`, and **`ENV_CLIENT`** (always `true` in the bundle).

**Load the bundle**, editor-guarded, in your base layout:

```html
<script>
  if (window.inEditorMode) {
    import("/register-components.js").catch((e) => console.warn(e));
  }
</script>
```

**Component resolution** (`data-editable="component"` / `array-item` re-renders):
`data-component="X"` → the browser runs `{% include "X" %}` against a shared
LiquidJS engine, with the item's data spread in as props. So **`data-component`
is just an include path** — no registration step (unlike Astro's
`registerAstroComponent`). Explicit overrides exist via `liquid.components: { name: path }`.

**Limitations that bite** (all shimmed approximately or not at all in the browser
runtime — the build is unaffected): layouts aren't re-rendered (only components
are), `pagination` isn't exposed, non-Liquid `renderTemplate`/`renderFile`
engines no-op, and any mirrored filter/shortcode that touches `this.ctx`,
`process`, `require`, or a Node module throws at render time (→ supply a
`liquid.filters`/`.shortcodes` browser override).

---

## 3. `data-editable` region cheat-sheet (as used here)

| Region | Where used | Markup |
| --- | --- | --- |
| **array** | page builder; hero's buttons | `<div data-editable="array" data-prop="content_blocks" data-component-key="_type">` |
| **array-item** | each block/button | `<div data-editable="array-item" data-component="{{ block._type }}" data-id="{{ forloop.index0 }}">` |
| **text (span)** | headings | `<h1 data-editable="text" data-type="span" data-prop="heading.heading_text">` |
| **text (block)** | markdown bodies | `<div data-editable="text" data-type="block" data-prop="subheading.markdown_content">` |
| **image** | image wrapper (contains a descendant `<img>`) | `<div data-editable="image" data-prop-src="image.image_path" data-prop-alt="image.alt_text">` |
| **component** | implicit — an `array-item` with `data-component` re-renders as a component | (see array-item) |

Rules that mattered:

- **`data-prop` is relative to the nearest parent editable.** Inside a hero
  `array-item` (bound to `content_blocks[i]`), `data-prop="heading.heading_text"`
  resolves to `content_blocks[i].heading.heading_text`. A nested `array`
  (`data-prop="buttons"`) resolves under the item. Paths use `.` separators.
- **Primitive vs component:** primitives (`text`/`image`/`array`) update their own
  DOM slice. A section that has **style/class/conditional bindings** (hero's
  gradient + background colour, left-right's `flipped` ordering) must be a
  **component** region so those re-render from data — inline primitives alone
  won't reflect a colour or `flipped` change. Here that's automatic: each block is
  an `array-item` with `data-component`, so the whole block re-renders, with
  primitives nested inside for direct on-canvas editing.
- **`data-component-key`** names the field on each item that selects its component
  (`_type`). **`data-id`** is the per-item stable identity for reorder matching;
  it defaults to the `_type` value, which **collides when two items share a type**
  (we have two `left-right` blocks) — so set an explicit unique `data-id`
  (we used `forloop.index0`).

---

## 4. Split co-located structures ("one config file per component")

CloudCannon natively supports one structure-value file per component, gathered by
glob — no JS config, no central registry edit when adding a component.

Each block/button component has a sibling `*.cloudcannon.structure-value.yml`:

```yaml
# src/_includes/components/hero.cloudcannon.structure-value.yml
label: Hero
icon: cottage            # MUST be a valid Material Symbols name (see gotcha #4)
picker_preview: { text: [Hero], icon: [cottage] }
preview:
  text: [{ key: heading.heading_text }, Hero]
  icon: [cottage]
  image: [{ key: image.image_path }]
value:                   # inserted when an editor adds this block
  _type: components/hero # discriminator = the component include path
  background_color: '#ffffff'
  heading: { heading_text: Hero heading, heading_gradient_color: '#a0a2ff' }
  # …every field that can appear on the block, with a default (structures rule #1)
  buttons: []
_inputs:                 # component-scoped input config
  heading: { type: object, options: { preview: { icon: short_text } } }
  buttons: { type: array, options: { structures: _structures.buttons } }
```

Collected in `cloudcannon.config.yml`:

```yaml
_structures:
  content_blocks:
    values_from_glob: [/src/_includes/components/*.cloudcannon.structure-value.yml]
  buttons:
    values_from_glob: [/src/_includes/components/buttons/*.cloudcannon.structure-value.yml]
_inputs:
  _type:           { hidden: true }
  content_blocks:  { type: array,  options: { structures: _structures.content_blocks } }
  buttons:         { type: array,  options: { structures: _structures.buttons } }
  button:          { type: object, options: { structures: _structures.buttons } }
```

Notes:
- The top-level (non-recursive) `*` glob keeps `buttons/` sub-structures out of
  `content_blocks` — organise nested/shared structures in subfolders.
- Keep the pre-existing shared cascade `_inputs` (colours, `image_path`,
  `markdown_content`, `button_link`, etc.) — they still apply globally by name.
- `_type` must equal a resolvable include path and be **identical** across the
  structure `value`, the `array-item`'s `data-component`, and the `includeWith`
  argument. It's hidden in the editor.

---

## 5. Snippets (markdown-embedded) off Bookshop

Bookshop snippets used `template: eleventy_liquid_bookshop_component`. Replacement:

1. Implement real Eleventy shortcodes in `.eleventy.js` (`addLiquidShortcode` /
   `addPairedLiquidShortcode`) that emit the same HTML.
2. Rewrite content: `{% bookshop 'snippets/alert' background_color: "…" … %}` →
   `{% alert "…", "…", "…", "…" %}` (Eleventy Liquid shortcodes take **positional**
   args, comma-separated — not named args like the Bookshop tag).
3. Configure `_snippets` so editors can insert them, and enable the toolbar:
   `snippet: true` on both `_editables.content` and each markdown input's `options`.

**Use raw snippets** (explicit `snippet:` pattern + `params`) — see gotcha #6:

```yaml
_snippets:
  alert:
    inline: false
    snippet: '{% alert [[args]] %}'
    params:
      args:
        parser: argument_list         # `argument` for a single positional value
        options:
          models:
            - { editor_key: background_color, type: string }
            - { editor_key: alert_message,    type: string }
            - { editor_key: color,            type: string }
            - { editor_key: icon,             type: string }
          format:
            root_pair_delimiter: [', ']
            string_boundary: ['"']
    _inputs: { … }
```

`_snippets_imports` was removed (it loads catch-all matchers that can mis-match).

---

## 6. Gotchas (each is skill-ready)

1. **`renderContent` is a reserved built-in filter** in the editable-regions Liquid
   runtime (a RenderPlugin shim that renders *Liquid*, not markdown). A custom
   markdown filter of the same name is **skipped by the auto-mirror**, so live
   preview would render raw markdown. **Fix:** rename it (we used `renderMarkdown`)
   *or* register a browser override via `liquid.filters.renderContent`.
2. **`@11ty/eleventy-img` / `sharp` can't run in the browser bundle.** The image
   shortcode is mirrored and would break esbuild bundling. **Fix:** guard the
   optimizer path with `{% if ENV_CLIENT %}<img …>{% else %}{% image … %}{% endif %}`
   *and* add `liquid: { browserStub: ["@11ty/eleventy-img"] }`. Verified: the
   stub Proxy appears in the emitted bundle and the build still optimises images.
3. **`data-component` = include path.** `_type` must be `components/hero`, not
   `hero`, and must match everywhere. Zero-config resolution runs `{% include %}`.
4. **Component/structure `icon:` must be a valid Material Symbols name.**
   `smart_button` is **invalid** (`npx @cloudcannon/cli validate` catches it); we
   used `ads_click`. `cottage`, `view_column`, `article` are valid.
5. **`data-id` collisions on repeated block types** — omitting `data-id` defaults
   it to `_type`, so N blocks of the same type share one identity. Give each
   `array-item` a unique `data-id` (`forloop.index0`).
6. **Eleventy snippet template ids aren't publicly enumerable** (`@cloudcannon/scrap-booker`
   is private; the config schema treats `template` as a free string). Only
   `eleventy_liquid_paired_shortcode_positional_args` is confirmed (kept for
   `tint`). For everything else, **use raw snippets** — fully self-specified, no
   guessing.
7. **`includeWith`'s second arg must be a variable reference** — inline object
   literals aren't valid Liquid. Assign a loop/property value first
   (`{% assign _t = block._type %}{% includeWith _t, block %}`).
8. **Passing extra params beyond the spread object** — `includeWith` only spreads
   one object. When a component needs an extra arg (e.g. the image component's
   `image_sizes`), use a plain `{% include "components/image", image_path: …, image_sizes: "…" %}` instead.
9. **Build-tooling coupling:** dart-sass was provided *transitively* by
   `@bookshop/sass`. Removing Bookshop made the `sass` script fall back to the
   machine's global (Ruby) sass and fail. **Add `sass` as an explicit devDependency.**
10. **CloudCannon build hooks** (`.cloudcannon/prebuild`, `.cloudcannon/postbuild`)
    called `bookshop-sass:build` and `npx @bookshop/generate` — update them, or
    CloudCannon's cloud build breaks even though local `npm run build` passes.
11. **`instance_value: now` → `NOW`** — the CLI validator requires the uppercase
    enum (`UUID`/`NOW`). A latent issue the migration is a good moment to fix.

---

## 7. Migration checklist

1. **Deps/config:** remove `@bookshop/*`; `npm i @cloudcannon/editable-regions`;
   `npm i -D sass`. Swap the plugin in `.eleventy.js`; rename the markdown filter;
   add `browserStub: ["@11ty/eleventy-img"]`.
2. **Components → `src/_includes/components/`:** convert `{% bookshop %}` →
   `{% includeWith %}`/`{% include %}`; `env_bookshop_live` → `ENV_CLIENT`; add
   `data-editable` markup. Rewrite the page-builder loop as an editable array.
3. **Structures:** one `*.cloudcannon.structure-value.yml` per block/button;
   wire `_structures` (`values_from_glob`) + `_inputs` in `cloudcannon.config.yml`.
   Rule #1: every field a block can have is in `value` with a default.
4. **Snippets:** real Eleventy shortcodes + `_snippets` (raw); `snippet: true` in
   editors; rewrite markdown bodies to the new shortcode syntax; drop
   `_snippets_imports`.
5. **Content/layout/cleanup:** `_bookshop_name` → `_type` (include-path values) in
   content *and* schemas; load `register-components.js` (editor-guarded); fold
   component SCSS into the sass pipeline; delete `component-library/`; fix the
   `.cloudcannon/` build hooks; scrub docs/metadata.

## 8. Verification

```bash
npx @cloudcannon/cli validate          # config + every structure-value file valid
npm run build                          # exits 0
ls _site/register-components.js         # bundle emitted
node --check _site/register-components.js   # bundle is valid, self-contained JS
grep -ri bookshop src .eleventy.js package.json cloudcannon.config.yml  # → nothing
```

Then in the Visual Editor (or locally with `window.inEditorMode = true` + the
CloudCannon API): editing heading/markdown/image/colour re-renders live; the
`content_blocks` array adds/reorders/removes blocks; snippets insert from the
content-editor toolbar.
