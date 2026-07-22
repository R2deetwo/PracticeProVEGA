#!/usr/bin/env python3
"""Remove the inline HtmlPagePreview definition from DocumentDetailView.tsx.

The component is now imported from '../documents/HtmlPagePreview' instead.
"""
import sys
from pathlib import Path

path = Path('/home/z/my-project/src/components/details/DocumentDetailView.tsx')
text = path.read_text()
lines = text.split('\n')

# Lines 172-458 (1-indexed) are the old inline HtmlPagePreview.
# In 0-indexed Python: indices 171 through 457 inclusive.
# Replace them with a single comment line.
new_lines = lines[:171] + [
    '// ─── HtmlPagePreview & DocumentPreviewModal are now imported from',
    "// '../documents/HtmlPagePreview' and '../documents/DocumentPreviewModal'.",
    "// The inline component was extracted so it can be reused in the modal.",
    '',
] + lines[458:]

path.write_text('\n'.join(new_lines))
print(f'Updated file. Was {len(lines)} lines, now {len(new_lines)} lines.')
