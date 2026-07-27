# Collection URLs

Collections that produce pages need a `url` pattern so CloudCannon can open them in the visual editor and display the correct URL in the collection file list. **A wrong `url` is the most common reason a page fails to load in the visual editor.** If the visual editor shows a blank page or the wrong page for a supported file type, check the `url` pattern first -- including the trailing slash.

## Fixed placeholders

Use square brackets for fixed (filename-based) placeholders:

- `[slug]` -- filename without extension. If the filename is `index`, resolves to an empty string.
- `[filename]` -- filename with extension.
- `[relative_base_path]` -- file path without extension, relative to the collection path.
- `[full_slug]` -- alias for `[relative_base_path]/[slug]`.
- `[collection]` -- the collection key name.
- `[ext]` -- the file extension.

```yaml
pages:   url: "/[slug]/"
blog:    url: "/blog/[slug]/"
authors: url: "/authors/[slug]/"
```

A `pages` collection with `url: "/[slug]/"` produces `/` for `index.md` and `/about/` for `about.md`.

## Data placeholders (frontmatter fields)

Use curly braces to reference frontmatter data. This is essential when the output URL is derived from a frontmatter field rather than the filename -- a common pattern where templates use a `slug`, `permalink`, or `title` field to control the output path.

```yaml
blog:    url: "/posts/{slug}/"
news:    url: "/news/{category|slugify}/{title|slugify}/"
```

**Filters** are applied with `|` after the key name. Multiple filters can be chained. Full reference: [CloudCannon template strings docs](https://cloudcannon.com/documentation/developer-articles/configure-your-template-strings/).

Common filters for URLs:

- `slugify` -- converts non-alphanumeric characters to hyphens, collapses sequential hyphens, strips leading/trailing hyphens
- `lowercase` / `uppercase` -- case transformation
- `year`, `month`, `day` -- extract date parts (2-digit month/day, 4-digit year)
- `default=value` -- fallback when the field is empty
- `truncate=N` -- limit to N characters

**Nested keys and arrays** are supported: `{seo.description}` for nested objects, `{tags[0]}` for specific array items, `{tags[*]}` for all items (joined with `, `).

**When to use data placeholders:** During the audit, check how the SSG generates output URLs. If the routing uses a frontmatter field (e.g. `getStaticPaths` returns `params: { slug: post.data.slug }` rather than using the filename), use `{field}` in the CloudCannon `url`. Compare a few filenames against their build output paths in `dist/` -- if they don't match, the URL is frontmatter-driven.

## Content in subdirectories within a collection

**Symptom:** A post's output URL is `/posts/examples/my-post/` but the `{slug}` placeholder resolves to just `my-post` — the subdirectory is missing from the rendered URL and the Visual Editor can't open the page.

**Detect:** Compare build output paths in `dist/` against the `{slug}` values. If they diverge, the SSG's routing utility is prepending the subdirectory.

### Fix options

| Fix                             | How                                                                                                                                     | Use when                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prefix the frontmatter `slug`   | Include the subdirectory in the slug value (`slug: examples/my-post`). Check the SSG's routing utility doesn't double-up the directory. | Small subdirectories within a content collection (example posts, archived posts). Keeps the collection unified.                                      |
| Split into separate collections | Give the subdirectory its own CC collection with a URL pattern that includes the prefix (`url: "/posts/examples/{slug}/"`).             | The subdirectory represents a genuinely different content type with its own editorial workflow, or is large enough to warrant its own sidebar entry. |

**Note:** Directories prefixed with `_` (e.g. `_releases/`) are often excluded from SSG routing — their posts get URLs without the directory prefix and work fine with plain `{slug}`. Check the SSG's path utility for `_`-prefix filtering before applying either fix.

## Troubleshooting

If a page doesn't load in the visual editor:

1. **Check the `url` pattern** -- compare the configured URL against the actual build output in `dist/`. The most common issues are wrong placeholders (`[slug]` vs `{slug}`) and wrong prefix paths.
2. **Check the trailing slash** -- a missing or extra trailing slash causes a mismatch. Compare against the `build.format` setting.
3. **Check fixed vs data placeholders** -- `[slug]` is the filename; `{slug}` is the frontmatter `slug` field. If the SSG uses a frontmatter field for routing, you need curly braces.
4. **Build and inspect** -- when in doubt, build the site and inspect the `dist/` directory to see the actual output paths.

## SSG-specific details

- **Astro**: [astro/collection-urls.md](astro/collection-urls.md) — glob loader `slug` override, trailing slash rules.
