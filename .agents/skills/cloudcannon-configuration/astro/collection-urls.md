# Collection URLs (Astro)

Astro-specific URL pattern guidance. For the general collection URL reference (placeholders, filters, troubleshooting), see [../collection-urls.md](../collection-urls.md).

## Glob loader and `slug` frontmatter

Astro's `glob()` loader has a built-in feature: if a content file's frontmatter contains a `slug` field, it overrides the auto-generated `id` (which is normally the filename without extension). This means `post.id` — which most templates use for routing — can come from either:

1. The frontmatter `slug` field (when present)
2. The filename (when `slug` is absent)

This is easy to miss because the `slug` field doesn't need to be in the Zod schema — the glob loader consumes it before validation. The application code doesn't reference `data.slug` either; it's already baked into `post.id`.

**Implications for CC URLs:** When a template uses `post.id` for routing (common pattern: `params: { slug: post.id }` in `getStaticPaths`), and some content files have a `slug` frontmatter that differs from the filename, CC's `[slug]` placeholder (filename-based) will produce the wrong URL. Use `{slug}` (frontmatter-based) instead.

**Ensuring consistency:** If only some posts have `slug` frontmatter, add it to the rest (matching the filename) so `{slug}` works uniformly. Also add `slug` to the CC schema template so new posts get the field, and make the `slug` input visible so editors can control their URL.

## Trailing slash rule

The URL must match the built output path exactly. Check `astro.config.mjs` for `trailingSlash` and `build.format`:

- **`build.format: "directory"` (default)** -- Astro builds pages as `dir/index.html`. URLs need a trailing slash: `/about/`, `/blog/my-post/`. This is the default even when `trailingSlash` is set to `"never"`.
- **`build.format: "file"`** -- Astro builds pages as `page.html`. URLs do not have a trailing slash: `/about`, `/blog/my-post`.
- **`build.format: "preserve"`** -- matches the source file structure. Check the output to determine the pattern.
