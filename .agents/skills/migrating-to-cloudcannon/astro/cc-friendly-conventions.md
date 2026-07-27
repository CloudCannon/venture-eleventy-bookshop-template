# CC-Friendly Astro Conventions

Architectural constraints for building an Astro site that will be edited in CloudCannon. Read this **before scaffolding** if the Astro site is being generated as part of a larger task (e.g. converting from WordPress or another platform). Following these conventions avoids structural refactoring during the CloudCannon migration.

This is not a migration guide — see [overview.md](overview.md) for the full migration workflow.

## Output mode

Use `output: "static"` (Astro's default). CloudCannon requires static output — `server` and `hybrid` modes are not supported.

## Astro version

Use Astro 5+. The CloudCannon editable regions integration (`@cloudcannon/editable-regions`) requires Astro 5+, and `content.config.ts` with the `glob()` loader is the expected content collection format.

## Content collections

- Define collections in `src/content.config.ts` using `glob({ pattern, base })` loaders.
- Use **flat files** (`blog/my-post.md`), not folder-per-post (`blog/my-post/index.md`).
  **Why:** flat files work natively with CloudCannon's `[slug]` URL placeholder; folder-per-post requires workarounds.
- Co-locate images with content only when necessary — prefer `src/assets/` for optimized images (see Images below).

## Frontmatter

- Match the casing the components already use. When building from scratch with no existing convention, prefer `snake_case`.
- Include all fields explicitly in every file, even optional ones with defaults.
  **Why:** CloudCannon editors see what's in the file, not Astro's runtime defaults.
- Use consistent types per field across a collection (don't mix strings and objects for the same key).
- Use ISO 8601 for dates (`2024-04-04T05:00:00Z`).

## Images

- **Optimized images** (`<Image>`, `<Picture>` from `astro:assets`): keep in `src/assets/`.
- Store the full repo-relative path in frontmatter (`/src/assets/images/hero.jpg`).
- Resolve at build time with `import.meta.glob` — don't use hardcoded `import` statements.
- **Static images** (plain `<img>`): keep in `public/`. Reference with paths relative to the public root (`/images/photo.jpg`).
- Don't move optimized images to `public/`.
  **Why:** it breaks Astro's build-time processing.

## Components

- Use `.astro` components and React (`@astrojs/react`) for anything that will be visually editable in CloudCannon.
  **Why:** Vue, Svelte, and Solid are unsupported in editable regions (see [overview.md § Astro scope](overview.md)).
- Avoid presentational wrapper components (e.g. a `<Link>` that just renders a styled `<a>`) inside editable content. Use plain HTML + CSS instead.
  **Why:** they'd need snippet configuration to survive editing.

## Page structure

- **Prefer content-backed pages** over hardcoded templates. Pages with structured or repeated data (card lists, feature grids, timelines) should pull from content collections so editors get CRUD control.
  **Why:** reserve hardcoded templates for truly fixed layouts with only a few editable text strings.
- For pages with 3+ reusable block components, use a **page builder pattern**: a `content_blocks` array in frontmatter where each item has a `_type` discriminator field.
  **Why:** this lets editors assemble pages from reusable blocks.
- Add a **catch-all route** (`src/pages/[...slug].astro`) so pages created from the CMS have a route.
  **Why:** Astro's routing priority means dedicated routes always win.
- When multiple page types share a collection, use `z.union` or `z.discriminatedUnion` in the Zod schema.

## Shared data

Cross-page content (navigation, CTAs, testimonials, site settings) should live in JSON files (e.g. `src/data/cta.json`) rather than scattered across collection frontmatter. This keeps shared data consistent and editable in one place via CloudCannon's data editor.

**Default to editable.** All user-facing text should be editable. Never leave common UI sections hardcoded without explicit justification from the customer. If an editor can see it on the page, they must be able to edit it.

### Shared-UI treatment table

Every site has most of these. For each row, the default treatment is non-negotiable unless you have a written technical reason not to — scan the repo for each one and either implement it or document the exception in `.cloudcannon/migration/visual-editing.md`.

| Section                             | Default treatment                           | Data file / approach                                                                |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Header / Navigation                 | data-file + component                       | `src/data/navigation.json` with `items[]` structure                                 |
| Footer link columns                 | data-file + array                           | `src/data/footer.json` — `columns[{heading, links[]}]`                              |
| Footer tip / credits / image credit | data-file                                   | Same `src/data/footer.json`, under `tip`, `credits`, `image_credit` keys            |
| CTA banner (above footer)           | data-file + `editable-component`            | `src/data/cta.json` — `title`, `link`, `link_text`                                  |
| Share block (post / project detail) | source editables OR `src/data/sharing.json` | `data-editable="source"` on heading + description in the page template              |
| Author card                         | data-file                                   | `src/data/authors.json` keyed by slug; frontmatter `author: <slug>`; `select` input |
| Cookie banner / announcement bar    | data-file                                   | `src/data/announcement.json` or similar                                             |

### Footer

Use simple `{heading, links[]}` arrays for columns. Tip text, credits, and image credits go in the same file. Use `@data[footer]` editables in the component. the columns array editable wraps **only the mapped columns** — static siblings (logo, tagline) sit _outside_ the `data-editable="array"` wrapper. Wrap with `class="contents"` so the array container stays layout-neutral and the surrounding grid still flows. Child editables inside each `data-editable="array-item"` use **relative paths** (`data-prop="heading"`, `data-prop="links"`, `data-prop="label"`) — never the indexed form `data-prop="@data[footer].columns[N].heading"`. See [visual-editing-reference.md § Arrays inside data files](../../cloudcannon-visual-editing/astro/visual-editing-reference.md#arrays-inside-data-files).

### CTA

Extract CTA content to a data file if the section is rendered on multiple pages via a shared component or layout. "CTA" here means the shared promotional section that typically appears above the footer across pages (e.g. "Contact us today", "Get started free") — not individual buttons or links. The test is whether the same content appears on multiple built pages, not how many files import the component directly.

### Author strategy

Treat authors as a data relationship, not a free-text field. Decide treatment by reuse pattern:

| Situation                                         | Treatment                                                                                                       | Rationale                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Few authors (≤ ~10), reused across posts/projects | `src/data/authors.json` keyed by slug; frontmatter `author: <slug>`; `select` input with `values: data.authors` | Centralized bios, avatars, roles; cheap to extend |
| Many authors with their own pages / URLs          | `src/content/authors/` collection; `_enabled_editors: [data]` if they don't render individual pages             | Needs CRUD and routing                            |
| One-off, never reused                             | Inline string on the post                                                                                       | Not worth the indirection                         |

**Anti-pattern:** constructing the author object inline in a page template with a hardcoded bio (`const author = { name: post.data.author, bio: 'Accessibility advocate' }`). Lift to a data file — the author's bio, avatar, and role belong in one editable place.

### Live-preview wiring requirement

Wire live-preview for `select` inputs that reference another data file, otherwise the rendered card won't update on change. The sidebar edit updates frontmatter, but without a registered component bound to the slug, the displayed card stays stale until rebuild.

Required pieces:

1. **Data file** keyed by slug — e.g. `src/data/authors.json` with `{ "<slug>": { name, avatar, bio } }`.
2. **CC input** — expose the data file under `data_config` (`authors: { path: src/data/authors.json }`), then a `select` input with `values: data.authors` and `value_key: ''` so the frontmatter stores the slug. Without the `data_config` entry, `data.authors` won't resolve.
3. **Dedicated registered component** that takes the slug and does the lookup _internally_ (e.g. `AuthorCard.astro`). Register with `registerAstroComponent('author-card', AuthorCard)`.
4. **Editable wrapper** at the call site: `<editable-component data-component="author-card" data-prop="<slug-field>"><AuthorCard author={slug} /></editable-component>`. The slug-field name must match the frontmatter key (e.g. `data-prop="author"`).

**Anti-pattern (silent breakage):** doing the slug→author lookup in the page template and passing the resolved object to a static child component. See [visual-editing-reference.md § Cross-collection select inputs](../../cloudcannon-visual-editing/astro/visual-editing-reference.md#cross-collection-select-inputs).

## Image galleries in MDX content

Create a self-closing `Gallery` component that takes an `images` array prop and renders images internally when content has inline image grids. This avoids paired/markdown-content snippets where editors could insert arbitrary content. Constants (width, height, class) live in the component; only `src` and `alt` are in the data.

```astro
---
import { Image } from 'astro:assets'
const { images = [] } = Astro.props
---
<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
  {images.map((img) => (
    <Image src={img.src} alt={img.alt} width={1200} height={600}
      class="h-[250px] w-full rounded-lg object-cover" />
  ))}
</div>
```

Add to AutoImport so content files use it without explicit imports. Configure a `_snippets` entry with `type: array` for the images prop so editors get a structured interface for adding/removing images.

## Markdown content

- Keep content bodies as clean markdown.
- Avoid custom remark/rehype plugins that structurally transform content in ways CloudCannon's editor can't reproduce.
- Inline HTML that editors need to modify (`<figure>`, `<video>`, `<details>`) should follow a consistent structure so it can be configured as a CloudCannon snippet.
- For MDX sites: auto-import components used in content (via `astro-auto-import` or equivalent) rather than using explicit `import` statements.
  **Why:** bare imports show as raw text in CloudCannon's content editor.
