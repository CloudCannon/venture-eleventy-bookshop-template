# Structures

Structures are templates that define the complete shape of data in CloudCannon. They serve two purposes:

1. **Array items** — when an editor adds a new item to an array (e.g. a `content_blocks` page builder), the structure populates the item with all required fields.
2. **Object inputs** — when an object input is empty, a structure tells CloudCannon what fields to offer when the editor populates it.

Without structures, CloudCannon can't populate new array items or empty objects, and existing items may have `undefined` fields that break editable regions in the visual editor.

## The four rules (read first)

These are non-optional. Each gets expanded later in this doc, but the table is the quick reference.

| #   | Rule                                                                                                                                                        | Failure mode if skipped                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Every field in a structure `value` is present in the content frontmatter, even if empty.                                                                    | `undefined` errors in the visual editor. Most common migration bug.                     |
| 2   | Every array and object input has an `_inputs` entry with `type: array`/`type: object` and an explicit `options.structures: _structures.<name>` (full path). | Editors cannot add items — the Add button won't appear or offers the wrong structure.   |
| 3   | Every structure value includes a `preview` block with a meaningful `text` key lookup.                                                                       | Sidebar cards show only the generic label ("Item", "Action") instead of a useful value. |
| 4   | Every nested object field editors see has `type: object` + `options.preview.icon`.                                                                          | Generic icon in the data editor; visual clutter.                                        |

These apply in both the main `cloudcannon.config.yml` AND inside co-located structure-value files. Define structures during the configuration phase and use them as the blueprint when creating content files in the content phase — not as a backfill step.

## Field completeness rule (rule #1)

For each content block in a page's `content_blocks` array, open the structure definition and verify that **every single key** appears in the content. The rule covers any field that appears on any item — rare (1 of 10 items), conditional (only populated when `type: dropdown`), or purely decorative. Commonly forgotten: `tagline`, `content`, `subtitle`, and nested object fields like `callToAction.variant`, `callToAction.icon`, `callToAction.target`.

After creating or editing content files, cross-reference every block in every content file against its structure definition. Field omissions are the single most common source of CloudCannon editor errors.

### Optional fields — common mistake

Don't leave an optional field out of the structure `value` because "only some items use it." Every field that appears on any item must be in the value template with a sensible default (`""`, `false`, `0`, `[]`). Omitting it means:

- CloudCannon can't match an existing item that _does_ have the field to the structure
- Editors can't add the field to new items from the sidebar
- Items with the field round-trip as "unknown" in the editor

Example — a `nav_items` structure where only the GitHub link has an `icon`:

```yaml
# ❌ Wrong — no icon field in the value template
value:
  type: link
  label: Label
  href: /
  external: false

# ✓ Right — icon present as empty default
value:
  type: link
  label: Label
  href: /
  icon: ""
  external: false
```

### Don't seed empty strings for genuinely-optional fields

There's a tension with rule #1: every field that appears on any item must be in the value, but an `""` default for a field no item should have **on creation** persists into frontmatter and breaks downstream conditionals.

```yaml
# ❌ Wrong — empty string persists, satisfies z.string().optional(), surfaces as a visible empty editable region
value:
  heading: Ready to Begin Your Journey?
  primaryLabel: Schedule a Consultation
  secondaryLabel: ""   # breaks ?.trim() button conditionals
  secondaryHref: ""

# ✓ Right — omit optional fields the editor adds explicitly
value:
  heading: Ready to Begin Your Journey?
  primaryLabel: Schedule a Consultation
```

Reconcile: rule #1 means "if any **existing** item has the field, the value template must declare it (with empty default)." It does NOT mean "seed every nullable field as `''`." Audit `*.cloudcannon.structure-value.yml`, `_structures.*.values[].value` in `cloudcannon.config.yml`, and `.cloudcannon/schemas/<collection>.md` — every `: ""` is either a real default (keep) or an over-eager seed (delete).

### Handling null values from empty YAML fields

In YAML, a bare key with no value (`tagline:`) parses as `null`, not as an empty string or `undefined`. Zod's `.optional()` accepts `undefined` but rejects `null`, so content files with empty fields can silently fail validation. Use one of the two approaches below:

| Approach         | How                                                                                                      | When to use                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Zod `.nullish()` | Replace `.optional()` with `.nullish()` on optional fields. Accepts `T \| null \| undefined`.            | Default — no per-field CC configuration needed.                                          |
| CC `empty_type`  | Set `empty_type: string` (or appropriate type) on the input in `_inputs`. Writes `""` instead of `null`. | When downstream code distinguishes `null` from `""`, or the Zod schema must stay strict. |

When using `.nullish()`, component templates should still use truthiness checks (`{title && ...}`) — both `null` and `""` are falsy.

## Inline approach (small sites)

For sites with fewer than 5 block types, define structures directly in `cloudcannon.config.yml`:

```yaml
_structures:
  content_blocks:
    values:
      - label: Banner
        icon: flag
        value:
          _type: banner
          title:
          content:
          image:
            src:
            alt:
      - label: Rich Text
        icon: article
        value:
          _type: rich_text
          content:

_inputs:
  content_blocks:
    type: array
    options:
      structures: _structures.content_blocks
```

Use the full `_structures.<name>` path, not the bare name. Naming-convention fallback is unreliable.

```yaml
# ❌ Wrong — bare name, relies on naming-convention fallback
options:
  structures: content_blocks

# ✓ Right — full path
options:
  structures: _structures.content_blocks
```

## Split co-located approach (5+ block types)

Each component gets its own structure file next to it:

```
src/components/
  Hero.astro
  hero.cloudcannon.structure-value.yml
  Features.astro
  features.cloudcannon.structure-value.yml
```

The input uses `values_from_glob` to collect them all:

```yaml
_inputs:
  content_blocks:
    type: array
    options:
      structures:
        values_from_glob:
          - /src/components/*.cloudcannon.structure-value.yml
```

**Naming:** Structure-value files use the `_type` key as filename prefix: `hero.cloudcannon.structure-value.yml` for `_type: hero`.

### `values_from_glob` vs `_structures_from_glob`

| Helper                  | What it imports                                                                          | Use when                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `values_from_glob`      | Individual structure values into an array. One file = one structure value.               | Split co-located approach (one file per component). Default choice.                      |
| `_structures_from_glob` | Named structure groups. One file defines an `_structures`-like block with multiple keys. | Grouping multiple related structures in one file (e.g. `header_links` + `footer_links`). |

## Shared sub-structures

Structures used by multiple block types — like `actions` (button arrays), `items` (feature/step lists), `stats`, `prices`, `testimonials` — stay in the main `cloudcannon.config.yml` under `_structures`. They're referenced by name from within the structure-value files and from the config.

**Only share when all consumers render the same fields.** If one component renders fields the others don't, create a separate structure for it instead of a union. A Timeline component rendering `job_title`, `company`, and `date_range` shouldn't share an `items` structure with an ItemGrid that only renders `title`, `description`, `icon` — create a `timeline_items` structure. Union structures clutter the editor with inputs that do nothing; editors fill them in expecting results on the page and get confused when nothing appears.

### Shared structure → shared preview

A structure's `preview` applies wherever the structure is used — a shared `_nav_items` can't have different icons per consumer. Pick an icon meaningful to the structure's own identity (`link` for `_nav_items`, `help` for `_faq_items`), not to any one consumer's context.

❌ Forking `_nav_items` into `_nav_items_primary` / `_nav_items_footer` just to vary the icon — clutters `_structures` with near-duplicates.
❌ Adding `[*]` overrides on the array per-consumer to "override" the preview — silently ignored when `structures:` is defined (see [configuration-gotchas.md § Array item previews](astro/configuration-gotchas.md#array-item-previews--vs-structure-value)).
✓ One structure, one preview. If two consumers truly need different previews, they need different structures.

### Duplicated select values across structure-value files

If two structure-value files define the same color palette or icon enum, a third will drift. Move shared enums to `_select_data.<name>` at the root of `cloudcannon.config.yml` and reference with `values: _select_data.<name>`.

```yaml
_structures:
  actions:
    values:
      - label: Action
        preview:
          text:
            - key: text
            - Action
          icon:
            - ads_click
        value:
          text:
          href:
          variant: primary
          icon:
          target:
  items:
    values:
      - label: Item
        preview:
          text:
            - key: title
            - Item
          icon:
            - list
        value:
          title:
          description:
          icon:
```

Shared sub-structures need `preview` blocks like any other structure — inline location is not an excuse to omit them.

**Linking sub-structures from co-located files:** Every co-located structure-value file that contains an array field (`items: []`, `actions: []`, etc.) must include an `_inputs` entry linking that array to the shared sub-structure:

```yaml
_inputs:
  items:
    type: array
    options:
      structures: _structures.items
```

The same applies to nested arrays inside shared sub-structures (e.g. if `prices` contains `items: []`, the `prices` structure definition must include `_inputs.items` linking to `_structures.items`).

## Previews

Previews go on **every** structure value — co-located `*.cloudcannon.structure-value.yml` files, inline `_structures` entries in the main config, AND inline structures defined inside `file_config._inputs` for data files. If an array has `structures:`, its item previews live here, **not** on the array's `[*]` path — see [configuration-gotchas.md § Array item previews](astro/configuration-gotchas.md#array-item-previews--vs-structure-value).

Every structure value should include both `picker_preview` and `preview`:

| Preview          | Where it shows                       | Key lookups                                                         | Typical shape                             |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------- |
| `picker_preview` | Modals (Add menu, structure picker)  | Often won't resolve (item has no data yet) — use literal fallbacks. | Literal `text` + `icon`.                  |
| `preview`        | Sidebar cards, collection file lists | Supported — pull data from the item with literal fallbacks.         | Cascade: `key:` lookup, literal fallback. |

Both accept cascading arrays for `text`, `icon`, `image`, and `subtext`. Default to arrays for consistency. CloudCannon tries each cascade entry in order and uses the first non-empty result. Literal strings (not `{key: ...}` objects) serve as fallbacks.

```yaml
label: Hero
icon: flag
picker_preview:
  text:
    - Hero
  icon:
    - flag
preview:
  text:
    - key: title
    - Hero
  icon:
    - flag
  image:
    - key: image.src
value:
  _type: hero
  title:
  subtitle:
```

## Structure-value file anatomy

A complete `*.cloudcannon.structure-value.yml` file:

```yaml
label: Content
icon: article
picker_preview:
  text:
    - Content
  icon:
    - article
preview:
  text:
    - key: title
    - Content
  icon:
    - article
value:
  _type: content
  title:
  subtitle:
  tagline:
  content:
  items: []
  image:
    src:
    alt:
  isReversed: false
  isAfterContent: false
_inputs:
  content:
    type: html
    options:
      allow_custom_markup: true
  image:
    type: object
    options:
      preview:
        icon: image
  isReversed:
    type: switch
  isAfterContent:
    type: switch
```

| Key              | Purpose                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `label`          | Display name in the Add menu                                                                      |
| `icon`           | Material Icons name                                                                               |
| `picker_preview` | How it looks in modals (Add menu, structure picker)                                               |
| `preview`        | How it looks as a card elsewhere (sidebar, collection lists) — cascade format with `key:` lookups |
| `value`          | The data template — `_type` discriminator plus all fields                                         |
| `_inputs`        | Field type configuration scoped to this component                                                 |

### The `_type` discriminator

Every structure value must include a discriminator key so CloudCannon can match array items to the correct structure definition. `_type` is our standard — the name is arbitrary (`_name`, `_component`) but must be consistent across all values in a given array. The discriminator value must match the key used in `componentMap` and `registerAstroComponent` calls.

### Scoped `_inputs`

Field type configuration inside a structure-value file is scoped to that component. Only include fields that need non-default types — strings, arrays, and objects work without explicit configuration.

**Nested object inputs need preview icons too.** Object fields within a structure (e.g. `callToAction`, `image`) show a generic icon in the data editor without explicit `type: object` + `options.preview.icon`. This applies to **both** co-located structure-value files **and** inline `_structures` entries in `cloudcannon.config.yml` (e.g. `prices`, `testimonials`, `items`):

```yaml
_inputs:
  callToAction:
    type: object
    options:
      preview:
        icon: ads_click
  image:
    type: object
    options:
      preview:
        icon: image
```

See [configuration.md § Object inputs need preview icons](astro/configuration.md#object-inputs-need-preview-icons).

## Deriving structures from components

1. Read the component's Props interface (or destructuring) for all fields
2. Write each field into the structure `value` with the correct default
3. Exclude internal-only props (see table)
4. Wire up field-type mapping

### Field-to-YAML mapping

| Prop type | YAML default                                     | Notes                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| String    | bare key (`title:`)                              | Parses as `null`. If the field has a closed value set (variants, sizes, alignment), the input should be `type: select` — see [configuration-gotchas.md § Configure variant/enum-like fields as select inputs](astro/configuration-gotchas.md#configure-variant--enum-like-fields-as-select-inputs). |
| Boolean   | `false`                                          |                                                                                                                                                                                                                                                                                                     |
| Number    | `0` or the component default (e.g. `columns: 3`) | Input must be `type: number`. If input is `type: text`, quote as string (`price: "29"`) — bare numbers with text inputs cause a "misconfigured" error.                                                                                                                                              |
| Array     | `[]`                                             |                                                                                                                                                                                                                                                                                                     |
| Object    | nested shape with empty fields                   | E.g. `image:\n  src:\n  alt:`. Gives CC the field structure for the object input.                                                                                                                                                                                                                   |

### Fields to include vs exclude

| Include                                                           | Exclude                                 |
| ----------------------------------------------------------------- | --------------------------------------- |
| Content: `title`, `subtitle`, `tagline`, `content`, `description` | `id` — HTML anchors, not content        |
| Media: `image`, `images`                                          | `isDark` — theme variant, hardcoded     |
| Behaviour: `isReversed`, `isAfterContent`, `isBeforeContent`      | `classes` — CSS customization           |
| Array: `items`, `actions`, `stats`, `prices`, `testimonials`      | `bg` — background slot content          |
| Configuration: `columns`, `count`                                 | `defaultIcon` — component-level default |

### Guarding empty objects and arrays in components

In YAML, `image:\n  src:\n  alt:` creates `{ src: null, alt: null }` — a truthy object. `actions: []` is also truthy. Component conditionals must check for meaningful content, not just the outer value:

- Objects: check a meaningful inner field — `image?.src &&` not `image &&`, `(callToAction?.text || callToAction?.icon) &&` not `callToAction &&`.
- Arrays: check `.length` — `actions?.length > 0 &&` not `actions &&`.

When iterating, filter items that have nothing visible to render: `actions.filter((a) => a?.text || a?.icon).map(...)`.

Check and update these guards during the visual-editing phase when wiring up editable regions. See [visual-editing-reference.md § Content-sourced objects and arrays are never falsy](../cloudcannon-visual-editing/astro/visual-editing-reference.md#content-sourced-objects-and-arrays-are-never-falsy) for the full pattern with code examples.

## Default values from components

When a component defines default values in its destructuring (e.g. `columns = 3`, `isReversed = false`), use those same defaults in the structure value. New blocks added via CloudCannon will then match the component's expected defaults.

## Common mistakes

| Symptom / mistake                                                                                                   | Fix                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure-value has `value:` with multiple fields but no `_inputs`                                                  | Editor falls back to CC's type inference — free-text for every field. Add a per-value `_inputs` block. Use `style: modal` on the structure so the editor opens a proper form. Applies equally to inline array structures, `_structures` entries, and array fields in `file_config._inputs`.   |
| One item in an array data file has a different icon/preview from its siblings, despite declaring the same structure | The divergent item's top-level key set doesn't exactly match the structure's `value:` shape — CC fell back to inferred preview. Grep each item's top-level keys, compare, drop dead keys or add empty defaults until shapes match. **Don't tweak the structure config first** — fix the data. |
