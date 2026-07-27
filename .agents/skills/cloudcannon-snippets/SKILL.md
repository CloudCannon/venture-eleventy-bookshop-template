---
name: cloudcannon-snippets
description: >-
  Use when adding snippet support to a CloudCannon site, configuring MDX
  components for the Content Editor, debugging snippet round-trip issues,
  or setting up inline HTML snippets in markdown content.
---

# CloudCannon Snippets

Snippets let editors insert and edit complex markup (components, shortcodes, embeds) inside CloudCannon's rich text Content Editor. This skill covers both the SSG layer (how components are imported/built) and the CloudCannon layer (`_snippets` config that teaches the editor the syntax).

## When to use this skill

- Adding snippet support to a new or existing CloudCannon site
- Configuring MDX components for the Content Editor
- Adding inline HTML snippets (figure, video, details) to markdown content
- Debugging snippet parsing, round-trip, or toolbar issues

## Docs

| Doc                                            | When to read                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [snippets.md](snippets.md)                     | Start here. Overview of both layers, configuration hierarchy, which approach to use, snippet properties, toolbar setup, raw HTML snippets in `.md` files |
| [template-based.md](template-based.md)         | Component syntax matches a built-in template (most common path)                                                                                          |
| [raw.md](raw.md)                               | Component needs custom syntax (e.g. `client:load`, non-standard attributes)                                                                              |
| [built-in-templates.md](built-in-templates.md) | Understanding built-in MDX templates, the import bundle, parser internals                                                                                |
| [gotchas.md](gotchas.md)                       | Debugging or reviewing. Common pitfalls and workarounds                                                                                                  |

**SSG-specific:**

| SSG   | Doc                                                                           |
| ----- | ----------------------------------------------------------------------------- |
| Astro | [astro.md](astro.md) — MDX stack, `astro-auto-import`, when to use MDX vs raw |

## Quick decision

| Case                                         | Approach                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Component syntax matches a built-in template | Template-based — see [template-based.md](template-based.md)                                                           |
| Extra syntax, SSG directives, custom parsing | Raw — see [raw.md](raw.md)                                                                                            |
| Inline HTML in `.md` (`<figure>`, `<video>`) | Raw snippets — see [snippets.md § Raw snippets for inline HTML](snippets.md#raw-snippets-for-inline-html-in-md-files) |

Most setups use template-based for simple components and raw for anything with SSG-specific directives.

## Checklist

Read this before starting and verify every item when done.

- [ ] Every component used in content files has a `_snippets` entry
- [ ] `_editables` includes `snippet: true` on relevant content blocks
- [ ] Each snippet round-trips correctly (insert via editor, save, reopen — markup unchanged)
- [ ] `_inputs` are configured for snippet fields (image fields get `type: image`, etc.)
- [ ] Snippet previews are configured (`view: gallery` for image-bearing snippets)
- [ ] `picker_preview` uses static values (not `key:` lookups, which don't resolve in picker context)

## Common mistakes

| Excuse                                         | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The built-in templates handle this"           | Verify the round-trip. Built-in templates have known edge cases — see [gotchas.md](gotchas.md).                                                                                                                                                                                                                                                                                                                                             |
| "I'll configure the snippet toolbar later"     | No toolbar means editors can't insert snippets. Add `snippet: true` to `_editables` now.                                                                                                                                                                                                                                                                                                                                                    |
| "This component is too niche for a snippet"    | If editors encounter it in content, they need to be able to edit it. Configure it.                                                                                                                                                                                                                                                                                                                                                          |
| "Import statements in content are fine"        | Use auto-import (Astro: `astro-auto-import`) to keep imports out of content files.                                                                                                                                                                                                                                                                                                                                                          |
| "I can use `_snippets_imports` for this"       | Don't. It loads catchall matchers that can match incorrectly. Write explicit `_snippets` entries.                                                                                                                                                                                                                                                                                                                                           |
| "I configured `_snippets`, snippets are done"  | Without `astro-auto-import` wired in `astro.config.mjs` AND the `import` lines removed from MDX files, editors still see raw `import` statements at the top of MDX content. All four pipeline steps are required — see [astro.md § MDX setup pipeline](astro.md#mdx-setup-pipeline-must-complete-all-four).                                                                                                                                 |
| "Inline image grid in MDX is fine as raw HTML" | Editors can't safely edit raw `<div class="grid">` + `<Image>` blocks. Extract to a self-closing `<Gallery images={[{src, alt}, ...]} />` component (auto-imported) with a matching `_snippets` entry — `images` as `type: array` with nested `images[*].src: type: image`. See [cc-friendly-conventions.md § Image galleries in MDX content](../migrating-to-cloudcannon/astro/cc-friendly-conventions.md#image-galleries-in-mdx-content). |
