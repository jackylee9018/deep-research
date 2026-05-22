#!/usr/bin/env python3
"""Build corporate.pptx and minimal.pptx from templates/default.pptx (accent bar colors)."""
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE_TYPE

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE = REPO_ROOT / "templates" / "default.pptx"
TARGETS = {
    "corporate.pptx": RGBColor(4, 120, 87),
    "minimal.pptx": RGBColor(24, 24, 27),
}


def tint_top_shapes(prs, accent: RGBColor):
    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.shape_type != MSO_SHAPE_TYPE.AUTO_SHAPE:
                continue
            if shape.top.inches > 0.2:
                continue
            if shape.height.inches > 0.25:
                continue
            try:
                shape.fill.solid()
                shape.fill.fore_color.rgb = accent
            except Exception:
                pass


def main():
    if not SOURCE.exists():
        raise SystemExit(f"Missing source template: {SOURCE}")

    for file_name, accent in TARGETS.items():
        prs = Presentation(str(SOURCE))
        while len(prs.slides) > 0:
            r_id = prs.slides._sldIdLst[0].rId
            prs.part.drop_rel(r_id)
            del prs.slides._sldIdLst[0]
        tint_top_shapes(prs, accent)
        out = REPO_ROOT / "templates" / file_name
        prs.save(str(out))
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
