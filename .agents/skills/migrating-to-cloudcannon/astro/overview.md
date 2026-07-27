# Astro Migration Guide

Guidance for migrating an Astro site to CloudCannon. Follow the phases in order. Before starting, run any available audit scripts in [../scripts/](../scripts/) to gather site information automatically.

## Astro scope

This guide covers Astro sites that use:

- Astro content collections (`src/content/` with `content.config.ts` or `src/content/config.ts`)
- `.astro` single-file components
- Static output (`output: "static"` -- the default)
- Islands architecture with optional framework integrations. Only `.astro` and React components are supported in editable regions -- Vue, Svelte, and Solid components throw runtime errors in the visual editor even when nested inside supported components. Convert to a supported framework, or use `ENV_CLIENT` editing fallbacks (see the `cloudcannon-visual-editing` skill)

Server-rendered Astro sites (`output: "server"` or `output: "hybrid"`) are not covered -- CloudCannon requires static output.

## Phases

### Phase 1: Audit

Analyze the site before making any changes. Map content collections, routing, components, and the build pipeline.

See [audit.md](audit.md).

### Phase 2: Configuration

Generate a baseline `cloudcannon.config.yml` using the CloudCannon CLI, then customize based on the audit findings. If the site uses MDX components in content, configure snippets as part of this phase.

**Read the `cloudcannon-configuration` skill** for CloudCannon CLI, structures, collection URLs, and Astro-specific configuration guidance.

If the site uses MDX components or inline HTML in content, also **read the `cloudcannon-snippets` skill**.

### Phase 3: Content

Review and restructure content files if needed so they work well in the CMS.

See [content.md](content.md).

### Phase 4: Visual editing

Add `@cloudcannon/editable-regions` for inline editing in CloudCannon's Visual Editor.

**Read the `cloudcannon-visual-editing` skill** for editable regions API, setup workflow, and Astro-specific patterns.

### Phase 5: Build and test

Validate the migration works end-to-end (local build and SSG-specific checks in [build.md](build.md)), then hand off using [SKILL.md § Handoff and verification](../SKILL.md#handoff-and-verification) so the user can verify in CloudCannon.

See [build.md](build.md).

## Notes

- Not every site needs all phases. Small sites may skip Phase 3 if content is already well-structured.
- Visual editing (Phase 4) is optional but high-value -- prioritize it for sites where the site owner wants a visual editing experience.
