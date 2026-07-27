# Content (Astro)

> **Checklist discipline:** This doc ends with a [Review checklist addendum](#review-checklist-addendum). Work through the review checklist items as you go, then verify the addendum before marking this phase complete.

Guidance for reviewing and restructuring content files to be CMS-friendly in an Astro site. Run this phase after configuration (Phase 2). Small, targeted content fixes needed to support configuration decisions (adding `slug` fields, normalizing values) can happen during Phase 2 — see [../SKILL.md § Phases are sequential, not siloed](../SKILL.md).

## When to skip this phase

If the audit shows content is already well-structured -- consistent frontmatter, clean markdown, no unusual extensions in content bodies -- skip content changes and just document the patterns. Not every migration needs file edits.

## Review checklist

Work through these checks for every migration. Document findings even when no changes are needed.

### Astro template artifacts in extracted content

When extracting hardcoded data from `.astro` templates into content frontmatter, check for Astro JSX expression artifacts like `{""}`, `{"</>"}`, or similar sequences that leaked from the template syntax. These are meaningless in YAML content and should be stripped to plain text. Search content files for `{"` to catch them.

### Frontmatter consistency

For each collection, compare content files against the Zod schema in `content.config.ts` using these rules:

#### Required fields present in every file

Every required field in the Zod schema appears in every content file. Missing required fields fail schema validation and break the build.
**Fix:** Add the field to content files, or make the schema `.optional()` / `.nullish()`. Prefer matching what the schema expects.

#### Optional fields with defaults

If a field has `z.default(...)` and is commonly used, add it explicitly to content files. Astro fills in defaults at runtime. CloudCannon editors see what's in the file, not the runtime default — an editor opening a file with no default sees an empty input.

#### `draft` field

If the site filters on `draft`, include `draft: false` explicitly on published content. `!data.draft` treats missing as `false` (safe at runtime), but CloudCannon's UI benefits from a visible toggle.

Collections with a `draft` field default to the content editor — `editor: content` on add options, or `_enabled_editors` starting with `content`. Draft pages aren't built, so the visual editor has no page to preview. The content editor doesn't require a built page.

#### Date formats

Use ISO 8601 (`2022-04-04T05:00:00Z`). Astro's `z.coerce.date()` handles both Date objects and ISO strings, but CloudCannon expects consistent formatting.

#### Image paths

| Image location            | Frontmatter path                                  | Note                                             |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `public/` (static)        | Relative to public root: `/images/banner.png`     | Served as-is via plain `<img>`.                  |
| `src/assets/` (optimized) | Full repo-relative: `/src/assets/images/hero.jpg` | So `import.meta.glob` can resolve at build time. |

Don't move optimized images from `src/assets/` to `public/`. See [configuration.md § Image path configuration](../../cloudcannon-configuration/astro/configuration.md#image-path-configuration) for the full upload path setup.

### Field naming

- Match the existing component prop names. If components use `imageAlt`, use `imageAlt` in frontmatter — not `image_alt`. This avoids translation layers in components. When creating new fields with no existing convention, prefer `snake_case`.
- Avoid name collisions with CloudCannon reserved keys (e.g. `_inputs`, `_structures`, `_schema`).
- Keep field names descriptive and consistent across collections (e.g. always `image`, not sometimes `image` and sometimes `thumbnail`).

### Index files and the `-index` convention

Some Astro templates use a `-index.md` file to hold listing/index page metadata (title, description, image for the `/blog` listing page, for example). This pattern works by:

1. The glob loader in `content.config.ts` picks up all `.md` files including `-index.md`
2. A helper like `getSinglePage()` filters out IDs starting with `-` (so `-index` never appears as a regular item)
3. A helper like `getListPage(collection, "-index")` fetches it by exact ID for listing page metadata

**Migration action:** Rename `-index.md` to `index.md` in every collection that uses this convention and refactor the helpers accordingly:

1. **Rename the files.** Run the rename script to handle this automatically:
   ```bash
   bash skills/migrating-to-cloudcannon/scripts/rename-dash-index.sh .
   ```
2. **Update `getSinglePage()`** to filter on `id === "index"` instead of `id.startsWith("-")`.
3. **Update `getListPage()` callers** from `"-index"` to `"index"`.

**Why `index`:** CloudCannon's `[slug]` placeholder collapses `index` to an empty string. A collection with `url: "/blog/[slug]/"` produces `/blog/` for `index.md` and `/blog/my-post/` for `my-post.md`. This means the index page gets the correct listing URL without any special-case URL config.

**CloudCannon implications:** The index file stays in the same collection as its siblings -- no separate collection or filter needed. In Phase 2 (configuration), define a separate schema on the collection for the index page so editors get the right fields when editing it vs. a regular item. See the "Schemas for index pages" section in configuration.md.

### Mixed-type fields

Some templates use fields with mixed types (e.g. `price` is a string `"Free"` for some items and an object `{monthly, annual}` for others). CloudCannon's data editor works best with consistent types. If the template only uses one branch of the type (e.g. only displays `price.monthly` from the object), simplify to a single type in the content files (e.g. always a string). Update the rendering code to match.

### Content references (string-based)

Some templates reference related content by string rather than by collection ID. For example, blog posts might use `author: "John Doe"` where the matching is done by slugifying the name and comparing to author filenames.

This works but is fragile -- renaming an author breaks the link. In Phase 2, configure CloudCannon's select input for these fields so editors pick from a list of valid values rather than typing freeform.

No content file changes are needed for this pattern.

### Markdown content body

Check for:

- **MDX components and shortcodes** -- auto-imported components or explicit `import` statements in `.mdx` files. CloudCannon's editors can't render these but can parse and re-serialize them if snippet configs are defined. Document which files use them, note each component's props, and whether `client:load` is used. This inventory feeds directly into the snippet configuration in Phase 2. See the `cloudcannon-snippets` skill for the full workflow.
- **Inline HTML that has no markdown equivalent** -- HTML blocks like `<figure>`, `<video>`, `<details>`, `<iframe>` can't be expressed in standard markdown syntax. These must become snippets so editors get a structured interface instead of raw HTML. For each pattern identified in the audit: (1) normalize all instances to a consistent format (same attributes, same whitespace), (2) document the normalized pattern in the project's migration notes. The snippet config itself is created in Phase 2 -- see [snippets.md § Raw snippets for inline HTML](../../cloudcannon-snippets/snippets.md#raw-snippets-for-inline-html-in-md-files). Simple inline HTML that editors don't need to modify (e.g. `<sup>`, `<br>`) can be left as-is.
- **Complex embedded HTML** with `set:html` directives in the rendering template may not round-trip cleanly. Usually not an issue for content bodies.
- **Empty content bodies.** Index files and section data often have no body content (all data lives in frontmatter). This is normal and CloudCannon handles it fine.
- **Remark/rehype plugin output.** If custom remark or rehype plugins transform markdown in ways that affect the content structure (e.g. adding IDs to headings, wrapping images), note them but don't change the content. The plugins run at build time.

### Handling styled HTML in frontmatter

**Rule — markdown fields:** Markdown content fields (`type: markdown` inputs) must be plain markdown or plain HTML without class attributes. Class attributes, inline styles, and arbitrary attributed HTML collapse into uneditable snippet chips in CloudCannon's rich-text editor — authors can't click into the element to edit link text or URLs.

❌ `<a href="/x" class="text-primary font-medium">text</a>` (becomes an uneditable chip)
✅ `<a href="/x">text</a>` with styling in CSS targeting the rendered prose container
✅ `[text](/x)` plain markdown link

Preserve inline HTML with CSS classes, entities, or responsive markup in frontmatter verbatim. CloudCannon's visual editor renders unknown HTML classes with red outlines and can't interact with them.
**Rule:** Frontmatter stores content; components own presentation.

Pick the option that matches the source pattern (preference order top → bottom):

| Source pattern                                                                                                              | Approach                                 | How                                                                                                                                                                                                                                                                                                                             | When                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Inline text styling (highlighted/accented text, brand emphasis) — e.g. `<span class="text-accent">Astro 5.0</span>`         | `type: html` input + editor styles CSS   | Configure input as `type: html` with `options.styles: .cloudcannon/styles/editor.css`. Define semantic classes (`span.highlight-text { ... }`) in the stylesheet. Component renders with `set:html`. Editors toggle styles in the toolbar like bold/italic. Strip Tailwind utilities and replace with the semantic class names. | Any styling expressible as a CSS class. Preferred default. See [Jetstream](https://github.com/CloudCannon/jetstream-astro-template). |
| Fixed-structure multi-part text — e.g. `Graphic Designer <br /> <span>ABC Studio</span> <br /> <span>2021 - Present</span>` | Decompose into structured sub-fields     | Split into `job_title`, `company`, `date_range`. Template each segment in the component.                                                                                                                                                                                                                                        | Each segment has distinct semantic meaning.                                                                                          |
| Line-separated list items (`<br />` between entries)                                                                        | Convert to HTML list or array of strings | Either `<ul><li>...</li></ul>` in a `type: html` field with `allow_custom_markup: true`, OR an array of strings in a plain text field.                                                                                                                                                                                          | Content is semantically a list. (In a rich text field, `<br />` is fine as a line break — only convert when it's a list.)            |
| Responsive layout HTML — e.g. `<br class="block sm:hidden" />`, `&nbsp;`                                                    | Strip the HTML                           | Store plain text. Handle responsiveness in CSS or component logic.                                                                                                                                                                                                                                                              | Always — layout concerns don't belong in content.                                                                                    |

### Page-builder content migration

Every field from a block's structure `value` appears in content frontmatter, even if empty. See [structures.md § Mandatory rules](../../cloudcannon-configuration/structures.md#mandatory-rules-read-first). The visual editor throws `undefined` errors when editable regions reference fields missing from frontmatter. Getting this right now avoids a backfill step later.

#### Extraction pattern (per block)

1. Identify the block's `_type` from the original hardcoded page.
2. Look up the structure definition (`cloudcannon.config.yml` under `_structures.content_blocks`, or the co-located `*.cloudcannon.structure-value.yml` file).
3. Copy the full field list from the structure `value`.
4. Populate fields that have content from the original page.
5. Leave remaining fields at their default/empty values (strings empty, booleans `false`, arrays `[]`, objects with empty nested fields).

#### YAML quoting

Quote strings containing HTML (`<span class="...">`, `<br />`) or YAML special characters (`:`, `#`, `{`). Unquoted strings with `:` or `#` parse as mappings or comments, corrupting the value.
**How:** Use `>-` for multiline strings, or double quotes with escaped inner quotes.

#### Field completeness at scale

Cross-reference each block against its structure definition systematically — don't work from memory. With 15+ block types, it's trivial to forget fields on one or two blocks, and the failure mode (`undefined` in the visual editor) only surfaces when editors open that specific block.

#### Build early, build often

Don't extract all pages before running a build. Schema mismatches and guard issues compound as pages accumulate. Extracting a few representative pages first, building, fixing errors, then extracting the rest catches problems once instead of repeatedly.

#### Null values in YAML

Use `.nullish()` on optional Zod fields, not `.optional()`. Bare YAML keys (`tagline:`) parse as `null`. `.optional()` accepts `undefined` but rejects `null`, so content files with empty fields fail validation and `z.union` silently falls through to a non-page-builder schema — stripping `content_blocks` from the data.
**See:** [structures.md § Handling null values from empty YAML fields](../../cloudcannon-configuration/structures.md#handling-null-values-from-empty-yaml-fields).

### Astro slot content → frontmatter field

When an Astro component receives rich content via a `<slot />` (e.g. `<Content2>` receiving a `<Fragment>` with headings and paragraphs), this content must become a frontmatter field for CMS editing. The pattern:

1. **Add a `content` prop** to the component alongside the slot. Render it with `set:html` when populated, falling back to the slot for backward compatibility:
   ```astro
   const slotContent = Astro.props.content || await Astro.slots.render("default");
   // ...
   {slotContent && <div set:html={slotContent} />}
   ```
2. **Add the field to the structure** with `type: html` and `allow_custom_markup: true`.
3. **In content files**, put the HTML string in the `content` YAML field using `>-` for multiline.

**One field per visual slot:** When a component shows `propA || propB` (e.g. `subtitle || description`), two fields feed the same visual slot. In the CMS structure, keep only one field for that slot. Pick one name and use it everywhere — the structure, the Zod schema, the content files, and the component.

Decide which to keep:

- If the two fields have no semantic distinction (description is just an alias for subtitle), remove one. Use the name that best describes what the editor sees.
- If the fallback serves a genuinely different purpose (e.g. `description` is also used for page meta/SEO), keep both but rename to make the distinction obvious: `subtitle` for the visual slot, `meta_description` for SEO. Add a `comment` on the SEO input explaining its purpose.

The goal: every field in the data panel corresponds to exactly one thing on the page, and every inline editable's `data-prop` points to a field that exists in the structure. See [visual-editing-reference.md § Data-prop mismatch](../../cloudcannon-visual-editing/astro/visual-editing-reference.md#page-builder-blocks) for the related visual editing guidance when a shared component renames the prop.

### Resolving optimized image paths from frontmatter

When components receive image paths as strings from frontmatter (e.g. `/src/assets/images/hero.jpg`) but need `ImageMetadata` for `<Image>` or `<Picture>`, use `import.meta.glob` to resolve them at build time. Reference: [CloudCannon astro-minimal-starter `left-right.astro`](https://github.com/CloudCannon/astro-minimal-starter/blob/main/src/components/left-right/left-right.astro).

```astro
---
import type { ImageMetadata } from "astro";
import { Picture } from "astro:assets";

const { image, imageAlt } = Astro.props;

const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/**/*.{jpeg,jpg,png,gif,svg,webp,avif}",
  { eager: true },
);
const imageSrc = typeof image === "string"
  ? (images[image]?.default ?? image)
  : image;
---

{imageSrc && <Picture src={imageSrc} alt={imageAlt} widths={[400, 800]} />}
```

Key points:

- `{ eager: true }` resolves at build time (no async)
- The `typeof` check handles components whose prop type allows both `ImageMetadata` and `string` (common in templates with dual static/optimized support)
- The `?? image` fallback handles external URLs or `public/` paths gracefully
- Works with `<Image>`, `<Picture>`, or any `astro:assets` component
- Frontmatter stores the full repo-relative path (`/src/assets/images/...`) — this matches the `import.meta.glob` pattern

When migrating a component that originally used `import` statements for images (e.g. `import heroImg from "@/assets/images/hero.jpg"`), replace the import with this glob pattern so the image path can come from CMS-editable frontmatter instead of hardcoded imports.

### Flattening folder-per-post content

Flatten folder-per-post content (`blog/my-post/index.md`) to flat files (`blog/my-post.md`) unless the folder structure encodes meaningful grouping beyond the slug. CC's `[slug]` placeholder resolves to an empty string when the filename is `index`, forcing `slug` frontmatter + `{slug}` data placeholder workarounds. Flat files let Astro auto-generate slugs from the filename and CC's `[slug]` works natively.

**Checklist before flattening:**

1. **Check for sibling assets** — images or other files co-located in the post's directory. Move images to `src/assets/images/` (preserving Astro's image optimization) and other static files to `public/`. Update references accordingly — imported images use the new `src/assets/images/` path, static files use absolute paths from `public/`.
2. **Check for relative imports in MDX** — components imported with `./component.astro` paths. Move them to `src/components/` and set up `astro-auto-import` so they're available without explicit imports.
3. **Rename files** — `dir/index.md` becomes `dir.md`. Remove the now-empty directories.
4. **Remove `slug` frontmatter** — no longer needed since the filename provides the slug.
5. **Update CC config** — switch URL patterns from `{slug}` to `[slug]`.

When the folder structure encodes meaningful grouping beyond the slug, keep folder-per-post and use the `{slug}` workaround in [configuration-gotchas.md](../../cloudcannon-configuration/astro/configuration-gotchas.md#folder-per-post-content-and-cc-url-placeholders).

### Converting API-driven content to local collections

Convert build-time API fetches (JSONPlaceholder, headless CMS, REST endpoints) to a local content collection during migration. API-fetched content is invisible to CloudCannon — editors can't manage it.

**Steps:**

1. Create the collection directory (e.g. `src/content/blog/`) with sample markdown files matching the API's data shape
2. Add a collection definition to `content.config.ts` with a Zod schema covering the fields the templates use
3. Refactor page routes that called `fetch()` to use `getCollection()` / `getEntry()` + `getStaticPaths()`
4. Refactor components that also fetched from the API (listing components, launchers, search)
5. Remove the API URL from environment variables / config

**Sample content:** 6+ posts for a typical blog with `pageSize: 6`, enough to test pagination and listing pages. Thematically appropriate beats lorem ipsum for demos.

Ensure route params match content collection IDs (`params: { post: post.id }`). API-driven pages often have custom slug logic (truncation, transliteration) that differs from filename-derived IDs. Mismatched params produce 404s on migrated routes.

### Extracting TypeScript config to JSON data files

Extract editor-facing settings (navigation, social links, colors, CTAs) from TS config files to JSON data files in `src/data/`. CloudCannon can't edit TypeScript — editors lose access to settings locked inside `.ts` files.

| Keep in TS config                                     | Move to JSON data file                     |
| ----------------------------------------------------- | ------------------------------------------ |
| Asset imports (`import logo from '...'`)              | Navigation, social links, CTAs             |
| Computed values                                       | Label text, icon names, color scheme names |
| Framework-specific settings (CSS var mappings, flags) | Any value an editor should control         |
| Anything referencing other TS modules                 |                                            |

**Steps:**

1. Identify which config values editors should control vs. developer-only
2. Create JSON files in `src/data/` for each editable group (e.g. `navigation.json`, `social-links.json`)
3. Update consuming components to import from the JSON files
4. Strip extracted values from the TS config (set to empty defaults)
5. Add `data_config` entries and `file_config` with appropriate `_inputs` and `_structures` in the CC config

After extraction, audit the consuming component template for hardcoded values (icons like `lucide:rocket`, colors, link targets, label text, image paths) and move those into the data file too. Editors lose access to any visible value the template hardcodes, even if the original TS config didn't expose it. Extraction is the opportunity to fix this — if an editor can see it and it could reasonably vary, it belongs in the data file.

### Data collections

Data collections hold content that doesn't build its own page. They can live inside `src/content/` (Astro content collections) or outside it (standalone JSON/YAML files exposed via `data_config`). The deciding factor is purpose, not location:

| Content usage                                                             | Pattern                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| Builds its own page (blog post, service page)                             | Page collection with a `url` pattern             |
| Used on one page only (homepage hero)                                     | That page's frontmatter — no separate collection |
| Used across multiple pages (navigation, social links, testimonials, tags) | Data collection                                  |

Set `disable_url: true` on data collections. They don't produce pages; without this, CC attempts a URL and breaks the Visual Editor.

**Verify the data files:**

- JSON/YAML is valid and well-formatted
- Nested structures aren't so deep that CloudCannon's editor becomes unwieldy (3+ levels of nesting is a flag)
- Arrays of objects either have consistent shapes or are backed by structures definitions for each shape

## Review checklist addendum

Run this checklist on every content file before marking the content phase complete.

- [ ] **Field completeness (CRITICAL):** Every block in `content_blocks` includes ALL fields from its structure definition — cross-reference field-by-field against [structures.md § Mandatory rules](../../cloudcannon-configuration/structures.md#mandatory-rules-read-first). Common misses: `tagline`, `content`, `subtitle`, and nested sub-keys like `callToAction.variant`.
- [ ] Fields not present in the original page are set to empty/default values (strings empty, booleans `false`, arrays `[]`).
- [ ] Frontmatter strings contain no block-level HTML (`<br />`, `<p>`, `<ul>`) unless the matching `_inputs` entry uses a rich-text or markdown input.
- [ ] Every array inside a structure-value file links to its `_structures` entry via an explicit `_inputs` block. (Canonical rule: [structures.md § Mandatory rules](../../cloudcannon-configuration/structures.md#mandatory-rules-read-first).)
- [ ] For each JSON data file, every visible/configurable value (icons, link targets, label text, image paths) the editor would reasonably change lives in the data file — not hardcoded in the component template.
