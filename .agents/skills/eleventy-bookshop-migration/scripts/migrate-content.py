"""Rewrites page front matter for the editable-regions migration.

- _bookshop_name -> _type (component include paths)
- removes the shapes the templates used to synthesise at render time, so the
  stored shape equals the rendered shape (see plan decision 3)
"""
import json, pathlib, re, sys, yaml

ROOT = pathlib.Path("/Users/tomrichardson/Dev/work/venture-eleventy-bookshop-template")
MAP = json.loads((pathlib.Path(__file__).parent / "type-map.json").read_text())

LR_SIZES = "(min-width: 769px) 700px, 100vw"
ASSET_SIZES = "(min-width: 769px) 960px, 91vw"
GALLERY_SIZES = "(min-width: 769px) 368px, (min-width: 480px) 46vw, 78vw"
IMAGE_CARD_SIZES = "(min-width: 769px) 368px, (min-width: 480px) 63vw, 94vw"


def retype(node):
    """_bookshop_name -> _type, recursively."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == "_bookshop_name":
                if v not in MAP:
                    sys.exit(f"unmapped bookshop name: {v}")
                out["_type"] = MAP[v]
            else:
                out[k] = retype(v)
        return out
    if isinstance(node, list):
        return [retype(i) for i in node]
    return node


def card_hierarchies(heading):
    """Reproduces the hierarchy the card sections used to compute at render time."""
    primary = (heading or {}).get("primary_heading")
    eyebrow = (heading or {}).get("eyebrow_headline")
    if primary and eyebrow:
        return "h4", "h5"
    if primary or eyebrow:
        return "h3", "h4"
    return "h2", "h3"


def to_imagery_icon(icon):
    """icon-cards used to synthesise this object as a YAML string."""
    common = {"icon_size": "small", "icon_type": (icon or {}).get("icon_type"),
              "rounded_border": False, "theme_color": True}
    if (icon or {}).get("hero_library_icon_name"):
        return {"_type": "components/icons/hero-library-icon",
                "hero_library_icon_name": icon["hero_library_icon_name"], **common}
    return {"_type": "components/icons/custom-icon",
            "icon_path": (icon or {}).get("icon_path"), **common}


def migrate_block(block):
    t = block.get("_type")
    content = block.get("content") or {}

    # Heroes forced h1/h2 in the template; store it instead.
    if t in ("components/heroes/hero", "components/heroes/hero--simple"):
        h = content.get("heading")
        if isinstance(h, dict):
            h["primary_heading_hierarchy"] = "h1"
            h["eyebrow_headline_hierarchy"] = "h2"

    if t == "components/heroes/hero":
        img = content.get("image")
        if isinstance(img, dict) and img.get("image_path"):
            img.setdefault("image_sizes", None)

    # simple-text-block: content.text was a text-block component; now a string.
    if t == "components/sections/simple-text-block":
        txt = content.get("text")
        if isinstance(txt, dict):
            content["text"] = txt.get("text")

    # Card grids: stored shape now equals what card.liquid renders.
    if t in ("components/sections/icon-cards", "components/sections/image-cards"):
        ph, eh = card_hierarchies(content.get("heading"))
        for item in content.get("grid_items") or []:
            if "icon" in item:
                item["imagery"] = to_imagery_icon(item.pop("icon"))
            elif "image" in item:
                img = item.pop("image") or {}
                img["_type"] = "components/assets/image"
                img["image_sizes"] = IMAGE_CARD_SIZES
                item["imagery"] = img
            h = item.get("heading")
            if isinstance(h, dict):
                h["primary_heading_hierarchy"] = ph
                h["eyebrow_headline_hierarchy"] = eh
            item.pop("_type", None)  # grid items aren't a structure of their own
            # card.liquid reads imagery/heading/description/buttons directly
            item.setdefault("description", None)
            item.setdefault("buttons", [])

    # image_sizes used to be injected by the section; store it on the image.
    if t in ("components/sections/left-right-simple",
             "components/sections/left-right-labelled-icons",
             "components/sections/left-right-testimonial"):
        img = content.get("image")
        if isinstance(img, dict):
            img["image_sizes"] = LR_SIZES

    if t == "components/sections/centered-large-asset":
        asset = content.get("asset")
        if isinstance(asset, dict) and asset.get("_type") == "components/assets/image":
            asset["image_sizes"] = ASSET_SIZES

    if t == "components/sections/gallery":
        gallery = content.get("gallery") or {}
        for img in gallery.get("images") or []:
            if isinstance(img, dict):
                img["image_sizes"] = GALLERY_SIZES
    return block


def dump(fm):
    text = yaml.safe_dump(fm, sort_keys=False, default_flow_style=False,
                          allow_unicode=True, width=100)
    # `key: null` -> `key:` matches how CloudCannon writes empty fields.
    return re.sub(r": null$", ":", text, flags=re.M)


for path in sorted((ROOT / "src/pages").glob("*.html")):
    raw = path.read_text()
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", raw, re.S)
    if not m:
        print(f"skip (no front matter): {path.name}")
        continue
    fm = retype(yaml.safe_load(m.group(1)))
    body = m.group(2)

    if isinstance(fm.get("hero"), dict):
        migrate_block(fm["hero"])
    for block in fm.get("content_blocks") or []:
        migrate_block(block)

    path.write_text(f"---\n{dump(fm)}---\n{body}")
    print(f"migrated {path.name}")
