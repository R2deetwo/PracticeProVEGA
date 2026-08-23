#!/usr/bin/env python3
"""
Schema index verification — checks that every .withIndex("by_X", ...)
call in convex/ has a matching .index("by_X", [...]) definition in
convex/schema.ts. Also lists "unused" indexes (defined but not referenced
via .withIndex) for manual review.
"""

import re
from pathlib import Path
from collections import defaultdict

CONVEX_DIR = Path("/home/z/my-project/convex")
SCHEMA_FILE = CONVEX_DIR / "schema.ts"

# Find all .index("by_X", [...]) definitions in schema.ts
# Returns: dict[index_name, list[(table, line)]]
defined_indexes = defaultdict(list)
schema_text = SCHEMA_FILE.read_text(encoding="utf-8", errors="replace")

# Track current table definition (look for defineTable above .index calls)
# Schema pattern: `tableName: defineTable({...}).index("by_X", [...])...`
# We'll parse by walking line-by-line and tracking the most recent table def.
current_table = "?"
for i, line in enumerate(schema_text.split("\n"), 1):
    # Match table definitions like:  tableName: defineTable({
    tm = re.match(r'\s*([a-zA-Z_]+):\s*defineTable\(\{', line)
    if tm:
        current_table = tm.group(1)
    # Match .index("by_X", [...])
    im = re.search(r'\.index\("([a-zA-Z_]+)"', line)
    if im:
        defined_indexes[im.group(1)].append((current_table, i))

# Find all .withIndex("by_X", ...) calls in convex/*.ts (excluding schema.ts)
# Returns: dict[index_name, list[(file, line, table)]]
index_usage = defaultdict(list)
for path in CONVEX_DIR.rglob("*.ts"):
    if path.name == "schema.ts":
        continue
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    last_table = "?"
    for i, line in enumerate(text.split("\n"), 1):
        qm = re.search(r'\.query\("([a-zA-Z_]+)"', line)
        if qm:
            last_table = qm.group(1)
        wm = re.search(r'\.withIndex\("([a-zA-Z_]+)"', line)
        if wm:
            index_usage[wm.group(1)].append((str(path.relative_to(Path("/home/z/my-project"))), i, last_table))

# Report
defined_set = set(defined_indexes.keys())
used_set = set(index_usage.keys())
missing = used_set - defined_set
unused = defined_set - used_set

print("# Convex Index Verification")
print()
print(f"- Indexes DEFINED in schema.ts: **{len(defined_set)}**")
print(f"- Indexes USED in queries: **{len(used_set)}**")
print(f"- MISSING (used but not defined): **{len(missing)}**")
print(f"- UNUSED (defined but no .withIndex call found): **{len(unused)}**")
print()

if missing:
    print("## ❌ MISSING INDEXES (used in queries but NOT defined in schema)")
    print()
    for name in sorted(missing):
        usages = index_usage[name]
        print(f"### `{name}` — {len(usages)} call site(s)")
        for file, line, table in usages[:5]:
            print(f"  - `{file}:{line}` (table: `{table}`)")
        if len(usages) > 5:
            print(f"  - ... and {len(usages) - 5} more")
        print()
else:
    print("## ✅ All indexes used in queries are defined in schema.ts")
    print()

print(f"## UNUSED INDEXES ({len(unused)} total)")
print()
print("Each unused index is listed below with its table(s) for manual review.")
print("Keep if tied to a planned-but-unshipped feature; remove if leftover from a changed data shape.")
print()
print("| # | Index Name | Table(s) | Defined Line(s) |")
print("|---|-----------|---------|-----------------|")
for i, name in enumerate(sorted(unused), 1):
    tables = sorted(set(t for t, _ in defined_indexes[name]))
    lines = sorted(set(l for _, l in defined_indexes[name]))
    table_str = ", ".join(tables)
    line_str = ", ".join(str(l) for l in lines[:3]) + ("..." if len(lines) > 3 else "")
    print(f"| {i} | `{name}` | {table_str} | {line_str} |")
