# Scripts

Reference implementations from the Venture migration. The two Python scripts are
**starting points, not drop-in tools** — they hardcode that project's type map and
its per-component normalisations. Copy and adapt.

| Script | Purpose |
| --- | --- |
| `render-check.mjs` | Re-renders every page-builder block through the emitted browser bundle. Generic — runs anywhere. Run after a build, from the project root. |
| `generate-structure-values.py` | Reads `.bookshop.yml` files, resolves the `bookshop:x/y!` shorthands, and emits co-located `*.cloudcannon.structure-value.yml`. Adapt `MAP` and `normalise()`. |
| `migrate-content.py` | Rewrites page front matter: `_bookshop_name` → `_type`, plus the reshaping that removes render-time synthesis. Adapt `migrate_block()`. |

Both Python scripts expect a `type-map.json` beside them mapping old Bookshop
component names to new include paths:

```json
{ "generic/heading": "components/generic/heading",
  "sections/hero":   "components/heroes/hero" }
```

`generate-structure-values.py` also expects the original `.bookshop.yml` files in a
`bookshop-yml/` subdirectory, flattened to `<dir>_<dir>_<name>.bookshop.yml`. If
you've already deleted `component-library/`, recover them from git:

```bash
git ls-tree -r HEAD --name-only | grep '\.bookshop\.yml$' | while read f; do
  git show "HEAD:$f" > "bookshop-yml/$(echo "${f#component-library/components/}" | tr '/' '_')"
done
```
