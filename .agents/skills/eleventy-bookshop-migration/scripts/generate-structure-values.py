"""Generates co-located *.cloudcannon.structure-value.yml from .bookshop.yml.

Replicates what `npx @bookshop/generate` did at build time (see
node_modules/@bookshop/generate/lib/structure-builder.js), but emits one file
per component instead of a merged _cloudcannon/info.json:

  - resolves the `bookshop:<key>!` / `bookshop:structure:<key>!` shorthands
    recursively, inlining referenced blueprints as default values
  - rewrites _bookshop_name -> _type with component include paths
  - applies the same normalisations as the content migration, so structure
    defaults match the shapes the migrated templates render

Output still needs a hand pass: icons must be valid Material Symbols names,
and previews want meaningful key lookups.
"""
import json, pathlib, re, sys, yaml

HERE = pathlib.Path(__file__).parent
ROOT = pathlib.Path("/Users/tomrichardson/Dev/work/venture-eleventy-bookshop-template")
MAP = json.loads((HERE / "type-map.json").read_text())

SHORTHAND = re.compile(r"^bookshop:(?P<structure>structure:)?(?P<key>.+?)(?P<init>!)?(?:\((?P<param>.+?)\))?$")

# name -> parsed .bookshop.yml
COMPONENTS = {}
for f in sorted((HERE / "bookshop-yml").glob("*.bookshop.yml")):
    # generic_form_text-input_text-input.bookshop.yml -> generic/form/text-input
    stem = f.name[: -len(".bookshop.yml")]
    parts = stem.split("_")
    name = "/".join(parts[:-1])
    COMPONENTS[name] = yaml.safe_load(f.read_text()) or {}

# structure key -> [component names]
GROUPS = {}
for name, doc in COMPONENTS.items():
    for s in (doc.get("spec") or {}).get("structures") or []:
        GROUPS.setdefault(s, []).append(name)


def parse_shorthand(value):
    if not isinstance(value, str) or not value.startswith("bookshop:"):
        return None
    m = SHORTHAND.match(value.strip())
    if not m:
        sys.exit(f"unparsed shorthand: {value}")
    d = m.groupdict()
    return {"structure": bool(d["structure"]), "key": d["key"].strip(),
            "init": bool(d["init"]), "param": d["param"]}


def resolve(value, inputs, key, depth=0):
    """Returns (resolved_default_value). Records _inputs config as a side effect."""
    if depth > 6:
        return None

    sh = parse_shorthand(value)
    if sh:
        if sh["structure"]:
            inputs.setdefault(key, {})["type"] = "object"
            inputs[key].setdefault("options", {})["structures"] = f"_structures.{sh['key']}"
            if sh["init"]:
                members = GROUPS.get(sh["key"]) or []
                target = sh["param"] or (members[0] if members else None)
                return blueprint_value(target, depth + 1) if target else None
            return None
        inputs.setdefault(key, {})["type"] = "object"
        inputs[key].setdefault("options", {})["structures"] = f"_structures.{single_key(sh['key'])}"
        return blueprint_value(sh["key"], depth + 1) if sh["init"] else None

    if isinstance(value, list):
        # `[bookshop:generic/button]` -> array of that component
        if len(value) == 1 and parse_shorthand(value[0]):
            item_sh = parse_shorthand(value[0])
            inputs.setdefault(key, {})["type"] = "array"
            struct = item_sh["key"] if item_sh["structure"] else single_key(item_sh["key"])
            inputs[key].setdefault("options", {})["structures"] = f"_structures.{struct}"
            return []
        return [resolve(v, inputs, key, depth + 1) for v in value]

    if isinstance(value, dict):
        return {k: resolve(v, inputs, k, depth + 1) for k, v in value.items()}

    return value


def single_key(name):
    return name.split("/")[-1].replace("-", "_") + "_blocks"


def blueprint_value(name, depth=0):
    doc = COMPONENTS.get(name)
    if not doc:
        return None
    bp = doc.get("blueprint") or {}
    throwaway = {}
    out = {"_type": MAP[name]}
    for k, v in bp.items():
        out[k] = resolve(v, throwaway, k, depth + 1)
    return out


# ---------------------------------------------------------------- normalisation
LR_SIZES = "(min-width: 769px) 700px, 100vw"
ASSET_SIZES = "(min-width: 769px) 960px, 91vw"
GALLERY_SIZES = "(min-width: 769px) 368px, (min-width: 480px) 46vw, 78vw"
IMAGE_CARD_SIZES = "(min-width: 769px) 368px, (min-width: 480px) 63vw, 94vw"


def normalise(name, value):
    """Same reshaping the content migration applied."""
    content = value.get("content") if isinstance(value.get("content"), dict) else None

    if name in ("sections/hero", "sections/hero--simple") and content:
        h = content.get("heading")
        if isinstance(h, dict):
            h["primary_heading_hierarchy"] = "h1"
            h["eyebrow_headline_hierarchy"] = "h2"

    if name == "sections/simple-text-block" and content:
        if isinstance(content.get("text"), dict):
            content["text"] = None  # now a plain markdown string

    if name in ("sections/icon-cards", "sections/image-cards") and content:
        content["grid_items"] = []  # items come from the grid_items structure

    if name in ("sections/left-right-simple", "sections/left-right-labelled-icons",
                "sections/left-right-testimonial") and content:
        if isinstance(content.get("image"), dict):
            content["image"]["image_sizes"] = LR_SIZES

    if name == "sections/centered-large-asset" and content:
        if isinstance(content.get("asset"), dict):
            content["asset"]["image_sizes"] = ASSET_SIZES

    if name == "sections/gallery" and content:
        g = content.get("gallery")
        if isinstance(g, dict):
            g.setdefault("images", [])
    return value


def preview_for(name, doc, value):
    spec = doc.get("spec") or {}
    label = spec.get("label") or name.split("/")[-1].title()
    icon = spec.get("icon") or "widgets"
    text_key = None
    for candidate in ("content.heading.primary_heading", "heading.primary_heading",
                      "label", "text", "primary_heading"):
        node, ok = value, True
        for part in candidate.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                ok = False
                break
        if ok:
            text_key = candidate
            break
    preview = {"text": ([{"key": text_key}] if text_key else []) + [label], "icon": [icon]}
    for img in ("content.image.image_path", "image_path", "content.asset.image_path"):
        node, ok = value, True
        for part in img.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                ok = False
                break
        if ok:
            preview["image"] = [{"key": img}]
            break
    return label, icon, preview


written = 0
for name, doc in sorted(COMPONENTS.items()):
    structures = (doc.get("spec") or {}).get("structures") or []
    if not structures:
        continue

    inputs = {}
    bp = doc.get("blueprint") or {}
    value = {"_type": MAP[name]}
    for k, v in bp.items():
        value[k] = resolve(v, inputs, k)
    value = normalise(name, value)

    # component-scoped _inputs from the .bookshop.yml, merged over derived ones
    for k, v in (doc.get("_inputs") or {}).items():
        inputs.setdefault(k, {}).update(v)

    label, icon, preview = preview_for(name, doc, value)
    out = {"label": label, "icon": icon,
           "picker_preview": {"text": [label], "icon": [icon]},
           "preview": preview, "value": value}
    if inputs:
        out["_inputs"] = inputs

    target = ROOT / "src/_includes" / (MAP[name] + ".cloudcannon.structure-value.yml")
    target.parent.mkdir(parents=True, exist_ok=True)
    text = yaml.safe_dump(out, sort_keys=False, default_flow_style=False,
                          allow_unicode=True, width=100)
    target.write_text(re.sub(r": null$", ":", text, flags=re.M))
    written += 1
    print(f"{name:42s} -> {target.relative_to(ROOT)}   [{', '.join(structures)}]")

print(f"\n{written} structure-value files")
print("\nGroups:")
for g, members in sorted(GROUPS.items()):
    print(f"  {g}: {len(members)} -> {sorted(MAP[m] for m in members)}")
