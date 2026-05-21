#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


SCRIPT_DIR = Path(__file__).resolve().parent
CATALOG_PATH = SCRIPT_DIR / "layout_catalog.json"


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


def set_text_frame(shape, text, font_size=24, bold=False, color=RGBColor(30, 41, 59)):
    frame = shape.text_frame
    frame.clear()
    paragraph = frame.paragraphs[0]
    paragraph.text = text or ""
    paragraph.font.size = Pt(font_size)
    paragraph.font.bold = bold
    paragraph.font.color.rgb = color
    return frame


def add_title(slide, text, left=0.75, top=0.55, width=8.5, height=0.75, font_size=30):
    shape = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    set_text_frame(shape, text, font_size=font_size, bold=True, color=RGBColor(15, 23, 42))
    return shape


def add_body(slide, bullets, left, top, width, height, font_size=20):
    shape = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    frame = shape.text_frame
    frame.clear()
    for idx, bullet in enumerate(bullets):
        paragraph = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        paragraph.text = bullet
        paragraph.level = 0
        paragraph.font.size = Pt(font_size)
        paragraph.font.color.rgb = RGBColor(51, 65, 85)
    return shape


def add_subtitle(slide, text, left=0.9, top=1.55, width=8.1, height=1.0, font_size=20):
    shape = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    frame = set_text_frame(shape, text or "", font_size=font_size, color=RGBColor(71, 85, 105))
    frame.paragraphs[0].alignment = PP_ALIGN.CENTER
    return shape


def add_accent_bar(slide):
    shape = slide.shapes.add_shape(1, Inches(0), Inches(0), Inches(10), Inches(0.14))
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(37, 99, 235)
    shape.line.fill.background()


def create_presentation(plan, template_path):
    if template_path and Path(template_path).exists():
        prs = Presentation(template_path)
        while len(prs.slides) > 0:
            r_id = prs.slides._sldIdLst[0].rId
            prs.part.drop_rel(r_id)
            del prs.slides._sldIdLst[0]
    else:
        prs = Presentation()

    blank_layout = prs.slide_layouts[6]

    for slide_data in plan.get("slides", []):
        slide = prs.slides.add_slide(blank_layout)
        add_accent_bar(slide)
        layout_id = slide_data.get("layoutId")

        if layout_id == "title":
            add_title(slide, slide_data.get("title", ""), left=0.9, top=1.35, width=8.2, height=0.9, font_size=38)
            add_subtitle(slide, slide_data.get("subtitle", ""), top=2.45, font_size=22)
        elif layout_id == "section":
            add_title(slide, slide_data.get("title", ""), left=0.9, top=1.75, width=8.2, height=0.85, font_size=34)
            add_subtitle(slide, slide_data.get("subtitle", ""), top=2.8, font_size=20)
        elif layout_id == "two_column":
            add_title(slide, slide_data.get("title", ""))
            add_title(slide, slide_data.get("leftTitle", ""), left=0.75, top=1.55, width=4.1, height=0.45, font_size=19)
            add_title(slide, slide_data.get("rightTitle", ""), left=5.1, top=1.55, width=4.1, height=0.45, font_size=19)
            add_body(slide, slide_data.get("leftBullets", []), 0.8, 2.15, 4.0, 3.0, 18)
            add_body(slide, slide_data.get("rightBullets", []), 5.15, 2.15, 4.0, 3.0, 18)
        elif layout_id == "closing":
            add_title(slide, slide_data.get("title", ""), left=0.8, top=0.9, width=8.4, height=0.75, font_size=32)
            add_subtitle(slide, slide_data.get("subtitle", ""), top=1.85, font_size=19)
            add_body(slide, slide_data.get("bullets", []), 1.45, 3.0, 7.1, 1.7, 18)
        else:
            add_title(slide, slide_data.get("title", ""))
            add_body(slide, slide_data.get("bullets", []), 1.0, 1.65, 8.0, 3.4)

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
