---
name: cloudcannon-visual-editing
description: >-
  Use when adding Visual Editor support to a CloudCannon site, setting up
  editable regions, debugging visual editing issues, or making page sections
  editable in the CloudCannon preview.
---

# CloudCannon Visual Editing

`@cloudcannon/editable-regions` makes page elements interactive in CloudCannon's Visual Editor. This skill covers the editable regions API, integration setup, and SSG-specific patterns for wiring up text, image, array, and component editables.

## When to use this skill

- Adding Visual Editor support to a new or existing CloudCannon site
- Making page sections editable (text, images, arrays, components)
- Setting up component re-rendering for live preview
- Debugging editable regions that aren't appearing or updating
- Adding editable regions to shared partials backed by data files

## Docs

| Doc                                                            | When to read                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [editable-regions.md](editable-regions.md)                     | Start here. Region types, attribute reference, when to use components vs primitives |
| [editable-regions-internals.md](editable-regions-internals.md) | Only when debugging. Lifecycle traces, JavaScript API reference                     |

**SSG-specific:**

| SSG   | Doc                                                                    | Purpose                                                                    |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Astro | [astro/visual-editing.md](astro/visual-editing.md)                     | Setup workflow, section census, infrastructure + completeness checklists   |
| Astro | [astro/visual-editing-reference.md](astro/visual-editing-reference.md) | Pattern reference (read sections on demand as the checklist links to them) |

**Scripts:**

| Script                                                                 | Purpose                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [scripts/setup-editable-regions.sh](scripts/setup-editable-regions.sh) | Installs package, wires Astro integration, creates `registerComponents.ts` stub |

## Quick reference

| Region type  | Use for                     | Key attributes                                                           |
| ------------ | --------------------------- | ------------------------------------------------------------------------ |
| `text`       | Inline rich text            | `data-editable="text"` `data-prop` `data-type`                           |
| `image`      | Image picker                | `data-editable="image"` `data-prop` (or `data-prop-src`/`data-prop-alt`) |
| `array`      | List CRUD                   | `data-editable="array"` `data-prop` on container                         |
| `array-item` | Each list item              | `data-editable="array-item"` on each child                               |
| `component`  | Re-rendering sections       | `data-editable="component"` `data-component` `data-prop`                 |
| `source`     | Hardcoded text in templates | `data-editable="source"` `data-path` `data-key`                          |

**Rule of thumb:** Use `component` when a section has conditional elements, style bindings, or derived content. Nest primitives (`text`, `image`, `array`) inside components for inline editing.

## Workflow

1. **Setup** — Run the setup script, verify integration, add conditional `registerComponents` import
2. **Census** — Document every visible section on every key page with treatment decisions
3. **Implement** — Work through sections, adding editable attributes per the census
4. **Verify** — Run the completeness checklist in the SSG-specific workflow doc

## Checklist reinforcement

The SSG-specific workflow docs contain detailed completeness checklists. These are not optional.

- **Read the checklist BEFORE starting** so you know what to aim for
- **You are not done until every checklist item is verified**
- Every section in the census must have editable regions OR a documented `sidebar-only` justification with a specific technical reason
- Don't mark arrays as done without nested editables on their items — CRUD controls alone are not sufficient

## Symptom-driven debugging

| Symptom / mistake                                                                                                                                                         | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Used `data-editable="content"`                                                                                                                                            | Not a valid region type. Valid types: `text`, `image`, `array`, `array-item`, `component`, `source`. For the markdown body use `data-editable="text" data-type="block" data-prop="@content"`.                                                                                                                                                                                                                                            |
| Put defaults in template `\|\|` fallbacks instead of schema frontmatter                                                                                                   | `data-editable` regions display the stored field value, not the rendered HTML. Empty-string/missing field + template fallback = production renders default, editor shows blank. Put default values in the collection schema (and in structure-value defaults for page-builder blocks), not `{x \|\| "Default"}` fallbacks. Keep a `?.trim() \|\|` safety net for legacy entries, and backfill existing content files.                    |
| Assumed a component registered in `componentMap.ts` would live-update in the editor                                                                                       | Registration only enables page-builder instantiation as a `_type` block. Inline live-editing still requires `data-editable` attributes on every rendered text/image field and `data-editable="array"` + `array-item` + nested `text` on every `.map()`. These are independent concerns.                                                                                                                                                  |
| Used `data-editable="source"` with `data-path` / `data-key` for a shared-data field                                                                                       | The canonical pattern in CloudCannon's Astro integration is `data-editable="text"` (or `image`, `array`, …) with `data-prop="@data[<key>]..."`, where `<key>` is registered in `data_config` in `cloudcannon.config.yml`. `source` has different semantics; `@data[<key>]` routes through the same channel as frontmatter edits.                                                                                                         |
| Changed a schema default without backfilling existing content                                                                                                             | `data-editable` shows the stored value. Existing entries keep the old (often empty) value; only brand-new entries get the new default. Always pair the schema change with a backfill script.                                                                                                                                                                                                                                             |
| Editing a static-placement section mutates a top-level frontmatter field instead of the nested key (e.g. `heading` instead of `ctaBox.heading`), or appears to do nothing | Component is registered in `componentMap.ts` and statically placed in a page/layout but is missing its `<editable-component data-component="<name>" data-prop="<key>">` wrapper. A `propPrefix`-style prop is the wrong fix — it builds correct `data-prop` strings at compile time but the component never re-renders on field change. Wrap with `<editable-component>`; remove any `propPrefix` / `scope()` helper from the component. |
| Multiselect appears to work but selection is ignored — same output regardless of what's selected                                                                          | Component has an `if (length === 0) showAll` fallback. Combined with a ref-comparison bug, the filtered array always empties and the fallback always fires. Remove the fallback. Empty array = render nothing. Seed defaults in `.cloudcannon/schemas/<collection>.md`.                                                                                                                                                                  |
| Multiselect of refs renders nothing or renders all — selection appears not to work                                                                                        | `reference()` fields are `{collection, id}` objects at runtime, not strings. Comparing `entry.id === ref` is string-vs-object → always false → empty filter result. Use `getEntry(ref)` for one ref or `entry.data.x.some(r => r.id === currentId)` for membership. Type Props as `{collection: string; id: string}[]`, never `string[]`.                                                                                                |
| Component renders fine in `astro build` but a field is missing from `Astro.props` in the visual editor                                                                    | The CC schema file (`.cloudcannon/schemas/<collection>.md`) gates which frontmatter fields are forwarded on re-render. Adding a hidden `_input` in `cloudcannon.config.yml` does NOT fix this — `_inputs` control sidebar UI, not prop forwarding. Add the missing key (with a sensible default) inside the correct nested object in the schema file.                                                                                    |

## Common mistakes

| Excuse                                                      | Reality                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Text editables are enough for this page"                   | Check images, arrays, and components too. Text-only is a half-finished job.                                                                                                                                                                                                                                      |
| "This component is too complex for editable regions"        | If it renders data from a content collection, it should be editable. Simplify the component or wrap it in `editable-component` for sidebar re-rendering.                                                                                                                                                         |
| "The footer/nav doesn't need editables"                     | Shared partials need data-file-backed editables. Every visible section needs a treatment.                                                                                                                                                                                                                        |
| "Array items just need add/remove controls"                 | Without nested text/image editables on items, editors can't edit field values inline.                                                                                                                                                                                                                            |
| "I'll register components later"                            | Unregistered components can't re-render. Wire them as you go.                                                                                                                                                                                                                                                    |
| "Source editables aren't needed — this text rarely changes" | If it's visible, it should be editable -- but the _mechanism_ depends on the page. Page-builder `pages` collection entry for unique-layout pages with 2+ sections; data file for shared UI; `data-editable="source"` only for long-form prose.                                                                   |
| "I'll source-editable any hardcoded string on a page"       | Source-editable is for long-form prose only. If the page has 2+ structured sections, it belongs in a page-builder `pages` collection. See [migrating-to-cloudcannon/astro/page-building.md § When to reach for page builder](../migrating-to-cloudcannon/astro/page-building.md#when-to-reach-for-page-builder). |
