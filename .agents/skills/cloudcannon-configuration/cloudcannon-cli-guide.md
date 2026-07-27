# CloudCannon Setup with the CloudCannon CLI — AI Skill Guide

This guide is for AI agents and skill file authors who want to automate CloudCannon CMS setup for a project. The CloudCannon CLI inspects a project's file structure and generates the configuration files CloudCannon needs.

## Prerequisites

- Node.js 22+ installed
- A project with source files (HTML, Markdown, data files, etc.)

## Quick Setup (One Command)

For fully automated setup, run from the project root:

```bash
npx @cloudcannon/cli configure generate --auto --initial-build-settings
```

This generates:

- `cloudcannon.config.yml` — CloudCannon configuration with detected SSG settings, collections, and paths
- `.cloudcannon/initial-site-settings.json` — Build settings (install command, build command, output path) so the site builds on first upload

> **One-time only:** `initial-site-settings.json` is read when CloudCannon provisions the site for the first time. After that, these settings live in the CloudCannon UI and the file is ignored. If a user asks to change build commands, Node version, or other build settings for an existing site, the agent cannot make that change via code — recommend the user check **Site Settings > Builds > Configuration** in the CloudCannon dashboard instead.

## Step-by-Step Setup (More Control)

For more control, run each detection step independently.

### 1. Detect the Static Site Generator

```bash
npx @cloudcannon/cli configure detect-ssg
```

Returns the detected SSG and confidence scores:

```json
{
  "ssg": "astro",
  "scores": { "astro": 50, "hugo": 0, "jekyll": 0 }
}
```

Use the detected SSG key in subsequent commands via `--ssg`.

### 2. Detect the Source Folder

```bash
npx @cloudcannon/cli configure detect-source --ssg astro
```

Returns:

```json
{ "source": "src", "ssg": "astro" }
```

This is informational only — **do not set `source` in `cloudcannon.config.yml`** during migration. See [astro/configuration.md](astro/configuration.md) for details on why `source` should be omitted.

### 3. Inspect Available Collections

```bash
npx @cloudcannon/cli configure detect-collections --ssg astro
```

Returns a tree of detected collections. Each collection has a `suggested: true/false` flag indicating whether the CLI recommends including it. Collections represent groups of files for editing in CloudCannon (e.g., blog posts, pages, data files).

### 4. Inspect Build Suggestions

```bash
npx @cloudcannon/cli configure detect-build-commands --ssg astro
```

Returns build command suggestions with attributions explaining why each was suggested (e.g., "because of your package.json file", "most common for Astro sites").

### 5. Generate Everything

The `generate` subcommand will create the files in place:

```bash
npx @cloudcannon/cli configure generate --auto --initial-build-settings --ssg astro
```

Adding the `--dry-run` flag prints the file output instead:

```bash
npx @cloudcannon/cli configure generate --auto --dry-run
```

## Validating Configuration

Run after generating the baseline and after each round of customization.

```bash
npx @cloudcannon/cli validate
```

Checks `cloudcannon.config.yml` (and any split config files referenced via `*_from_glob` keys), `.cloudcannon/initial-site-settings.json`, and `.cloudcannon/routing.json` if present. Exit code `0` = all valid, `1` = one or more invalid.

```
✓ valid: cloudcannon.config.yml
✗ invalid: .cloudcannon/initial-site-settings.json
  $.build: unexpected property 'install_command'
```

Errors use JSONPath notation. Fix the flagged key and re-run.

**Flags:**

| Flag                          | Effect                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `--configuration`             | Validate `cloudcannon.config.yml` only                  |
| `--initial-site-settings`     | Validate `.cloudcannon/initial-site-settings.json` only |
| `--configuration-path=<path>` | Override the config file path                           |
| `--stdin`                     | Read from stdin instead of disk                         |

Validation catches unknown keys, wrong value types, and missing required fields. It does **not** catch semantic errors (e.g. a `url` pattern that doesn't match your output paths, or a `_structures` reference to a non-existent key).

## Customizing After Generation

The CLI generates a baseline. These keys are the common customization targets:

| Key                  | What it controls                                                                                                   | Reference                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections_config` | Each collection CloudCannon exposes — paths, schemas, URLs, collection-scoped settings                             | [astro/configuration.md](astro/configuration.md)                                                                                             |
| `_inputs`            | How fields appear in the editor (dropdowns, date pickers, image uploaders, hidden fields)                          | [astro/configuration.md § Customize the config](astro/configuration.md#customize-the-config)                                                 |
| `_structures`        | Reusable component structures for array and object inputs                                                          | [structures.md](structures.md)                                                                                                               |
| `collection_groups`  | Sidebar grouping of collections                                                                                    | [astro/configuration.md](astro/configuration.md)                                                                                             |
| `_editables`         | Rich text editor toolbars (per key: `content`, `block`, `text`, `image`, `link`)                                   | [astro/configuration-gotchas.md § `_editables`](astro/configuration-gotchas.md)                                                              |
| `markdown`           | Markdown engine options — set `options.table: true` if content has Markdown-syntax tables (default is HTML tables) | [astro/configuration-gotchas.md § Markdown tables](astro/configuration-gotchas.md#set-markdownoptionstable-when-content-has-markdown-tables) |
| `_snippets`          | Component syntax support in rich text content                                                                      | [cloudcannon-snippets skill](../cloudcannon-snippets/SKILL.md)                                                                               |
| `_select_data`       | Shared dropdown options                                                                                            | [astro/configuration.md § Customize the config](astro/configuration.md#customize-the-config)                                                 |
| `file_config`        | Per-file input overrides (array format only)                                                                       | [astro/configuration.md § Customize the config](astro/configuration.md#customize-the-config)                                                 |

The full set of configuration keys is defined in the CloudCannon Configuration JSON Schema, see [SKILL.md § Do this before writing any configuration](SKILL.md#do-this-before-writing-any-configuration) for schema details. For IDE autocomplete and validation, use an LSP that supports validating against JSON Schemas (see below) — **do not** add ad-hoc schema comments in YAML.

## JSON Schemas

CloudCannon’s configuration schemas are published on the [JSON Schema Store](https://www.schemastore.org/). Editor LSPs map filenames such as `cloudcannon.config.yml`, `cloudcannon.config.json`, and `.cloudcannon/initial-site-settings.json` to the right schema automatically.

**Do not** add or keep a first-line `# yaml-language-server: $schema=...` comment in `cloudcannon.config.yml`. That directive overrides the Schema Store association and forces a specific URL instead of the catalogued schema.

**VS Code-compatible editors:** Recommend extensions via `.vscode/extensions.json` so YAML and JSON files use an LSP to validate. A minimal set used in CloudCannon’s Astro templates includes [`redhat.vscode-yaml`](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) plus Astro/Tailwind helpers—for example the same recommendations as [sendit-astro-template’s `.vscode/extensions.json`](https://github.com/CloudCannon/sendit-astro-template/blob/main/.vscode/extensions.json):

```json
{
  "recommendations": [
    "astro-build.astro-vscode",
    "redhat.vscode-yaml",
    "bradlc.vscode-tailwindcss"
  ],
  "unwantedRecommendations": []
}
```

When working outside an IDE (e.g. as an AI agent), download the schema and query it with `jq`. See [SKILL.md § JSON Schemas](SKILL.md#json-schemas) for the download command and query patterns. The schema is saved to `.cloudcannon/migration/cloudcannon-config.latest.schema.json` so it persists across agent turns (kept under `.cloudcannon/` so the CLI doesn't detect the folder as a collection).

## File Placement

- **`cloudcannon.config.yml`** and **`.cloudcannon/initial-site-settings.json`** live at the **repository root**, not under `src/` or another app subdirectory.

## Example Skill File Workflow

```
1. Download the JSON schema (one curl command, follows redirects):
   mkdir -p .cloudcannon/migration && curl -sL "https://github.com/cloudcannon/configuration-types/releases/latest/download/cloudcannon-config.latest.schema.json" -o .cloudcannon/migration/cloudcannon-config.latest.schema.json
2. Run `npx @cloudcannon/cli configure detect-ssg` to identify the SSG
3. Parse the JSON output to get the SSG key
4. Run `npx @cloudcannon/cli configure generate --auto --initial-build-settings --ssg <key>`
5. Read the generated cloudcannon.config.yml
6. Before adding each customisation key, query the schema: jq '.definitions["<section>"].properties | keys' .cloudcannon/migration/cloudcannon-config.latest.schema.json
7. Write the updated config back to disk
```

## Reference Links

- [CloudCannon Documentation](https://cloudcannon.com/documentation/)
- [Configuration File Reference](https://cloudcannon.com/documentation/developer-reference/configuration-file/)
- [Initial Site Settings Reference](https://cloudcannon.com/documentation/developer-reference/initial-site-settings-file/)
- [JSON Schemas](https://cloudcannon.com/documentation/developer-reference/schemas/)
- [CloudCannon CLI on GitHub](https://github.com/CloudCannon/cli)
- [CloudCannon CLI on npm](https://www.npmjs.com/package/@cloudcannon/cli)

> **Note:** Examples use `npx @cloudcannon/cli`. If you install the CLI globally, you can run `cloudcannon configure` instead.
