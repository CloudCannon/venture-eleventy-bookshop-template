# Migration Scripts

Deterministic migration steps automated as shell scripts. Run these before or during the relevant phase to save time and improve consistency.

All scripts accept an optional `[project-dir]` argument (defaults to the current directory).

## Scripts

### `audit-astro.sh` (Phase 1: Audit)

Gathers audit data for an Astro site. Runs CloudCannon CLI commands (`configure detect-ssg`, `configure detect-collections`, `configure detect-build-commands`) then supplements with project metadata the CLI doesn't cover: dependency versions, package manager, Node version, page routes, data files, content config location, and dash-index file detection.

```bash
bash audit-astro.sh /path/to/project
```

The output is structured text the agent uses as a starting point for `.cloudcannon/migration/audit.md`. The agent still handles schema field analysis, component hierarchy, visual editing candidates, and flags/gotchas.

### `rename-dash-index.sh` (Phase 3: Content)

Renames `-index.md` / `-index.mdx` files to `index.md` / `index.mdx` under `src/content/`. This enables CloudCannon's `[slug]` URL collapsing on listing pages.

```bash
bash rename-dash-index.sh /path/to/project
```

After running, the agent still needs to update helper functions (`getSinglePage`, `getListPage` callers) to use `"index"` instead of `"-index"`.

## Scripts in other skills

- **`setup-editable-regions.sh`** — Lives in the `cloudcannon-visual-editing` skill's `scripts/` directory. Installs `@cloudcannon/editable-regions`, wires the Astro integration, and creates the `registerComponents.ts` stub.
