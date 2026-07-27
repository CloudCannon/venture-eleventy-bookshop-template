---
name: migrating-to-cloudcannon
description: >-
  Migrate an existing SSG site to work with CloudCannon. Use when the user wants
  to onboard a site to CloudCannon, add CMS support, or make a template
  CloudCannon-compatible.
---

# Migrating to CloudCannon

This skill orchestrates a full migration of an existing SSG site to CloudCannon. It coordinates five phases, delegating domain-specific work to standalone skills that can also be used independently.

> **Model recommendation:** Migrations involve multi-file architectural decisions across five phases. Use a high-reasoning model (not a fast/lightweight one) for best results.

## Supported SSGs

| SSG   | Guide                                  |
| ----- | -------------------------------------- |
| Astro | [astro/overview.md](astro/overview.md) |

## Chaining with upstream skills

If the site is being **generated** as part of this task (e.g. converting from WordPress), read [astro/cc-friendly-conventions.md](astro/cc-friendly-conventions.md) before scaffolding — it covers the structural choices that make the migration smooth. Once scaffolded, return here and run the migration phases.

## Step 1: Detect the SSG

Run from the project root:

```bash
npx @cloudcannon/cli configure detect-ssg
```

Use the detected SSG to pick the correct guide above.

## Migration phases

Each SSG guide walks through these in order. Phases that delegate to standalone skills are marked below.

1. **Audit** — Analyze content structure, components, routing, and build pipeline before changing anything.
2. **Configuration** — Generate and customize CloudCannon config files.
   - Read the `cloudcannon-configuration` skill.
   - If the site uses MDX components or inline HTML in content, also read the `cloudcannon-snippets` skill.
3. **Content** — Restructure content files if needed so they're CMS-friendly.
4. **Visual editing** — Add editable regions for CloudCannon's Visual Editor.
   - Read the `cloudcannon-visual-editing` skill.
5. **Build and test** — Validate the migration end-to-end.

Not every site needs all phases. Small sites may skip Phase 3 if content is already well-structured. Phase 4 is optional but high-value.

### Per-phase workflow

For each phase, in order:

1. **Read** the phase doc end-to-end before touching any files.
2. **TaskCreate** one task per checklist item in that phase doc. Set the task `in_progress` before starting it; mark `completed` only when the checklist item is satisfied. Do not batch-complete tasks at the end of the phase.
3. **Do the work** — small, mechanical cross-phase fixes (adding a missing field, normalizing a value) are fine in any phase; structural changes (moving files, reorganizing collections, altering rendering) wait for their proper phase.
4. **Write** `.cloudcannon/migration/<phase>.md` documenting decisions, findings, and anything the user should review.
5. **Check the handoff readiness row below.** If it's met, the phase is safe to hand off to a fresh conversation. Whether you actually open a fresh conversation is a judgment call (see [Chunking](#chunking-large-migrations) below) — within one conversation, just continue.

**Why:** checklists catch things agents otherwise skim past — data collections missing from `collections_config`, `data_config` entries missing for referenced data files, blog/detail page editables skipped while focusing on page-builder blocks, arrays not linked to structures. TaskCreate makes the skim visible.

### Phase handoff readiness

These rows define what must be true for a phase to be safely picked up by a fresh conversation. They are **not** walls inside one conversation — cross-phase fixes (per step 3 above) are still fine. They exist so a chunked migration's later runs have a clean starting point.

| After phase           | Ready for handoff when…                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Audit**          | `.cloudcannon/migration/audit.md` exists, contains the census table, and lists every collection + every page route. Sectioning thresholds (below) have been evaluated; if tripped, `.cloudcannon/migration/plan.md` exists.                                                     |
| **2. Configuration**  | `cloudcannon.config.yml` validates against the published JSON schema (no IDE red squigglies). Every collection in the audit has a `collections_config` entry; every referenced data file has a `data_config` entry. `.cloudcannon/migration/configuration.md` written.          |
| **3. Content**        | All structural content changes from Phase 2 are reflected in the files. `npm run build` (or project equivalent) succeeds. `.cloudcannon/migration/content.md` written.                                                                                                          |
| **4. Visual editing** | Every section flagged in the audit census as "needs editable region" has been wired or has a documented justification for not being wired. `registerComponents.ts` registers every component used inside a wrapped section. `.cloudcannon/migration/visual-editing.md` written. |
| **5. Build and test** | Production build succeeds locally. User has run their CloudCannon-side verification (preview, inline edit, save-to-git). `.cloudcannon/migration/build.md` written.                                                                                                             |

## Chunking large migrations

Migrations can run end-to-end in one conversation, but on larger sites context fills up — quality drops in later phases (especially Phase 4 visual editing) when the agent is recalling decisions from earlier phases through a long backscroll. Chunking into fresh conversations is a way to avoid that.

**Chunking is a suggestion, not a wall.** The agent doesn't _halt_ between phases — it tells the user "context is heavy; consider opening a fresh conversation for Phase N" and lets the user choose. If the user keeps going in the same conversation, that's fine.

### When to suggest a fresh conversation

At the end of Phase 1, evaluate the sizing thresholds against `.cloudcannon/migration/audit.md`:

| Signal                                | Threshold | Source                                                                       |
| ------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Total pages                           | > 30      | Audit § Pages and routing                                                    |
| Hardcoded `.astro` → YAML conversions | > 15      | Audit census table rows recommending page-builder or fixed-schema collection |
| Distinct collections                  | > 5       | Audit § Content collections + new collections from census                    |

If any 2 thresholds are tripped, write `.cloudcannon/migration/plan.md` using the template below, then suggest to the user that later phases run in fresh conversations. Phase 4 (visual editing) is the most context-hungry — it's the most likely candidate for a fresh start.

| Shape                         | When                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Vertical (per-collection)** | Page-builder pages or unique-shape collections dominate — each unit has its own schema/visual-editing decisions |
| **Horizontal (per-phase)**    | Collections are mostly uniform — repetitive per-collection work benefits from one mental model at a time        |

### `.cloudcannon/migration/plan.md` template

```markdown
# Migration plan

## Sizing

- Total pages: <n> (threshold >30: <tripped|ok>)
- Hardcoded → YAML conversions: <n> (threshold >15: <tripped|ok>)
- Distinct collections: <n> (threshold >5: <tripped|ok>)
- Tripped: <count>/3 → <chunked recommended|single-pass fine>

## Shape (if chunking)

<vertical|horizontal> — because: <one-line reason>

## Chunks

Each chunk is intended as a single agent run, ideally in a fresh conversation
once context is heavy. The agent reads `.cloudcannon/migration/audit.md` + this file + the
listed phase doc, then works the listed scope.

| #   | Scope                            | Phase(s) | Inputs                     | Output artefact                           |
| --- | -------------------------------- | -------- | -------------------------- | ----------------------------------------- |
| 1   | <e.g. all collections — config>  | 2        | audit.md                   | cloudcannon.config.yml + configuration.md |
| 2   | <e.g. blog collection — content> | 3        | audit.md, configuration.md | content.md (blog section)                 |
| 3   | <...>                            | ...      | ...                        | ...                                       |

## Global decisions locked in chunk 1 (do not revisit)

- Collection URL patterns
- Shared structures (`_structures`)
- Snippet configs (if MDX/inline HTML)
- `registerComponents.ts` setup
```

**Resumption brief** (paste into a fresh conversation): "Read `.cloudcannon/migration/audit.md`, `.cloudcannon/migration/plan.md`, and the phase doc(s) listed for chunk N. Work chunk N's scope. Write the output artefact and stop."

**Repetition → script rule:** After migrating 2 entries of the same shape, write a throwaway script for the rest. 23 hand-conversions of the same article shape is wasted tokens and an error multiplier.

## Scripts

Deterministic migration steps are automated as scripts in [scripts/](scripts/). Run these before or during the relevant phase.

## Migration notes

All written to `.cloudcannon/migration/` (under `.cloudcannon/` so the CLI doesn't detect the folder as a collection): one file per phase (`audit.md`, `configuration.md`, `content.md`, `visual-editing.md`, `build.md`), plus `plan.md` if the migration is sectioned. See the per-phase workflow above for the gates that consume each file.

## Handoff and verification

### Testing boundaries

| Check                                                              | Owner |
| ------------------------------------------------------------------ | ----- |
| Local build (`npm run build` or whatever `package.json` defines)   | Agent |
| Builds, greps, small scripts, `dist/` inspection                   | Agent |
| Fidelity checks in CloudCannon (preview, inline edit, save-to-git) | Human |

Prefer asking the user to run CloudCannon verification over spinning up long-lived dev servers or heavy end-to-end testing in the agent session.

### When to close with the user

Close after a **meaningful chunk**, not every tiny edit. At minimum: when Phase 5 (Build and test) is done for a first full migration pass. If the user stops earlier (e.g. after configuration only), hand off at that milestone instead.

### What to say

Be direct and brief:

1. A short summary of what changed.
2. A checklist the user can run.
3. One clear ask for feedback.

Skip empty phrases ("let me know if you need anything"). Thanking them once for checking is fine.

### What to ask the user to verify

- **Local build** — the project's real build entrypoint, not a partial command. If it fails, paste the full error output (command, exit code, last ~30 lines of stderr).
- **Checks you already ran** — state them in one line so the user doesn't duplicate work.
- **CloudCannon (human)** — confirm in the hosted environment:
  - Inline text regions can be edited in the preview on representative pages
  - Image regions open the image picker
  - Array regions show add/remove/reorder controls where arrays were wired
  - Cross-file editables (`@file`, shared partials) update the intended source file
  - Saved changes land in the expected files in git

### What to ask the user to send back

Concrete signals: the exact command run, CloudCannon build log snippets if the remote build failed, the page URL and what they clicked if the editor misbehaved, or a short description of what differs from expected.

### Iteration

End with one line that invites the next pass — when they've run those checks, reply with any failures or odd behavior.

## Naming conventions

Follow existing project conventions when present. Otherwise:

- `kebab-case` for files
- `camelCase` for JavaScript and JSON
- Markdown frontmatter and YAML: match existing component prop names so frontmatter keys pass through without translation
- New fields with no existing convention: prefer `snake_case`

## Cross-references for known pitfalls

For specific architectural decisions and config-syntax mistakes, see:

| Topic                                                                                                                      | Owner                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classifying static pages (source-editable vs page-builder vs collection)                                                   | [astro/audit.md § Classifying static pages](astro/audit.md#classifying-static-pages-source-editables-vs-content-collection)                                                                                                                           |
| `home.md` vs `index.md`, collection-of-one                                                                                 | [astro/page-building.md § Common mistakes](astro/page-building.md#common-mistakes)                                                                                                                                                                    |
| Shared UI (CTA banners, footers, share blocks)                                                                             | [astro/cc-friendly-conventions.md § Shared-UI treatment table](astro/cc-friendly-conventions.md#shared-ui-treatment-table)                                                                                                                            |
| Multi-schema collections (`pages` with `z.union`)                                                                          | [../cloudcannon-configuration/astro/configuration.md § Schemas](../cloudcannon-configuration/astro/configuration.md#schemas)                                                                                                                          |
| Config-syntax hallucinations (wrong keys/types)                                                                            | [`cloudcannon-configuration` § Common invalid keys](../cloudcannon-configuration/SKILL.md#common-invalid-keys)                                                                                                                                        |
| Markdown body renders as unstyled text — no heading sizes, list bullets, or link colour — despite `prose prose-lg` classes | `@tailwindcss/typography` not installed or not registered. Tailwind 4 needs `@plugin "@tailwindcss/typography";` in the main CSS (after `@import "tailwindcss";`). Two-line fix: `npm install @tailwindcss/typography` + add the `@plugin` directive. |

## Common mistakes

| Excuse                                                          | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "This site is simple enough to skip the audit"                  | The audit catches structural issues early. Skipping it means discovering problems mid-configuration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| "I'll do the checklist at the end"                              | Read checklists BEFORE starting each phase. They tell you what to aim for.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| "Content restructuring can wait"                                | If a missing field blocks configuration, add it now. Phases are sequential, not siloed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| "Visual editing is optional so I'll skip it"                    | It's the highest-value phase for editors. Only skip if the user explicitly says so.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| "The build passes so we're done"                                | A passing build doesn't mean the editor works. The user must verify in CloudCannon.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| "I'll call the homepage file `home.md` — it's more descriptive" | CloudCannon resolves the URL from the slug; `home.md` with `url: "/[slug]/"` → `/home/`. Use `index.md` so Astro collapses the slug to `/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| "It's hardcoded, so it's developer-only"                        | If an editor can see it on the page, they must be able to edit it. The mechanism depends on the page: shared UI (CTA banners, footers, share blocks, author cards) → data file; unique-layout pages with 2+ sections → page-builder `pages` collection entry; long-form prose page → fixed-schema collection with markdown body. `data-editable="source"` is for long-form prose only — not the default for any one-off string. See [astro/cc-friendly-conventions.md § Shared-UI treatment table](astro/cc-friendly-conventions.md#shared-ui-treatment-table) and [astro/page-building.md § When to reach for page builder](astro/page-building.md#when-to-reach-for-page-builder). |
| "This page is unique so it should be source-editable"           | Unique-layout pages with 2+ sections belong in a `pages` collection with a page-builder schema. Source-editable is for long-form prose only. See [astro/audit.md § Classifying static pages](astro/audit.md#classifying-static-pages-source-editables-vs-content-collection).                                                                                                                                                                                                                                                                                                                                                                                                        |
| "I'll make a single-entry `homepage` collection"                | Use one `pages` collection with `index.md` as one entry. Add `our-team.md`, `about.md`, etc. as more entries. CloudCannon collections support multiple schemas per collection — both via `schemas:` config and via Zod `z.union` in Astro content config. See [../cloudcannon-configuration/astro/configuration.md § Schemas](../cloudcannon-configuration/astro/configuration.md#schemas).                                                                                                                                                                                                                                                                                          |
| "Page builder is overkill for these few pages"                  | Page builder is the default for any site with more than one unique-layout page. The cost is a `[...slug].astro` catch-all + a `BlockRenderer` — both are mechanical. The benefit is editors can add new pages without engineering.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
