#!/usr/bin/env python3
"""Verify templates/registry.json layout indices against each .pptx file."""
import json
import sys
from pathlib import Path

from pptx import Presentation


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
REGISTRY_PATH = REPO_ROOT / "templates" / "registry.json"
CATALOG_PATH = SCRIPT_DIR / "layout_catalog.json"

REQUIRED_LAYOUTS = ("title", "section", "bullets", "two_column", "quote", "stat", "closing")


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def check_template(entry, catalog):
    template_id = entry.get("id", "?")
    file_name = entry.get("file", "default.pptx")
    pptx_path = REPO_ROOT / "templates" / file_name
    layouts_map = entry.get("layouts") or {}
    issues = []

    if not pptx_path.exists():
        issues.append(f"[{template_id}] missing file: {pptx_path}")
        return issues

    prs = Presentation(str(pptx_path))
    layout_count = len(prs.slide_layouts)

    for layout_id in REQUIRED_LAYOUTS:
        index = layouts_map.get(layout_id)
        if index is None:
            index = catalog.get(layout_id, {}).get("templateLayoutIndex", 1)
            issues.append(
                f"[{template_id}] layout '{layout_id}' not in registry; fallback index {index}"
            )
        if index >= layout_count:
            issues.append(
                f"[{template_id}] layout '{layout_id}' index {index} >= slide_layouts ({layout_count})"
            )
            continue

        slide_layout = prs.slide_layouts[index]
        placeholder_count = len(slide_layout.placeholders)
        if layout_id in ("bullets", "quote", "stat") and placeholder_count < 2:
            issues.append(
                f"[{template_id}] layout '{layout_id}' index {index} has only {placeholder_count} placeholders"
            )
        if layout_id == "two_column" and placeholder_count < 3:
            issues.append(
                f"[{template_id}] two_column index {index} has only {placeholder_count} placeholders (want >=3)"
            )

    return issues


def main():
    registry = load_json(REGISTRY_PATH)
    catalog = load_json(CATALOG_PATH)
    all_issues = []

    for entry in registry.get("templates", []):
        all_issues.extend(check_template(entry, catalog))

    if all_issues:
        print("Template layout verification FAILED:\n")
        for line in all_issues:
            print(f"  - {line}")
        return 1

    print(f"OK: {len(registry.get('templates', []))} template(s) verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
