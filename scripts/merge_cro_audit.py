#!/usr/bin/env python3
"""Merge cover PDF + body PDF into the final deliverable."""
import os
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    """Force every page to exactly A4 dimensions to avoid sub-pixel mismatches."""
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    # Tighten tolerance to 0.5pt so even small mismatches get normalized
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        page.scale_to(A4_W, A4_H)
    # Also set the mediabox explicitly to the exact A4 dimensions
    from pypdf.generic import RectangleObject
    page.mediabox = RectangleObject([0, 0, A4_W, A4_H])
    return page

cover_pdf = "/home/z/my-project/scripts/cro_audit_cover.pdf"
body_pdf  = "/home/z/my-project/scripts/cro_audit_body.pdf"
output    = "/home/z/my-project/download/PracticePro_CRO_PLG_Audit.pdf"

writer = PdfWriter()
# Cover page first
cover_page = PdfReader(cover_pdf).pages[0]
writer.add_page(normalize_page_to_a4(cover_page))
# Body pages follow
body_reader = PdfReader(body_pdf)
for page in body_reader.pages:
    writer.add_page(normalize_page_to_a4(page))

writer.add_metadata({
    '/Title': 'PracticePro CRO & PLG Audit',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Conversion Rate Optimization and Onboarding Audit',
    '/Keywords': 'PracticePro, CRO, PLG, onboarding, audit, payment gateway, trial'
})

os.makedirs(os.path.dirname(output), exist_ok=True)
with open(output, 'wb') as f:
    writer.write(f)

print(f"✓ Merged PDF: {output}")
print(f"  Size: {os.path.getsize(output) / 1024:.1f} KB")
print(f"  Pages: {len(writer.pages)}")
