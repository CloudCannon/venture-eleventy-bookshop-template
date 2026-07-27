# Built-in Snippet Templates

Reference for built-in snippet templates shipped with CloudCannon's snippet parser (`@cloudcannon/scrap-booker`). These resolve automatically when referenced by name in `_snippets` — no `_snippets_imports` required for template resolution.

> **Two layers:** Built-in **templates** (e.g. `mdx_component`) are always available by name in `_snippets`. **Pre-built snippet instances** (e.g. `_cc_mdx_unknown`) are a separate bundle that only loads via `_snippets_imports` — migrations skip this (see [snippets.md § Configuration hierarchy](snippets.md#configuration-hierarchy)). See [Built-in templates](#built-in-templates) vs [MDX default import bundle](#mdx-default-import-bundle) below.

For how to use templates in migrations, see [template-based.md](template-based.md). For raw snippet syntax, see [raw.md](raw.md).

> Only MDX templates are documented here (the only SSG currently supported). Templates for Hugo, Jekyll, Eleventy, and Markdoc exist in CloudCannon but are not covered until those SSGs are added to this skill.

---

## MDX (Astro, generic MDX)

JSX/MDX component syntax for Astro and generic MDX sites: built-in templates (always available by name) and, separately, optional pre-built snippets from the MDX default import bundle.

### Built-in templates

| Template               | Pattern                                    | Required definitions                          |
| ---------------------- | ------------------------------------------ | --------------------------------------------- |
| `mdx_component`        | `<[[name]][[args]]/>`                      | `component_name`, `named_args`                |
| `mdx_paired_component` | `<[[name]][[args]]>[[content]]</[[name]]>` | `component_name`, `named_args`, `content_key` |

See [template-based.md](template-based.md) for full usage guidance and examples.

### Internal format: `mdx_format`

The format object used internally by MDX templates. Useful when writing raw snippets that need to match MDX template behavior:

```yaml
root_value_delimiter: "="
root_value_boundary:
  start: "{"
  end: "}"
root_value_boundary_optional:
  string: true
root_pair_delimiter:
  - " "
string_boundary:
  - '"'
  - "'"
forbidden_tokens:
  - "/>"
  - ">"
allow_implied_values: true
```

Key behaviors from this format:

- String attributes use quotes: `prop="value"`
- Non-string attributes use braces: `prop={true}`, `prop={42}`
- Both single and double quotes accepted
- `/>` and `>` stop the key-value parser (end of tag)
- Bare attributes like `disabled` are allowed (`allow_implied_values`)

### MDX default import bundle

Requires `_snippets_imports` to load CloudCannon's MDX defaults. These entries are **not** the same as referencing `mdx_component` or `mdx_paired_component`: they are separate named snippets that match unrecognized MDX-ish content as hidden fallbacks (imports, unknown tags, `{expression}`, exports).

| Snippet                    | What it catches                                     |
| -------------------------- | --------------------------------------------------- |
| `import`                   | `import X from 'y'` statements                      |
| `_cc_mdx_unknown`          | Self-closing components: `<Unknown ... />`          |
| `_cc_mdx_paired_unknown`   | Paired components: `<Unknown ...>content</Unknown>` |
| `_cc_mdx_unknown_template` | Expression templates: `{expression}`                |
| `_cc_mdx_unknown_export`   | Named exports: `export const x = value;`            |

Without `_snippets_imports` for MDX defaults, none of the rows above are registered — only the explicit `_snippets` entries you define (using built-in templates or raw config) apply.

---

## Parser Internals

### `repeating_literal` parser

Matches a literal character repeated N or more times. Used for patterns like variable-length backtick fences.

```yaml
params:
  backticks:
    parser: repeating_literal
    options:
      literal: "`"
      minimum: 3
      default: 3
```

### `_cc_` prefix deprioritization

Snippet types starting with `_cc_` are sorted after all other snippets in the matching loop. User-defined snippets always get first chance to match before `_cc_*` patterns **that are actually present** in the config (for example from the MDX default import bundle or from your own `_cc_*` snippet names). A migration with no `_snippets_imports` does not load `_cc_mdx_unknown` and similar catchalls at all.

### Round-trip safety

When CloudCannon serializes snippet data back to source text, it re-parses the output and compares the result. If re-parsing produces a different snippet sequence, it throws `"Stringified content would be unparseable"`. Fix the snippet config ambiguity rather than working around it.

### `alternate_formats`

An array of alternative snippet configurations tried when the primary parse fails. Each entry is a full snippet config. The first successful match wins. On save, CloudCannon always uses the primary format — `alternate_formats` only affects parsing of existing content.
