# Snippet Gotchas

Common pitfalls when configuring CloudCannon snippets.

---

### Raw `key_values`: set `root_value_delimiter` and `string_boundary`

For typical `key="value"` attribute syntax, both belong in `format:`. The schema treats `format` and these fields as optional, but the parser’s defaults do not give you MDX/HTML-style parsing: without `root_value_delimiter` you get **Expected delimiter** (unless everything is implied via `allow_implied_values`). Without `string_boundary` including your quote character, quoted values are not parsed as strings. Template-based snippets set format internally; this applies to raw snippets.

```yaml
# Works
format:
  root_value_delimiter: '='
  string_boundary:
    - '"'

# Broken — missing root_value_delimiter
format:
  string_boundary:
    - '"'
```

---

### `key_values` models must be an array

Despite some CC docs examples showing `models` as an object (with source keys as map keys), the runtime validates `models` as an **array**. Use the same array format as template-based `named_args`:

```yaml
# Correct
models:
  - editor_key: id
    type: string

# Wrong — CloudCannon rejects this at runtime
models:
  id:
    editor_key: id
    type: string
```

---

### `_snippets_imports` can match unintended content

Don't use `_snippets_imports` during migrations — see [snippets.md § Configuration hierarchy](snippets.md#configuration-hierarchy) for the full rationale.

---

### Snippets matching inside code blocks

Custom snippets can also match inside fenced code blocks. If content files contain code examples that use the same syntax as a snippet (e.g. a documentation post showing `:::note` admonition syntax in a ` ```md ` block), the snippet parser will treat those as real snippets.

Fix: set `escape_snippets_in_code_blocks: true` in the markdown options. This should be enabled whenever snippets are configured:

```yaml
markdown:
  options:
    escape_snippets_in_code_blocks: true
```

---

### Import statements in content

Rich text editors show everything in the file. Import statements (`import X from 'y'`) will be visible to non-technical editors. Use your SSG's auto-import mechanism to avoid import statements in content files. See SSG-specific docs for details (e.g. `astro-auto-import` for Astro).

---

### Nested component children must use the `repeating` parser

For parent/child patterns like `<Tabs><Tab>...</Tab></Tabs>`, use the `repeating` parser with an **inline template** for the child — do NOT define the child as a separate `_snippets` entry. If you do, the content parser matches the child standalone before the parent's repeating parser runs, which empties the parent and breaks the match. See [raw.md](raw.md) for the `repeating` parser reference and a working example.

---

### Round-trip safety throws on unparseable stringify output

When CloudCannon serializes snippet data back to source text, it re-parses the output and compares the result. If re-parsing produces a different snippet sequence, it throws `"Stringified content would be unparseable"`. This usually means two snippets match overlapping syntax, or a format issue causes the re-parse to match differently. Fix the snippet config ambiguity rather than working around it.

---

### Don't use `argument` for HTML attribute values

The `argument` parser is designed for positional shortcode arguments (e.g. `{{<figure image.png>}}`). It does not work for values inside HTML `key="value"` attribute syntax — not even with `forbidden_tokens` or `string_boundary` in the format. The parser simply isn't built for that context.

**Always use `key_values`** for HTML attribute values. Pull the variable attributes into a single `[[placeholder]]` and leave fixed attributes in the literal text:

```yaml
# Correct — key_values for multiple variable attributes
snippet: |-
  <img [[img_attrs]] />
params:
  img_attrs:
    parser: key_values
    options:
      models:
        - editor_key: src
          type: string
        - editor_key: alt
          type: string
      format:
        root_value_delimiter: "="
        string_boundary:
          - '"'

# Correct — key_values even for a single variable attribute
# Fixed attributes (type) stay in the literal text after the placeholder
snippet: |-
  <source [[source_attrs]] type="video/mp4">
params:
  source_attrs:
    parser: key_values
    options:
      models:
        - editor_key: src
          type: string
      format:
        root_value_delimiter: "="
        string_boundary:
          - '"'

# Broken — argument parser cannot parse HTML attribute values
snippet: '<img src="[[src]]" alt="[[alt]]" />'
params:
  src:
    parser: argument
    options:
      model:
        editor_key: src
        type: string
```

---

### `_cc_` snippets are deprioritized in matching

Snippet types starting with `_cc_` are sorted after all user-defined snippets in the matching loop. This means your custom `_snippets` entries always get first chance to match. You don't need to worry about hidden catchall patterns (`_cc_*_unknown`) stealing matches from your explicit snippet configs — whenever those `_cc_*` snippets exist in config, they still lose to your explicit entries first (migrations without `_snippets_imports` typically never load those catchalls).
