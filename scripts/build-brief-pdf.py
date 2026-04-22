#!/usr/bin/env python
"""
Render CTO-SECURITY-BRIEF.md to a compact, professional PDF.

Supports:
- # / ## / ### headings
- Paragraphs with **bold** and `inline code`
- Markdown pipe tables (auto-sized)
- Fenced ``` code blocks (monospace)
- Horizontal rules
- Bulleted lists

Run from the investment-tracker directory:
    python scripts/build-brief-pdf.py
"""
import os
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "CTO-SECURITY-BRIEF.md"
OUT = ROOT / "CTO-SECURITY-BRIEF.pdf"

# ── Styles ────────────────────────────────────────────────────
BASE = getSampleStyleSheet()
FONT_BODY = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_MONO = "Courier"

styles = {
    "title": ParagraphStyle(
        "title", parent=BASE["Title"],
        fontName=FONT_BOLD, fontSize=18, leading=22,
        spaceAfter=4, textColor=colors.HexColor("#1a1a1a"),
    ),
    "h1": ParagraphStyle(
        "h1", parent=BASE["Heading1"],
        fontName=FONT_BOLD, fontSize=13, leading=16,
        spaceBefore=12, spaceAfter=4, textColor=colors.HexColor("#1a1a1a"),
    ),
    "h2": ParagraphStyle(
        "h2", parent=BASE["Heading2"],
        fontName=FONT_BOLD, fontSize=11, leading=14,
        spaceBefore=10, spaceAfter=3, textColor=colors.HexColor("#2a2a2a"),
    ),
    "h3": ParagraphStyle(
        "h3", parent=BASE["Heading3"],
        fontName=FONT_BOLD, fontSize=10, leading=13,
        spaceBefore=6, spaceAfter=2, textColor=colors.HexColor("#333"),
    ),
    "body": ParagraphStyle(
        "body", parent=BASE["BodyText"],
        fontName=FONT_BODY, fontSize=9, leading=12,
        spaceBefore=2, spaceAfter=4, textColor=colors.HexColor("#222"),
    ),
    "small": ParagraphStyle(
        "small", parent=BASE["BodyText"],
        fontName=FONT_BODY, fontSize=8, leading=10,
        textColor=colors.HexColor("#555"),
    ),
    "bullet": ParagraphStyle(
        "bullet", parent=BASE["BodyText"],
        fontName=FONT_BODY, fontSize=9, leading=12,
        leftIndent=12, bulletIndent=0, spaceBefore=1, spaceAfter=1,
    ),
    "code": ParagraphStyle(
        "code", parent=BASE["Code"],
        fontName=FONT_MONO, fontSize=7.5, leading=9.5,
        backColor=colors.HexColor("#f5f5f5"),
        borderColor=colors.HexColor("#ddd"), borderWidth=0.5, borderPadding=6,
        spaceBefore=4, spaceAfter=6, textColor=colors.HexColor("#222"),
    ),
    "tablecell": ParagraphStyle(
        "tablecell", parent=BASE["BodyText"],
        fontName=FONT_BODY, fontSize=8, leading=10, textColor=colors.HexColor("#222"),
    ),
    "tableheader": ParagraphStyle(
        "tableheader", parent=BASE["BodyText"],
        fontName=FONT_BOLD, fontSize=8, leading=10, textColor=colors.HexColor("#fff"),
    ),
}


# ── Inline markdown → reportlab markup ────────────────────────
def inline(text: str) -> str:
    """Convert a subset of markdown inline syntax to reportlab's <b>/<i>/<font> tags."""
    # Escape XML first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # `code` → monospace
    text = re.sub(r"`([^`]+)`", r'<font name="Courier" size="8">\1</font>', text)
    # **bold**
    text = re.sub(r"\*\*([^\*]+)\*\*", r"<b>\1</b>", text)
    # *italic*
    text = re.sub(r"(?<!\*)\*([^\*]+)\*(?!\*)", r"<i>\1</i>", text)
    # Strip [label](url) → label
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text


# ── Block parsers ─────────────────────────────────────────────
def parse_table(lines):
    """Parse a markdown pipe-table block, returning a Table flowable."""
    rows = []
    for ln in lines:
        ln = ln.strip()
        if not ln or set(ln.replace("|", "").replace("-", "").replace(":", "").strip()) == set():
            continue  # separator row
        cells = [c.strip() for c in ln.strip("|").split("|")]
        rows.append(cells)
    if not rows:
        return None

    header, body = rows[0], rows[1:]
    data = [[Paragraph(inline(c), styles["tableheader"]) for c in header]]
    for row in body:
        data.append([Paragraph(inline(c), styles["tablecell"]) for c in row])

    tbl = Table(data, repeatRows=1, colWidths=None, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2a5a8a")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
    ]))
    return tbl


def md_to_flowables(md: str):
    """Walk the markdown document, yielding reportlab flowables."""
    lines = md.splitlines()
    i = 0
    out = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Code fence
        if stripped.startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            code = "\n".join(code_lines)
            out.append(Preformatted(code, styles["code"]))
            continue

        # Table (a line starting with | and the next line is a separator)
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", lines[i + 1]):
            tbl_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                tbl_lines.append(lines[i])
                i += 1
            tbl = parse_table(tbl_lines)
            if tbl:
                out.append(tbl)
                out.append(Spacer(1, 4))
            continue

        # Horizontal rule
        if stripped in {"---", "***", "___"}:
            out.append(Spacer(1, 3))
            out.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#ccc")))
            out.append(Spacer(1, 3))
            i += 1
            continue

        # Headings
        if stripped.startswith("# "):
            out.append(Paragraph(inline(stripped[2:]), styles["title"]))
            i += 1
            continue
        if stripped.startswith("## "):
            out.append(Paragraph(inline(stripped[3:]), styles["h1"]))
            i += 1
            continue
        if stripped.startswith("### "):
            out.append(Paragraph(inline(stripped[4:]), styles["h2"]))
            i += 1
            continue

        # Bullet list
        if re.match(r"^\s*[-*]\s+", line):
            bullets = []
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                item = re.sub(r"^\s*[-*]\s+", "", lines[i])
                bullets.append(Paragraph(f"• {inline(item)}", styles["bullet"]))
                i += 1
            out.extend(bullets)
            continue

        # Blank line
        if not stripped:
            i += 1
            continue

        # Paragraph (accumulate until blank line or next block)
        para_lines = []
        while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(
            ("#", "```", "|", "-", "*")
        ):
            para_lines.append(lines[i].strip())
            i += 1
        if para_lines:
            out.append(Paragraph(inline(" ".join(para_lines)), styles["body"]))

    return out


# ── Build the PDF ─────────────────────────────────────────────
def build():
    md = SRC.read_text(encoding="utf-8")
    flowables = md_to_flowables(md)

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=1.6 * cm, rightMargin=1.6 * cm,
        topMargin=1.4 * cm, bottomMargin=1.4 * cm,
        title="Security Posture — Investment Tracker",
        author="Investment Tracker team",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT_BODY, 7.5)
        canvas.setFillColor(colors.HexColor("#888"))
        canvas.drawString(doc.leftMargin, 0.8 * cm, "Confidential — for internal review")
        canvas.drawRightString(
            A4[0] - doc.rightMargin, 0.8 * cm,
            f"Page {doc.page}",
        )
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=on_page)])
    doc.build(flowables)
    print(f"✓ Wrote {OUT}  ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
