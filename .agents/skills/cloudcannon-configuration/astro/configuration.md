# Configuration (Astro)

> **Checklist discipline:** This doc ends with a [Verification checklist](#verification-checklist). Read it now so you know what to aim for, then work through every item before marking this phase complete.

Guidance for creating and configuring `cloudcannon.config.yml` and `.cloudcannon/initial-site-settings.json` for an Astro site.

## Baseline generation with the CloudCannon CLI

Use the CloudCannon CLI to generate a baseline configuration. Run subcommands individually to cross-reference against the Phase 1 audit. See [../cloudcannon-cli-guide.md](../cloudcannon-cli-guide.md) for the full CLI reference and all available commands.

```bash
npx @cloudcannon/cli configure generate --auto --initial-build-settings --ssg astro
```

**When the CloudCannon CLI is unavailable** (sandbox network restrictions, version incompatibility, etc.), write the config manually using the audit findings. Follow the same review and customization checklists below — the CloudCannon CLI is a time-saver, not a prerequisite.

## Review the generated config

After generation, check `cloudcannon.config.yml` against this table:

| Key                  | Rule                                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`             | **Omit for typical Astro sites.** Remove it if the CLI wrote one.                                                                | Deployment-specific (monorepos). CC root defaults to repo root, so config can reference paths outside `src`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `collections_config` | All content collections present with paths matching `content.config.ts` `base` directories. **Remove `output: true`** — defunct. | Collections auto-output when they have a `url` pattern. Use `disable_url: true` to prevent output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `paths`              | `static: public` (unless the site uses a different public directory). `uploads: public/images` (default when no precedent).      | `paths` configures asset directories only. 7 valid keys: `static`, `uploads`, `uploads_filename`, `dam_uploads`, `dam_uploads_filename`, `dam_static`, `uploads_use_relative_path` (See [../SKILL.md § Do this before writing any configuration](../SKILL.md#do-this-before-writing-any-configuration) for schema details). There is NO `paths.collections` or `paths.data` — collection paths go on each `collections_config.<name>.path`, data paths on each `data_config.<name>.path`. See [Image path configuration](#image-path-configuration) for optimized vs static. |

### Build settings (`.cloudcannon/initial-site-settings.json`)

Build settings must be nested under a `build` key. The old flat format (`build_command`/`output_path` at the root) is defunct.

**Structure:** `ssg` at the root; `install_command`, `build_command`, `output_path`, `node_version` nested under `build`.

| Key                     | Value                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ssg`                   | `"astro"`                                                                                                                                                                                                                    |
| `build.install_command` | From the detected package manager. Omit if none.                                                                                                                                                                             |
| `build.build_command`   | The script from `package.json` if present, otherwise `"astro build"`.                                                                                                                                                        |
| `build.output_path`     | `"dist"`                                                                                                                                                                                                                     |
| `build.node_version`    | `"file"` if `.nvmrc` or `.node-version` exists (CC reads the version from the file automatically). Otherwise the major version from `package.json` `engines.node` (`">=18"` → `"18"`). Otherwise omit — CC uses its default. |

Prefer `.cloudcannon/prebuild` for extra setup steps so `build_command` stays a straight build, not a shell chain.

**Only takes effect on first site creation.** For existing CloudCannon sites, change build settings in the CloudCannon UI (**Site Settings > Builds > Configuration**). See [cloudcannon-cli-guide.md](../cloudcannon-cli-guide.md).

## Customize the config

### Targeted content fixes during configuration

The migration phases are sequential, but don't treat them as rigid boundaries. When a CC config pattern requires content files to have a field that's inconsistent or missing, **add it** rather than settling for a worse config. Examples: adding `slug` frontmatter so `{slug}` URL patterns work, adding `_schema` to disambiguate collection schemas, normalizing a `date` field format.

The decision rule: if skipping the change means the config is wrong or fragile, make the change now. If the change is structural (moving files, adding new fields that alter rendering, reorganizing collections), defer to the content phase.

### Customization checklist

The CloudCannon CLI produces a structural baseline. The following customizations are almost always needed, informed by the Phase 1 audit:

- **`_inputs`** -- configure how fields appear in the editor (dropdowns, date pickers, image uploaders, comments, hidden fields). Map these from the Zod schemas discovered in the audit. When a frontmatter field contains markdown (e.g. a hero description with `**bold**` text), use `type: markdown`, not `type: textarea`. The same goes for fields that contain html elements (e.g. a hero description with `<strong>bold</strong>` text) - they should use `type: html`, instead of `type: textarea`. Use scoped input keys (e.g. `hero.description`) when the general input should stay as `textarea` but a specific context needs `markdown`. Fields whose value is one of a fixed set (`variant`, `target`, `size`, `align`, `theme`, `columns`, etc.) must be `type: select` — never `type: text`. See [configuration-gotchas.md § Configure variant/enum-like fields as select inputs](configuration-gotchas.md#configure-variant--enum-like-fields-as-select-inputs).
- **`_structures`** -- MANDATORY for every array and object input on the site. See [../structures.md § Mandatory rules](../structures.md#mandatory-rules-read-first) for the full requirement (structure definition + explicit `_inputs` linkage with full path).
- **`icon`** -- every collection should have an `icon` key so it gets a meaningful icon in the CloudCannon sidebar instead of a generic default. Pick icons that reflect the collection's purpose (e.g. `wysiwyg` for pages, `post_add` for blog posts, `home` for homepages, `settings` for data/config). CloudCannon's icon set is a **fixed curated subset** of Material Symbols — invalid names silently fall back to the default. When unsure, see [../SKILL.md § Do this before writing any configuration](../SKILL.md#do-this-before-writing-any-configuration) for schema details to check for the exact name. Common gotcha: `place` is not in the enum — use `location_on`.
- **All schema fields mapped** -- cross-reference every field in the Zod schema against the `_inputs` config. Every user-facing field needs an appropriate input type (`textarea` for multi-line strings like excerpts/descriptions, `datetime` for dates, `image` for image paths, etc.). Missing fields fall back to CC's type inference, which is often wrong. When unsure whether a field is user-facing or developer-only, check whether its value is rendered as visible text on the built page. If it appears on the page, it should be editable with an appropriate input type. Only fields undergoing heavy programmatic transformation (e.g. used purely as a build-time lookup key) should be hidden.
- **`collection_groups`** -- organize collections into sidebar groups for a clean editing experience.
- **`_editables`** -- configure rich text editor toolbars per collection or globally.
- **Editor styles** -- when the audit flagged styled HTML in content fields (inline spans with CSS classes for accent colors, emphasis, etc.), create `.cloudcannon/styles/editor.css` with semantic class definitions and reference it from `type: html` inputs via `options.styles`. This lets editors apply custom styling (e.g. brand-colored highlight text) through the rich text toolbar without Tailwind utility classes in the content. See [content.md § Handling styled HTML in frontmatter](../../migrating-to-cloudcannon/astro/content.md#handling-styled-html-in-frontmatter) and the [Jetstream template](https://github.com/CloudCannon/jetstream-astro-template) for the reference pattern.
- **`markdown`** -- if content files contain Markdown-syntax tables (`| col | col |`), set `markdown.options.table: true`. See [configuration-gotchas.md § Markdown tables](configuration-gotchas.md#set-markdownoptionstable-when-content-has-markdown-tables).
- **`_snippets`** -- configure snippets for non-standard markdown amongst markdown content. In Astro this is often MDX components used in rich text content. Built-in templates like `mdx_component` resolve automatically — no `_snippets_imports` needed. See the `cloudcannon-snippets` skill.
- **`_select_data`** -- define shared dropdown options for fields used across collections. When values need friendly display names (e.g. icon identifiers), use objects with `name`/`id` instead of flat strings, paired with `value_key: id` on the input:

```yaml
_select_data:
  icons:
    - name: GitHub
      id: lucide:github
    - name: Arrow Right
      id: lucide:arrow-right

_inputs:
  icon:
    type: select
    options:
      allow_create: true
      value_key: id
      preview:
        text:
          - key: name
      values: _select_data.icons
```

- **Schemas** -- define templates for creating new content files, based on the content patterns found in the audit. **Multiple schemas can live in one collection** -- both via `schemas:` config and Zod `z.union`. See [§ Schemas](#schemas) below for the worked multi-schema `pages` example.
- **`data_config`** -- a root-level key that targets specific data files via a path, and exposes them for use in CloudCannon (eg. a data file of tags that can be used to populate a multi-select input called tags). Once a data set has been exposed in the `data_config`, its available for use on a select type input by defining it as the input's, `options.values` value (it uses the key we've defined in the `data_config` as the name to use as a reference).
- **`file_config`** -- an **array** of objects, each with a `glob` key targeting specific files. Do NOT use the old map-keyed format (`file_config: src/file.yaml: ...`) — it must be an array with `- glob:` entries. Use it when key names would collide at broader scopes, or to configure inputs for settings/data files. Supports `$` to reference the root of the file or structure. Example:

```yaml
file_config:
  - glob: src/config/theme.json
    _inputs:
      theme_color.primary:
        type: color
      font_family.primary:
        type: text
```

**Scoping:** For top-level arrays and objects in data/config files, use `file_config` so that you can gain access to `$`, which symbolises the root of the data file:

```yaml
file_config:
  - glob: src/config/config.json
    _inputs:
      $:
        type: array
      $[*]:
        type: object
        options:
          preview:
            icon: language
```

### Object inputs need preview icons

Object inputs without a `preview.icon` show a generic icon in the data editor. Configure `type: object` with `options.preview.icon` on any object key that editors will see — both top-level data file objects and nested objects inside structures. Use [Material Icons](https://fonts.google.com/icons) names.

```yaml
_inputs:
  callToAction:
    type: object
    options:
      preview:
        icon: ads_click
```

### Hide developer-only frontmatter fields

Fields like `layout`, `_schema`, and other routing/rendering keys should be hidden from editors:

```yaml
_inputs:
  layout:
    hidden: true
  _schema:
    hidden: true
```

The full set of configuration keys is defined in the CloudCannon Configuration JSON Schema, see [../SKILL.md § Do this before writing any configuration](../SKILL.md#do-this-before-writing-any-configuration) for schema details. For IDE autocomplete and validation, use the setup in [cloudcannon-cli-guide.md § JSON Schemas](../cloudcannon-cli-guide.md#json-schemas) (recommended extensions, no `# yaml-language-server: $schema=...` line in YAML).

### Schemas

One collection, many schemas. Don't make a new collection just because you need a new schema. A `pages` collection can hold a default markdown page, a page-builder page, and a landing page side-by-side. Editors choose which schema to use when creating a new entry.

```yaml
collections_config:
  pages:
    path: src/content/pages
    url: "/[slug]/"
    icon: wysiwyg
    _enabled_editors: [visual, data]
    schemas:
      default:
        path: .cloudcannon/schemas/page.md
        name: Page (markdown body)
      page_builder:
        path: .cloudcannon/schemas/page-builder.md
        name: Page Builder
      landing:
        path: .cloudcannon/schemas/landing.md
        name: Landing Page
    add_options:
      - name: Page Builder
        schema: page_builder
      - name: Landing Page
        schema: landing
      - name: Markdown Page
        schema: default
        editor: content
```

Add `_schema: <key>` to each content file's frontmatter so CloudCannon matches it explicitly rather than guessing from the frontmatter shape.

#### Zod: `z.union` vs `z.discriminatedUnion`

| When                                                                                                    | Use                                           | Why                                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Page schemas have **required fields that differ between types** (each type has a unique required field) | `z.union([mostSpecific, ..., leastSpecific])` | First match wins — most-specific first ensures correct discrimination.                                                          |
| Page schemas have **many optional fields with defaults** (`.nullish()`, `[].default()`)                 | `z.discriminatedUnion("_schema", [...])`      | Matching by shape becomes unreliable when optional fields blur the boundaries. Discriminator field guarantees correct matching. |

```typescript
const pagesCollection = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.union([
    landingSchema, // most specific first
    pageBuilderSchema,
    defaultPageSchema, // catch-all last
  ]),
});
```

## Consolidating single-file collections

After the CloudCannon CLI generates collections, review the result for collections that contain only a single file. A collection of one doesn't add value in the CloudCannon sidebar, is semantically less correct, and should be consolidated. Two strategies, applied in order:

### Strategy A: Merge simple pages into the `pages` collection

If a single-file collection uses the same schema as `pages` (e.g. an `about` or `contact` collection with standard title/description/image/body fields), merge it into the `pages` collection:

- Move the content file into the `pages` directory (e.g. `src/content/about/index.md` -> `src/content/pages/about.md`)
- Remove the separate collection from `content.config.ts` and `cloudcannon.config.yml`
- Update the page's rendering template in `src/pages/` to fetch from the `pages` collection instead
- The page still uses its own rendering template for routing

### Strategy B: Use `data_config` for reusable section data

If a page has data coming from a file separate from the content page, or a page has data that is consistent across the site (CTA, testimonials, etc.), extract it into JSON data files and configure `data_config` rather than trying to group it into a collection with the page:

- Move section data from `.md` frontmatter into `src/data/*.json` files
- Add `data_config` entries in `cloudcannon.config.yml` pointing to each JSON file
- Import the JSON directly in Astro components (no collection needed)
- Use `@data[key].field` syntax for editable regions (e.g. `data-prop="@data[call-to-action].title"`)

For pages with unique schemas (e.g. a homepage with `banner`/`features`), merge the page into the `pages` collection using a `z.union` in the Zod schema and CC schemas for the correct editor fields (see Fallback below).

### Fallback: Merge unique pages into `pages` with a union

When a page has a unique schema but no related files to justify a collection of its own, merge it into `pages` using the multi-schema pattern from [§ Schemas](#schemas). Each page type gets its own named Zod schema spreading `commonFields` plus its required fields, combined via `z.union` (or `z.discriminatedUnion` — see the decision table above).

```typescript
const pageSchema = z.object({ ...commonFields });
const contactPageSchema = z.object({ ...commonFields, name_label: z.string() /* ... */ });
const homepageSchema = z.object({
  ...commonFields,
  banner: z.object({
    /* ... */
  }),
  features: z.array(/* ... */),
});

const pagesCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/pages" }),
  schema: z.union([homepageSchema, contactPageSchema, pageSchema]),
});
```

**In templates**, narrow the union with an `in` check before accessing schema-specific fields: `if (!("banner" in data)) throw new Error(...)`. The page still uses its own rendering template in `src/pages/` — routing is independent of collection structure.

Every Zod schema in the union needs a matching CC schema in `.cloudcannon/schemas/` and a corresponding entry under the collection's `schemas` key in `cloudcannon.config.yml`.

## Splitting nested subdirectories into their own collections

When the `pages` collection contains subdirectories that represent a distinct group of content with their own URL prefix (e.g. `pages/homes/`, `pages/landing/`), split them into separate CloudCannon collections rather than keeping everything flat under `pages`. This gives each group its own sidebar entry, correct URL pattern, and cleaner editorial experience.

1. **Exclude the subdirectories from `pages`** using glob negation:

```yaml
pages:
  path: src/content/pages
  glob:
    - "!homes/**"
    - "!landing/**"
  url: "/[slug]/"
```

2. **Add a collection for each subdirectory** with its own `path` and `url`:

```yaml
homes:
  path: src/content/pages/homes
  url: "/homes/[slug]/"
landing:
  path: src/content/pages/landing
  url: "/landing/[slug]/"
```

3. **Add the new collections to `collection_groups`** under the same heading as `pages`.

No changes are needed on the Astro side — the content collection's glob loader already picks up all nested files, and the catch-all route uses `entry.id` which includes the subdirectory path.

## Data config for shared data

Use `data_config` when you have reusable data (CTAs, testimonials, site settings) that doesn't belong in a content collection. Data files are edited in the CloudCannon data editor and referenced from templates via JSON import.

```yaml
data_config:
  call-to-action:
    path: src/data/call-to-action.json
  testimonial:
    path: src/data/testimonial.json
```

In Astro templates, import the JSON directly:

```astro
---
import callToActionData from "@/data/call-to-action.json";
---
<CallToAction call_to_action={callToActionData} />
```

For visual editing, use `@data[key].path` syntax in editable regions:

```astro
<h2 data-editable="text" data-prop="@data[call-to-action].title">
  {call_to_action.title}
</h2>
```

Data files configured via `data_config` allows those files to be referenced by other CloudCannon config, but **they do not automatically appear in the sidebar**. The most common reason to add an entry to `data_config` is to populate select inputs. To make data files browsable and editable in the sidebar, add a `collections_config` entry pointing to the data file(s) and group it under a "Data" `collection_group`. Configure `_inputs` and `_structures` globally since data files don't have collection-scoped config.

### Single `data` collection or split?

Default: **one `data` collection** with `path: src/data`, `glob: '**/*.json'`, `disable_url: true`, and per-file `file_config` overrides. One sidebar entry, tailored inputs per file, low config surface.

```yaml
collections_config:
  data:
    path: src/data
    glob:
      - "**/*.json"
    disable_url: true
    icon: settings
    _enabled_editors:
      - data

file_config:
  - glob: src/data/theme.json
    _inputs:
      $:
        type: object
        options:
          preview:
            icon: palette
      # ... per-file inputs
  - glob: src/data/navigation.json
    _inputs:
      $:
        type: object
        options:
          preview:
            icon: menu
      # ...
```

Split into per-file collections only when:

- The files have radically different edit cadences or permissions
- Editors actively complain they can't find a specific file under "Data"
- You need different `_enabled_editors` per file that `file_config` can't express

"Each file gets its own sidebar icon" is not a strong enough reason — `file_config.$.options.preview.icon` handles per-file icons inside a single collection.

## Image path configuration

| Image type | Location      | How served                                              | Frontmatter path                                                                       | Config                                |
| ---------- | ------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| Static     | `public/`     | Plain `<img>`, served as-is                             | Relative to public root (`images/photo.jpg` or `/images/photo.jpg`) — NOT `public/...` | Global `paths.uploads`.               |
| Optimized  | `src/assets/` | Astro pipeline (`<Image>`, `<Picture>`, `astro:assets`) | Full repo-relative (`/src/assets/images/hero.jpg`)                                     | Per-input override with `static: ""`. |

Don't move images out of `src/assets/` into `public/` — if images are in `src/assets/`, the developer intended optimization.

Optimized image inputs need a per-input `static: ""` (empty string). Without it, CC strips the path prefix and `import.meta.glob` can't resolve the image.

### Global vs per-input paths

Set global paths for the common case (static) and override per-input for optimized fields:

```yaml
# Global: blog images, inline markdown images, general uploads
paths:
  static: public
  uploads: public/images

# Per-input: optimized image fields in page builder blocks, structured components
_inputs:
  image:
    type: image
    options:
      paths:
        uploads: /src/assets/images
        static: ""
```

Place the per-input override on image inputs that feed into `<Image>` or `<Picture>`. When all component images are optimized and only rich text / blog images are static, the global path handles the static case.

### Rich text / toolbar images

Blog post inline images inserted via markdown or the rich text toolbar use the global `paths.uploads` (`public/images`) — markdown `![](...)` produces plain `<img>`, which Astro does not optimize. If editors should not insert raw `<img>` (because all images should be optimized), disable the image toolbar button in `_editables` and offer optimized images only through structured inputs or snippets.

## Collection URLs

See [../collection-urls.md](../collection-urls.md) for the full reference on URL patterns (fixed/data placeholders, glob loader slug override, subdirectories, trailing slash, troubleshooting).

## Schemas for index pages

When a collection contains an `index.md` file alongside regular items (e.g. `blog/index.md` for the listing page metadata alongside `blog/post-1.md`, `blog/post-2.md`), define separate schemas so editors get the correct fields for each file type.

```yaml
blog:
  path: src/content/blog
  url: "/blog/[slug]/"
  schemas:
    default:
      path: .cloudcannon/schemas/post.md
      name: Blog Post
    blog_index:
      path: .cloudcannon/schemas/blog-index.md
      name: Blog Index
```

The `default` schema controls what editors see when creating or editing regular items. The index schema provides the right fields for the listing page. CloudCannon matches the schema to existing files automatically based on frontmatter shape, or you can set `_schema: blog_index` in the index file's frontmatter to be explicit.

The `[slug]` collapse behavior means no special URL handling is needed -- `index.md` resolves to `/blog/` while `post-1.md` resolves to `/blog/post-1/`.

Create the schema template files in `.cloudcannon/schemas/` with representative frontmatter for each type.

## New preview URL for schemas

When an editor creates a new file from a schema, it hasn't been built yet so it has no output URL. The `new_preview_url` key on a schema tells CloudCannon which page to load as the preview for newly created files.

```yaml
schemas:
  default:
    path: .cloudcannon/schemas/page.md
    name: Page
    new_preview_url: /elements/
  page_builder:
    path: .cloudcannon/schemas/page-builder.md
    name: Page Builder
    new_preview_url: /services/
```

Pick a `new_preview_url` that uses the same layout or template as the schema. `new_preview_url` is optional — if omitted, CloudCannon falls back to showing the site's homepage for new files.

**Caveat for drafts:** `new_preview_url` only helps with newly created files. It does not help with existing files marked `draft: true` — those pages are excluded from the build and have no output URL. For collections with a `draft` field, use `editor: content` on the add option so editors land in the content editor, which doesn't require a built page.

## Controlling the Add button with `add_options`

By default, CloudCannon shows all schemas in the "+ Add" button dropdown. Use `add_options` to restrict which schemas editors can create new files from.

```yaml
collections_config:
  pages:
    add_options:
      - name: Page
        schema: default
        icon: wysiwyg
      - name: Page Builder
        schema: page_builder
        icon: dashboard
  blog:
    add_options:
      - name: Blog Post
        schema: default
        icon: event_available
```

Each `add_options` entry supports: `name`, `schema`, `icon`, `editor` (`content`, `data`, or `visual`), `base_path`.

When `add_options` is defined, **only** the listed options appear. Schemas not listed (like index page schemas or one-off page schemas) are still used for editing existing files but can't be used to create new ones.

### When to use `add_options`

- **Index pages in content collections**: Blog, authors, tags -- where `index.md` has its own schema but shouldn't be duplicable.
- **One-off pages with dedicated routes**: Homepage, contact -- where the Astro route is hardcoded to load a specific entry.
- **Page builder pages**: When offering multiple schema types for new pages, `add_options` curates the list editors see.

### `_enabled_editors` order determines the default

The first editor in the `_enabled_editors` list is the default when opening a file. Order matters. Recommended orderings:

- **Page builder collections**: `[visual, data]` — visual editor shows the live page; data editor for bulk field editing
- **Blog posts** (with visual editing support): `[visual, content, data]` — visual is default for existing posts. Use `editor: content` on `add_options` to open _new_ posts in the content editor (which doesn't need a built page)
- **Data-only collections** (no page output): `[data]`
- **`.astro` page collections** (source editables): `[visual]`

A common mistake is putting `data` first on page collections — this makes every page open in the data editor instead of the visual editor.

### Using `editor: content` on add options

Set `editor: content` on the add option to open new files in the content editor instead of the visual editor. The content editor doesn't need a preview URL, so it works immediately. This is the preferred approach for collections where the primary editing workflow is writing markdown (blog posts, docs, articles), and for collections with a `draft` field — draft pages aren't built, so the visual editor has no page to preview. The content editor doesn't require a built page, making it the only reliable editing experience for drafts. For page-builder collections, use `new_preview_url` on the schema instead.

Note that `editor: content` on add options only controls the editor for _new_ files. Existing files use the `_enabled_editors` order. Blog posts should still have `visual` first in `_enabled_editors` so existing posts open in the visual editor by default.

## Page building patterns

See [page-building.md](../../migrating-to-cloudcannon/astro/page-building.md) for the full guide on creating content-backed pages and array-based page builders, including the pages collection setup, catch-all route, BlockRenderer, and CC collection config.

For the structures reference (inline vs split, field completeness, previews, deriving from components), see [../structures.md](../structures.md).

## Prebuild script

If the audit identified pre-build scripts (theme generation, JSON generation, search indexing), create `.cloudcannon/prebuild`:

```bash
#!/usr/bin/env bash
set -e

node scripts/themeGenerator.js
node scripts/jsonGenerator.js
```

This runs before the build command on CloudCannon. Alternatively, chain the scripts in the build command itself:

```
node scripts/themeGenerator.js && node scripts/jsonGenerator.js && astro build
```

## Editor README

Create `.cloudcannon/README.md` as an editor-facing guide that appears on the Site Dashboard when the site is opened in CloudCannon. This is the first thing editors see, so it should orient non-technical users.

The README should cover:

- **Welcome and site overview** -- what the site is and what content it manages
- **Quick links** -- `cloudcannon:collections/<name>` links to each collection for one-click navigation
- **Collections guide** -- for each collection, explain what it contains and how to create, edit, and delete items. Mention which editing views are available (visual, content, data)
- **Data files** -- if the site has `data_config` entries, explain what each file controls
- **Site settings** -- where to find site-wide config (theme, navigation, social links)
- **New preview URL** -- if any schemas use `new_preview_url`, explain that newly created pages show a temporary preview of an existing page
- **Rich text components** -- if the site has `_snippets`, briefly list the available components editors can insert

Write in plain language. Avoid technical terms like YAML, frontmatter, Zod, schema, SSG, or Astro. Use `cloudcannon:` protocol links where helpful.

## Verification checklist

Work through these before moving to the next phase. One check per line.

### Blocking gates

- [ ] **MDX gate:** if any `.mdx` file uses JSX components (`rg '<[A-Z]' -g '*.mdx' src/content`), the [MDX setup pipeline](../../cloudcannon-snippets/astro.md#mdx-setup-pipeline-must-complete-all-four) is fully complete. `_snippets` alone is not enough — auto-import and `import` removal are both required. #1 source of migration regressions.
- [ ] [Structures — mandatory rules](../structures.md#mandatory-rules-read-first) all pass (field completeness + array/object structure linkage + preview blocks + nested object preview icons).

### Files

- [ ] `cloudcannon.config.yml` exists and is valid YAML
- [ ] `.cloudcannon/initial-site-settings.json` has `"ssg": "astro"`
- [ ] Build settings nested under `"build"` (`build_command`, `output_path`, `install_command`)
- [ ] `node_version` set: `"file"` when `.nvmrc`/`.node-version` exists; major version from `package.json` `engines.node` otherwise
- [ ] `.cloudcannon/prebuild` exists if pre-build steps are needed
- [ ] `.cloudcannon/README.md` exists with editor-facing documentation

### Collections

- [ ] `collections_config` has entries for every collection from the audit
- [ ] No defunct pre-unified keys: `output: true`, `singular_key`, `parser`, `collections_config_override`
- [ ] No non-content directories in `collections_config` (e.g. `lib`, `source`)
- [ ] No collections contain only a single file — consolidate or group
- [ ] `collection_groups` organise collections into logical sidebar groups
- [ ] Every collection has a `url` pattern with the correct trailing slash, OR `disable_url: true` — see [../collection-urls.md](../collection-urls.md)
- [ ] Collections with content in subdirectories: `dist/` output matches the URL template
- [ ] Collections with `index.md`: separate schemas for index page and regular items

### Inputs

- [ ] `_inputs` configured for common field types (images, dates, dropdowns, hidden fields)
- [ ] Icon fields use `type: select` with `allow_create: true`, `value_key: id`, and named values (use a data file for 20+ icons)
- [ ] Numeric frontmatter values mapped to `text` inputs are quoted as strings
- [ ] Developer-only fields (`layout`, `_schema`, routing/rendering keys) have `hidden: true`
- [ ] Every input has explicit config — don't rely on CC type inference from field name alone
- [ ] `file_config` entries use the array format (`- glob: ...`), not the old map-keyed format

### Images

- [ ] `paths.uploads` matches where the site stores images
- [ ] If the site has both optimized (`src/assets/`) and static (`public/`) images, global paths target static and per-input overrides target optimized — see [§ Image path configuration](#image-path-configuration)

### Snippets & editors

- [ ] Every MDX component has a `_snippets` entry OR the file uses `_enabled_editors: [source, data]` with rationale in migration notes — see [cloudcannon-snippets/astro.md § Every MDX component must be accounted for](../../cloudcannon-snippets/astro.md#every-mdx-component-must-be-accounted-for)
- [ ] MDX files with `import` statements set up `astro-auto-import` (or equivalent) so imports are injected at build time and removed from source files — see [astro.md § Auto-import](../../cloudcannon-snippets/astro.md#auto-import-keeping-import-statements-out-of-content)
- [ ] `_enabled_editors` order has the preferred default editor first (`visual` for page collections; `visual` → `content` for blog posts)
- [ ] Collections of `.md` files that don't build to a page have `_enabled_editors: [data]`

### Content specifics

- [ ] `<br />` tags in plain text frontmatter that simulate lists are converted to HTML lists in `type: html` fields, or split into arrays. `<br />` in rich text fields is fine. See [content.md § Handling styled HTML in frontmatter](../../migrating-to-cloudcannon/astro/content.md#handling-styled-html-in-frontmatter)
- [ ] `markdown.options.table` is `true` if any content files contain Markdown-syntax tables
- [ ] For every boolean/switch/enum field in `_inputs`, the template has a conditional render. No dead fields — an editor-visible switch that toggles nothing is a broken UX signal.
- [ ] For every `data-editable="text"` region with a template `|| "default"` fallback, the collection schema (or structure-value default) sets the same text as a real value, and existing content files are backfilled. Template fallbacks alone are invisible to the editor.
- [ ] `grep -n "type: markdown" cloudcannon.config.yml` — every hit has an `options:` block (inline or via `*anchor`). No bare `type: markdown` declarations.
- [ ] Every schema-default change is paired with a backfill script across existing content entries.
- [ ] Every array/multiselect backed by a data file references `values: data.<name>` — no hardcoded duplicates.
- [ ] Every data file that holds a list of like-shaped items is a **top-level array** with an explicit `slug`/`id` field per item, wired to a `_structures` entry so editors get an "Add" button.
- [ ] When an array data file's items each correspond to a page route, the route is a single dynamic `[slug].astro` with `getStaticPaths` reading the data file — not one hardcoded `.astro` per known slug.
- [ ] No component template contains a `length === 0 ? showAll : showSelected` toggle on a multiselect-driven field. Empty = render nothing, OR seed defaults at the schema-file level.

### Schemas & add options

- [ ] `add_options` restricts the Add button to only creatable schemas
- [ ] Collections where editors should not create new files use `disable_add: true`
- [ ] Schemas for creatable page types have `new_preview_url` OR `editor: content` on add options
- [ ] Collections with a `draft` field use `editor: content` on add options (drafts aren't built)
- [ ] Sites with 3+ reusable block components have a page builder schema — see [page-building.md](../../migrating-to-cloudcannon/astro/page-building.md)

For common pitfalls and patterns, see [configuration-gotchas.md](configuration-gotchas.md).
