# Editable Regions — Overview

Reference for `@cloudcannon/editable-regions` v0.1.x — the client-side system that makes DOM elements interactive inside CloudCannon's Visual Editor. SSG-specific integration lives in [astro/visual-editing.md](astro/visual-editing.md) (or the equivalent for your SSG). Internals, lifecycle traces, and the JavaScript API reference live in [editable-regions-internals.md](editable-regions-internals.md).

## Region Types

### Primitive vs component regions

| Kind          | Types                                            | Behaviour                                                                                                         | Use when                                                                                                                    |
| ------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Primitive** | `text`, `image`, `array`, `array-item`, `source` | Updates its own slice of the live DOM directly. No registered renderer needed.                                    | Inline on-canvas editing of a single value or list.                                                                         |
| **Component** | `component`, `snippet` (extends component)       | Re-renders from structured data so the whole template slice stays in sync — text, images, styles, derived markup. | The section has conditional elements, style/class bindings, or computed content. Nest primitives inside for inline editing. |

**Precedence:** a primitive that binds a `data-prop` to a subtree wins for that subtree's live value — updates follow frontmatter through the region and override any component-level transform. With no primitive on that markup, the component re-render owns value derivation. Typical split: an `array` region for CRUD plus nested `text`/`image` primitives on the fields you want on-canvas.

For when to wrap a section in a component, see [When to Use a Component Editable Region](#when-to-use-a-component-editable-region).

### EditableText

On-canvas text editor (ProseMirror-based). The `data-type` attribute selects the editing mode:

- `data-type="span"` — plain text, no formatting toolbar
- `data-type="text"` — paragraph-level rich text (bold, links, superscript)
- `data-type="block"` — multi-paragraph rich text (lists, quote blocks, headings)

When `data-type` is omitted, CloudCannon defaults to `block`/`text` for Source Editable Regions, `data-prop="@content"`, or Rich Text Inputs, and `span` for everything else.

### EditableImage

Image editing via CloudCannon's data panel. The region **host** is either (1) an `<img>` with `data-editable="image"` and path attributes on that same element, or (2) a non-`img` host (`<editable-image>`, `<div data-editable="image">`, layout wrapper, etc.) that contains a descendant `<img>`. The resolved `<img>` is what gets live `src` / `alt` / `title` updates — each facet can be bound independently via `data-prop-src`, `data-prop-alt`, `data-prop-title`, or together via `data-prop` (for object image fields).

### EditableComponent

Re-renders a component when its data changes so the rendered slice updates holistically from that data. Requires a renderer registered through your SSG’s `@cloudcannon/editable-regions` integration (Astro: `registerAstroComponent`). Diffs new HTML into the live DOM rather than replacing wholesale, preserving focused editors and live state.

### EditableArray & EditableArrayItem

On the page, manages ordered lists with full CRUD (add, remove, reorder) and drag-and-drop. Array items on their own don't re-render contents — adding `data-component` to an array item element enables component re-rendering alongside the CRUD controls. For complex arrays, the array wrapper needs `data-component-key` and optionally `data-id-key` to declare which data fields identify each item’s type and stable identity (see [Complex array attributes](#complex-array-attributes-wrapper-vs-item)). Use `<editable-array-item>` when no suitable HTML container exists.

### EditableSource

Edits raw HTML source files rather than frontmatter. Uses `data-path` (file path) and `data-key` (unique identifier) instead of `data-prop`. Reads/writes the full source file via the CloudCannon file API.

### EditableSnippet

Extends `EditableComponent` for editing snippets within rich text content. Manages its own data locally and dispatches `snippet-change` events.

---

## When to Use a Component Editable Region

Primitive editables update their own DOM slice but can't re-render the surrounding template. Wrap a section in a component when it has any of the signals below — without a component region, data-driven changes to conditional or computed markup don't reflect live.

| Signal                   | Example                                                      |
| ------------------------ | ------------------------------------------------------------ |
| Conditional elements     | A button that appears/disappears based on a boolean          |
| Style or class bindings  | Alternating background colours, layout order driven by index |
| Computed/derived content | A badge or label that changes based on another field         |

**When in doubt, prefer a component.** Cost: one registration call + a wrapper element. Benefit: every data-driven change live-updates.

---

## Quick Attribute Reference

| Attribute                 | Values                                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-editable`           | `text`, `image`, `array`, `array-item`, `component`, `source` | Declares the region type                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `data-prop`               | Path string                                                   | Data path for the editable value. `@content` is the reserved token for the file's markdown body — frontmatter is reached via normal field paths, so the body has no path other than `@content`                                                                                                                                                                                                                                                     |
| `data-prop-*`             | Path string                                                   | Per-attribute binding: the suffix after `data-prop-` names the attribute or logical field being edited; path-string rules match `data-prop`. On **image** regions the usual cases are `data-prop-src`, `data-prop-alt`, and `data-prop-title`. The same pattern applies elsewhere where the visual editor supports binding that attribute for the region type — it is not limited to images, but not every attribute is available on every region. |
| `data-type`               | `span`, `text`, `block`                                       | Text editor mode. `span` = plain text (no toolbar); `text` = paragraph-level rich text (bold, links, superscript); `block` = multi-paragraph rich text (lists, quotes, headings). Omitted → `block`/`text` for Source regions, `@content`, and Rich Text Inputs; `span` otherwise                                                                                                                                                                  |
| `data-component`          | Component key                                                 | Component identifier for re-rendering lookup                                                                                                                                                                                                                                                                                                                                                                                                       |
| `data-id-key`             | Key name                                                      | On the **array wrapper**: which data field uniquely identifies each item. Defaults to `data-component-key` value when omitted (Dec 2025)                                                                                                                                                                                                                                                                                                           |
| `data-component-key`      | Key name                                                      | On the **array wrapper**: which data field identifies the component type for each item                                                                                                                                                                                                                                                                                                                                                             |
| `data-id`                 | ID value                                                      | On each **array item**: the resolved identity value for this specific item. Defaults to `data-component` when omitted                                                                                                                                                                                                                                                                                                                              |
| `data-path`               | File path                                                     | Source file path (for `EditableSource`)                                                                                                                                                                                                                                                                                                                                                                                                            |
| `data-key`                | Unique key                                                    | Identifier within a source file                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `data-defer-mount`        | _(presence)_                                                  | Lazy initialization — editor mounts on first click                                                                                                                                                                                                                                                                                                                                                                                                 |
| `data-cloudcannon-ignore` | _(presence)_                                                  | Exclude element from scanning                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Use `data-prop-*`** when the main `data-prop` value would be the wrong shape (string path for `src` while `alt` lives in another field) or when only one facet of a composite value should be wired to data.
**Use `data-prop`** when the stored value is already one object the editor understands.

### Complex array attributes (wrapper vs item)

These attributes wire **complex** arrays (e.g. page builders) so the Visual Editor can add, reorder, and re-render rows. They are SSG-agnostic; only the registration API differs by stack.

- **`data-component-key`** (on the **array wrapper**): Name of the field **in each array item’s data object** whose value selects **which client-rendered component** handles that row (e.g. `_type` → `hero`). The editor uses it when the array is empty or when inserting a new row.
- **`data-id-key`** (on the **array wrapper**): Name of the field used as a **stable identity** for matching DOM nodes to data items across reorder/add/remove. Often the same field as `data-component-key`; when omitted, it defaults to the same value as `data-component-key` (Dec 2025).
- **`data-component`** (on each **array item**): The **resolved** component key for that row. It must match the string registered for that renderer in your SSG’s editable-regions setup (Astro example: `registerAstroComponent('hero', Hero)` → `data-component="hero"`).
- **`data-id`** (on each **array item**): The **resolved** stable id for that row, taken from the field named by `data-id-key`. When omitted, it defaults to the same value as `data-component` (Dec 2025).

CloudCannon uses **`data-id` / `data-id-key`**, not a separate `data-component-id` attribute.

For when to add HTML `<template>` children on the array wrapper versus relying on component registration, see the visual-editing guide for your SSG (e.g. [astro/visual-editing.md](astro/visual-editing.md) § Array editing).

### Custom Element Equivalents

| Custom Element          | Equivalent                         |
| ----------------------- | ---------------------------------- |
| `<editable-text>`       | `<span data-editable="text">`      |
| `<editable-image>`      | `<div data-editable="image">`      |
| `<editable-component>`  | `<div data-editable="component">`  |
| `<editable-array-item>` | `<div data-editable="array-item">` |
| `<editable-source>`     | `<div data-editable="source">`     |

Both forms produce identical behaviour. Custom elements self-hydrate via `connectedCallback`.

| Host                                                        | Preferred form                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Wrapper-only (markup whose only job is to carry the region) | Custom element (`<editable-text>`, `<editable-image>`) — less likely to collide with layout CSS |
| Semantic or layout element (`<h1>`, `<p>`, `<section>`)     | Keep `data-editable` on the semantic element                                                    |
| Stylesheet or third-party targets `span`/`div`              | Explicit `<span data-editable="...">` / `<div data-editable="...">`                             |

Astro-specific patterns (slots, links, templates) are in [astro/visual-editing.md](astro/visual-editing.md).
