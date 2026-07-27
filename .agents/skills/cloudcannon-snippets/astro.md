# Snippets (Astro)

Guidance for configuring CloudCannon snippets for MDX components in an Astro site. Read the cross-SSG [snippets overview](snippets.md) first for CC snippet concepts and reference. This page complements that overview’s template-based vs raw discussion by focusing on the **Astro + MDX** stack (content shape, auto-import, and Astro-specific raw patterns such as `client:load`).

## When this doc applies (MDX path)

This workflow assumes editors use **MDX component tags** in content. Concretely:

- MDX integration (`@astrojs/mdx`) installed and registered in `astro.config.mjs`
- Content files that use those components are `.mdx` (not `.md`)

**Agent discretion:** A site may start as Markdown-only. Either refactor toward the bullets above—install MDX, register it, convert or rename affected entries to `.mdx`—when built-in `mdx_*` templates and auto-import are simpler than a large raw-snippet surface, or keep `.md` and rely on **raw** snippets per [raw.md](raw.md) and [Which approach?](snippets.md#which-approach) in the overview. Raw snippets offer maximum flexibility and literal syntax control; the MDX + template path is often less complicated for standard props and paired content, at the cost of format and build setup.

## MDX setup pipeline (must complete all four)

| #   | Step                                                         | File                     | Skip = broken                        |
| --- | ------------------------------------------------------------ | ------------------------ | ------------------------------------ |
| 1   | `npm install astro-auto-import`                              | `package.json`           | `import` statements leak into editor |
| 2   | Register `AutoImport({ imports: [...] })` **before** `mdx()` | `astro.config.mjs`       | Components not resolved at build     |
| 3   | Delete `import` lines from all `.mdx` content files          | `src/content/**/*.mdx`   | Raw imports shown to editors         |
| 4   | Add `_snippets` entries (or raw snippet) for every JSX tag   | `cloudcannon.config.yml` | Components shown as broken in editor |

All four are mandatory. Steps 1+2 without 4 = editor still can't insert/parse the components. Step 4 without 1+2 = build fails. Verify at the end with the [component inventory grep](#component-inventory-grep-must-run-check).

## Auto-import: keeping import statements out of content

CloudCannon's Content Editor displays the raw file contents. Import statements (`import Button from '../components/Button'`) would be visible to editors in the rich text view — confusing for non-technical users. Astro content must use an auto-import mechanism so components are available without explicit imports.

### `astro-auto-import`

The recommended approach. This Astro integration injects imports into MDX files at build time.

```bash
npm install astro-auto-import
```

In `astro.config.mjs`, register it **before** the `mdx()` integration:

```javascript
import AutoImport from "astro-auto-import";
import mdx from "@astrojs/mdx";

export default defineConfig({
  integrations: [
    AutoImport({
      imports: ["@/shortcodes/Button", "@/shortcodes/Notice", "@/shortcodes/Youtube"],
    }),
    mdx(),
  ],
});
```

Each entry maps a module to a default import. The component is available in MDX by its filename (e.g. `Button`, `Notice`). Named exports use object syntax:

```javascript
imports: [{ "astro-embed": ["Tweet", "YouTube"] }];
```

### Alternative: `components` prop

Pass components explicitly when rendering content:

```astro
---
import Button from "@/shortcodes/Button";
const { Content } = await entry.render();
---
<Content components={{ Button }} />
```

Less scalable but avoids the extra dependency. The `astro-auto-import` approach is better for templates with many shortcodes. If auto-import fails to resolve components (path alias issues, pnpm hoisting), fallback to this approach -- it's reliable and sufficient for sites with only 1-2 MDX components.

## Built-in templates for Astro

Astro MDX files use standard MDX component syntax. The built-in `mdx_component` and `mdx_paired_component` templates match JSX/MDX syntax and resolve automatically when referenced by name in `_snippets`.

## Workflow: from component to snippet config

For each component used in MDX content:

1. **Find the component source** — check the auto-import config or shortcodes directory
2. **Read its props** — look at the TypeScript interface or function parameters
3. **Check how it's used in content** — self-closing or wrapping content? Uses `client:load`?
4. **Choose the approach** — see table below
5. **Write the snippet config** — map props to named_args/models, add `_inputs` for good editor UX
6. **Add `_inputs` for constrained values** — use `select` for props with known options, `url` for links, etc.

| Content shape                             | Approach                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| No `client:load` + self-closing           | `mdx_component` template                                                                                    |
| No `client:load` + wraps content          | `mdx_paired_component` template                                                                             |
| Has `client:load` (any directive)         | Raw snippet — templates can't output directives                                                             |
| Nested tree (`<Tabs><Tab>…</Tab></Tabs>`) | Single raw snippet with `repeating` parser. See [§ Nested components](#nested-components-repeating-parser). |

## Handling `client:load` directives

Astro's `client:load`, `client:idle`, `client:visible` directives trigger client-side hydration for interactive components. The MDX templates (`mdx_component`, `mdx_paired_component`) don't output these directives — they produce plain `<Component />` syntax.

Use raw snippet syntax to include the directive as literal text.

For raw `key_values` on MDX attributes, include `format` with `root_value_delimiter` and `string_boundary` whenever you use normal `prop="value"` (or similar) syntax — optional in schema, required in practice. See [raw.md — `key_values`](raw.md#key_values--keyvalue-pairs).

### Self-closing with `client:load`

```yaml
youtube:
  snippet: "<Youtube client:load [[named_args]] />"
  inline: false
  preview:
    text: YouTube Video
    icon: play_circle
  params:
    named_args:
      parser: key_values
      options:
        models:
          - editor_key: id
            type: string
          - editor_key: title
            type: string
        format:
          root_value_delimiter: "="
          string_boundary:
            - '"'
  _inputs:
    id:
      type: text
      comment: YouTube video ID
```

### Paired with `client:load`

```yaml
accordion:
  snippet: "<Accordion client:load [[named_args]]>[[inner_content]]</Accordion>"
  inline: false
  preview:
    text: Accordion
    icon: expand_more
  params:
    named_args:
      parser: key_values
      options:
        models:
          - editor_key: title
            type: string
        format:
          root_value_delimiter: "="
          string_boundary:
            - '"'
    inner_content:
      parser: content
      options:
        editor_key: inner_content
```

The directive appears literally in the `snippet` string outside any `[[placeholder]]`, so it's preserved as-is during parsing and re-serialization.

### Custom template for multiple `client:load` components

If several components all need `client:load`, define a custom template to avoid repetition:

```yaml
_snippets_templates:
  astro_client_component:
    snippet: "<[[component_name]] client:load [[named_args]] />"
    params:
      component_name:
        parser: literal
        options:
          literal:
            ref: component_name
      named_args:
        parser: key_values
        options:
          models:
            ref: named_args
          format:
            root_value_delimiter: "="
            string_boundary:
              - '"'
```

Then individual snippets inherit from it:

```yaml
_snippets:
  youtube:
    template: astro_client_component
    definitions:
      component_name: Youtube
      named_args:
        - editor_key: id
          type: string
        - editor_key: title
          type: string
```

## Nested components (repeating parser)

For nested patterns like `<Tabs><Tab>...</Tab></Tabs>`, use a single snippet with the `repeating` parser. See [raw.md § repeating](raw.md#repeating--repeat-a-child-pattern-as-array-items) for the full parser reference. Do NOT define the child as a separate `_snippets` entry — it would match standalone and steal content from the parent.

**Astro-specific note:** Tabs components typically need `client:load` on the parent element. Include this in the snippet template string:

```yaml
tabs:
  snippet: "<Tabs client:load>[[repeating_tabs]]</Tabs>"
  inline: false
  preview:
    text: Tabs
    icon: tab
  _inputs:
    tab_items:
      type: array
    tab_items[*]:
      options:
        preview:
          text:
            - key: name
          icon: tab
    tab_items[*].name:
      type: text
    tab_items[*].tab_content:
      type: markdown
  params:
    repeating_tabs:
      parser: repeating
      options:
        snippet: "<Tab [[named_args]]>[[tab_content]]</Tab>"
        editor_key: tab_items
        default_length: 2
        style:
          output: block
          between: "\n\n"
          block:
            leading: "\n\n"
            trailing: "\n\n"
    named_args:
      parser: key_values
      options:
        models:
          - editor_key: name
            type: string
        format:
          root_value_delimiter: "="
          string_boundary:
            - '"'
    tab_content:
      parser: content
      options:
        editor_key: tab_content
        style:
          block:
            leading: "\n\n"
            trailing: "\n\n"
```

Configure `_inputs` using the `editor_key` from the repeating parser (`tab_items`) as the array input, and `tab_items[*]` for array item previews. Use `[*].field` syntax for individual field inputs within each item.

## Every MDX component must be accounted for

Every component used in MDX content must either have a `_snippets` entry or the file must be restricted to source/data editor only (`_enabled_editors: [source, data]`). There is no middle ground — an unconfigured component shows as a broken/unrecognizable element in the content editor. "Demo content", "only used once", or "not worth configuring" are not valid reasons to skip.

**Preference order:** Define `_snippets` first so the content editor can parse, offer toolbar inserts, and round-trip the markup. Well-configured snippets are the right default for MDX body content; `_enabled_editors: [source, data]` is a **last resort** after you are confident no reasonable snippet plus component refactor can represent the pattern. Document what you tried and why snippets are not viable in the migration notes.

**Try first:**

- Self-closing components with string/number/boolean props (Button, Youtube, Video)
- Paired components with simple inner content and a few props (Notice, Accordion)
- Nested tag trees that map to parsers: `repeating` for patterns like `<Tabs><Tab>…</Tab></Tabs>`, `content` for rich inner regions, raw `snippet` strings for literals such as `client:load`
- Components editors should insert from the toolbar — including components with no author-editable props (still add a minimal snippet so the content editor recognizes them)
- Refactor before giving up: move JS expressions and derived values inside the component; expose only props you can describe with `_inputs`. Wrap or thin-wrap third-party components when possible so MDX only passes simple values

**Nesting:** Depth alone does not disqualify a pattern. What matters is whether the tree is **regular and mappable** to snippet parsers (often one parent snippet with `repeating` children). Deep but repetitive structure may still be one snippet. Hard cases are **arbitrary or unbounded** child trees that do not match a repeating or fixed-slot model.

**Source/data only when (high bar):**

- Shapes that still cannot be captured with template, raw, `repeating`, and `content` parsers after a genuine snippet attempt
- Prop payloads that remain unmappable after simplifying the component API and `_inputs` — not "looks complex at a glance"
- Vendor components you cannot wrap, where MDX usage cannot be narrowed to a representable subset
- Verified round-trip or parsing failures with a prototype snippet — not a default when MDX contains expressions (refactor those into the component first)

For files restricted to source/data editor, add `_enabled_editors: [source, data]` at the file or collection level, and document the reason in the migration notes.

## Common mistakes

| ❌ Mistake                                                               | ✓ Correct                                                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Adding `_snippets` entries without `astro-auto-import`                   | Steps 1–4 in the [MDX setup pipeline](#mdx-setup-pipeline-must-complete-all-four) are all required                                 |
| Skipping `<Image>` from `astro:assets` because "it's a layout component" | Every JSX tag in `.mdx` must have a `_snippets` entry — layout isn't an exemption                                                  |
| Leaving `import` lines at the top of `.mdx` content files                | Delete them; let `AutoImport` inject them. Editors shouldn't see raw imports.                                                      |
| Registering `AutoImport` after `mdx()` in `astro.config.mjs`             | Order matters — `AutoImport` must come earlier in the `integrations` array                                                         |
| "I'll configure the common ones now and add the rest later"              | Run the [component inventory grep](#component-inventory-grep-must-run-check); unconfigured components show as broken in the editor |

## Component inventory grep (must-run check)

Before declaring snippets done, list every JSX tag used in content and verify each has a `_snippets` entry:

```bash
grep -rohE '<[A-Z][a-zA-Z]+' src/content/**/*.mdx src/pages/**/*.mdx 2>/dev/null | sort -u
# or with ripgrep:
rg -oN '<[A-Z][a-zA-Z]+' -g '*.mdx' src/content src/pages | sed 's/.*://' | sort -u
```

Every component name in the output must have a `_snippets` entry in `cloudcannon.config.yml`, or the containing file must be restricted with `_enabled_editors: [source, data]` and the exclusion documented in migration notes. This includes layout components like `<Image>` used in grid patterns — "only used for layout" is not a valid reason to skip.

## Verification

After adding snippet configs:

- [ ] MDX setup pipeline (steps 1–4) complete — see [table above](#mdx-setup-pipeline-must-complete-all-four)
- [ ] Component inventory grep returns zero unconfigured names — see [§ Component inventory grep](#component-inventory-grep-must-run-check)
- [ ] No `^import ` lines remain in any `.mdx` content file
- [ ] `_snippets` entries exist in `cloudcannon.config.yml` (no `_snippets_imports` needed — built-in templates resolve automatically)
- [ ] Every component used in MDX content has a corresponding `_snippets` entry, or the file uses `_enabled_editors: [source, data]` only as a last resort with rationale in migration notes
- [ ] Components with `client:load` use raw snippet syntax, not templates
- [ ] `_inputs` are configured for constrained values (select dropdowns, url inputs, etc.)
- [ ] `astro build` passes cleanly
- [ ] Components in existing `.mdx` files should round-trip correctly (CC parses and re-serializes without losing attributes)
