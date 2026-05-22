#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE, PP_PLACEHOLDER
from pptx.util import Inches, Pt


SCRIPT_DIR = Path(__file__).resolve().parent
SLIDE_W_IN = 10
SLIDE_H_IN = 5.625
ACCENT_BAR_H_IN = 0.14

BOX_PRESETS = {
    "title": {
        "title": {"x": 8, "y": 24, "w": 72, "h": 20},
        "subtitle": {"x": 10, "y": 48, "w": 58, "h": 14},
    },
    "section": {
        "title": {"x": 6, "y": 28, "w": 88, "h": 22},
        "subtitle": {"x": 10, "y": 54, "w": 62, "h": 12},
    },
    "bullets": {
        "title": {"x": 5, "y": 7, "w": 62, "h": 13},
        "body": {"x": 7, "y": 24, "w": 58, "h": 66},
    },
    "two_column": {
        "title": {"x": 5, "y": 6, "w": 90, "h": 11},
        "leftTitle": {"x": 5, "y": 21, "w": 44, "h": 9},
        "leftBody": {"x": 5, "y": 32, "w": 44, "h": 60},
        "rightTitle": {"x": 52, "y": 18, "w": 43, "h": 9},
        "rightBody": {"x": 52, "y": 29, "w": 43, "h": 63},
    },
    "closing": {
        "title": {"x": 12, "y": 14, "w": 76, "h": 14},
        "subtitle": {"x": 14, "y": 32, "w": 68, "h": 10},
        "body": {"x": 18, "y": 46, "w": 64, "h": 40},
    },
}
REPO_ROOT = SCRIPT_DIR.parent.parent
CATALOG_PATH = SCRIPT_DIR / "layout_catalog.json"
REGISTRY_PATH = REPO_ROOT / "templates" / "registry.json"


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False))


def text_len(value):
    return len((value or "").strip())


def add_issue(issues, code, message, slide_index=None, field=None, suggested_action=None):
    issue = {"code": code, "message": message}
    if slide_index is not None:
        issue["slideIndex"] = slide_index
    if field:
        issue["field"] = field
    if suggested_action:
        issue["suggestedAction"] = suggested_action
    issues.append(issue)


def validate_plan(plan):
    catalog = load_json(CATALOG_PATH)
    issues = []
    slides = plan.get("slides") or []

    if not slides:
        add_issue(issues, "empty_deck", "Deck has no slides.", suggested_action="Add at least three slides.")

    for slide in slides:
        layout_id = slide.get("layoutId")
        index = slide.get("index")
        limits = catalog.get(layout_id)
        if not limits:
            add_issue(issues, "unknown_layout", f"Unknown layout: {layout_id}", index, "layoutId")
            continue

        title = slide.get("title", "")
        max_title = limits.get("maxTitleChars")
        if not text_len(title):
            add_issue(issues, "missing_title", "Slide title is required.", index, "title")
        elif max_title and text_len(title) > max_title:
            add_issue(
                issues,
                "title_too_long",
                f"Title is {text_len(title)} chars; max is {max_title}.",
                index,
                "title",
                "Shorten the title.",
            )

        max_subtitle = limits.get("maxSubtitleChars")
        subtitle = slide.get("subtitle")
        if max_subtitle and subtitle and text_len(subtitle) > max_subtitle:
            add_issue(
                issues,
                "subtitle_too_long",
                f"Subtitle is {text_len(subtitle)} chars; max is {max_subtitle}.",
                index,
                "subtitle",
                "Shorten the subtitle.",
            )

        max_bullets = limits.get("maxBullets")
        max_bullet_chars = limits.get("maxBulletChars")
        bullet_fields = ["bullets", "leftBullets", "rightBullets"]
        for field in bullet_fields:
            bullets = slide.get(field)
            if bullets is None:
                continue
            if max_bullets and len(bullets) > max_bullets:
                add_issue(
                    issues,
                    "too_many_bullets",
                    f"{field} has {len(bullets)} bullets; max is {max_bullets}.",
                    index,
                    field,
                    "Merge or remove bullets.",
                )
            for item_index, bullet in enumerate(bullets):
                if not text_len(bullet):
                    add_issue(issues, "empty_bullet", "Bullet text is empty.", index, f"{field}.{item_index}")
                elif max_bullet_chars and text_len(bullet) > max_bullet_chars:
                    add_issue(
                        issues,
                        "bullet_too_long",
                        f"Bullet is {text_len(bullet)} chars; max is {max_bullet_chars}.",
                        index,
                        f"{field}.{item_index}",
                        "Shorten this bullet.",
                    )

    return issues


def resolve_template_entry(plan, template_arg):
    registry = load_json(REGISTRY_PATH)
    template_id = (plan.get("templateId") or "default").strip()
    for entry in registry.get("templates", []):
        if entry.get("id") == template_id:
            file_name = entry.get("file", "default.pptx")
            return entry, REPO_ROOT / "templates" / file_name, entry.get("layouts", {})
    file_name = "default.pptx"
    if template_arg:
        path = Path(template_arg)
        if path.exists():
            return None, path, load_json(CATALOG_PATH)
    return None, REPO_ROOT / "templates" / file_name, {}


def find_placeholder(slide, idx):
    for shape in slide.placeholders:
        if shape.placeholder_format.idx == idx:
            return shape
    return None


def set_placeholder_text(shape, text):
    if shape is None:
        return
    text = (text or "").strip()
    if not hasattr(shape, "text_frame"):
        return
    shape.text_frame.text = text


def set_bullets_in_placeholder(shape, bullets):
    if shape is None or not hasattr(shape, "text_frame"):
        return
    frame = shape.text_frame
    frame.clear()
    items = [b.strip() for b in (bullets or []) if text_len(b)]
    if not items:
        frame.text = ""
        return
    for idx, bullet in enumerate(items):
        paragraph = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        paragraph.text = bullet
        paragraph.level = 0


def add_accent_bar(slide):
    from pptx.dml.color import RGBColor

    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        Inches(0),
        Inches(0),
        Inches(SLIDE_W_IN),
        Inches(ACCENT_BAR_H_IN),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(0x25, 0x63, 0xEB)
    shape.line.fill.background()


def layout_index(layouts_map, layout_id, catalog):
    if layouts_map and layout_id in layouts_map:
        return layouts_map[layout_id]
    return catalog.get(layout_id, {}).get("templateLayoutIndex", 1)


def has_custom_boxes(slide_data):
    boxes = slide_data.get("boxes") or {}
    return bool(boxes)


def effective_boxes(slide_data):
    layout_id = slide_data.get("layoutId")
    preset = BOX_PRESETS.get(layout_id, {})
    custom = slide_data.get("boxes") or {}
    merged = dict(preset)
    merged.update(custom)
    return merged


def box_to_inches(rect):
    return {
        "left": Inches(rect["x"] / 100 * SLIDE_W_IN),
        "top": Inches(rect["y"] / 100 * SLIDE_H_IN),
        "width": Inches(rect["w"] / 100 * SLIDE_W_IN),
        "height": Inches(rect["h"] / 100 * SLIDE_H_IN),
    }


def add_textbox(slide, text, rect, font_size=24, bold=False):
    shape = slide.shapes.add_textbox(**box_to_inches(rect))
    frame = shape.text_frame
    frame.clear()
    paragraph = frame.paragraphs[0]
    paragraph.text = text or ""
    paragraph.font.size = Pt(font_size)
    paragraph.font.bold = bold
    return shape


def add_image_box(slide, image_path, rect):
    if not image_path or not Path(image_path).is_file():
        return
    slide.shapes.add_picture(str(image_path), **box_to_inches(rect))


def add_bullet_textbox(slide, bullets, rect, font_size=18):
    shape = slide.shapes.add_textbox(**box_to_inches(rect))
    frame = shape.text_frame
    frame.clear()
    items = [b.strip() for b in (bullets or []) if text_len(b)]
    for idx, bullet in enumerate(items):
        paragraph = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        paragraph.text = bullet
        paragraph.level = 0
        paragraph.font.size = Pt(font_size)
    return shape


def fill_slide_positioned(slide, slide_data):
    boxes = effective_boxes(slide_data)
    layout_id = slide_data.get("layoutId")
    title = slide_data.get("title", "")

    def place(key, text, size=24, bold=False, bullets=None):
        rect = boxes.get(key)
        if not rect:
            return
        if bullets is not None:
            add_bullet_textbox(slide, bullets, rect, font_size=size)
        else:
            add_textbox(slide, text, rect, font_size=size, bold=bold)

    if layout_id in ("title", "section"):
        place("title", title, size=34, bold=True)
        place("subtitle", slide_data.get("subtitle", ""), size=20)
        return

    if layout_id == "bullets":
        place("title", title, size=28, bold=True)
        place("body", "", bullets=slide_data.get("bullets", []), size=18)
        image_meta = slide_data.get("image") or {}
        image_path = image_meta.get("path")
        image_rect = boxes.get("image")
        if image_path and image_rect:
            add_image_box(slide, image_path, image_rect)
        return

    if layout_id == "two_column":
        place("title", title, size=28, bold=True)
        place("leftTitle", slide_data.get("leftTitle", ""), size=16, bold=True)
        place("leftBody", "", bullets=slide_data.get("leftBullets", []), size=16)
        place("rightTitle", slide_data.get("rightTitle", ""), size=16, bold=True)
        place("rightBody", "", bullets=slide_data.get("rightBullets", []), size=16)
        return

    if layout_id == "quote":
        place("title", title, size=14, bold=True)
        place("body", slide_data.get("quote", ""), size=22, bold=True)
        place("subtitle", slide_data.get("attribution", ""), size=14)
        return

    if layout_id == "stat":
        place("title", title, size=20, bold=True)
        place("subtitle", slide_data.get("value", ""), size=40, bold=True)
        context = slide_data.get("context", "")
        if text_len(context):
            place("body", context, size=16)
        else:
            place("body", "", bullets=slide_data.get("bullets", []), size=16)
        return

    if layout_id == "closing":
        place("title", title, size=30, bold=True)
        place("subtitle", slide_data.get("subtitle", ""), size=18)
        place("body", "", bullets=slide_data.get("bullets", []), size=18)


def fill_slide(slide, slide_data, layouts_map, catalog):
    layout_id = slide_data.get("layoutId")
    title = slide_data.get("title", "")
    subtitle = slide_data.get("subtitle", "")

    if layout_id == "title":
        set_placeholder_text(find_placeholder(slide, 0), title)
        set_placeholder_text(find_placeholder(slide, 1), subtitle)
        return

    if layout_id == "section":
        set_placeholder_text(find_placeholder(slide, 0), title)
        set_placeholder_text(find_placeholder(slide, 1), subtitle)
        return

    if layout_id == "bullets":
        set_placeholder_text(find_placeholder(slide, 0), title)
        set_bullets_in_placeholder(find_placeholder(slide, 1), slide_data.get("bullets", []))
        return

    if layout_id == "two_column":
        set_placeholder_text(find_placeholder(slide, 0), title)
        set_placeholder_text(find_placeholder(slide, 1), slide_data.get("leftTitle", ""))
        set_bullets_in_placeholder(
            find_placeholder(slide, 2),
            slide_data.get("leftBullets", []),
        )
        set_placeholder_text(find_placeholder(slide, 3), slide_data.get("rightTitle", ""))
        set_bullets_in_placeholder(
            find_placeholder(slide, 4),
            slide_data.get("rightBullets", []),
        )
        return

    if layout_id == "quote":
        set_placeholder_text(find_placeholder(slide, 0), title)
        set_placeholder_text(find_placeholder(slide, 1), slide_data.get("quote", ""))
        return

    if layout_id == "stat":
        set_placeholder_text(find_placeholder(slide, 0), title)
        set_placeholder_text(find_placeholder(slide, 1), slide_data.get("value", ""))
        body_lines = []
        if text_len(slide_data.get("context", "")):
            body_lines.append(slide_data.get("context", "").strip())
        body_lines.extend(slide_data.get("bullets", []) or [])
        set_bullets_in_placeholder(find_placeholder(slide, 1), body_lines)
        return

    if layout_id == "closing":
        set_placeholder_text(find_placeholder(slide, 0), title)
        body_lines = []
        if text_len(subtitle):
            body_lines.append(subtitle.strip())
        body_lines.extend(slide_data.get("bullets", []) or [])
        set_bullets_in_placeholder(find_placeholder(slide, 1), body_lines)
        return

    set_placeholder_text(find_placeholder(slide, 0), title)
    set_bullets_in_placeholder(find_placeholder(slide, 1), slide_data.get("bullets", []))


def create_presentation(plan, template_path):
    catalog = load_json(CATALOG_PATH)
    _entry, resolved_path, layouts_map = resolve_template_entry(plan, template_path)

    if not resolved_path.exists():
        raise FileNotFoundError(f"Template not found: {resolved_path}")

    prs = Presentation(str(resolved_path))

    while len(prs.slides) > 0:
        r_id = prs.slides._sldIdLst[0].rId
        prs.part.drop_rel(r_id)
        del prs.slides._sldIdLst[0]

    blank_layout = prs.slide_layouts[6]

    for slide_data in plan.get("slides", []):
        if has_custom_boxes(slide_data):
            slide = prs.slides.add_slide(blank_layout)
            add_accent_bar(slide)
            fill_slide_positioned(slide, slide_data)
            continue

        layout_id = slide_data.get("layoutId")
        index = layout_index(layouts_map, layout_id, catalog)
        if index >= len(prs.slide_layouts):
            raise ValueError(
                f"Layout index {index} for {layout_id} is out of range "
                f"(template has {len(prs.slide_layouts)} layouts)",
            )
        slide_layout = prs.slide_layouts[index]
        slide = prs.slides.add_slide(slide_layout)
        fill_slide(slide, slide_data, layouts_map, catalog)

    return prs


def command_generate(args):
    plan = load_json(args.plan)
    issues = validate_plan(plan)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if issues:
        emit({"success": False, "issues": issues, "slide_count": len(plan.get("slides") or [])})
        return 0

    prs = create_presentation(plan, args.template)
    prs.save(output)
    emit(
        {
            "success": True,
            "file_path": str(output),
            "issues": [],
            "slide_count": len(prs.slides),
        }
    )
    return 0


def command_validate(args):
    plan = load_json(args.plan)
    issues = validate_plan(plan)
    emit({"success": len(issues) == 0, "issues": issues, "slide_count": len(plan.get("slides") or [])})
    return 0


def command_template(args):
    prs = Presentation()
    prs.save(args.output)
    emit({"success": True, "file_path": args.output, "issues": [], "slide_count": 0})
    return 0


def main():
    parser = argparse.ArgumentParser(description="Generate and validate PPTX decks.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate = subparsers.add_parser("generate")
    generate.add_argument("--plan", required=True)
    generate.add_argument("--output", required=True)
    generate.add_argument("--template")
    generate.set_defaults(func=command_generate)

    validate = subparsers.add_parser("validate")
    validate.add_argument("--plan", required=True)
    validate.set_defaults(func=command_validate)

    template = subparsers.add_parser("create-template")
    template.add_argument("--output", required=True)
    template.set_defaults(func=command_template)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        emit({"success": False, "issues": [{"code": "skill_error", "message": str(exc)}]})
        raise SystemExit(1)
