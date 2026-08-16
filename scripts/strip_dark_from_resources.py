#!/usr/bin/env python3
"""
Strip all `dark:*` Tailwind classes from ResourcesPage.tsx so the page
always renders in light mode, regardless of the user's system theme
or saved `practicepro_theme` localStorage value.

The script also collapses double-spaces left behind by removed classes
and trims trailing whitespace on every line.
"""

import re
from pathlib import Path

SRC = Path("/home/z/my-project/src/components/ResourcesPage.tsx")

text = SRC.read_text(encoding="utf-8")

# Match a single dark:xxx token (with optional leading space).
# Tailwind class tokens only contain [A-Za-z0-9_\-/.:#%[]] characters
# and may be wrapped in arbitrary expression interpolation in TSX,
# but in this file all dark: usages are plain string literals.
DARK_TOKEN = re.compile(r"\s*dark:[A-Za-z0-9_\-/.:#%\[\]\(\)\+]+")

original_line_count = text.count("\n")
removed_count = 0

def strip_line(line: str) -> str:
    global removed_count
    new_line, n = DARK_TOKEN.subn("", line)
    removed_count += n
    # Collapse double-spaces that the removal may have left behind
    # (but preserve leading indentation).
    if "  " in new_line:
        # Only collapse interior double-spaces; keep leading whitespace intact.
        indent_match = re.match(r"^(\s*)", new_line)
        indent = indent_match.group(1) if indent_match else ""
        rest = new_line[len(indent):]
        rest = re.sub(r" {2,}", " ", rest)
        new_line = indent + rest
    # Trim trailing whitespace.
    return new_line.rstrip()

new_text = "\n".join(strip_line(ln) for ln in text.split("\n"))

# Preserve trailing newline state from original.
if text.endswith("\n") and not new_text.endswith("\n"):
    new_text += "\n"

SRC.write_text(new_text, encoding="utf-8")

print(f"Processed {original_line_count + 1} lines.")
print(f"Removed {removed_count} dark:* class tokens.")
print(f"New file size: {len(new_text)} bytes (was {len(text)} bytes).")
