# Editable Regions — Internals & API Reference

**Only read this file when debugging unexpected Visual Editor behavior.** For the overview, region types, and attribute reference, see [editable-regions.md](editable-regions.md).

---

## Lifecycle Trace: A Text Editable Region

The best way to understand the system is to trace a single text editable from HTML to live editing.

### 1. HTML

```html
<p data-editable="text" data-prop="title">Welcome to my site</p>
```

### 2. Hydration

`components/index.ts` runs `hydrateDataEditableRegions(document.body)` and sets up a `MutationObserver` to catch future DOM changes. The hydration function finds `[data-editable]` elements, maps the type string to a class, and calls `.connect()`.

For Web Components (`<editable-text>`), hydration happens via `connectedCallback()` instead.

### 3. Connection

`connect()` waits for the CloudCannon API via `apiLoadedPromise`, which resolves when `window.CloudCannonAPI` becomes available (or is already present). Then it calls `setupListeners()`:

1. Walks up the DOM to find a parent editable (none in this case)
2. Parses `data-prop="title"` — resolves to `CloudCannon.currentFile()`
3. Binds to the API file object's `change` and `delete` events
4. Listens for `cloudcannon-api` CustomEvents on the element

### 4. Mounting

When initial data arrives, `pushValue()` resolves the path against the file's frontmatter, stores the result, and calls `mount()`. `EditableText.mount()` creates a ProseMirror editor via `CloudCannon.createTextEditableRegion()`.

### 5. Data Down (CloudCannon → Page)

```
CloudCannon API fires "change" → pushValue() → EditableText.update() → editor.setContent(newValue)
```

`shouldUpdate()` checks the editor isn't focused (to avoid clobbering typing) and the value actually changed.

### 6. Data Up (Page → CloudCannon)

User types → `onChange` callback → `dispatchSet()` → bubbling `cloudcannon-api` CustomEvent → `executeApiCall()` → `file.data.set({ slug: "title", value })`.

---

## Core Internals

### Hydration Engine

Two mechanisms: **data attribute scanning** (`helpers/hydrate-editable-regions.ts`) and **Web Components** (`components/editable-*-component.ts`). Both share a `MutationObserver` that watches the entire document. Custom types can be registered via `addCustomEditableRegion()`.

### The Editable Base Class

`nodes/editable.ts` handles: lifecycle management (`connect`, `disconnect`, `mount`, `update`), data path parsing (`parseSource` for `@collections`, `@file`, `@data` prefixes), value resolution (`lookupPathAndContext`), API dispatch (`executeApiCall`), and event handling (`handleApiEvent`).

### Bubbling Event Bus

Mutations flow upward via `cloudcannon-api` CustomEvents with `bubbles: true`. Each parent editable prepends its path segment. Deeply nested editables never need to know their full path.

### Parent-Child Listener Tree

Editables form a DOM-mirroring tree. Children register as listeners on their nearest parent editable. If the parent hasn't hydrated yet, listeners are queued in `__pendingEditableListeners` and replayed on connect.

---

## CloudCannon JavaScript API

### Detecting the Visual Editor

CloudCannon provides three mechanisms for detecting the Visual Editor ([docs](https://cloudcannon.com/documentation/developer-articles/detecting-your-site-is-loaded-in-the-visual-editor/)):

| Mechanism                        | Context           | Use for                                                                                                 |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `.cms-editor-active` on `<body>` | CSS               | Overriding styles (animations, visibility). Most reliable for initial page load                         |
| `window.inEditorMode`            | Runtime JS        | Inline `<script>` logic, conditional imports                                                            |
| `import.meta.env.ENV_CLIENT`     | Build-time (Vite) | Astro component template expressions (only in editable-regions client bundle, not the production build) |

### Connecting

CloudCannon sets `window.inEditorMode = true` inside the Visual Editor iframe.

```javascript
document.addEventListener("cloudcannon:load", () => {
  const api = window.CloudCannonAPI.useVersion("v1", true);
});
```

### Core Methods

| Method                             | Returns           | Description                                   |
| ---------------------------------- | ----------------- | --------------------------------------------- |
| `currentFile()`                    | `File`            | Handle for the page currently being edited    |
| `file(path)`                       | `File`            | Handle for a specific file by path            |
| `collection(key)`                  | `Collection`      | Handle for a collection                       |
| `dataset(key)`                     | `Dataset`         | Handle for a dataset defined in `data_config` |
| `getPreviewUrl(url, inputConfig?)` | `string`          | Resolve a preview URL for DAM/asset files     |
| `uploadFile(file, inputConfig?)`   | `Promise<string>` | Upload a file, returns the URL                |
| `findStructure(structure, value)`  | `any`             | Look up a structure value                     |

### File Interface

```typescript
interface File {
  data: {
    get(opts?: { slug?: string }): Promise<any>;
    set(opts: { slug: string; value: any }): Promise<any>;
    edit(opts: { slug: string }): void;
    addArrayItem(opts: { slug: string; item?: any }): Promise<any>;
    removeArrayItem(opts: { slug: string; index: number }): Promise<any>;
    moveArrayItem(opts: { slug: string; from: number; to: number }): Promise<any>;
  };
  content: {
    get(): Promise<string>;
    set(value: string): Promise<void>;
  };
  getInputConfig(opts: { slug: string }): any;
  addEventListener(event: "change" | "delete", listener: () => void): void;
}
```

Slug paths use `.` as the separator: `"hero.title"` for `{ hero: { title: "X" } }`.

### Dataset / Collection

```typescript
interface Dataset {
  items(): Promise<File | File[]>;
  addEventListener(event: "change" | "delete", listener: () => void): void;
}
interface Collection {
  items(): Promise<File[]>;
  addEventListener(event: "change" | "delete", listener: () => void): void;
}
```

`dataset.items()` can return a single `File` or `File[]` — always handle both.

### Editor Creation

**`createTextEditableRegion`** — creates an inline ProseMirror editor. No `destroy()` method exists; use a generation counter for stale closures. Editor starts empty (call `setContent` after creation). `setContent` resets cursor — skip on focused editors.

**`createCustomDataPanel`** — opens a floating data panel with custom input fields (used by `EditableImage`).

---

## Known Quirks

### Text Editor

| Quirk                                                            | Mitigation                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| No `destroy()` — old instances fire `onChange` after DOM removal | Use a generation counter; stale closures check and no-op |
| `onChange` fires on init (ProseMirror normalizes on mount)       | Guard with a `setupComplete` flag                        |
| Editor starts empty — does not read `innerHTML`                  | Call `setContent(value)` immediately after creation      |
| `setContent` resets cursor position                              | Track focus state; skip on focused editors               |

### Data API

| Quirk                                | Detail                                                |
| ------------------------------------ | ----------------------------------------------------- |
| Slug separator is `.` not `/`        | `"hero.title"` for `{ hero: { title: "X" } }`         |
| `dataset.items()` return type varies | Can return `File` or `File[]` — always handle both    |
| `change` events are coarse           | Doesn't indicate which key changed — re-read all keys |
| `change` fires for own writes        | Guard against echo loops                              |

### DOM and Content

| Quirk                             | Detail                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| Values often contain HTML         | Use `innerHTML` not `textContent`                                |
| `<editable-text>` replacement tag | Replace with `<span>` (inline) or `<div>` (block) when stripping |
| MutationObserver timing           | Process cloned DOM trees while detached                          |

### Events

| Event                              | Fired On                  | When                                |
| ---------------------------------- | ------------------------- | ----------------------------------- |
| `cloudcannon:load`                 | `document`                | CloudCannon API is ready            |
| `change`                           | File, Collection, Dataset | Data changed (including own writes) |
| `delete`                           | File, Collection, Dataset | Data deleted                        |
| `cloudcannon-api`                  | DOM elements (bubbles)    | Internal editable regions event bus |
| `editable:focus` / `editable:blur` | DOM elements (bubbles)    | Focus state changes                 |

### Global State

| Global                  | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `window.inEditorMode`   | `true` when inside the Visual Editor iframe |
| `window.CloudCannonAPI` | API router — call `.useVersion("v1", true)` |
| `window.cc_components`  | Component renderer registry                 |
| `window.cc_snippets`    | Snippet renderer registry                   |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BUILD TIME                                  │
│                                                                     │
│  ┌─ Astro ──────────────────────┐  ┌─ Eleventy ──────────────────┐ │
│  │ Vite plugin:                 │  │ esbuild bundle:              │ │
│  │ • shims astro:* modules      │  │ • discovers .liquid files    │ │
│  │ • enables client-side SSR    │  │ • bundles as text strings    │ │
│  │ • patches astro:build plugin │  │ • imports filters/shortcodes │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  PAGE LOAD (in Visual Editor iframe)                 │
│                                                                     │
│  Integration layer registers renderers in window.cc_components      │
│  Core: hydrateDataEditableRegions() + MutationObserver              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     LIVE EDITING DATA FLOW                           │
│                                                                     │
│  DATA DOWN: API "change" → pushValue() → update() → DOM update     │
│  DATA UP:   User action → CustomEvent("cloudcannon-api") bubbles   │
│             → parents prepend path → root calls file.data.set()     │
└─────────────────────────────────────────────────────────────────────┘
```
