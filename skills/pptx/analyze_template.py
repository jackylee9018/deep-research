#!/usr/bin/env python3
"""Analyze a .pptx and suggest templates/registry.json layout indices."""
import argparse
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import PP_PLACEHOLDER

SCRIPT_DIR = Path(__file__).resolve().parent
CATALOG_PATH = SCRIPT_DIR / "layout_catalog.json"

REQUIRED_LAYOUTS = (
    "title",
    "section",
    "bullets",
    "two_column",
    "quote",
    "stat",
    "closing",
)


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def placeholder_types(layout):
    types = set()
    for shape in layout.placeholders:
        if not shape.is_placeholder:
            continue
        ph_type = shape.placeholder_format.type
        if ph_type is not None:
            types.add(int(ph_type))
    return types


def layout_meta(prs):
    rows = []
    for index, layout in enumerate(prs.slide_layouts):
        name = layout.name or f"Layout {index}"
        ph_count = len(layout.placeholders)
        types = placeholder_types(layout)
        rows.append(
            {
                "index": index,
                "name": name,
                "placeholderCount": ph_count,
                "placeholderTypes": sorted(types),
            }
        )
    return rows


def score_layout(layout, layout_id, name_lower):
    ph_count = len(layout.placeholders)
    types = placeholder_types(layout)
    title_type = int(PP_PLACEHOLDER.TITLE)
    center_title = int(PP_PLACEHOLDER.CENTER_TITLE)
    body_type = int(PP_PLACEHOLDER.BODY)
    subtitle_type = int(PP_PLACEHOLDER.SUBTITLE)
    object_type = int(PP_PLACEHOLDER.OBJECT)

    has_title = title_type in types or center_title in types
    has_body = body_type in types or object_type in types
    has_subtitle = subtitle_type in types

    if layout_id == "title":
        score = 0
        if "title" in name_lower and "content" not in name_lower:
            score += 4
        if has_title and ph_count <= 3:
            score += 3
        if ph_count <= 2:
            score += 1
        return score

    if layout_id == "section":
        score = 0
        if "section" in name_lower or "header" in name_lower:
            score += 5
        if has_title and (has_subtitle or ph_count <= 3):
            score += 2
        return score

    if layout_id == "bullets":
        score = 0
        if "content" in name_lower or "bullet" in name_lower:
            score += 4
        if has_title and has_body and ph_count >= 2:
            score += 4
        if ph_count == 2:
            score += 1
        return score

    if layout_id == "two_column":
        score = 0
        if "comparison" in name_lower or "two" in name_lower or "雙" in name_lower:
            score += 5
        if ph_count >= 3:
            score += 3
        if has_body and ph_count >= 4:
            score += 2
        return score

    if layout_id == "quote":
        score = 0
        if "quote" in name_lower or "引用" in name_lower:
            score += 5
        if has_body and ph_count >= 2:
            score += 2
        return score

    if layout_id == "stat":
        score = 0
        if "metric" in name_lower or "number" in name_lower or "數據" in name_lower:
            score += 4
        if has_title and has_body:
            score += 2
        return score

    if layout_id == "closing":
        score = 0
        if "closing" in name_lower or "end" in name_lower or "結尾" in name_lower:
            score += 5
        if has_title and ph_count <= 3:
            score += 2
        return score

    return 0


def suggest_layouts(prs, catalog):
    warnings = []
    layouts = {}
    for layout_id in REQUIRED_LAYOUTS:
        fallback = catalog.get(layout_id, {}).get("templateLayoutIndex", 1)
        best_index = fallback
        best_score = 0

        for index, slide_layout in enumerate(prs.slide_layouts):
            name_lower = (slide_layout.name or "").lower()
            score = score_layout(slide_layout, layout_id, name_lower)
            if score > best_score:
                best_score = score
                best_index = index

        if best_score == 0:
            warnings.append(
                f"layout '{layout_id}' 無法從母片自動對應，使用預設索引 {fallback}"
            )

        if best_index >= len(prs.slide_layouts):
            warnings.append(
                f"layout '{layout_id}' 索引 {best_index} 超出母片數量，改為 {fallback}"
            )
            best_index = min(fallback, max(0, len(prs.slide_layouts) - 1))

        layouts[layout_id] = best_index

    return layouts, warnings


def _theme_color(root, scheme_name, ns):
    path = f".//a:themeElements/a:clrScheme/a:{scheme_name}"
    srgb = root.find(f"{path}/a:srgbClr", ns)
    if srgb is not None and srgb.get("val"):
        return srgb.get("val").upper()
    sys_clr = root.find(f"{path}/a:sysClr", ns)
    if sys_clr is not None and sys_clr.get("lastClr"):
        return sys_clr.get("lastClr").upper()
    return None


def extract_export_theme(pptx_path):
    """Read accent/background colors from ppt/theme/theme1.xml when present."""
    ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    try:
        with zipfile.ZipFile(pptx_path) as archive:
            theme_files = sorted(
                name
                for name in archive.namelist()
                if name.startswith("ppt/theme/") and name.endswith(".xml")
            )
            if not theme_files:
                return None
            root = ET.fromstring(archive.read(theme_files[0]))
    except Exception:
        return None

    accent = _theme_color(root, "accent1", ns) or _theme_color(root, "accent2", ns)
    if not accent:
        return None

    title = _theme_color(root, "dk1", ns) or _theme_color(root, "dk2", ns) or "0F172A"
    body = _theme_color(root, "dk2", ns) or _theme_color(root, "tx1", ns) or "334155"
    muted = _theme_color(root, "tx2", ns) or _theme_color(root, "lt2", ns) or "475569"
    slide_bg = _theme_color(root, "lt1", ns) or _theme_color(root, "bg1", ns) or "F8FAFC"
    slide_bg_end = (
        _theme_color(root, "lt2", ns) or _theme_color(root, "bg2", ns) or "EEF2FF"
    )

    return {
        "accent": accent,
        "title": title,
        "body": body,
        "muted": muted,
        "slideBackground": slide_bg,
        "slideBackgroundEnd": slide_bg_end,
    }


def analyze(pptx_path):
    catalog = load_json(CATALOG_PATH)
    prs = Presentation(str(pptx_path))
    layouts, warnings = suggest_layouts(prs, catalog)
    export_theme = extract_export_theme(pptx_path)
    if not export_theme:
        warnings.append("無法從 ppt/theme 解析色票，預覽/匯出將沿用 default 配色")
    return {
        "layoutCount": len(prs.slide_layouts),
        "slideLayouts": layout_meta(prs),
        "layouts": layouts,
        "warnings": warnings,
        "exportTheme": export_theme,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", required=True)
    args = parser.parse_args()
    path = Path(args.pptx)
    if not path.exists():
        emit_error(f"File not found: {path}")
        return 1

    try:
        payload = analyze(path)
        print(json.dumps({"success": True, **payload}, ensure_ascii=False))
        return 0
    except Exception as exc:
        emit_error(str(exc))
        return 1


def emit_error(message):
    print(json.dumps({"success": False, "error": message}, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
