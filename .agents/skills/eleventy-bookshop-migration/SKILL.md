---
name: eleventy-bookshop-migration
description: >-
  Use when migrating an Eleventy site off Bookshop onto CloudCannon editable
  regions, or when wiring editable regions into an Eleventy + Liquid site.
  Covers the Eleventy integration internals, the props-to-data-path rule that
  drives all markup decisions, structure generation, and the failure modes that
  only appear in the Visual Editor.
---

# Bookshop → CloudCannon Editable Regions (Eleventy)

The Eleventy-specific layer that the `cloudcannon-visual-editing` skill is missing.
That skill owns the SSG-agnostic vocabulary (`data-editable`, region types,
`data-prop`, `@content`/`@data`/`@file`); read it first. `cloudcannon-configuration`
owns structures and `_inputs`.

Verified against `@cloudcannon/editable-regions@0.0.18` by reading the package
source and by migrating two real sites: a small starter, and **Venture**
(50 Bookshop components, 6 pages, forms, galleries, page builder). Every claim
below was checked with a clean `npm run build`, `npx @cloudcannon/cli validate`,
and live re-renders driven through the emitted browser bundle.

---

## 1. What replaces what

| Concern | Bookshop | Editable regions |
| --- | --- | --- |
| Eleventy plugin | `@bookshop/eleventy-bookshop` | `@cloudcannon/editable-regions/eleventy` |
| Component location | `component-library/**/*.eleventy.liquid` | `src/_includes/components/**/*.liquid` |
| Render, spread props | `{% bookshop "hero" bind: block %}` | `{% includeWith "components/sections/hero", block %}` |
| Render, named args | `{% bookshop "image" image_path:x %}` | `{% include "components/assets/image", image_path: x %}` |
| Named args, `=` form | `{% bookshop "x" id={{ id }} %}` | `{% include "components/x", id: id %}` |
| Dynamic component | `{% bookshop "{{b._bookshop_name}}" bind:b %}` | `{% assign _t = b._type %}{% includeWith _t, b %}` |
| Layout indirection | `{% bookshop_include "page" … %}` | page-builder markup inlined in the layout |
| Page builder | `content_blocks[]` + `_bookshop_name` | `data-editable="array"` + `array-item` per block |
| Discriminator | `_bookshop_name` (`sections/hero`) | `_type` = **include path** (`components/sections/hero`) |
| Schema | per-component `*.bookshop.yml` | per-component `*.cloudcannon.structure-value.yml` |
| Structures | `spec.structures` tags, built by `@bookshop/generate` at build time | `_structures.<name>.values_from_glob` in `cloudcannon.config.yml` |
| Editor detection | `env_bookshop_live` | `ENV_CLIENT` |
| Component CSS | `bookshop-sass` → `bookshop.css` | globbed SCSS index → normal sass pipeline |

Net effect: components become ordinary Liquid partials, and CloudCannon config
owns the CMS schema.

---

## 2. How the Eleventy integration works

Setup — Liquid is the default and only language needed:

```js
eleventyConfig.addPlugin(editableRegions, {
  liquid: { browserStub: ["@11ty/eleventy-img", "esbuild"] },
});
```

The plugin does two things:

1. Registers the **`includeWith`** Liquid tag (server-side and in the browser engine).
2. On `eleventy.after`, esbuild-bundles **`register-components.js`** into `dir.output`. That bundle:
   - **auto-mirrors your Eleventy config** — imports and *replays* it in the browser,
     capturing `addFilter` / `addShortcode` / `addPairedShortcode` / `addLiquidTag`
     (and helpers registered by `addPlugin`) with closures intact;
   - **discovers components** — every `.liquid`/`.html` under `dir.includes` and
     `dir.input` becomes resolvable by include path, no registration step;
   - exposes `page`, `collections`, `eleventy`, `pkg`, and `ENV_CLIENT` (always `true`).

Load it editor-guarded in the base layout:

```html
<script>
  if (window.inEditorMode) {
    import("/register-components.js").catch((e) => console.warn(e));
  }
</script>
```

### What a component re-render actually does

From `integrations/liquid/index.mjs`:

```js
createComponentRenderer(key, `{% include "${key}" %}`)      // any name resolves
htmlString = await engine.parseAndRender(templateSource, {
  ...props, page: buildPageData(), collections: buildCollectionsData(),
});
rootEl.innerHTML = htmlString;   // children replaced; the host element is NOT
```

Three consequences drive every markup decision:

1. **Props are spread as top-level variables**, matching `includeWith` server-side.
2. **The region host element is not re-rendered — only its children.** A section's
   own root element (with its `component--{{ color_group }}` classes) must live
   *inside* the region wrapper, never be the wrapper.
3. **Nothing but `props` + globals is in scope.** Ambient variables work at build
   time and are `undefined` in the editor (gotcha 8.4).

Limitations: layouts aren't re-rendered (only components), `pagination` isn't
exposed, non-Liquid `renderTemplate`/`renderFile` no-op.

---

## 3. The one-data-path rule

> A partial can be a component region **only if its props are exactly the object
> at one data path.**

Re-render passes the data at `data-prop`, spread, and nothing else. Audit every
component against this before writing any `data-editable`. It splits the library
in two:

| Kind | Test | Treatment |
| --- | --- | --- |
| **Data-shaped** | props == one stored object (`heading` ← `content.heading`) | Component region. **Bare, self-relative** `data-prop` inside; the **call site** declares the path. |
| **Presentational** | props flattened / reshaped / from several paths | Cannot be a component region. The **caller** owns the editable markup (§4.3). |

### 3.1 Prop scoping: wrap, never thread a prefix

`nodes/editable.ts › setupListeners()` walks up to the nearest ancestor with
`data-editable`, registers a **relative** listener, and each parent prepends its
own segment. So regions compose:

```liquid
<div data-editable="component" data-component="components/generic/heading"
     data-prop="content.heading">
  {% includeWith "components/generic/heading", content.heading %}
</div>
```

```liquid
{# heading.liquid — bare props, no knowledge of its own path #}
<h2 data-editable="text" data-type="span" data-prop="primary_heading">…</h2>
```

Reusable leaf partials must **never** take a `prop_prefix` parameter —
`cloudcannon-visual-editing` calls that an anti-pattern, and the wrapper gives
correct scoping *and* re-render for free.

Paths beginning `@data[...]`, `@collections[...]`, `@file[...]` are absolute and
skip the parent walk — that's how shared nav/footer partials write to data files.

### 3.2 Scalars can't be wrapped — the caller must pass the path

A component region spreads the object at `data-prop`, so `data-prop` must point at
an **object**. A partial that renders a bare string or a src/alt pair has nothing
to wrap. Those partials take the path as a parameter:

```liquid
{# text-block: one markdown string, at a different path in every caller #}
{% include "components/generic/text-block", text: content.description,
                                            prop: "content.description" %}
{# image: binds two scalars #}
{% include "components/assets/image", image_path: content.image.image_path,
     prop_src: "content.image.image_path", prop_alt: "content.image.image_alt" %}
```

This is **not** the prefix anti-pattern: it's one explicit path for one scalar,
carrying exactly the information a wrapper's `data-prop` would, in the one case
where a wrapper is impossible. Give the partial a default (`prop_src` defaulting
to `image_path`) so it still works when a caller *does* wrap it.

---

## 4. Region placement recipes

### 4.1 Page builder (in the layout)

```liquid
<div data-editable="array" data-prop="content_blocks" data-component-key="_type">
  {% for block in content_blocks %}
    {% assign _t = block._type %}
    <div data-editable="array-item" data-component="{{ _t }}" data-id="{{ forloop.index0 }}">
      {% includeWith _t, block %}
    </div>
  {% endfor %}
</div>
```

`data-id` must be the loop index. It defaults to `data-component`, so N blocks of
the same type share one identity and collide when the editor matches DOM nodes to
items on reorder.

`data-component-key` is only needed for **polymorphic** arrays (page builder, form
elements). For homogeneous arrays (a list of buttons), put `data-component` on each
item and omit it.

### 4.2 Put array regions on existing layout containers

The commonest way to break a template is to add a wrapper that steals a grid/flex
item's place. Prefer an element that already exists:

```liquid
<ul class="c-price-list__lists__list" data-editable="array" data-prop="list_items">
```

When you must add one, port the layout the children had so the rendering is
unchanged, e.g. buttons that were direct children of a `display:flex; gap` parent:

```scss
.c-card__buttons { display: flex; flex-direction: column; gap: var(--gap-normal); }
```

For a flex/grid container whose items are sized by a rule like
`& .c-card { width: calc(…) }`, retarget the rule at the direct child so it works
whether or not a region wrapper sits between: `& > * { width: calc(…) }`.

Avoid `display: contents` on region hosts — it removes the box the editor needs
for its hover/click target.

### 4.3 Presentational partials: captured HTML slots

For partials that fail the one-data-path rule, the section — which knows the
paths — renders editable markup into `{% capture %}` and passes it in. The layout
partial keeps only layout and classes.

```liquid
{% capture content_html %}
  <div data-editable="component" data-component="components/generic/heading"
       data-prop="content.heading">
    {% includeWith "components/generic/heading", content.heading %}
  </div>
{% endcapture %}
{% include "components/layout/left-right-block", content_html: content_html %}
```

**Verified**: LiquidJS does not escape `{{ content_html }}`, and the markup
survives a browser re-render (the enclosing section is the component region, so
its captures regenerate).

### 4.4 Images: region on the `<img>`, not a wrapper

Templates frequently place `.c-image` / `picture` as a CSS grid item
(`.c-hero .c-image { grid-row: 1 / -1 }`). A wrapper becomes the grid item and
breaks the layout. Pass the region attributes through the image shortcode instead
so they land on the `<img>` that `eleventy-img` generates:

```js
return Image.generateHTML(metadata, { alt, class: className, sizes, ...editableAttributes });
```

### 4.5 When *not* to use a component region on an array item

An `array-item` without `data-component` still gets CRUD and still hosts nested
primitives; it just doesn't re-render itself. That's the right choice when the item
needs a value its own data doesn't carry — a card that takes
`card_color_group` from its **section**. A component region would re-render it with
only the item's data and drop the colour. The enclosing section re-renders instead.

### 4.6 Duplicated DOM

If a partial renders the same array twice (desktop and mobile nav), wire **one**.
Two regions on one path give the editor duplicate CRUD controls.

---

## 5. Structures

Bookshop generated all structures at build time from `spec.structures` via
`npx @bookshop/generate`. Migrating means hand-owning them — for a large library,
generate them:

**Write a one-off script** that reads every `.bookshop.yml`, resolves the
shorthands the way `@bookshop/generate/lib/structure-builder.js` does, and emits
one `*.cloudcannon.structure-value.yml` per component. The grammar is
`bookshop:(structure:)?<key>(!)?(\(<param>\))?` — `!` means "inline that
component's blueprint as the default value". Then hand-review icons and previews.

⚠ Blueprints also contain **literal** `_bookshop_name:` dicts, not just
`bookshop:` shorthands. Run a final `_bookshop_name` → `_type` pass over the
generated output or a few will survive.

### 5.1 Structure membership is a directory glob, not a tag

`spec.structures: [asset_blocks, card_imagery_blocks]` is many-to-many; CloudCannon
collects by directory glob. Plan the component tree around the groups:

```
components/sections/ → content_blocks    components/heroes/ → hero_blocks
components/form/     → form_blocks       components/icons/  → icon_blocks
components/assets/   → asset_blocks      components/form/parts/, layout/ → none
```

For residual overlap use an explicit single-file glob rather than duplicating a
file (duplicates drift):

```yaml
card_imagery_blocks:
  values_from_glob:
    - /src/_includes/components/icons/*.cloudcannon.structure-value.yml
    - /src/_includes/components/assets/image.cloudcannon.structure-value.yml
```

Bookshop also synthesised a structure per single-component reference
(`_bookshop_single_component_*`). Regenerate those as inline `_structures` entries,
or object inputs can't be populated.

### 5.2 Check `_type` isn't already taken

`_type` is the standard discriminator, but a Bookshop site may already use it for
something else — Venture's `contact_details` items use `_type: Email | Phone |
Address`. Harmless (only `content_blocks` uses it as a `data-component-key`), but
grep before assuming it's free, and remember a global `_inputs._type: {hidden: true}`
hides both.

---

## 6. Build tooling

- **Replace `bookshop-sass`** with a small script that globs co-located component
  `.scss` and writes an index that the normal sass pipeline `@use`s — this keeps
  Bookshop's auto-discovery. Give each `@use` a unique alias (`as c0`, `as c1`);
  component filenames repeat across directories and sass rejects duplicate
  namespaces.
- **`sass` may be a transitive dep of `@bookshop/sass`.** Removing Bookshop can
  make the `sass` script fall back to a global (Ruby) sass. Add it explicitly.
- **Update `.cloudcannon/prebuild` / `postbuild`** — they call `bookshop-sass` and
  `npx @bookshop/generate`. Miss this and the cloud build breaks while local passes.
- **Delete the Bookshop browser page** (`components.html`, `{% bookshop_component_browser %}`)
  and its stylesheet.

---

## 7. Verification

```bash
npm run build                                # exits 0
npx @cloudcannon/cli validate                # config + every structure-value file
node --check _site/register-components.js    # bundle emitted and self-contained
grep -ri bookshop src utils eleventy.config.js package.json cloudcannon.config.yml
```

Three checks that catch what those don't:

**Re-render every block through the bundle.** Editor-only breakage never shows up
in `npm run build`. Drive the emitted bundle from Node against a ~30-line DOM shim
(`document.createElement` returning an object with an `innerHTML` setter, plus
`customElements`, `MutationObserver`, `HTMLElement`; leave `navigator` alone, it's
getter-only on modern Node). Loop over every block in every content file:

```js
await import("./_site/register-components.js");
const el = await window.cc_components[block._type](block);
if (!el.innerHTML.trim() || /undefined/.test(el.innerHTML)) throw new Error("bad render");
```

**Diff rendered output against a pre-migration baseline.** Build on the old commit
first and keep the HTML. Comparing raw HTML is too noisy (region attributes and
wrappers are expected), so extract and sort **visible text**, **class names**, and
**src/href** separately. A migration like this should leave visible text
byte-identical; any class or asset diff should be one you can name.

**Audit structures rule #1** — walk each content block against its structure
`value` and report missing keys. Missing fields surface as `undefined` in the
editor, never as a build failure.

---

## 8. Gotchas

**8.1 ⚠ The config auto-mirror aborts at the first throw.** The highest-impact
failure, and it's silent. The bundle replays your config against a recorder;
stubbed modules return a Proxy that **throws when called**, and the replay is
wrapped in a single `try/catch`, so the first throw skips every remaining
registration:

```js
eleventyConfig.addPlugin(pluginFoo({ … })); // stubbed module CALLED here → throws
eleventyConfig.addFilter("markdownify", …); // never mirrored
```

Symptom: `Unknown tag "assign_local"` in the Visual Editor while `npm run build` is
green. **Register all filters/shortcodes/tags BEFORE any `addPlugin` call.** The
warning it prints doesn't name the lost helpers — treat it as a build failure.

**8.2 Reserved names, exactly** (`eleventy/browser/liquid-builtins.mjs`). A config
helper with one of these names is dropped **without warning**: `slug`, `slugify`,
`log`, `url`, `inputPathToUrl`, `htmlBaseUrl`, `serverlessUrl`, `htmlDateString`,
`getNewestCollectionItemDate`, `getCollectionItem`, `getPreviousCollectionItem`,
`getNextCollectionItem`, `getCollectionItemIndex`, **`renderContent`**; shortcode
`renderFile`; tag `renderTemplate`. `renderContent` is the one Bookshop sites hit —
it's a RenderPlugin shim that renders *Liquid*, so a markdown filter of that name
silently vanishes and preview shows raw markdown. Rename it.

**8.3 What `browserStub` must contain.** Node built-ins,
`@cloudcannon/editable-regions/eleventy`, and `@11ty/eleventy` + `@11ty/eleventy/*`
are stubbed automatically. **`@11ty/eleventy-img` is not** — the check is
`id === "@11ty/eleventy" || id.startsWith("@11ty/eleventy/")` and it matches
neither. Stub it (that also keeps `sharp` out). Stub `esbuild` or any build tool
the config imports. Don't over-stub: `js-yaml`/`markdown-it` are browser-safe and
power real filters, and a plugin whose only Node dep is a built-in bundles fine
(the filter throws only if called, which is fine behind `{% if ENV_CLIENT %}`).

**8.4 Bookshop leaked parent scope; the editor doesn't.** `includeWith` uses
`context.push(obj)`, so at build time the parent scope is still on the stack and
ambient variables resolve. In the browser the component renders standalone. Ambient
reads therefore work in production and break only in the editor. Grep for variables
a partial reads but is never passed. Real examples: a `card-grid` branching on a
bare `_bookshop_name` (the *parent's* name); a `radio-button-group` passing an
undefined `radio_id`. Make each an explicit parameter.

**8.5 `capture` + `ymlify` synthesis is a re-render hazard.** A common Bookshop
idiom builds child data as a YAML string:

```liquid
{% capture heading %}primary_heading: {{ content.quote }}{% endcapture %}
{% assign_local heading = heading | ymlify %}
{% bookshop "generic/heading" bind:heading %}
```

Re-render only passes **stored** data, so a synthesised object has no data path:
nested `data-prop`s can't bind, and the editor diverges from the build. **Normalise
the stored shape** — push derived values into content and structure defaults so the
stored shape equals the rendered shape. In Venture this removed six such sites
(hero heading hierarchy, two card grids, two icon lists, a testimonial quote).

**8.6 `includeWith` takes a variable, not a literal.** The second argument must be
a variable reference; inline object literals aren't valid Liquid. For a dynamic
component, assign first: `{% assign _t = block._type %}{% includeWith _t, block %}`.

**8.7 `includeWith` spreads one object only.** When a component needs an extra
argument beyond the spread, that argument is lost on re-render (which passes only
the stored object). Either move the value into the data, or use a plain
`{% include %}` and accept sidebar-only re-render via the parent (§4.5).

**8.8 The CloudCannon validator catches years of latent Bookshop errors.** Bookshop
never validated its `_inputs`/icons, so expect a batch of pre-existing failures on
first run — in Venture, 16 files. All were inherited, none were caused by the
migration:
- **Invalid Material Symbols icons.** Confirmed invalid: `feed`, `create`,
  `ondemand_video`, `mail_outline`, `insert_emoticon`, `collections`, `smart_button`.
  Valid replacements: `cottage`, `edit`, `movie`, `mail`, `mood`, `photo_library`,
  `ads_click`. Don't guess — the enum lives in
  `@cloudcannon/configuration-types/dist/cloudcannon-structures.schema.json`
  (3,584 values); extract it and test candidates.
- **`_instance_value` → `instance_value`**, and the value must be the uppercase
  enum (`UUID` / `NOW`).
- **An input with `instance_value` or `hidden` still needs `type`.**
- **Dangling `_structures.<name>` references.** Bookshop tolerated inputs pointing
  at structures that were never defined (editors just couldn't add items). Check
  every reference resolves, and that nothing is unexpectedly unused.

**8.9 Async helpers work, but check whether you're actually exercising them.**
The browser engine handles async properly — `integrations/liquid/shortcodes.mjs`
makes `render` async and `await`s both the argument tokens and `shortcodeFn(...)`,
paired shortcodes `await toPromise(renderTemplates(...))` first, and the mirror maps
`addAsyncFilter` / `addAsyncShortcode` onto the same registrars as their sync
siblings. An `async` function passed to plain `addShortcode` is fine too; Eleventy's
Liquid renders async by default.

The catch is that the usual reason to have an async shortcode — image optimisation —
is also the thing you stub out of the browser bundle. With
`{% if ENV_CLIENT %}<img …>{% else %}{% image … %}{% endif %}` the editor never
reaches the async path, so it's bypassed rather than proven. Fine, but know which
one you have.

The real async landmine in a Bookshop-era config is a **custom tag that evaluates
synchronously**. `assign_local` (a common Bookshop helper) calls
`this.liquid.evalValueSync(...)`, so `{% assign_local x = y | someAsyncFilter %}`
breaks in both engines. Grep custom tags for `evalValueSync` / `renderSync`.

**8.10 Pair the defaults on a scalar-path partial.** A partial that defaults its
prop paths (§3.2) must not default them *independently*. Venture's image partial
defaulted `prop_alt` to a relative `"image_alt"` whenever the caller omitted it —
including callers that passed an **absolute** `prop_src="@data[nav].nav_logo_image"`.
With no ancestor region, the relative alt resolved against the *current page's*
front matter, so editing the logo's alt text would have written a stray `image_alt`
key into every page. Default the paths together, or not at all, and emit the
attribute only when its path exists. This class of bug is invisible in the build and
in a re-render check — it only shows up by reading the emitted attributes.

**8.11 Not every Bookshop site has snippets.** Check
`grep -n "_snippets" cloudcannon.config.yml` and whether any page has a markdown
body before planning snippet work. Venture had neither — all content is front
matter. When a site does use them, Bookshop's `template: eleventy_liquid_bookshop_component`
becomes a real Eleventy shortcode plus a **raw** `_snippets` entry (explicit
`snippet:` pattern + `params`), because Eleventy snippet template ids aren't
publicly enumerable — only
`eleventy_liquid_paired_shortcode_positional_args` is confirmed. Drop
`_snippets_imports`; it loads catch-all matchers that can mis-match.

---

## 9. Migration checklist

1. **Baseline.** Build the pre-migration site and keep the HTML for §7's diff.
2. **Spike first.** Install the plugin and migrate one vertical slice
   (one section + its leaf partials). Confirm: `includeWith` with a variable path;
   a nested component region scoping bare props; captured HTML surviving an include;
   `browserStub` covering everything; your custom tags/filters mirrored; no reserved
   name collisions. Findings here change the plan.
3. **Deps/config.** Remove `@bookshop/*`; add `@cloudcannon/editable-regions`;
   add `sass` explicitly. Swap the plugin, **move helper registration above it**
   (8.1), set `browserStub`.
4. **Audit every component against the one-data-path rule** (§3) and record the
   treatment. Do this before writing markup.
5. **Move and convert.** Group directories by structure (§5.1). Convert the tag
   forms (§1), `env_bookshop_live` → `ENV_CLIENT`, fix ambient-scope reads (8.4),
   normalise away synthesis (8.5).
6. **Regions.** Sections as `array-item` components; primitives nested inside;
   arrays on existing containers (§4.2); data-file partials on `@data[...]`.
7. **Structures.** Generate, then hand-review icons/previews; wire
   `values_from_glob`; hide `_type`; seed the collection schema.
8. **Content.** `_bookshop_name` → `_type` include paths, apply the normalised
   shapes, backfill every structure field.
9. **Verify** (§7), including the re-render loop and the baseline diff.
