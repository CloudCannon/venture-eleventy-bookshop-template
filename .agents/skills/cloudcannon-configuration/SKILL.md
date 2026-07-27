---
name: cloudcannon-configuration
description: >-
  Use when configuring a site for CloudCannon for any of the following. Download
  the JSON schemas before writing any configuration (see the top of SKILL.md).

  - Setting up cloudcannon.config.yml or .cloudcannon/initial-site-settings.json
  - Generating a baseline with the CloudCannon CLI
  - Adding or modifying Collections, Inputs, Structures, or Select Data
  - Setting up Structures for Array and Object Inputs
  - Configuring Collection URLs
  - Troubleshooting missing fields or Input types
---

# CloudCannon configuration

## Do this before writing any configuration

```bash
mkdir -p .cloudcannon/migration
curl -sL "https://github.com/cloudcannon/configuration-types/releases/latest/download/cloudcannon-config.latest.schema.json" \
  -o .cloudcannon/migration/cloudcannon-config.latest.schema.json
curl -sL "https://github.com/cloudcannon/configuration-types/releases/latest/download/cloudcannon-initial-site-settings.schema.json" \
  -o .cloudcannon/migration/cloudcannon-initial-site-settings.schema.json
```

Do not proceed until both files exist. Training data hallucinates keys — the schemas are the only authoritative source.

These are large generated reference files, not project artefacts — add `.cloudcannon/migration/*.schema.json` to `.gitignore` so they aren't committed. (The migration phase docs in the same folder are intentional and should be kept.)

**Before writing any key, query the schema:**

```bash
# List all valid keys for a section (e.g. collections_config entries)
jq '.definitions["collections_config.*"].properties | keys' .cloudcannon/migration/cloudcannon-config.latest.schema.json

# Check whether a specific key exists
jq '.definitions["collections_config.*"].properties.disable_file_actions' .cloudcannon/migration/cloudcannon-config.latest.schema.json

# List all valid input type values
jq '[.definitions | to_entries[] | select(.key | test("Input$")) | .key]' .cloudcannon/migration/cloudcannon-config.latest.schema.json

# List valid keys for _editables.content (BlockEditable)
jq '.definitions.BlockEditable.properties | keys' .cloudcannon/migration/cloudcannon-config.latest.schema.json

# List valid keys on a structure value item
jq '.definitions["type.structure.values.[*]"].properties | keys' .cloudcannon/migration/cloudcannon-config.latest.schema.json
```

No `jq`? Use Node:

```bash
node -e "const s=require('./.cloudcannon/migration/cloudcannon-config.latest.schema.json'); console.log(Object.keys(s.definitions['collections_config.*'].properties))"
```

Do not add a `# yaml-language-server: $schema=...` comment to `cloudcannon.config.yml`.

This skill covers creating and customizing `cloudcannon.config.yml` (tells CloudCannon how to understand and present your site's content), and `.cloudcannon/initial-site-settings.json` (tells CloudCannon how build your site).

Generate a baseline configuration with the CloudCannon CLI, if `cloudcannon.config.yml` does not already exist, run:

```bash
npx @cloudcannon/cli configure generate --auto --initial-build-settings
```

This detects your SSG, collections, and build settings, and writes `cloudcannon.config.yml` and `.cloudcannon/initial-site-settings.json`. The output likely needs customization — it does not infer input types, structures, select data, or editor toolbars. See [cloudcannon-cli-guide.md](cloudcannon-cli-guide.md) for step-by-step control and customization targets.

## Common invalid keys

Observed LLM hallucinations — not exhaustive, the JSON schemas are authoritative. Each row specifies the real key for each hallucination. Run `npx @cloudcannon/cli validate` to catch unknown keys automatically — see [cloudcannon-cli-guide.md § Validating Configuration](cloudcannon-cli-guide.md#validating-configuration).

| Wrong                                                               | Correct                                                                                                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `disable_url_preview: true`                                         | `disable_url: true` (toggles whether the collection has an output URL)                                                                          |
| `output: false` (legacy Jekyll/Hugo/Eleventy key)                   | Omit `url:` and add `disable_url: true` — or use `data_config` instead of a collection                                                          |
| `type: hidden` (deprecated value)                                   | `hidden: true` (sibling of `type`, works on any input; also `hidden: "<query>"` for conditional hiding)                                         |
| `options.max` on text/textarea                                      | `options.max_length` (paired with `min_length`)                                                                                                 |
| `_editables.text: { bulletedlist, blockquote, format, table, ... }` | `_editables.text` is inline-only (`TextEditable`). For block-level formatting use `_editables.content` or `_editables.block` (`BlockEditable`)  |
| `heading2: true`, `heading3: true`                                  | `format: "p h1 h2 h3 h4 h5 h6"` (space-separated string)                                                                                        |
| `options.collections: [team]` (invented)                            | `values: collections.team` with `value_key` / `preview`                                                                                         |
| `options.structures: my_blocks` (bare name, invalid)                | `options.structures: _structures.my_blocks` (full path)                                                                                         |
| `timezone: "+10:00"` (UTC offset, invalid)                          | `timezone` is a top-level key and a strict IANA-name enum (e.g. `Australia/Melbourne`, `America/New_York`), not a UTC offset. Default `Etc/UTC` |
| `paths.collections`, `paths.data` (legacy keys)                     | No such keys. Use `collections_config.<name>.path` and `data_config.<name>.path`                                                                |
| Arbitrary Material Symbols name (e.g. `place`)                      | Icon must be in the fixed enum (e.g. `location_on`). Invalid names silently fall back — check the schema for names                              |

## Symptom-driven gotchas

Issues you'll hit while configuring or debugging a real site, with their fix.

| Symptom                                                                                                                                      | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hardcoded `{value, label}` pairs for values that live in a data file                                                                         | Reference `values: data.<file>` + `value_key` + `preview` so the dropdown stays in sync with the data.                                                                                                                                                                                                                                                                                                                                                                             |
| Defined a switch/boolean in `_inputs` but the template never reads it                                                                        | An editor-visible switch that toggles nothing is a broken UX signal. For every boolean/enum field, grep the template for a conditional render. If none, add one or remove the field.                                                                                                                                                                                                                                                                                               |
| `type: markdown` with no `options:`, or using plural `snippets:`                                                                             | Editor shows an "unconfigured snippets" toolbar. Every markdown input needs explicit `options:`. Once you declare any option, all omitted keys become false. Valid keys: `bold`, `italic`, `link`, `bulletedlist`, `numberedlist`, `blockquote`, `format`, `image`, `removeformat`, `table`, `snippet` (singular). The inline `data-editable="text" data-type="block"` region and the sidebar input panel are independent channels — configuring one does not configure the other. |
| Data file is a top-level object keyed by slug (`{ "office-a": {...}, "office-b": {...} }`)                                                   | Editors can't add a third item — keys are baked into `file_config`. Convert to a top-level array with an explicit `slug` field per item; consumers switch from `data[slug]` to `data.find(d => d.slug === s)`. `values: data.<file>` + `value_key: slug` is unchanged.                                                                                                                                                                                                             |
| Visual editor errors on one entry but not others — the errored entry has a frontmatter field populated that the template renders as editable | The collection's `_inputs` has no entry for that field. Grep every `data-prop=` in the template, grep `_inputs:` in the collection config, diff the keys. Any editable region without a matching `_inputs` entry is the bug. Add an entry whose `type:` matches the region's `data-type`.                                                                                                                                                                                          |

## Docs

| Doc                                                  | When to read                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [cloudcannon-cli-guide.md](cloudcannon-cli-guide.md) | Generating baseline config with the CloudCannon CLI                                                                           |
| [structures.md](structures.md)                       | Defining structures for arrays and object inputs. **Read this early** — missing structures are the most common config mistake |
| [collection-urls.md](collection-urls.md)             | URL patterns for collections. Wrong URLs = pages won't load in the Visual Editor                                              |

**SSG-specific:**

| SSG   | Doc                                                              | Purpose                                                                         |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Astro | [astro/configuration.md](astro/configuration.md)                 | Full configuration workflow, customization checklist, verification checklist    |
| Astro | [astro/configuration-gotchas.md](astro/configuration-gotchas.md) | Icon fields, numeric values, markdown tables, and other Astro-specific pitfalls |

## Key concepts

### CloudCannon CLI

`npx @cloudcannon/cli configure generate --auto --initial-build-settings` produces a structural baseline. It detects your SSG, collections, and build settings. **CloudCannon CLI output always needs customization** — it does not infer input types, structures, select data, or editor toolbar configuration.

### Structures

Every array and object input needs a structure definition. Without one, editors can't add new items. See [structures.md](structures.md) for the field completeness rule and definition patterns.

### Collection URLs

Collections that produce pages need a `url` pattern so the Visual Editor can open them. A wrong URL is the most common reason pages fail to load in the Visual Editor. See [collection-urls.md](collection-urls.md).

### Inputs

Every user-facing frontmatter field needs an `_inputs` entry with the right type (`textarea`, `datetime`, `image`, `select`, `markdown`, `html`, etc.). CloudCannon's type inference is a fallback — don't rely on it.

### Multi-schema collections

One collection, many schemas. Don't make a new collection just because you need a new schema. Both CloudCannon (`schemas:` config) and Astro (Zod `z.union`) support multiple schemas in one collection. A `pages` collection can hold a default markdown page, a page-builder page, and a landing page side-by-side. See [astro/configuration.md § Schemas](astro/configuration.md#schemas) for the worked pattern.

## Checklist reinforcement

The SSG-specific configuration docs contain detailed verification checklists. These are not optional.

- **Read the checklist BEFORE starting** so you know what to aim for
- **You are not done until every checklist item is verified**
- **After every round of changes, run `npx @cloudcannon/cli validate`** — fixes unknown keys and type errors before they become hard-to-debug editor issues. See [cloudcannon-cli-guide.md § Validating Configuration](cloudcannon-cli-guide.md#validating-configuration)
- Cross-reference every Zod schema field against `_inputs` — missing fields get wrong editor types
- Every Array Input needs both a structure definition AND an `_inputs` entry linking to it

## Common mistakes

| Excuse                                                                                 | Reality                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The CloudCannon CLI output is good enough"                                            | The CloudCannon CLI gives a baseline. It always needs customization — inputs, structures, select data, toolbars.                                                                                                                                                                                                        |
| "This array doesn't need a structure"                                                  | Every array needs a structure or editors can't add items. No exceptions.                                                                                                                                                                                                                                                |
| "I'll add `_inputs` config later"                                                      | Missing inputs now means broken editing later. Configure as you go.                                                                                                                                                                                                                                                     |
| "CloudCannon will infer the right input type"                                          | CC's inference is a fallback to configuration. Explicit `_inputs` entries prevent wrong editor types.                                                                                                                                                                                                                   |
| "The URL pattern looks right"                                                          | Test it. Wrong URLs are the #1 reason pages fail to load in the Visual Editor. Check trailing slashes.                                                                                                                                                                                                                  |
| "Data collections don't need configuration"                                            | Data files need `data_config` entries with `file_config` for proper input types and structures.                                                                                                                                                                                                                         |
| "I don't need `_select_data` — editors can type values"                                | Free-text entry leads to inconsistency. Use `_select_data` for any field with a fixed set of valid values.                                                                                                                                                                                                              |
| "I split theme/navigation/socials into 3 collections for nicer sidebar icons"          | Single `data` collection + per-file `file_config` is the default; use `$.options.preview.icon` on each file's root to get per-file icons without the config bloat. See [astro/configuration.md § Single `data` collection or split?](astro/configuration.md#single-data-collection-or-split).                           |
| "I copied the colors block from a reference config — it has `accent` and `background`" | Before adding `_inputs`, grep the actual JSON for keys. Inputs for missing keys are silently ignored; missing inputs for real keys fall through to plain text. See [astro/configuration-gotchas.md § Data inputs must follow the JSON](astro/configuration-gotchas.md#data-inputs-must-follow-the-json-not-a-template). |
| "The icon field is optional so I left it out of the structure value"                   | Every field that appears on any item must be in the value template with a default — otherwise CC can't match existing items and editors can't add the field to new ones. See [structures.md § Common mistakes — optional fields](structures.md#common-mistakes--optional-fields).                                       |
| "It's just a string field, `type: text` is fine"                                       | If the component branches on the value (`variant === 'primary'`, `target === '_blank'`), it's an enum. Use `type: select` with the known values. Free-text for an enum is a silent-bug factory.                                                                                                                         |
