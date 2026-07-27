# Raw Snippets

Use when the SSG's component syntax doesn't match an available template — for example, when extra directives like Astro's `client:load` need to appear literally, or when you need fine-grained control over parsing.

Read [snippets.md](snippets.md) first for overview, imports, and shared snippet properties.

---

## How it works

Define a `snippet` string with `[[placeholder]]` markers, then configure a `params` entry for each placeholder with a parser type and options.

```yaml
_snippets:
  youtube:
    snippet: "<Youtube client:load [[named_args]] />"
    params:
      named_args:
        parser: key_values
        options:
          models:
            - editor_key: id
              type: string
          format:
            root_value_delimiter: "="
            string_boundary:
              - '"'
```

Text outside `[[placeholders]]` is literal — it appears as-is in the output and must match in the source for the snippet to be recognized.

---

## Parser types

Each `params.*` entry has a `parser` key. Pick from the table below, then read the matching section for options.

| Parser              | Purpose                                                   | Use when                                                                                                         | See                                                                       |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `key_values`        | Key=value attribute pairs                                 | `<Component prop="val" other={expr} />` — the most common case                                                   | [§ key_values](#key_values--keyvalue-pairs)                               |
| `content`           | Rich multiline content between paired tags                | `<Component>inner body</Component>` — paired components with rich inner content                                  | [§ content](#content--rich-multiline-content)                             |
| `argument`          | Single positional value (shortcode-style)                 | `{{<figure image.png>}}` — positional args. Don't use for HTML attribute values (`src="..."`); use `key_values`. | [§ argument](#argument--single-positional-argument)                       |
| `argument_list`     | Multiple positional values in order                       | Shortcodes with ordered args like `{{<video src.mp4 640 480>}}`                                                  | [§ argument_list](#argument_list--multiple-distinct-positional-arguments) |
| `literal`           | Exact fixed string                                        | Inside custom templates, to lock a literal value via `ref`                                                       | [§ literal](#literal--exact-fixed-value)                                  |
| `optional`          | Higher-order wrapper making another parser optional       | Zero-or-one wrap around another parser                                                                           | [§ optional](#optional--higher-order-wrapper)                             |
| `repeating_literal` | A single character repeated N+ times                      | Variable-length fences like ` ``` ` / ` ```` `                                                                   | [§ repeating_literal](#repeating_literal--repeated-literal-character)     |
| `repeating`         | Repeat a child inline template as array items             | Parent/child patterns like `<Tabs><Tab>…</Tab></Tabs>`. Don't define the child as a separate `_snippets` entry.  | [§ repeating](#repeating--repeat-a-child-pattern-as-array-items)          |
| `wrapper`           | Embed one inline pattern inside another (single instance) | Like `repeating` but produces one instance, not an array                                                         | [§ wrapper](#wrapper--embed-one-inline-pattern-inside-another)            |

### `key_values` — key=value pairs

The most common parser for component attributes. Handles `key="value"` or `key={expression}` syntax.

Options:

- `models` (array, required) — snippet model configs for each attribute (see [template-based.md](template-based.md) for the model reference)
- `format` (object) — Parsing format (see Snippet Format below). Optional for the validator, but for typical attribute lists (`key="value"` or `key={expression}`) treat it as **required**: set at least `root_value_delimiter` and `string_boundary`. Without them, quoted values and `=` pairs do not parse as intended. Omit only when you rely solely on implied keys (`allow_implied_values: true`) and unquoted values.
- `style` (object) — output formatting (inline/block whitespace)

```yaml
params:
  named_args:
    parser: key_values
    options:
      models:
        - editor_key: url
          source_key: href
          type: string
        - editor_key: target
          type: string
          optional: true
      format:
        root_value_delimiter: "="
        string_boundary:
          - '"'
```

### `content` — rich multiline content

Parses content between paired tags. Supports nested snippets.

Options:

- `editor_key` (string, required) — key in the editor for the content
- `allow_nested` (boolean) — recognize nested snippets within the content
- `raw` (boolean) — treat content as raw text (no markdown parsing)
- `forbidden_tokens` (array) — characters that stop the parser
- `optional` (boolean) — whether content is required
- `trim_text` (boolean) — trim leading/trailing whitespace

```yaml
params:
  inner_content:
    parser: content
    options:
      editor_key: body_text
      allow_nested: true
```

### `argument` — single positional argument

Parses a single value, optionally delimited by characters. Best for shortcode-style positional args (e.g. `{{<figure image.png>}}`).

**Do not use `argument` for HTML attribute values** (e.g. `src="[[src]]"`). It does not work in that context, even with `forbidden_tokens` or `string_boundary`. Use `key_values` instead — see [gotchas](gotchas.md#dont-use-argument-for-html-attribute-values).

Options:

- `model` (object) — snippet model config for the value
- `format` (object) — Parsing format (see Snippet Format below). Same practical rule as `key_values`: for quoted or delimited values, set the `format` fields the parser needs; empty defaults rarely match real syntax.

### `argument_list` — multiple distinct positional arguments

Options:

- `models` (array) — ordered array of snippet models, one per position

### `literal` — exact fixed value

Matches a specific literal string. Mainly used within custom templates.

Options:

- `literal` (string or ref) — the exact value to match

### `optional` — higher-order wrapper

Makes another parser optional (matching zero times is valid).

### `repeating_literal` — repeated literal character

Matches a single character repeated N or more times. Used for patterns like variable-length backtick fences (` ``` `, ` ```` `, etc.).

Options:

- `literal` (string, required) — the character to repeat
- `minimum` (number) — minimum number of repetitions required
- `default` (number) — repetitions to use when creating a new snippet

```yaml
params:
  backticks:
    parser: repeating_literal
    options:
      literal: "`"
      minimum: 3
      default: 3
```

### `repeating` — repeat a child pattern as array items

Parses a repeating inline template and presents matched items as a structured array in the editor (add/remove/reorder).

Options:

- `snippet` (string, required) — an **inline template string** with `[[placeholder]]` markers for the child pattern. This is NOT a reference to another `_snippets` entry — it is the raw template for a single repeated item, e.g. `'<Tab [[named_args]]>[[content]]</Tab>'`.
- `editor_key` (string) — key for the array input in the editor
- `default_length` (number) — how many items to create when inserting a new snippet. Default `1`.
- `style` (object) — controls output formatting:
  - `output` — `block` or `inline`
  - `between` — delimiter string between repeated items (e.g. `"\n\n"`)
  - `block.leading` / `block.trailing` — whitespace before/after the group
  - `block.indent` — indentation for each item
- `optional` (boolean) — allow zero items. Default `false`.

**Critical**: The `[[placeholder]]` markers in the inline template reference params in the **parent snippet's** `params` block. The repeating parser's sub-parser inherits the parent's full params, so child param definitions must sit alongside the repeating param definition — not in a separate snippet.

**Do not** define the child component as a separate `_snippets` entry. If you do, the content parser will match it standalone before the parent's repeating parser runs, stealing the child elements and leaving the parent empty.

```yaml
_snippets:
  tabs:
    snippet: "<Tabs client:load>[[repeating_tabs]]</Tabs>"
    inline: false
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

Note: `named_args` and `tab_content` are in the same `params` block as `repeating_tabs` — the sub-parser inherits them and uses them to parse the inline template.

### `wrapper` — embed one inline pattern inside another

Like `repeating`, but produces a single instance instead of an array. The `options.snippet` is an **inline template string** (same rules as `repeating` — NOT a snippet name reference). The sub-parser inherits the parent's `params`.

Options:

- `snippet` (string, required) — inline template string with `[[placeholder]]` markers
- `remove_empty` (boolean) — remove the wrapper output when all its fields are empty

```yaml
params:
  wrapped:
    parser: wrapper
    options:
      snippet: "<Inner [[inner_args]] />"
  inner_args:
    parser: key_values
    options:
      models:
        - editor_key: size
          type: string
      format:
        root_value_delimiter: "="
        string_boundary:
          - '"'
```

---

## Snippet Format

Controls how values are parsed and serialized. Applied via the `format` key in parser options. The parser still applies internal defaults when `format` is omitted or partial (often empty arrays or unset delimiters), but **those defaults do not reproduce MDX/JSX or HTML attribute syntax**. Raw snippets do not inherit template-based format presets — you must supply the fields your syntax needs. Template-based snippets set format internally.

### Core fields (used in most raw snippets)

| Field                  | Type             | Default  | Description                                                                                                                                |
| ---------------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `root_value_delimiter` | string           | **none** | Delimiter between key and value. Use `'='` for MDX/JSX (`key="val"`), `': '` for Liquid (`key: "val"`). **Must always be set explicitly.** |
| `string_boundary`      | array of strings | **none** | Quote characters for string values. Usually `['"']`. Without this, strings won't be parsed.                                                |
| `root_pair_delimiter`  | array of strings | **none** | Delimiter between key-value pairs. Usually `[' ']` (space).                                                                                |
| `forbidden_tokens`     | array of strings | **none** | Characters that stop the parser. Useful to prevent greedy matching.                                                                        |

### Value type parsing

| Field                  | Type    | Default | Description                                                                                                          |
| ---------------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `allow_booleans`       | boolean | `false` | Parse unquoted `true`/`false` as booleans                                                                            |
| `allow_numbers`        | boolean | `false` | Parse unquoted numeric values as numbers                                                                             |
| `allow_null`           | boolean | `false` | Parse `null` as a null value                                                                                         |
| `allow_implied_values` | boolean | `false` | Allow keys without values to imply `true`. For attributes like `<Component disabled />` where `disabled` has no `=`. |

### Expression boundaries (MDX `{expression}` syntax)

| Field                          | Type                  | Description                                                                                                                                                   |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root_value_boundary`          | object `{start, end}` | Boundary tokens around values. MDX uses `{ start: "{", end: "}" }` for expression syntax like `prop={true}` or `prop={42}`.                                   |
| `root_value_boundary_optional` | object                | Which value types don't require boundaries. MDX uses `{ string: true }` so strings can be `prop="val"` (quoted) while non-strings use `prop={true}` (braced). |

These two fields work together. When `root_value_boundary` is set to `{ start: "{", end: "}" }` and `root_value_boundary_optional: { string: true }`, the parser handles both `prop="string"` and `prop={true}` in the same snippet.

### String handling

| Field                     | Type   | Default  | Description                                                                                                       |
| ------------------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `string_escape_character` | string | **none** | Character for escaping string boundaries. Usually `'\'`. Set this if attribute values may contain escaped quotes. |
| `allowed_string_cases`    | object | **none** | Restrict which case types are valid: `{ any, leading_upper, leading_lower, lower, upper }`. Rarely needed.        |

### Advanced (rarely needed in migrations)

| Field                        | Type                  | Description                                                                      |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `root_boundary`              | object `{start, end}` | Boundary tokens enclosing the entire key-value segment                           |
| `remove_empty_root_boundary` | boolean               | Remove root boundary tokens when the segment is empty. Default `false`.          |
| `object_boundary`            | object `{start, end}` | Start/end tokens for inline object literals (usually `{ start: "{", end: "}" }`) |
| `object_value_delimiter`     | string                | Key-value delimiter within objects (usually `':'`)                               |
| `object_pair_delimiter`      | string                | Pair delimiter within objects (usually `','`)                                    |
| `array_boundary`             | object `{start, end}` | Start/end tokens for inline array literals (usually `{ start: "[", end: "]" }`)  |
| `array_delimiter`            | string                | Item delimiter within arrays (usually `','`)                                     |

For the full reference of all format options, see the [CloudCannon Snippet Format docs](https://cloudcannon.com/documentation/developer-reference/configuration-file/types/snippet-format/).

### Common format presets

**MDX/JSX attributes** (`key="value"` and `key={expression}`):

```yaml
format:
  root_value_delimiter: "="
  string_boundary:
    - '"'
  root_value_boundary:
    start: "{"
    end: "}"
  root_value_boundary_optional:
    string: true
  allow_booleans: true
  allow_numbers: true
```

**MDX/JSX attributes — strings only** (the minimum for most cases):

```yaml
format:
  root_value_delimiter: "="
  string_boundary:
    - '"'
```

**Liquid-style** (`key: "value"`):

```yaml
format:
  root_value_delimiter: ": "
  root_pair_delimiter:
    - ","
  string_boundary:
    - '"'
```

---

## Custom templates for repeated patterns

If multiple components share the same structure (e.g. several self-closing components that all need `client:load`), define a `_snippets_templates` entry to avoid repeating the raw snippet/params pattern:

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

Then use it in `_snippets`:

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

The `ref:` syntax pulls values from `definitions`, so each snippet only needs to specify what varies.
