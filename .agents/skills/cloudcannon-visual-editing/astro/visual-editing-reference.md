# Visual Editing Reference (Astro)

Pattern reference for editable region types, data paths, component re-rendering, and edge cases. Read this doc on demand when a checklist item in [visual-editing.md](visual-editing.md) links here — don't read it all upfront.

For the full editable regions API (region types, path syntax, API actions), see [../editable-regions.md](../editable-regions.md).

## Quick rules — read before editing this page

1. **Golden rule** — computed content needs an `<editable-component>` wrapper: [§Golden rule](#golden-rule--computed-content-needs-a-component-wrapper)
2. **Standalone wrapper placement** — `<editable-component>` at the call site, not self-marking on the section root: [§Registration placement](#where-does-the-registration-go--component-root-or-call-site)
3. **Frontmatter co-location** — one object key per registered component; no scattered root fields: [§Nested frontmatter](#scattered-fields-feeding-a-registered-component--nest-the-frontmatter)
4. **Editable-region completeness** — every `data-editable` region needs a matching `_inputs` entry: [visual-editing.md completeness checklist](visual-editing.md#completeness-checklist)
5. **Shared-data handling** — `@data[key]` prop path, not `data-editable="source"`: [§Shared-data table](#shared-data--computed-content-handling)

## Golden rule — computed content needs a component wrapper

If a frontmatter field contributes to rendering and the rendering involves any trigger below, extract the section into a registered component and wrap with `<editable-component data-component="<name>" data-prop="<prefix>">`. Primitive `data-editable="text"` updates DOM text only — it cannot re-run an expression.

| Trigger                              | Example                                           | Why a primitive fails                     |
| ------------------------------------ | ------------------------------------------------- | ----------------------------------------- |
| Conditional / ternary text           | `{inStock ? "In stock" : "Out of stock"}`         | Primitive swaps text, not the branch      |
| Data-file lookup                     | `{locations[slug].street}`                        | Lookup runs at build; never re-resolves   |
| Icon / asset-path index              | `{iconPaths[t.icon]}`                             | Text swap leaves the looked-up path stale |
| Computed class / `class:list` branch | `class:list={[inStock ? "bg-green" : "bg-grey"]}` | Text swap doesn't change classes          |
| `set:html` of a derived string       | `<div set:html={md(body)} />`                     | Text swap doesn't re-run the renderer     |

### Where does the registration go — component root or call site?

| Component is rendered…                         | Emit registration as                                                                                                                        | Why                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Inside `BlockRenderer` (page-builder array)    | `data-editable="component"` on the component's own root element                                                                             | The `<div data-editable="array-item">` wrapper provides the parent editable `setupListeners` needs                          |
| Directly from a page template (`[slug].astro`) | `<editable-component data-component="<name>" data-prop="<key>">…</editable-component>` **at the call site**, component root as plain markup | No array-item ancestor exists; without the wrapper, sidebar-only changes (switches, dropdowns) don't propagate to re-render |

❌ Standalone hero with self-marking — sidebar boolean toggles don't update live:

```astro
<!-- page template -->
<Hero {...hero} />
<!-- Hero.astro — WRONG -->
<section data-editable="component" data-component="hero" data-prop="hero">…</section>
```

✅ Standalone hero with `<editable-component>` wrapper at the call site:

```astro
<!-- page template -->
<editable-component data-component="hero" data-prop="hero">
  <Hero {...hero} />
</editable-component>
<!-- Hero.astro — plain markup, no data-editable on root -->
<section>…</section>
```

❌ Dynamic `data-prop` swap for a boolean branch — class-list ternaries don't toggle live:

```astro
<span data-editable="text" data-prop={inStock ? "inStockLabel" : "outOfStockLabel"}>
  {inStock ? inStockLabel : "Out of stock"}
</span>
```

✅ Two complete branches gated on the boolean — each with its own static `data-prop`:

```astro
{inStock ? (
  <p class="bg-green-100">
    <span data-editable="text" data-prop="inStockLabel">{inStockLabel}</span>
  </p>
) : (
  <p class="bg-gray-200"><span>Out of stock</span></p>
)}
```

## Editable type — pick one

| Field shape                                                                         | Editable type                                                                           | Section                                                                             |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Single string/text (frontmatter or body)                                            | `data-editable="text"` or `<editable-text>`                                             | [Text editing](#text-editing)                                                       |
| Single image                                                                        | `data-editable="image"` / `<editable-image>`                                            | [Image editing](#image-editing)                                                     |
| Array of items (uniform)                                                            | `data-editable="array"` + `array-item` children                                         | [Array editing](#array-editing)                                                     |
| Page builder (heterogeneous blocks)                                                 | `array` + per-item `data-component` + CRUD                                              | [Page builder blocks](#page-builder-blocks)                                         |
| Conditional/computed output, style bindings                                         | Register the component; wrap with `<editable-component>`                                | [When to use a component editable region](#when-to-use-a-component-editable-region) |
| Hardcoded string in `.astro` template                                               | `data-editable="source"` (last resort — prefer page-builder)                            | [Source editables for hardcoded content](#source-editables-for-hardcoded-content)   |
| React island (`client:*`) that fetches, submits forms, or loads third-party scripts | Gate with `window.inEditorMode`; render same markup but skip API calls and script loads | [Editing fallbacks](#editing-fallbacks-vue-svelte-solid-or-complex-components)      |

## Data-prop paths — pick one

| Context                              | Syntax                    | Example                                           | Where it works                                                                                                             |
| ------------------------------------ | ------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Same file, frontmatter               | Relative key              | `data-prop="title"`, `data-prop="banner.title"`   | Default case.                                                                                                              |
| Same file, markdown body             | `@content`                | `data-prop="@content"` (with `data-type="block"`) | Blog bodies, rich-text body regions.                                                                                       |
| Shared data file (via `data_config`) | `@data[key].path`         | `data-prop="@data[call-to-action].title"`         | Reusable CTAs, testimonials. Key matches `data_config` entry.                                                              |
| Another content file by path         | `@file[/repo/path].field` | `data-prop="@file[/src/content/team/jane].name"`  | Cross-collection items on a listing page. Path must start with `/`.                                                        |
| Inside an `array-item`               | Relative (scope = item)   | `data-prop="title"` resolves to `items[N].title`  | Array children. Do NOT repeat the array's `@data[...]` prefix — see [Arrays inside data files](#arrays-inside-data-files). |
| Pass-through scope                   | Empty string              | `data-prop=""`                                    | Primitive regions only. Breaks `<editable-component>` (empty string treated as falsy).                                     |

## Anti-patterns — MUST NOT

| Anti-pattern                                                                           | What breaks                                                                                      | Fix / see                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Mix array items with non-array siblings under the same `data-editable="array"` wrapper | CloudCannon includes the siblings in the array and CRUD controls attach to the wrong elements    | [Don't mix array items with non-array siblings](#dont-mix-array-items-with-non-array-siblings)    |
| Pass `data-prop=""` (empty string) to `<editable-component>`                           | Web component treats empty string as falsy and silently skips binding                            | [Empty `data-prop` pass-through](#empty-data-prop-pass-through)                                   |
| Omit `data-component` on nested sub-arrays inside a registered component               | The parent component doesn't re-render when editors change sub-array items                       | [Sub-arrays within widget components](#sub-arrays-within-widget-components)                       |
| Hardcode section titles / buttons inside child components                              | Text isn't editable; editors have nowhere to change it                                           | [Section titles and buttons in child components](#section-titles-and-buttons-in-child-components) |
| Attach `data-editable` directly to a third-party component's output                    | The third-party component's rendered HTML may not accept `data-*` attributes where you need them | [Third-party component fields](#third-party-component-fields)                                     |
| Use build-time cross-collection lookups with a static child component                  | Sidebar changes don't trigger a re-render                                                        | [Component editables backed by data files](#component-editables-backed-by-data-files)             |
| Repeat the parent's `@data[...]` prefix on descendants                                 | Path resolves incorrectly                                                                        | [Arrays inside data files](#arrays-inside-data-files)                                             |
| Use indexed paths on nested array-item editables (`@data[footer].columns[0].heading`)  | Path escapes the item's scope; edits don't round-trip                                            | [Arrays inside data files](#arrays-inside-data-files)                                             |

## Guard optional fields

Every `data-editable` element must be conditionally rendered when its field can be null/undefined — CloudCannon inspects the resolved value at region initialization. Guards belong in the component that renders the element (including shared sub-components). See [structures.md § field completeness](../../cloudcannon-configuration/structures.md) for the upstream fix.

```astro
{subtitle && <p set:html={subtitle} data-editable="text" data-prop="subtitle" />}
```

### Shared sub-component editables inside page builders

When a shared component like `Headline.astro` renders title/subtitle/tagline for many widgets, adding `data-editable` attributes there is correct — inside a page builder block, editables are scoped to the parent registered component. So `data-prop="title"` on Headline resolves to `content_blocks[n].title`.

**Prop alignment pitfall:** If the parent widget passes data through the shared component with a fallback (e.g. `subtitle={subtitle || description}`), the editable targets the prop name (`subtitle`), not the fallback source (`description`). Content files must populate the field the editable targets — otherwise the editable binds to null while the visible text comes from the fallback field.

### Content-sourced objects and arrays are never falsy

Content YAML objects with all-null inner fields and empty arrays are truthy in JavaScript. Guard on meaningful inner fields (`image?.src &&`) and array length (`actions?.length > 0 &&`). See [structures.md § Guarding empty objects and arrays](../../cloudcannon-configuration/structures.md#guarding-empty-objects-and-arrays-in-components) for the full pattern with examples.

**Astro-specific: dual slot/prop components.** Many Astro widgets accept both slot content (rendered as strings) and structured objects (from content collections). They commonly use `typeof value === 'string'` to branch between the two. When fixing guards for these components, preserve the string branch:

```astro
{(typeof callToAction === 'string' ? callToAction : (callToAction?.text || callToAction?.icon)) && ...}
{(Array.isArray(actions) ? actions.length > 0 : actions) && ...}
```

## Text editing

**Where to put text regions:**

- **Semantic or layout element** — when an existing element is the natural host (`<h1>`, `<p>`, `<li>`, etc.), add `data-editable="text"` and `data-prop="<path>"` to it directly.
- **Wrapper-only** — when extra markup exists only to host editable text (e.g. inside a link, slot content, or a conditional branch), prefer `<editable-text>` over `<span data-editable="text">`: same behaviour, clearer intent, and fewer clashes with generic `span` rules. See [editable-regions.md § Custom Element Equivalents](../editable-regions.md#custom-element-equivalents).
- **Stay primitive when needed** — keep `<span data-editable="text">` when CSS or legacy markup already targets `span`, or when a specific integration is clearer with the explicit primitive.

```astro
<h1
  set:html={markdownify(title)}
  class="mb-4"
  data-editable="text"
  data-prop="title"
/>
```

For block-level rich text (paragraphs, headings, lists), add `data-type="block"`:

```astro
<div class="content" data-editable="text" data-type="block" data-prop="@content">
  <Content />
</div>
```

The `@content` path targets the file's markdown body (not frontmatter).

**Choosing `data-type` for HTML-rendered frontmatter fields:**

This applies to any frontmatter field rendered as HTML — whether via `set:html` directly, or through a markdown parser like `markdownify()` or `marked()` (which produces HTML that then goes through `set:html`).

Keep the original element and don't add `data-type` unless there's a reason to. The two signals that `data-type="block"` is needed:

1. **The field's input config allows block-level content.** The CloudCannon input configuration (`_inputs` in `cloudcannon.config.yml` or schema files) is the source of truth for what a field accepts. If the input config permits block-level options (lists, headings, etc.), the on-page text editable needs `data-type="block"` to match — otherwise a user adds a list via the sidebar, and the on-page editable can't handle it.
2. **The existing content already contains block-level HTML.** Even without explicit input config, if a `set:html` field already contains `<ul>`, `<ol>`, `<h*>`, or similar, add `data-type="block"`.

When `data-type="block"` is needed, the host element must support block content. `<p>` cannot nest block elements — browsers auto-close the `<p>` before any `<ul>`/`<ol>`/`<h*>`, breaking the DOM and the editable region. Change to an element that can hold block content (e.g. `<div>`).

Also watch for content working around element limitations — e.g. `<br>` tags inside a `<p>` to fake a list, or repeated inline markup to mimic separate blocks. That's a signal the element is semantically wrong. Refactor the element to match what the content actually represents (e.g. a `<p>` with `<br>`-separated items should become a proper `<ul>` or a `<div>` with `data-type="block"`).

**Editables inside slot content:** Editable text passed into a slot must sit under a **single concrete DOM element** so `data-editable` / `data-prop` (or the equivalent custom element) has a host. `<Fragment>` has no DOM node and cannot carry those attributes.

The same applies if you abstract slot content into an Astro `.astro` component: a **Fragment root** or **multiple roots** leaves no single element to attach the region to—use one wrapper element (native or custom) as the component output.

```astro
<!-- Won't work: Fragment can't carry data-editable -->
<Fragment slot="title">{title}</Fragment>

<!-- Works: prefer custom element -->
<editable-text slot="title" data-prop="title">{title}</editable-text>

<!-- Works: equivalent primitive form -->
<span slot="title" data-editable="text" data-prop="title">{title}</span>
```

## Image editing

Put path attributes (`data-prop`, `data-prop-src`, etc.) on the **image region host**. The library resolves the target like this: if the host is an `<img>`, it edits that element; otherwise it uses the first descendant `<img>` inside the host. So you can use **either** a wrapper (`<editable-image>`, `<div data-editable="image">`, or a layout element that already wraps the picture) **or** `data-editable="image"` directly on a plain `<img>`.

When the host exists **only** for editing, prefer `<editable-image>` over `<div data-editable="image">` (equivalent behaviour; see [editable-regions.md § Custom Element Equivalents](../editable-regions.md#custom-element-equivalents)). Keep `data-editable="image"` on a real layout `<div>` when that element already carries structure or styling.

**Astro:** Output from `<Image />` (`astro:assets`) is often not a straightforward primitive `<img>` you annotate like static HTML, so the **wrapper + child** pattern below stays the usual choice for Astro image components.

There are two binding modes depending on the shape of the data:

**String image path** (most common -- the frontmatter field is a plain string like `"/images/hero.jpg"`):

Use `data-prop-src` to bind the image `src`. Optionally add `data-prop-alt` or `data-prop-title` if alt/title are stored in separate fields:

```astro
<editable-image data-prop-src="image">
  <ImageMod src={image} width={1200} height={600} alt={title} format="webp" />
</editable-image>
```

**Plain `<img>` host** (same bindings on the image element itself — useful for hand-authored HTML):

```astro
<img
  data-editable="image"
  data-prop-src="image"
  src={image}
  alt={title}
/>
```

**Object image field** (the frontmatter field is an object with `src`, `alt`, and `title` properties):

Use `data-prop` to bind the entire object at once:

```astro
<editable-image data-prop="hero_image">
  <img src={hero_image.src} alt={hero_image.alt} />
</editable-image>
```

Most Astro templates store images as simple string paths, so `data-prop-src` is the correct choice in the majority of cases. Using `data-prop` on a string field will not work -- it expects an object.

When the user clicks the image in the visual editor, CloudCannon opens the image picker. The `<img>` src is updated live.

**Image location and optimization:** Optimized images belong in `src/assets/`, not `public/`. Frontmatter stores the full repo-relative path (e.g. `/src/assets/images/hero.webp`). Components use `import.meta.glob` to resolve the string to `ImageMetadata` at build time (see [content.md § Resolving optimized image paths](../../migrating-to-cloudcannon/astro/content.md#resolving-optimized-image-paths-from-frontmatter)). Don't downgrade to `<img>` just because the path comes from frontmatter.

**Upload paths:** Configure per-input upload paths so optimized images go to `src/assets/images` while unoptimized use the global `public/` path. The per-input `static: ''` is critical — without it, CloudCannon strips the path prefix and `import.meta.glob` can't resolve the image. See [configuration.md § Image path configuration](../../cloudcannon-configuration/astro/configuration.md#image-path-configuration) for the full setup with YAML examples.

### Button/link text

For text inside links or buttons, wrap the label in `<editable-text>` (or use `<span data-editable="text">` when CSS or existing markup already targets `span`):

```astro
<a class="btn btn-primary" href={button.link}>
  <editable-text data-prop="banner.button.label">
    {button.label}
  </editable-text>
</a>
```

## Array editing

Wrap the container with `data-editable="array"` and each item with `data-editable="array-item"`. Child editable regions use paths relative to their array item:

```astro
<div data-editable="array" data-prop="features">
  {features.map((feature) => (
    <section data-editable="array-item">
      <h2 data-editable="text" data-prop="title">{feature.title}</h2>
      <editable-image data-prop-src="image">
        <ImageMod src={feature.image} ... />
      </editable-image>
      <p data-editable="text" data-prop="content">{feature.content}</p>
    </section>
  ))}
</div>
```

Array items get CRUD controls (reorder, add, delete) automatically. Without a registered component renderer, items won't visually re-render after data changes -- the user saves and refreshes. Text/image editable regions within items still work in real-time.

When conditional elements, style bindings, or computed content need live updates, you need a registered Astro component **somewhere**. **Default for a uniform list:** wrap the **parent** that owns the whole array in `<editable-component>` (one `registerAstroComponent` for the section) — see [When to use a component editable region](#when-to-use-a-component-editable-region). **Alternative:** put `data-component` on **each** `array-item` and register each item type separately — the pattern used for [page builder blocks](#page-builder-blocks). **You can combine** parent and per-item boundaries when the layout needs it (for example, a wrapper component for shared chrome plus different `data-component` types per row). Start with the parent wrap when it fits; reach for per-item (or a mix) when item types differ or you want each row to own its own re-render scope.

**Always nest text and image editables inside array items.** Without nested text/image regions on their key fields (`data-editable="text"` / `data-editable="image"`, or `<editable-text>` / `<editable-image>`), array items only get CRUD controls (add/remove/reorder) — no inline text editing or live image picking. This applies universally, not just when component re-rendering is unavailable. Text and image editables handle their own DOM updates independently of the component system, so they work even on Astro 4 where `editableRegions()` integration isn't available. Every array item should have nested editables on its title, description, and image fields at minimum.

**Use `data-prop=""` for plain string array items.** When array items are plain strings (not objects), use `data-prop=""` (empty string) to pass the current scope as the editable value. Without it, CloudCannon errors with "Text editable regions require a 'data-prop' HTML attribute but none was provided."

```astro
<ul data-editable="array" data-prop="skills">
  {skills.map((skill) => (
    <li data-editable="array-item"><editable-text data-prop="">{skill}</editable-text></li>
  ))}
</ul>
```

**When HTML `<template>` blueprints are needed.** The runtime can create new array rows from three sources (tried in order): in-flight update DOM, `<template>` children on the wrapper, or registered component rendering. Use this table to decide:

| Array type                                                                                                | Has `data-component-key` + per-item `data-component` + all types registered? | Can be empty at build time? | `<template>` needed?                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Page builder** (`content_blocks`)                                                                       | Yes                                                                          | Yes                         | **No** — the component pipeline handles it ([CC complex array docs](https://cloudcannon.com/documentation/developer-guides/set-up-visual-editing/visually-edit-complex-arrays-and-page-building/)) |
| **Uniform primitive list** (no `data-component`)                                                          | No                                                                           | Yes                         | **Yes** — one `<template>` so "Add item" has structure                                                                                                                                             |
| **Uniform primitive list** (no `data-component`)                                                          | No                                                                           | No (always has items)       | **Optional** — runtime can clone the first item                                                                                                                                                    |
| **Heterogeneous rows without per-item registration** (e.g. sub-array variants inside a registered widget) | No                                                                           | Varies                      | **Yes** — multiple `<template>` elements with `data-id` matching each variant, paired with CloudCannon structures                                                                                  |

**Simple arrays** (uniform primitive rows) usually include a single `<template>`:

```astro
<div data-editable="array" data-prop="items">
  {items.map((item) => (
    <div data-editable="array-item">
      <editable-image data-prop-src="img">
        <img src={item.img} alt={item.title} />
      </editable-image>
      <h2 data-editable="text" data-prop="title">{item.title}</h2>
      <p data-editable="text" data-prop="desc">{item.desc}</p>
    </div>
  ))}
  <template>
    <div data-editable="array-item">
      <editable-image data-prop-src="img">
        <img src="" alt="" />
      </editable-image>
      <h2 data-editable="text" data-prop="title"></h2>
      <p data-editable="text" data-prop="desc"></p>
    </div>
  </template>
</div>
```

When you author a `<template>`, mirror the live item's HTML: same editable attributes, empty content. Include **all** region types used in the row—text, image, nested arrays. For **image** regions, include an `<img>` the editor can target: either `<img data-editable="image" … src="" alt="">` as the host, or a wrapper (`<editable-image>` or `<div data-editable="image">`) around `<img src="" alt="">` — match the live item. Nested arrays inside a template row can include nested `<template>` elements.

**Conditional editable prop for cross-collection content.** When a shared component (like a card) is used both for frontmatter-backed array items AND programmatic content from another collection (e.g. blog posts fetched via `getCollection`), the editable attributes break on the programmatic items because there's no valid data scope. Add an `editable` prop (default `true`) to the component and conditionally apply editable attributes:

```astro
---
const { title, desc, editable = true } = Astro.props;
---
<h1>
  {editable ? <editable-text data-prop="title">{title}</editable-text> : title}
</h1>
```

Pass `editable={false}` when rendering cross-collection content that isn't backed by the current page's frontmatter.

**Rebuild comments on sidebar-only fields (Astro 4).** On Astro 4 without component re-rendering, fields that appear on the page but are only editable via the sidebar (e.g. `badge`, `tags`, `variant`) won't live-update. Add `comment` to these inputs in the CC config explaining what the field does and that changes require a save and rebuild. On Astro 5+ with component registration, these fields update live and the comments aren't needed.

### Arrays inside data files

When the array lives inside a shared data file (e.g. `src/data/footer.json` with `columns[{heading, links[]}]`), the path on the **parent** array editable is the only place the `@data[key]` prefix appears. Child editables inside each `data-editable="array-item"` use **relative paths** — same rule as frontmatter-backed arrays. The library uses the array-item context to resolve, so an indexed path (`@data[footer].columns[0].heading`) on a child editable is unrecognised and resolves to undefined.

```astro
<!-- DO: data-file array, relative paths inside items -->
<div class="contents" data-editable="array" data-prop="@data[footer].columns">
  {columns.map((column) => (
    <div data-editable="array-item">
      <h3 data-editable="text" data-prop="heading">{column.heading}</h3>
      <ul data-editable="array" data-prop="links">
        {column.links.map((link) => (
          <li data-editable="array-item">
            <editable-text data-prop="label">{link.label}</editable-text>
          </li>
        ))}
      </ul>
    </div>
  ))}
</div>

<!-- DON'T: full indexed paths on child editables resolve to undefined -->
<editable-text data-prop={`@data[footer].columns[${i}].heading`}>
  {column.heading}
</editable-text>
```

Nested data-file arrays follow the same rule: the inner `data-editable="array" data-prop="links"` uses the relative key (`links`), and items inside it use relative keys (`label`, `href`). The `@data[...]` prefix never repeats once you're inside an array item — relative paths chain naturally through nested levels.

### Don't mix array items with non-array siblings

A `data-editable="array"` wrapper treats every direct child as an `array-item` — including children that aren't part of the array. Putting a static element (logo column, summary block, "see all" link) as a sibling of `array.map(...)` output inside the same array wrapper breaks the array context: the static child has no matching frontmatter index, and the editable runtime errors trying to resolve it.

```astro
<!-- WRONG: static logo column inside the array container -->
<div class="grid grid-cols-4" data-editable="array" data-prop="@data[footer].columns">
  {columns.map((column) => (<div data-editable="array-item">...</div>))}
  <div>{/* static logo + tagline — not in columns[] */}</div>
</div>

<!-- RIGHT: split the layout container from the array container -->
<div class="grid grid-cols-4">
  <div class="contents" data-editable="array" data-prop="@data[footer].columns">
    {columns.map((column) => (<div data-editable="array-item">...</div>))}
  </div>
  <div>{/* static logo + tagline */}</div>
</div>
```

## Page builder blocks

For the structural setup (array wrapper, BlockRenderer, catch-all route, CC config), see [page-building.md](../../migrating-to-cloudcannon/astro/page-building.md). This section covers the **visual editing layers** that go on top of that structure.

Each block needs **three layers**: (1) array wrapper, (2) array items with component behaviour, (3) nested editables. Agents commonly add the array wrapper but miss the component layer or nested editables. See the [CloudCannon complex array docs](https://cloudcannon.com/documentation/developer-guides/set-up-visual-editing/visually-edit-complex-arrays-and-page-building/) for the canonical reference.

**Array items and components are two separate behaviours:**

- `data-editable="array-item"` gives **CRUD controls** — add, remove, reorder, drag-and-drop.
- `data-component` enables **component re-rendering** — all nested content re-renders when data changes.

Page builder blocks need **both** on the same element. Without `data-component`, the block's contents won't live-update when the editor changes data via the sidebar. Without `data-editable="array-item"`, there are no CRUD controls.

When a suitable HTML element exists, add both attributes directly:

```html
<section data-editable="array-item" data-component="{_type}" data-id="{_type}">
  <Component {...props} />
</section>
```

When no suitable element exists, use the `<editable-array-item>` web component:

```html
<editable-array-item data-component="{_type}" data-id="{_type}">
  <Component {...props} />
</editable-array-item>
```

`<editable-component>` is for **standalone** component regions that are not inside an array (e.g. a fixed hero section: `<editable-component data-component="hero" data-prop="banner">`).

**`data-component-key` / `data-id-key` on the array wrapper.** These go on the parent `data-editable="array"` element and tell CloudCannon which frontmatter key identifies the component type and unique ID for each item. They're needed because when the array is empty there are no child elements — CloudCannon still needs to know which data field to read. `data-component` / `data-id` on each child are the resolved runtime values. The key name is arbitrary (our examples use `_type`, the CC docs use `_name`).

Since December 2025, `data-id-key` and `data-id` **default** to the `data-component-key` and `data-component` values when not provided. When the identity key and component key are the same field (the common case), you can omit `data-id-key` and `data-id` entirely.

**Nested editables** inside widget components — add text/image regions on the elements that render editable fields (`data-editable="text"` / `data-editable="image"`, or `<editable-text>` / `<editable-image>` on wrapper-only hosts):

```astro
<!-- Inside Hero.astro -->
{title && <h1 set:html={title} data-editable="text" data-prop="title" />}
{subtitle && <p set:html={subtitle} data-editable="text" data-prop="subtitle" />}
{image && (
  <editable-image data-prop="image">
    <Image {...image} />
  </editable-image>
)}
```

Paths are relative to the component's data scope (the array item), so `data-prop="title"` resolves to `content_blocks[n].title`.

### BlockRenderer architecture

**Array-item wrappers belong in the page template, not in BlockRenderer.** CloudCannon wraps each registered component in its own `data-editable="array-item"` element with tracking attributes (`data-prop`, `data-length`, `data-id`). If the component's rendered output ALSO starts with a `data-editable="array-item"` element, you get double nesting: `array > array-item > array-item`. The inner array-item can't find an `array` parent and throws "Array item editable regions must be nested inside an array editable region."

The correct pattern:

```astro
<!-- Page template (e.g. index.astro) — owns the array-item wrapper -->
<div data-editable="array" data-prop="content_blocks" data-component-key="_type">
  {content_blocks?.map((block) => (
    <div data-editable="array-item" data-component={block._type}>
      <BlockRenderer {...block} />
    </div>
  ))}
</div>
```

**BlockRenderer should be a thin dynamic dispatcher**, not a markup container. It imports `componentMap` and renders the matching component:

```astro
---
import { componentMap } from '../cloudcannon/componentMap'
const { _type, ...props } = Astro.props
const Component = componentMap[_type]
---
{Component && <Component {...props} />}
```

**Each block type should have its own component file.** If the pristine site had a section as inline markup in a page template (no dedicated component), create a component during the migration. The component owns its section markup and its editable attributes (sub-arrays, text regions, image regions). BlockRenderer never contains section markup — it only dispatches.

**`componentMap` is the single source of truth.** Both `BlockRenderer.astro` and `registerComponents.ts` import from `src/cloudcannon/componentMap.ts`. The map keys are the `_type` values from content files. The map values are the actual component imports (not BlockRenderer itself — mapping every type to BlockRenderer defeats the purpose).

**Registration:** Every `_type` value must have a matching `registerAstroComponent` call. The key string must match the `_type` value exactly (e.g., `_type: call_to_action` → `registerAstroComponent('call_to_action', CallToAction)`, not `'call-to-action'`).

**Shared sub-components (e.g. Headline):** When a shared component like `Headline.astro` renders title/subtitle for many widgets, adding `data-editable` attributes to it is acceptable — inside a page builder block, the editables are scoped to the parent component, so `data-prop="title"` resolves correctly to the block's title.

**Data-prop mismatch when parent renames fields:** A shared component has `data-prop="subtitle"` on its subtitle element. Widget A passes `description` as the `subtitle` prop: `<Headline subtitle={description} />`. CloudCannon resolves `data-prop="subtitle"` against the block's data, looking for `content_blocks[n].subtitle` — but the block has `description`, not `subtitle`. Result: "received a value of type 'undefined'" error.

Fix options (pick one per widget):

1. **Make the shared component's data-prop configurable** — add a prop so each parent can specify the actual data key. E.g. Headline accepts `subtitleProp` and renders `data-prop={subtitleProp || "subtitle"}`. Hero passes `subtitleProp="description"`. This is cleanest when different widgets map different fields to the same visual slot.
2. **Standardize the field name** — rename the widget's field to match the shared component's prop. Only works when the field name is genuinely interchangeable.
3. **Move the editable to the parent** — put `data-editable` + `data-prop` on the parent widget's own markup instead of the shared component. Means duplicating the annotation in each widget.

Prefer option 1 when the shared component is used by 3+ widgets with different field mappings. Prefer option 2 when there's no semantic distinction between the field names.

## Sub-arrays within widget components

Widget components often contain their own arrays — an `items` list in a Features or Content widget, an `actions` list of buttons in a Hero, a `steps` timeline, etc. These sub-arrays need `data-editable="array"` / `data-editable="array-item"` attributes just like the top-level page builder array. Without them, the user can only edit sub-array items via the sidebar modal — there are no inline CRUD controls (add, remove, reorder, drag-and-drop).

Sub-array items **don't need `data-component`** — the parent widget component already handles re-rendering of its entire subtree. The `data-editable="array-item"` attributes only need to layer on CRUD controls.

**On the array container**, add `data-editable="array"` and `data-prop` pointing to the array field name. **On each item**, add `data-editable="array-item"`. **Inside each item**, add primitive text/image regions (`data-editable="text"`, `data-editable="image"`, or `<editable-text>` / `<editable-image>` when the host is wrapper-only) on the editable fields.

```astro
<!-- Shared UI component: ItemGrid.astro -->
<div
  class="grid gap-8"
  data-editable="array"
  data-prop="items"
>
  {items.map(({ title, description, icon }) => (
    <div data-editable="array-item">
      <h3 data-editable="text" data-prop="title">{title}</h3>
      <p set:html={description} data-editable="text" data-prop="description" />
    </div>
  ))}
</div>
```

Since the sub-array lives inside a registered component (e.g. Features3 rendered as a page builder block), `data-prop="items"` resolves relative to the block's data scope — e.g. `content_blocks[n].items`. The array item paths then resolve to `content_blocks[n].items[m].title`, etc.

**Shared UI components:** When a shared component like `ItemGrid.astro` always receives the array as the same prop name (`items`), hardcode `data-prop="items"` directly. If different callers use different field names, accept the prop name as a component parameter instead.

**Don't forget sub-arrays.** This is a common omission — agents add the page builder array and primitives (text/image) inside widgets but skip internal arrays. Every array rendered by a widget component should get array editables unless the array structure is too complex for inline editing (e.g. deeply nested objects better suited to the sidebar).

**Check all variants of shared UI components.** Templates often have numbered variants of the same component (e.g. `ItemGrid.astro` and `ItemGrid2.astro`, `Features.astro` and `Features2.astro`). Adding editables to one variant doesn't cover the others — each must be checked independently. After wiring up a shared component, grep for similar filenames (`ItemGrid*.astro`) to find variants that need the same treatment.

**Watch for inline array rendering.** Adding editability to shared UI components (e.g. `ItemGrid`, `Timeline`) cascades to all widgets that delegate to them, but some widgets render arrays directly in their own template without using a shared component. These are easy to miss. After wiring up shared components, grep for `.map(` across widget files to catch any inline array rendering that still needs editability attributes added directly to the widget template.

## Data path patterns — rules

Syntax for each form is in the [Data-prop paths table](#data-prop-paths--pick-one) at the top. The rules below apply on top of the syntax.

### Empty `data-prop` pass-through

Don't use `data-prop=""` on `<editable-component>` — the component controls UI treats empty string as falsy and won't render the edit button.

**Use when:** The parent's data IS the value the child needs (e.g. an `array` editable inside an array-bound component). Without it, `data-prop="plans"` would resolve to `plans.plans`.

```astro
<editable-component data-component="pricing" data-prop="plans">
  <PricingSection {...plans} />
</editable-component>

<!-- Inside PricingSection.astro -->
<div data-editable="array" data-prop="">
  {plans.map((plan) => (<div data-editable="array-item">...</div>))}
</div>
```

### Non-source editables for hardcoded pages

When a page template (e.g. `contact.astro`) has its own rendering logic but reads data from a `.md` file in the pages collection, editable regions still use **relative paths** — the collection file provides the data context. `_enabled_editors` and `_schema` settings ensure editors see the right fields.

### Cross-collection items on a page

When a page template fetches items from a different collection (team members on an About page, testimonials on a landing page), add `@file` editables so those items are editable inline:

```astro
{teamMembers.map((member) => (
  <div>
    <editable-image data-prop={`@file[/src/content/team/${member.id}].avatar`}>
      <img src={member.data.avatar.src} alt={member.data.avatar.alt} />
    </editable-image>
    <h3 data-editable="text" data-prop={`@file[/src/content/team/${member.id}].name`}>
      {member.data.name}
    </h3>
  </div>
))}
```

Note: `entry.id` behavior depends on the content collection type. **Legacy collections** (`type: "content"` in `src/content/config.ts`) include the file extension (e.g. `jane-doe.md`). **Glob loader** (`glob()` in `src/content.config.ts`) strips the extension (e.g. `jane-doe`), so you must append `.md` when building `@file` paths. Check which loader the collection uses before constructing paths.

### Shared-data / computed-content handling

| Trigger                                                                                  | Approach                                                                                                                                       | When not to                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Value from shared data file (`site.json`, `locations.json`) — rendered on multiple pages | Use `data-prop="@data[<key>]..."` (`<key>` registered in `data_config`). Scopes the edit to the data file.                                     | Don't use `data-editable="source"` (wrong semantics). Don't use a bare frontmatter-relative prop — mutates shared state from the wrong page. |
| Lookup result that doesn't live-update (`locations[slug].street`, `site.phone`)          | Read the lookup inside a registered component wrapped in `<editable-component>` so the whole block re-renders on slug change.                  | Don't put a primitive `data-editable="text"` on the rendered value — lookup bakes at build time.                                             |
| Computation/expression won't re-run (ternary, `iconPaths[x]`, `set:html`)                | Wrap section root with `<editable-component>` at the call site. CC re-renders the block on any child-field change, so expressions re-evaluate. | Don't use primitive `data-editable` on computed outputs — it updates DOM text only.                                                          |
| Multiple pages share a data-file value; editor should be able to change it               | `data-prop="@data[<key>].dotted.path"` routes through `data_config` and is explicitly data-file-scoped.                                        | Don't allow inline editing of shared data via page-frontmatter-relative paths.                                                               |

## When to use `data-editable="component"`

For the decision triggers, see [Golden rule](#golden-rule--computed-content-needs-a-component-wrapper).

1. Does the rendering involve a ternary/conditional, a lookup against another data file, an icon-path index, or a `set:html`? → **Yes:** extract into a registered component; wrap with `<editable-component>` at the call site.
2. Is the value a literal text/image pulled directly from a field? → **No component needed:** a primitive `data-editable="text"` / `data-editable="image"` is sufficient.
3. Does the section contain both primitive-ok fields and computed fields? → Use the component wrapper anyway — primitive edits still work inside, and computed parts re-render.

```astro
<!-- Component wrapper + nested primitives inside the component -->
<editable-component data-component="features" data-prop="features">
  <Features {...features} />
</editable-component>
<!-- Inside Features.astro: array + text/image primitives still work inline -->
```

**Component prop contract:** When `<editable-component>` re-renders, it passes the value at `data-prop` as spread props — destructure field names directly from `Astro.props`, not a named wrapper. For array-bound components, recover with `Object.values(Astro.props)`.

**Object-bound:** `<editable-component data-prop="banner"><Hero {...banner} /></editable-component>` → `const { title, image } = Astro.props` in Hero.astro.

**Array-bound:** `<editable-component data-prop="plans"><PricingSection {...plans} /></editable-component>` → `const plans = Object.values(Astro.props)` in PricingSection.astro.

### Scattered fields feeding a registered component — nest the frontmatter

**Symptom:** `Cannot destructure property 'x' of 'n.props' as it is undefined` in `registerComponents.*.js`. Or: you're about to write `propPrefix=""` / conditional `data-editable="component"` / `Astro.props ?? {}` workarounds.

All three template-level workarounds are wrong:

❌ Unconditional wrapper with empty prop path — throws on re-render: `<section data-editable="component" data-component="x" data-prop="">`

❌ Conditional emission — silently disables computed-content re-render: `{propPrefix && <section data-editable="component" ...>}`

❌ Defensive destructure — hides the broken wrapper: `const { x } = Astro.props ?? {};`

✅ Reshape the schema. Nest the scattered fields under a single object key matching the component:

```ts
// ❌ flat root fields
treatmentHeading: z.string().default("How We Help"),
treatments: z.array(treatmentEntry).default([]),

// ✅ nested object
treatments: z.object({
  heading: z.string().default("How We Help"),
  items: z.array(treatmentEntry).default([]),
}).default({ heading: "How We Help", items: [] }),
```

Then: `<TreatmentBlocks {...data.treatments} />` inside `<editable-component data-component="treatment_blocks" data-prop="treatments">`. No template conditionals or destructure guards.

> For components used at exactly one call site, hardcode the `data-prop` on the `<editable-component>` wrapper — removes `propPrefix` indirection entirely.

### Blog post detail pages

Blog post detail pages typically have a hero section (title, date, author, image) driven by top-level frontmatter, plus a markdown body. Use inline primitive editables for the fields that support them, and leave the rest to the sidebar.

```astro
<p>
  {formattedDate} •
  <editable-text data-prop="author">{author}</editable-text>
  {readingTime && ` • ${readingTime}`}
</p>
<h1 data-editable="text" data-prop="title">{title}</h1>
<img data-editable="image" data-prop-src="image" src={image} alt={title} />

<div data-editable="text" data-type="block" data-prop="@content">
  <Content />
</div>
```

**When the author is a select referencing a separate data file** (the common pattern — see [cc-friendly-conventions.md § Author strategy](../../migrating-to-cloudcannon/astro/cc-friendly-conventions.md#author-strategy)) and the rendered card shows the resolved name/avatar/bio, a plain `<editable-text data-prop="author">` only updates the visible slug — it can't update the avatar or bio because those come from a different file. Use the registered-component pattern in [Cross-collection select inputs](#cross-collection-select-inputs) instead.

**Shared PageHeader components.** When the blog detail page uses a shared `PageHeader` component (common in starter themes), the editable attributes still need to reach the rendered elements. Don't mark the hero as "sidebar-only" just because the component is shared. Instead, add optional prop-path parameters to the PageHeader (e.g. `titleProp`, `subtitleProp`, `imageProp`) that conditionally render `data-editable` attributes when provided. Callers pass the frontmatter field name (e.g. `titleProp="title"`); pages without that field in their data scope omit the prop. This keeps PageHeader reusable while enabling inline editing where the data supports it.

**Dates must NOT be text editables.** `<editable-text data-prop="pubDate">` sets a raw string, which conflicts with `z.coerce.date()` schemas. Use the sidebar datetime picker instead, and add a `comment` on the input so editors know changes appear after save:

```yaml
_inputs:
  pub_date:
    type: datetime
    comment: Changes to the publish date appear on the page after saving and rebuilding
```

**Computed server-only values** like reading time (from `remarkPluginFrontmatter`) can stay in the page template as static text — they aren't editable and don't need special handling.

**Why not wrap in `<editable-component>`?** When the hero fields live at the top level of the frontmatter (not nested under a single key), there's no `data-prop` path to point to. `data-prop=""` resolves the data correctly but the component controls UI treats empty string as falsy and doesn't render the edit button. `data-prop-*` attributes work but **lowercase all keys** internally (`propName.substring(4).toLowerCase()`), breaking camelCase prop names like `pubDate`. Nesting the hero fields under a `hero:` key in frontmatter would fix this but requires restructuring every content file. For most blog post heroes, inline primitive editables (title, author, image) plus sidebar-only fields (date, tags, category) give a good editing experience without the complexity.

## Source editables for hardcoded content

Source editables work by reading and writing the raw source file (e.g. `src/pages/index.astro`) directly. They don't need a content collection or data file -- just a `data-path` pointing to the source file and a `data-key` to identify the region within it.

**Source-editable is for long-form prose, not for any hardcoded string.** Unique-layout pages with 2+ structured sections belong in a page-builder `pages` collection, not pinned to the `.astro` source. See [migrating-to-cloudcannon/astro/page-building.md § When to reach for page builder](../../migrating-to-cloudcannon/astro/page-building.md#when-to-reach-for-page-builder).

### When to use source editables

| Use source-editable when...                                                                                    | Use page builder + nested editables instead when...      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| The page is mostly long-form prose and you need 1-2 inline string edits (e.g. a hero headline above markdown)  | The page has 2+ structured sections                      |
| There are 1-2 pages of this type and editors won't add more                                                    | Editors might want to add similar pages                  |
| The site is genuinely simple -- homepage + a blog, no marketing pages, no landing pages                        | The site has multiple unique-layout marketing/info pages |
| Refactoring to a content collection would change the rendered HTML in ways the user explicitly told you not to | Refactor freely; output should match                     |

**Editors must still be able to edit visible text.** "Hardcoded so it's developer-only" is not a valid classification -- but the _mechanism_ defaults to a content collection or page-builder block, not source-editable. Source-editable is the exception, reserved for long-form prose where the layout _is_ the body.

### Including `.astro` pages in collections

Pages with source editables should be included in the pages collection so editors can find and open them. Add specific `.astro` filenames to the collection's glob alongside `"*.md"` -- only include pages that actually have editable regions. Pages with no visually editable content (search, 404, tag listings) should be excluded. Set `_enabled_editors: [visual]` for the collection -- `.astro` files can only use the visual editor (their JS frontmatter isn't parseable as data), and `.md` pages work well in the visual editor too when they have editable regions. See [configuration-gotchas.md § Pages collection](../../cloudcannon-configuration/astro/configuration-gotchas.md#pages-collection-including-astro-pages) for the full config pattern.

### Syntax

```astro
<h1
  class="text-4xl font-bold"
  data-editable="source"
  data-path="src/pages/index.astro"
  data-key="hero-title"
>
  Welcome to My Site
</h1>

<p
  data-editable="source"
  data-path="src/pages/index.astro"
  data-key="hero-description"
  data-type="block"
>
  A description paragraph that editors can change.
</p>
```

### How it works

1. CloudCannon reads the full source file via `CloudCannon.file(path).get()`
2. Finds the editable region by locating the `data-key` attribute in the raw HTML
3. When the editor changes the text, splices the new content back into the source file at the same location
4. Writes the entire file back via `file.set(content)`

### Limitations

- **Astro component syntax inside the editable region will not survive editing.** If a paragraph contains `<LinkButton>` or other Astro components, the rich text editor can't handle them. Keep source editables on elements with plain HTML content only.
- **`data-key` must be unique within the file.** Use descriptive keys like `hero-title`, `hero-description`, `cta-heading`.
- **`data-path` is relative to the project root**, not the current file. Use the full path from the repo root (e.g. `src/pages/index.astro`).

### Identifying source editable candidates during audit

During Phase 1, run hardcoded text through the [audit.md classification census](../../migrating-to-cloudcannon/astro/audit.md#classifying-static-pages-source-editables-vs-content-collection) before reaching for source-editable. Most "hardcoded text" candidates -- homepage heroes, CTA sections, section headings -- belong in a page-builder `pages` collection entry, not pinned to the `.astro` source.

Source-editable is the right tool only when:

- The page is mostly long-form prose with 1-2 inline strings to edit (e.g. a hero headline above a markdown body), AND
- There are 1-2 pages of this type with no plans to add more

Footer taglines and other shared-UI text are not source-editable candidates -- they belong in a data file. See [migrating-to-cloudcannon/astro/cc-friendly-conventions.md § Shared-UI treatment table](../../migrating-to-cloudcannon/astro/cc-friendly-conventions.md#shared-ui-treatment-table).

## Astro components in source editables

Source editables cannot handle Astro component syntax — the rich text editor strips non-standard JSX. When a presentational Astro component (e.g. a styled `<Link>`) appears inside content that should be source-editable, choose one of:

1. **Inline as plain HTML + CSS** — replace the component with its HTML equivalent (`<a>` for `<Link>`) and use normal CSS selectors to replicate the styling. This works well for simple wrappers around native HTML elements. Avoid Tailwind utility classes on the inline HTML — use contextual CSS rules instead (e.g. `article a { ... }` in a stylesheet).

2. **Define a snippet** — for more complex components with meaningful props, configure a `_snippets` entry so editors get a structured interface. Enable `snippet: true` in `_editables.content` to make the snippet toolbar button available.

The decision rule: if the component just wraps a native HTML element with styles, inline it. If it has props, state, or non-trivial rendering, make it a snippet.

## Listing page editables with `@file`

For collections without detail pages (data-like `.md` files rendered only on listing pages), use `@file[/path].field` editables to make individual entries editable inline on the listing page.

```astro
{entries.map(entry => (
  <div>
    <h3
      data-editable="text"
      data-prop={`@file[/src/content/work/${entry.id}].company`}
    >
      {entry.data.company}
    </h3>
    <article
      data-editable="text"
      data-type="block"
      data-prop={`@file[/src/content/work/${entry.id}].@content`}
    >
      <entry.Content />
    </article>
  </div>
))}
```

**Path syntax:** `@file` paths must have a leading `/` and are relative to the repository root. For `entry.id` behavior, see the note in [Cross-collection items on a page](#cross-collection-items-on-a-page) — legacy collections include the file extension, glob loader collections do not.

**`@data` vs `@file` for listing-only content:** When `.md` (or similar) entries never build to their own pages and only feed a listing, you can keep the `@file[/path]` pattern above, or consolidate into one structured data file if that stays manageable.

If you consolidate: register the file in CloudCannon `data_config` and expose it under Data in the sidebar (configure inputs/collections as needed). `@data[...]` in `data-prop` uses logical keys instead of building repo paths from `entry.id`. Paths still resolve through `data_config`, but you avoid scattering filesystem layout across many attributes.

Keep separate files and `@file` when one file would be unwieldy, you need rich per-entry markdown/MDX bodies, or per-file workflows matter more than the simplification.

**Enabling visual editing for listing pages:** Add `visual` to the collection's `_enabled_editors` and include the listing page in the `pages` collection glob so editors can open it in the visual editor.

## What to make editable vs. what to leave for the sidebar

| Good for visual editing (inline)                                             | Better for sidebar / data editor                |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Page titles, headings, descriptions                                          | Navigation menus (nested structures)            |
| Hero/banner content (frontmatter via `data-prop`, or hardcoded via `source`) | Social links                                    |
| Images (hero, feature, author avatar)                                        | Theme settings (colors, fonts)                  |
| Content body (`@content`)                                                    | SEO metadata (`meta_title`, `meta_description`) |
| CTA copy                                                                     | Boolean toggles (`draft`, `enable`)             |
| Hardcoded text in page templates                                             | URL/link fields                                 |
| Blog metadata visible on the page (author name, publish date)                | Taxonomy arrays (categories, tags)              |

**MDX bodies and snippets:** MDX snippets don't render as their live-site output in the content or visual editor — editing a page body in the visual editor opens the content editor in an iframe, so the experience is the same. Snippet instances are still editable via CloudCannon's snippet UI. This is a preview limitation, not a reason to avoid visual editing for MDX.

### Use `ENV_CLIENT` editing fallbacks when

- **Vue, Svelte, Solid components** — these frameworks throw runtime errors in editable regions, even nested inside supported wrappers. Prefer converting to `.astro` (or React if state-heavy). If conversion isn't practical, guard with `import.meta.env.ENV_CLIENT` to render a simplified `.astro` editing fallback.
- **Components with complex DOM management** (Swiper carousels, etc.) — their JS conflicts with editable region DOM manipulation.
- **Server-only APIs** (`getImage` from `astro:assets` for image processing, `fetch` to external APIs at render time) — guard with `ENV_CLIENT` for a simplified client-side path that skips optimization.

Note: `import.meta.glob` resolves eagerly at build time and works fine in registered components. `getCollection`/`getEntry` also work — the integration shims them for the client bundle.

## Where does a value belong — frontmatter, structure-value default, or hardcoded?

| Value changes per entry? | Value same across all instances of a type?                                    | Place it in                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yes                      | —                                                                             | Collection schema frontmatter. Use `type: html` + editor-style CSS for styled inline spans; decompose multi-semantic values into separate fields.               |
| No                       | Yes — shared default for all page-builder instances of this type              | Structure-value `value:` default. See [structures.md § Deriving structures](../../cloudcannon-configuration/structures.md#deriving-structures-from-components). |
| No                       | No — pure presentation (class names, SVG paths, layout `<br>` tags, `&nbsp;`) | Hardcoded in the component template; strip from content. No editable region.                                                                                    |

**Row 1 — styled inline span via editor-style CSS** (preferred for branding/emphasis):

```yaml
# cloudcannon.config.yml
_inputs:
  title:
    type: html
    options:
      styles: .cloudcannon/styles/editor.css
      bold: true
      italic: true
      link: true
```

```css
/* .cloudcannon/styles/editor.css */
span.highlight-text {
  color: var(--color-brand);
}
```

**Row 1 — decompose multi-semantic value** (when pieces have distinct semantic meaning):

```json
// ❌ mixed HTML in one field
{ "content": "<span class='text-center'>Star us on <a class='underline' href='...'>GitHub</a></span>" }

// ✅ separate fields; component owns the HTML structure
{ "text": "Star us on", "link_text": "GitHub", "link_url": "https://github.com/..." }
```

## Section titles and buttons in child components

When a component renders a section title or button text from props (e.g. `FeaturedProjects` rendering "Featured projects" and "View all projects"), register the component and wrap with `<editable-component>` so `data-prop` paths inside the component resolve relative to the component's data scope. Use `data-editable="text"` on the heading and `<editable-text>` on the button text inside the component.

`getCollection`/`getEntry` work inside registered components because `astro:content` is shimmed by the integration. This means self-contained components that fetch their own data (e.g. a FeaturedPosts component that calls `getCollection('blog')`) work correctly in the visual editor — you don't need to pass fetched data as props.

**Button/link render gates**

❌ Multi-field `&&` chain — partial fill or whitespace-only strings produce visible empty editable regions:

```astro
{label && href && <a href={href}>{label}</a>}
```

✅ Gate on the single user-visible field; trim whitespace; fall the URL back to a safe default:

```astro
{label?.trim() && <a href={href || "/#contact"}>{label}</a>}
```

## Third-party component fields

When third-party npm components render props internally and don't pass through HTML attributes, editable text/image regions can't be placed on the rendered output. Create a thin wrapper component, register it, and use `data-component` on the array item. On data changes, the item re-renders and the wrapper passes new props through to the third-party component.

```astro
---
import { ProfileCard } from 'some-component-library'
const { name, role, avatar } = Astro.props
---
<ProfileCard name={name} role={role} avatar={avatar} />
```

For sections with third-party components that don't expose attributes, extract the section into its own registered component so the whole section re-renders on any data change. This handles title, content, and order updates.

## Component editables backed by data files

Use `data-prop="@data[key]"` on `<editable-component>` for components backed by data files. See [Shared-data / computed-content handling](#shared-data--computed-content-handling) for the full pattern table. Component prop names must match the data file's key names exactly (case-sensitive) — the re-renderer passes data file values directly as props.

```astro
<editable-component data-component="call-to-action" data-prop="@data[cta]">
  <CallToAction />
</editable-component>
```

## Cross-collection select inputs

Many sites use a `select` input to reference another data file — `author: <slug>` on posts/projects pointing into `src/data/authors.json`, `category: <slug>` pointing into `src/data/categories.json`, `team_member: <slug>` into a team file. The frontmatter stores the slug; the rendered card shows fields from the referenced file (name, avatar, bio).

The select input is editable in the sidebar by default — but **the rendered card on the page won't update on change** unless the wiring is right. The pattern that works:

1. **Data file** keyed by slug.

   ```json
   // src/data/authors.json
   {
     "jane-smith": { "name": "Jane Smith", "avatar": "...", "bio": "..." },
     "john-doe": { "name": "John Doe", "avatar": "...", "bio": "..." }
   }
   ```

2. **CC config** — expose the data file under `data_config` (without this, `data.authors` won't resolve in the select), then a `select` input with `value_key: ''` so the frontmatter stores the bare slug (not `{key, value}`).

   ```yaml
   data_config:
     authors:
       path: src/data/authors.json

   _inputs:
     author:
       type: select
       options:
         values: data.authors
         value_key: ""
   ```

3. **Dedicated registered component** that takes the slug as a prop and does the lookup _internally_. The lookup must live inside the registered component — not in the page template — because that's the code that re-runs when CC re-renders.

   ```astro
   ---
   // The component imports the data file, accepts the slug, looks up the entry,
   // and renders whatever fields the card displays. Shape your own component to
   // your data and UI — only the prop+lookup pattern is load-bearing.
   import authors from '../data/authors.json'
   const { author } = Astro.props
   const entry = author ? authors[author] : undefined
   ---
   {entry && <!-- render entry.name, entry.avatar, entry.bio, etc. -->}
   ```

   ```ts
   // registerComponents.ts
   registerAstroComponent("author-card", AuthorCard);
   ```

4. **Editable wrapper** at the call site, with `data-prop` pointing at the slug field:

   ```astro
   <editable-component data-component="author-card" data-prop="author">
     <AuthorCard author={post.data.author} />
   </editable-component>
   ```

When the editor changes the select, CC re-renders `author-card` with the new slug, AuthorCard's lookup re-runs against `authors.json`, and the displayed name/avatar/bio update live.

**Anti-pattern (silent breakage).** Doing the lookup in the page template and passing the resolved `{ name, image, bio }` object to a static child component:

```astro
<!-- WRONG: lookup runs at build time; nothing on the page binds to the slug -->
const author = authors[post.data.author]
<PageHeader author={author} />
```

The frontmatter still updates when the editor changes the select, but the displayed object was computed at build time from the _previous_ slug. Nothing re-renders. Sidebar feels broken — change occurs but the page doesn't reflect it. Move the lookup into the registered component.

**When the call site is a shared component (e.g. PageHeader).** Mirror the optional-prop pattern from titleProp/subtitleProp/imageProp: accept `authorSlug` and `authorProp`, and only render the `<editable-component>` wrapper when both are passed. Pages that don't have an author omit both props.

**`reference()` fields are objects, not strings.**

❌ String-vs-object comparison silently fails:

```ts
locations.map((id) => allLocations.find((entry) => entry.id === id)?.data);
// `id` is actually {collection, id} → never matches → empty array
```

✅ Resolve refs with `getEntry`:

```ts
const resolved = await Promise.all(locations.map((ref) => getEntry(ref)));
const data = resolved.filter(Boolean).map((e) => e.data);
```

✅ Membership test on a ref array:

```ts
entry.data.locations.some((ref) => ref.id === currentLocationId);
```

## Conditional editable-image on shared components

When a shared component like `PageHeader` is used across collections, not all contexts have the same frontmatter fields. For example, blog posts have an `image` field in frontmatter, but project pages compute their featured image from an array — there's no `image` field to bind. Wrapping unconditionally in `<editable-image data-prop-src="image">` causes errors on pages where `image` doesn't exist in the data scope.

Fix: add an optional prop (e.g. `imagePropPath`) that controls whether the image gets editable attributes. Only render the `<editable-image>` wrapper when the prop is provided:

```astro
{resolvedImage && imagePropPath ? (
  <editable-image data-prop-src={imagePropPath}>
    <Image src={resolvedImage} ... />
  </editable-image>
) : resolvedImage ? (
  <Image src={resolvedImage} ... />
) : null}
```

Pages where frontmatter includes the image field pass the prop; pages where it doesn't exist omit it.

## Component re-rendering

For full live preview (not just text/image), components need to be registered so `EditableComponent` can re-render them in the browser when data changes.

### Astro components

For page builder sites, add the component to `src/cloudcannon/componentMap.ts` -- it will be registered automatically by `registerComponents.ts` (see [setup steps in visual-editing.md](visual-editing.md#setup-steps)). For standalone components not in the page builder, add individual registrations directly in `registerComponents.ts`:

```typescript
import { registerAstroComponent } from "@cloudcannon/editable-regions/astro";
import CallToAction from "@/layouts/partials/CallToAction.astro";

registerAstroComponent("call-to-action", CallToAction);
```

### Non-Astro framework components

Only `.astro` and React components are supported (see [overview.md § Astro scope](../../migrating-to-cloudcannon/astro/overview.md#astro-scope)).

**Decision: convert or provide an editing fallback.** For each unsupported component, decide whether to convert it to a supported framework or keep it and provide a fallback:

- **Convert** -- rewrite as `.astro` or React. Prefer `.astro` unless the component needs complex client-side state/interactivity, in which case React is a good choice. This is simpler (no duplication) and gives full visual editing support. Default recommendation.
- **Editing fallback** -- if conversion isn't practical (third-party framework library with no equivalent, large complex component, team preference), keep the original and use `ENV_CLIENT` to conditionally render an editing fallback in the visual editor. See below.

#### React components

React components should generally stay as React. Use `registerReactComponent` for component re-rendering in the visual editor:

```typescript
import { registerReactComponent } from "@cloudcannon/editable-regions/react";
import Announcement from "@/components/Announcement";

registerReactComponent("announcement", Announcement);
```

To make nested content editable within a React component, you may need to refactor it slightly so there are suitable elements to attach editable attributes or web components to. The component handles overall re-rendering via `registerReactComponent`, but inner text, images, etc. should still be individually editable where possible.

**Hydration gotcha.** Content inside a React island's hydrated DOM can be overwritten when React rehydrates. If an editable region modifies static server-rendered HTML but React then re-renders and replaces that DOM with its own output, the editor's changes appear to do nothing. Factor this into refactoring decisions -- content controlled by React state may not be a good candidate for inline editable regions.

#### Editing fallbacks (Vue, Svelte, Solid, or complex components)

An editing fallback is a display-only `.astro` component that visually resembles the real component and supports editable attributes. It gives editors a representative preview they can edit inline -- it doesn't need interactivity or the original framework. The live site still uses the real component; only the visual editor renderer is swapped.

```astro
<!-- src/layouts/helpers/AnnouncementDisplay.astro -->
---
const { enable, text, link_text, link_url } = Astro.props;
---
{enable && text && (
  <div class="announcement-banner">
    <p>{text} {link_text && link_url && <a href={link_url}>{link_text}</a>}</p>
  </div>
)}
```

```typescript
// registerComponents.ts
import AnnouncementDisplay from "@/layouts/helpers/AnnouncementDisplay.astro";
registerAstroComponent("announcement", AnnouncementDisplay);
```

```astro
<!-- Base.astro — live site uses the real component -->
<editable-component data-component="announcement" data-prop="@data[announcement]">
  <Announcement client:load {...announcementData} />
</editable-component>
```

**When to use an editing fallback:**

- Vue, Svelte, or Solid components that can't be converted to `.astro`/React
- Components using third-party DOM libraries (Swiper, GSAP, etc.)
- Web Components with shadow DOM that don't serialize cleanly
- Any component where the live-site version is too complex for the editor to re-render directly

**Keep the editing fallback in sync.** The fallback duplicates markup, so changes to the real component's visual structure need to be mirrored. Keep both in the same directory and name them clearly (e.g. `Announcement.vue` + `AnnouncementDisplay.astro`).

### Wrapping with web components

Component editable regions need a wrapper element with `data-component` and `data-prop` attributes. When there is no suitable existing container element, use the `<editable-component>` web component provided by the library rather than adding an unnecessary `<div>`:

```astro
<editable-component data-component="announcement" data-prop="@data[announcement]">
  <Announcement client:load {...announcementData} />
</editable-component>
```

The `<editable-component>` custom element self-hydrates via `connectedCallback`/`disconnectedCallback` -- no `data-editable="component"` attribute is needed since the tag itself identifies the region type. The same idea applies to **text and image** primitives: when you would add a wrapper only for `data-editable`, use `<editable-text>` / `<editable-image>` instead of a generic `<span>` / `<div>` (see [Text editing](#text-editing) and [Image editing](#image-editing)). For **component** regions specifically, prefer `<editable-component>` over an extra wrapper `<div data-editable="component">` when no suitable container exists.

If a suitable container already exists in the markup (e.g. a `<section>` wrapping the component output), add `data-editable="component"` directly to that element instead.

**For array items**, use `<editable-array-item>` instead of `<editable-component>` when you need a web component wrapper. `<editable-array-item>` can also carry `data-component` for re-rendering — see [Page builder blocks](#page-builder-blocks).

**Caveats:**

- Astro components that use `astro:content` or `astro:assets` imports need the integration's Vite plugin (which shims these modules for client-side rendering)
- React components inside registered Astro components (e.g. `react-icons`) need the React framework renderer. Add `import "@cloudcannon/editable-regions/astro-react-renderer"` to `registerComponents.ts` -- this is a side-effect import that registers a catch-all React renderer for the editable-regions client-side re-rendering pipeline (it mirrors Astro's SSR renderer interface but runs entirely within the editor). Without it, any React component encountered during re-rendering will fail with "NoMatchingRenderer". Because its `check` function unconditionally returns `true`, it acts as a fallback for all unmatched components -- import it after any other framework renderers
- The React framework renderer only covers React -- there are no equivalent renderers for Vue, Svelte, or Solid. These frameworks will always error in editable regions and must be converted or given editing fallbacks
- **Prop-driven re-renders:** Registered components re-render in the browser with the props CloudCannon passes. `astro:content` is shimmed, so `getCollection`/`getEntry` calls inside registered components work. What does NOT re-run is parent page-level logic — top-level `fetch` in `.astro` frontmatter, layout-level data loading, etc. If the component needs data the parent normally fetches, pass it via props. Use `ENV_CLIENT` fallbacks only for genuinely server-only APIs like `getImage` ([What to make editable vs. what to leave for the sidebar](#what-to-make-editable-vs-what-to-leave-for-the-sidebar)).
- **Runtime `fetch()` in islands:** Not blocked by editable-regions, but preview iframes often differ from production (CORS, auth cookies, relative URLs). Test in the visual editor if the UI depends on it.

Text/image editable regions provide the most value with the least complexity. Component registration is the next step for templates where full live preview is a priority.

## How the Astro integration works

Understanding the integration internals helps when debugging unexpected behavior.

**Build-time** (`@cloudcannon/editable-regions/astro-integration`):

An Astro integration that registers a Vite plugin for the client build. The plugin:

1. Sets `ENV_CLIENT = true` for tree-shaking server-only code. **Important:** this only applies to the editable-regions client bundle, not the normal production build. Code guarded with `import.meta.env.ENV_CLIENT` in `.astro` template expressions still runs normally (with `ENV_CLIENT` undefined/false) in the production SSR output. For initial-render concerns (like hiding animation classes), use `.cms-editor-active` CSS overrides instead
2. Patches Astro's `astro:build` Vite plugin to force SSR transforms on client code -- this is what makes `renderToString()` work in the browser
3. Adds `vite-plugin-editable-regions` which intercepts `astro:*` virtual module imports and resolves them to local shims:
   - `astro:content` -> client-side shim
   - `astro:assets` -> client-side shim
   - `astro:env/server` -> client-side shim

Without this, Astro components that import from `astro:content` or `astro:assets` would fail to bundle for the client.

**Runtime** (`@cloudcannon/editable-regions/astro`):

`registerAstroComponent(key, AstroComponent)` creates a wrapper function that:

1. Constructs a fake Astro `SSRResult` (with renderers, metadata, crypto key for server islands, slot handling, etc.)
2. Calls Astro's `renderToString()` in the browser with the new props
3. Parses the resulting HTML into a document fragment
4. Triggers any queued client-side renders (e.g. React islands use `data-editable-region-csr-id`)
5. Strips Astro scaffolding (`<astro-island>`, `<link>`, server island metadata)
6. Returns the clean HTML element

The wrapper is stored in `window.cc_components[key]` where `EditableComponent` can find it.

## Schema file gates prop forwarding on re-render

When `@cloudcannon/editable-regions` re-renders a registered component inside the visual editor, the **schema file** (`.cloudcannon/schemas/<collection>.md`) determines which frontmatter fields are forwarded as props. Fields that exist in the entry's frontmatter and parse cleanly through the Astro/Zod content schema are still **stripped from props on re-render** if they are not declared in the CC schema's frontmatter shape. This applies to nested fields too — declaring a key at the top level of the schema is not enough if the section reads it from a nested object.

Don't add a hidden `_input` in `cloudcannon.config.yml` and expect the field to flow through — `_inputs` control how fields render in the sidebar UI; they have no effect on which fields are forwarded to a re-rendered editable-region component. The schema file is the gate.

### Symptom → diagnosis

The component renders correctly in `astro build` output but is missing data inside the visual editor:

1. Log `Object.keys(Astro.props)` from inside the component frontmatter and view it in the editor preview (console logs aren't reachable from inside the iframe).
2. Compare the surviving keys against the section's frontmatter on disk. Stripped keys are the diagnostic.
3. Open the relevant schema file in `.cloudcannon/schemas/`. The stripped keys will be absent from the schema's frontmatter shape (or absent from the relevant nested object).
4. Add the missing keys with sensible default values. Reload the editor — they appear in props immediately, no save/rebuild required.

### Concrete example

Entry `src/content/pages/home.md`:

```yaml
postsSection:
  categorySlug: news # used by the component to filter posts
  heading: Latest News
  intro: ...
```

Component `PostsListing.astro` reads `categorySlug` from `Astro.props`. In the visual editor, `Astro.props` contained only `heading` and `intro`; `categorySlug` was missing.

- ❌ Did not help: declaring `postsSection.categorySlug` as a hidden `_input` in `cloudcannon.config.yml`.
- ✅ Fixed it: adding `categorySlug: ""` inside the `postsSection:` block in `.cloudcannon/schemas/page.md`.

### Debug snippet

Drop this at the top of a section component, reload the editor, and read off which keys survived:

```astro
---
const debug = { allPropKeys: Object.keys(Astro.props), allProps: Astro.props };
---
<pre style="background:#fffbe6;border:2px solid #f59e0b;padding:12px;font-size:12px;white-space:pre-wrap;word-break:break-all;">
{JSON.stringify(debug, null, 2)}
</pre>
```

If a key is missing, the schema file is the place to fix it.

## Troubleshooting — why isn't my field live-updating?

| Symptom                                                                                                                                                                             | Diagnosis & fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React island shows error state in editor                                                                                                                                            | Open editor iframe dev tools → console. Errors are almost always: (a) `fetch` failing because there's no server, (b) missing required field, (c) hydration mismatch.                                                                                                                                                                                                                                                                                                                                                           |
| Slug change in a `reference()`-backed array doesn't update the card's name/image in the editor                                                                                      | `await getEntry(ref)` resolves at build time — CC can't re-resolve refs client-side. Mitigations: (a) wrap parent section in `<editable-component>` to re-render on array change; (b) restructure items to carry inline-editable fields alongside the ref.                                                                                                                                                                                                                                                                     |
| Field's rendered output is a template expression (icon SVG lookup, conditional class, `set:html` result)                                                                            | Primitive `data-editable="text"` updates DOM text only — it can't re-run the expression. Wrap the section root in `<editable-component>`.                                                                                                                                                                                                                                                                                                                                                                                      |
| Value comes from a shared data file via an import or lookup                                                                                                                         | Lookups bake at build time. Fix: (a) read the lookup inside a registered component with `<editable-component>` wrapper; or (b) use `data-prop="@data[<key>].dotted.path"`. Do not use `data-editable="source"`.                                                                                                                                                                                                                                                                                                                |
| `data-prop` not resolving / shows blank in editor / data-driven re-render doesn't fire                                                                                              | `data-prop` paths resolve via `CloudCannon.currentFile()` against the markdown source mapped through the collection's `url` config — not against `Astro.props`. Check: (a) route `url` in `cloudcannon.config.yml` matches the collection; (b) field path exists in the markdown frontmatter; (c) a parent `data-editable` ancestor exists; (d) `data-component` value exactly matches the key in `componentMap.ts`.                                                                                                           |
| Sidebar field (switch/dropdown) doesn't trigger a re-render OR `Cannot destructure property 'x' of 'n.props' as it is undefined` — text editables on the same component update fine | Two possible causes: (1) **Schema flat-fields** — scattered fields with `propPrefix=""`. Fix by nesting under one frontmatter key (see [§Nested frontmatter](#scattered-fields-feeding-a-registered-component--nest-the-frontmatter)). (2) **Standalone self-marking** — component rendered directly from a page template has `data-editable="component"` on its own root. Fix by using `<editable-component>` at the call site (see [§Registration placement](#where-does-the-registration-go--component-root-or-call-site)). |
| Multiselect of refs renders nothing or all — selection appears not to work                                                                                                          | `reference()` fields are `{collection, id}` objects at runtime, not strings. Comparing `entry.id === ref` is string-vs-object → always false. Fix: use `getEntry(ref)` for one ref, or `entry.data.x.some(r => r.id === currentId)` for membership. Type Props as `{collection: string; id: string}[]`, never `string[]`.                                                                                                                                                                                                      |
| Multiselect appears to work but selection is ignored — same output regardless of what's selected                                                                                    | Component has an `if (length === 0) showAll` fallback. Combined with a ref-comparison bug, the filtered array always empties and the fallback always fires. Remove the fallback. Empty array = render nothing. Seed defaults in `.cloudcannon/schemas/<collection>.md`.                                                                                                                                                                                                                                                        |
| Component renders correctly in `astro build` but a field is missing from `Astro.props` in the visual editor                                                                         | The CC schema file (`.cloudcannon/schemas/<collection>.md`) gates which frontmatter fields are forwarded on re-render. Fields absent from the schema shape are stripped from props, even if they parse cleanly through the Zod content schema. A hidden `_input` in `cloudcannon.config.yml` does NOT fix this. Add the missing key (with a sensible default) inside the correct nested object in the schema file. See [§Schema file gates prop forwarding](#schema-file-gates-prop-forwarding-l53).                           |

## Scroll-reveal and entrance animations

Many templates start elements hidden (`opacity: 0`, `transform: translateY(...)`, `visibility: hidden`) and reveal them with JS (IntersectionObserver, scroll listeners) or CSS animation classes. Common class names: `reveal`, `animate-on-scroll`, `aos-*`, `fade-in`, `scroll-fade`.

**Why this breaks in the visual editor:** CloudCannon replaces DOM nodes when re-rendering registered components. New nodes get the hidden CSS but not the JS-applied "active" class that makes them visible. The reveal JS typically only runs on page-load events (`astro:page-load`, `DOMContentLoaded`), not on editor re-renders. Symptoms:

- Blocks fade away on initial visual editor load
- All content disappears after editing a field that triggers component re-render
- Multiple blocks vanish when editing one block

**Fix (primary): CSS override using `.cms-editor-active`.** CloudCannon automatically adds the `.cms-editor-active` class to `<body>` when a page loads inside the Visual Editor ([docs](https://cloudcannon.com/documentation/developer-articles/detecting-your-site-is-loaded-in-the-visual-editor/)). Override the hidden state in global CSS:

```css
/* Force reveal elements visible in the CloudCannon editor */
.cms-editor-active .reveal {
  opacity: 1;
  transform: translateY(0);
  transition: none;
}
```

This is the most reliable approach: pure CSS, no timing issues, works on initial page load and after component re-renders. Adapt the selector to match whatever class the template uses (`.reveal`, `.aos-animate`, `.animate-on-scroll`, etc.).

**Fix (supplementary): `ENV_CLIENT` guard in component code.** For the editable-regions client bundle (component re-renders), you can also skip the hidden class at render time:

```astro
<!-- WidgetWrapper.astro or equivalent -->
<div class:list={[{ reveal: animate && !import.meta.env.ENV_CLIENT }]}>
  <slot />
</div>
```

`ENV_CLIENT` is only `true` in the editable-regions client bundle — it does NOT affect the initial production HTML. The CSS override above handles the initial render; this guard prevents the class from appearing in re-rendered component output.

**Inline `<script>` runtime checks.** For animation JS in inline `<script>` tags (e.g. `IntersectionObserver` setup), use `window.inEditorMode`:

```javascript
if (window.inEditorMode) {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("active"));
  return;
}
```

For the full detection-mechanism reference, see [editable-regions-internals.md § Detecting the Visual Editor](../editable-regions-internals.md#detecting-the-visual-editor).

**Audit flag:** During the audit phase, flag any scroll-reveal or entrance animation patterns. Search for `opacity: 0` in CSS, `IntersectionObserver` in JS, and common class names like `reveal`, `aos`, `animate-on-scroll`. Note the file(s) responsible so they can be patched in the visual editing phase.

## Module compatibility in the editable-regions client bundle

The `editableRegions()` integration builds a client bundle that re-renders registered components in the browser. Most modules work without special handling. Here's how different module types are resolved:

**Shimmed `astro:*` modules** — editable-regions provides browser-safe shims for `astro:content`, `astro:assets`, and `astro:env/server`. Components importing from these work automatically. Without the integration, these imports would fail in the client bundle.

**Other `astro:*` modules** — Modules like `astro:actions`, `astro:transitions`, `astro:i18n`, `astro:middleware`, and `astro:env/client` are not shimmed by editable-regions, but they aren't blocked either. The resolver passes them through to Astro's own Vite plugins, which handle them normally.

**Third-party virtual modules** — Modules like `virtual:astro-icon` are not intercepted by editable-regions at all (its resolver only handles `astro:*` prefixed imports). They're resolved by their own Vite plugins in the same build pipeline. As long as the emitted module is browser-safe (no Node APIs in the output), these work fine. Most Vite virtual modules emit static data or pure JS at build time, so this is the common case.

**What doesn't work** — Components that use Node-only APIs at runtime (filesystem access, `process.env`, native binaries) will fail in the browser context. Vue, Svelte, and Solid components don't have renderers (only React has one via `astro-react-renderer`). These need editing fallbacks — see [When to use an editing fallback](#when-to-use-an-editing-fallback).

**Runtime shims provided by editable-regions:**

- `Astro.props` — passed through from CloudCannon's prop data
- `Astro.slots` — shimmed with `has()` and `render()` via `renderSlotToString`
- `Astro.request` — shimmed as `new Request(window.location.href)` (one new instance per `createAstro` call)

### `astro-icon`

`astro-icon` is a common example of a third-party virtual module that works. Register components using `<Icon>` normally — no editing fallbacks needed.

`virtual:astro-icon`'s Vite plugin emits serialized JSON (icon SVG collections) at build time. `@iconify/utils` is pure JS. `Astro.request` is shimmed. The entire chain is browser-safe.

**Sprite dedup quirk:** `Icon.astro` uses `Astro.request` as a `WeakMap` key for sprite deduplication. Since editable-regions creates a new `Request` per component, every icon renders its full `<symbol>` instead of reusing with `<use href>`. This only affects the visual editor preview and is cosmetically irrelevant.

**Build-time issues** (astro-icon specific, not related to editable-regions):

1. **Missing `src/icons/` directory** — `astro-icon` always tries to load a `local` icon set from `src/icons/`. If the directory doesn't exist, the build fails with `Unable to load the "local" icon set!`. Fix: create an empty `src/icons/` directory.
2. **Empty icon props in `<template>` blueprints** — Astro renders `<template>` element contents server-side. If a blueprint passes an empty icon name to a component that uses `<Icon>`, the build fails with `Unable to locate "" icon!`. Fix: guard `<Icon>` rendering on a truthy name:

```astro
{icon && <Icon aria-hidden="true" name={icon} />}
```

This applies to any component rendered inside a `<template>` array blueprint where prop values may be empty.
