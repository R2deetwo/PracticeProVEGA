#!/usr/bin/env python3
"""
Strip all `dark:*` Tailwind classes from the public marketing/legal pages
so they always render in light mode, regardless of the user's system theme
or saved `practicepro_theme` localStorage value.

Also adds a forced light-mode safeguard to each page's root container:
    style={{ colorScheme: 'light' }}
    data-public-page

This mirrors the treatment applied to ResourcesPage.tsx in a previous step.

Files processed:
    - PrivacyPolicy.tsx
    - TermsOfService.tsx
    - DataProcessingAgreement.tsx
    - CookiePolicy.tsx
    - UsagePolicy.tsx
    - PortalTermsOfUse.tsx
    - LandingPage.tsx  (already has html.dark stripping; just clean dark: classes
                        for consistency, and add colorScheme: light for defense
                        in depth)
"""

import re
from pathlib import Path

BASE = Path("/home/z/my-project/src/components")

FILES = [
    "PrivacyPolicy.tsx",
    "TermsOfService.tsx",
    "DataProcessingAgreement.tsx",
    "CookiePolicy.tsx",
    "UsagePolicy.tsx",
    "PortalTermsOfUse.tsx",
    "LandingPage.tsx",
]

# Match a single dark:xxx token (with optional leading space).
# Tailwind class tokens only contain [A-Za-z0-9_\-/.:#%[]()+] characters.
DARK_TOKEN = re.compile(r"\s*dark:[A-Za-z0-9_\-/.:#%\[\]\(\)\+]+")


def strip_dark_classes(text: str) -> tuple[str, int]:
    """Remove every `dark:*` token from each line; collapse double spaces
    left behind in class attribute interiors; preserve leading indentation
    and trailing newline state."""
    removed_total = 0
    out_lines = []

    for line in text.split("\n"):
        new_line, n = DARK_TOKEN.subn("", line)
        removed_total += n

        # Collapse interior double-spaces (preserve leading indent).
        if "  " in new_line:
            indent_match = re.match(r"^(\s*)", new_line)
            indent = indent_match.group(1) if indent_match else ""
            rest = new_line[len(indent):]
            rest = re.sub(r" {2,}", " ", rest)
            new_line = indent + rest

        # Trim trailing whitespace.
        new_line = new_line.rstrip()
        out_lines.append(new_line)

    new_text = "\n".join(out_lines)
    if text.endswith("\n") and not new_text.endswith("\n"):
        new_text += "\n"

    return new_text, removed_total


def add_light_mode_safeguard(text: str, file_label: str) -> str:
    """Inject `style={{ colorScheme: 'light' }}` and `data-public-page`
    on the outermost returned <div> in the file.

    Strategy:
      - Find the first `return (` after the component function declaration.
      - Find the next opening `<div` tag after that.
      - If the tag doesn't already contain `colorScheme`, inject the style
        and attribute right before the closing `>` of that opening tag.

    For LandingPage.tsx, the root div already has a `style={{...}}` block;
    we merge `colorScheme: 'light'` into the existing style object instead
    of adding a new style attribute.
    """
    # Find the first return ( ... <div ... > pattern.
    # We'll search line-by-line for the first line starting with `return (`
    # after a function declaration, then find the first opening div tag.
    lines = text.split("\n")

    # Find the return ( line
    return_idx = None
    for i, ln in enumerate(lines):
        # Skip comments and string literals containing "return ("
        stripped = ln.lstrip()
        if stripped.startswith("return (") or stripped.startswith("return("):
            # Make sure this isn't inside a comment or string
            # Simple heuristic: no // before "return" on this line
            if "//" not in ln.split("return")[0]:
                return_idx = i
                break

    if return_idx is None:
        print(f"  [{file_label}] WARNING: could not find `return (` — skipping root tag patch")
        return text

    # Find the first <div opening tag after return_idx
    div_idx = None
    for i in range(return_idx, min(return_idx + 30, len(lines))):
        if re.search(r"<div\b", lines[i]):
            div_idx = i
            break

    if div_idx is None:
        print(f"  [{file_label}] WARNING: could not find first <div> after return — skipping")
        return text

    # Walk forward from div_idx to find the closing `>` of this opening tag.
    # The opening tag may span multiple lines.
    end_idx = None
    for i in range(div_idx, min(div_idx + 15, len(lines))):
        # Find the first `>` that's not inside a string literal.
        # Simple heuristic: count quotes — we want a `>` outside any quote.
        line = lines[i]
        in_single = False
        in_double = False
        in_backtick = False
        j = 0
        while j < len(line):
            c = line[j]
            if c == "'" and not in_double and not in_backtick:
                in_single = not in_single
            elif c == '"' and not in_single and not in_backtick:
                in_double = not in_double
            elif c == '`' and not in_single and not in_double:
                in_backtick = not in_backtick
            elif c == '>' and not in_single and not in_double and not in_backtick:
                end_idx = i
                # Position of `>` in this line
                break
            j += 1
        if end_idx is not None:
            break

    if end_idx is None:
        print(f"  [{file_label}] WARNING: could not find closing > of root div — skipping")
        return text

    # Check if `colorScheme` is already present anywhere in the opening tag
    opening_tag_text = "\n".join(lines[div_idx:end_idx + 1])
    if "colorScheme" in opening_tag_text:
        print(f"  [{file_label}] root div already has colorScheme — not re-patching")
        return text

    # Case A: opening tag already has a style={{...}} attribute.
    # We'll merge `colorScheme: 'light'` into the existing style object.
    style_match = re.search(r"style=\{\{", opening_tag_text)
    if style_match:
        # Find the line in `lines` that contains `style={{`
        for i in range(div_idx, end_idx + 1):
            m = re.search(r"style=\{\{(.*)$", lines[i])
            if m:
                rest = m.group(1)
                # If the style object closes on the same line (i.e., contains "}}")
                if "}}" in rest:
                    # Insert colorScheme at the start of the style object
                    # Replace `style={{` with `style={{ colorScheme: 'light', `
                    lines[i] = lines[i].replace(
                        "style={{",
                        "style={{ colorScheme: 'light', ",
                        1
                    )
                    print(f"  [{file_label}] merged colorScheme into existing single-line style attr (line {i+1})")
                    return "\n".join(lines)
                else:
                    # Multi-line style object — insert on a new line right after `style={{`
                    indent_match = re.match(r"^(\s*)", lines[i + 1]) if i + 1 < len(lines) else None
                    indent = indent_match.group(1) if indent_match else "    "
                    new_line = f"{indent}colorScheme: 'light',"
                    lines.insert(i + 1, new_line)
                    print(f"  [{file_label}] merged colorScheme into existing multi-line style attr (inserted after line {i+1})")
                    return "\n".join(lines)

    # Case B: no existing style attribute. Inject `style={{ colorScheme: 'light' }}`
    # and `data-public-page` right before the closing `>`.
    target_line = lines[end_idx]
    # Find the position of the closing `>` (re-scan this line)
    in_single = False
    in_double = False
    in_backtick = False
    insert_pos = None
    j = 0
    while j < len(target_line):
        c = target_line[j]
        if c == "'" and not in_double and not in_backtick:
            in_single = not in_single
        elif c == '"' and not in_single and not in_backtick:
            in_double = not in_double
        elif c == '`' and not in_single and not in_double:
            in_backtick = not in_backtick
        elif c == '>' and not in_single and not in_double and not in_backtick:
            insert_pos = j
            break
        j += 1

    if insert_pos is None:
        print(f"  [{file_label}] WARNING: re-scan failed for closing > — skipping")
        return text

    injection = " style={{ colorScheme: 'light' }} data-public-page"
    new_line = target_line[:insert_pos] + injection + target_line[insert_pos:]
    lines[end_idx] = new_line
    print(f"  [{file_label}] injected colorScheme + data-public-page on line {end_idx + 1}")
    return "\n".join(lines)


def process_file(rel_path: str) -> None:
    full = BASE / rel_path
    if not full.exists():
        print(f"  [{rel_path}] FILE NOT FOUND — skipping")
        return

    original = full.read_text(encoding="utf-8")
    original_size = len(original)

    # Step 1: strip dark: classes
    stripped, removed = strip_dark_classes(original)

    # Step 2: add colorScheme: light + data-public-page to root container
    patched = add_light_mode_safeguard(stripped, rel_path)

    if patched == original:
        print(f"  [{rel_path}] no changes made")
        return

    full.write_text(patched, encoding="utf-8")
    print(f"  [{rel_path}] removed {removed} dark: tokens; "
          f"size {original_size} → {len(patched)} bytes")


def main() -> None:
    print("Processing public marketing/legal pages:")
    for f in FILES:
        print(f"\n→ {f}")
        process_file(f)
    print("\nDone.")


if __name__ == "__main__":
    main()
