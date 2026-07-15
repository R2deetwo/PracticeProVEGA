#!/usr/bin/env python3
"""Generate a clean PDF from the REMAINING_AUDIT_ITEMS.md file."""

import subprocess
import sys
import os

# Use pandoc to convert markdown to PDF via HTML
md_file = "/home/z/my-project/REMAINING_AUDIT_ITEMS.md"
html_file = "/home/z/my-project/scripts/audit_items.html"
pdf_file = "/home/z/my-project/download/PracticePro_Remaining_Audit_Items.pdf"

# Read the markdown
with open(md_file, 'r') as f:
    md_content = f.read()

# Convert markdown to HTML
try:
    import markdown
    html_body = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'codehilite'])
except ImportError:
    # Fallback: use pandoc
    subprocess.run(['pip', 'install', 'markdown', '-q'])
    import markdown
    html_body = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])

# Wrap in full HTML with styling
html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page {{
  size: A4;
  margin: 20mm 18mm;
}}
body {{
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #1a202c;
  max-width: 100%;
}}
h1 {{
  color: #4A694C;
  font-size: 22pt;
  border-bottom: 3px solid #4A694C;
  padding-bottom: 8px;
  margin-top: 30px;
}}
h2 {{
  color: #4A694C;
  font-size: 16pt;
  margin-top: 28px;
  border-bottom: 1px solid #cbd5e0;
  padding-bottom: 4px;
}}
h3 {{
  color: #2d3748;
  font-size: 13pt;
  margin-top: 20px;
}}
p {{
  margin: 8px 0;
}}
strong {{
  color: #1a202c;
}}
code {{
  background: #f7fafc;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 10pt;
  color: #c5221f;
}}
pre {{
  background: #1a202c;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 9pt;
  line-height: 1.5;
}}
pre code {{
  background: transparent;
  color: #e2e8f0;
  padding: 0;
}}
table {{
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 10pt;
}}
th {{
  background: #4A694C;
  color: white;
  padding: 8px 10px;
  text-align: left;
  font-weight: 700;
}}
td {{
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
}}
tr:nth-child(even) {{
  background: #f7fafc;
}}
hr {{
  border: none;
  border-top: 1px solid #cbd5e0;
  margin: 24px 0;
}}
ul, ol {{
  margin: 8px 0;
  padding-left: 24px;
}}
li {{
  margin: 4px 0;
}}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

# Write HTML
os.makedirs(os.path.dirname(html_file), exist_ok=True)
with open(html_file, 'w') as f:
    f.write(html)

# Convert HTML to PDF using Playwright
os.makedirs(os.path.dirname(pdf_file), exist_ok=True)

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f'file://{html_file}')
    page.wait_for_timeout(1000)  # Wait for fonts
    page.pdf(
        path=pdf_file,
        format='A4',
        margin={'top': '20mm', 'bottom': '20mm', 'left': '18mm', 'right': '18mm'},
        print_background=True,
    )
    browser.close()

print(f"PDF generated: {pdf_file}")
print(f"File size: {os.path.getsize(pdf_file)} bytes")
