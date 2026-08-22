#!/usr/bin/env python3
"""
Schema index verification — checks that every .withIndex("by_X", ...)
call in convex/ has a matching .index("by_X", [...]) definition in
convex/schema.ts.

Outputs a report of any missing indexes (used in queries but not defined
in the schema) — these would cause runtime errors or fall back to slow
table scans.
"""

import re
from pathlib import Path
from collections import defaultdict

CONVEX_DIR = Path("/home/z/my-project/convex")
SCHEMA_FILE = CONVEX_DIR / "schema.ts"

# Find all .index("by_X", [...]) definitions in schema.ts
defined_indexes = set()
schema_text = SCHEMA_FILE.read_text(encoding="utf-8", errors="replace")
for m in re.finditer(r'\.index\("([a-zA-Z_]+)"', schema_text):
    defined_indexes.add(m.group(1))

# Find all .withIndex("by_X", ...) calls in convex/*.ts
# Also try to associate each with the table being queried (best-effort:
# scan backward for "query(" to identify the table)
index_usage = defaultdict(list)  # index_name -> [(file, line, table)]
for path in CONVEX_DIR.rglob("*.ts"):
    if path.name == "schema.ts":
        continue
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    lines = text.split("\n")
    # Track most recent ctx.db.query("table_name") or .query("table_name")
    last_table = "?"
    for i, line in enumerate(lines, 1):
        # Match ctx.db.query("table") or db.query("table")
        qm = re.search(r'\.query\("([a-zA-Z_]+)"', line)
        if qm:
            last_table = qm.group(1)
        # Match .withIndex("by_X", ...)
        wm = re.search(r'\.withIndex\("([a-zA-Z_]+)"', line)
        if wm:
            index_name = wm.group(1)
            rel = str(path.relative_to(Path("/home/z/my-project")))
            index_usage[index_name].append((rel, i, last_table))

# Report
print("# Convex Index Verification")
print()
print(f"- Indexes DEFINED in schema.ts: **{len(defined_indexes)}**")
print(f"- Indexes USED in queries: **{len(index_usage)}**")
print()

missing = set(index_usage.keys()) - defined_indexes
unused = defined_indexes - set(index_usage.keys())

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

print(f"## Unused indexes (defined but no .withIndex call found): {len(unused)}")
print()
print("Note: 'unused' may include indexes used by Convex internally for")
print("foreign-key cascades or that are simply defined for future use.")
print("These are not a problem — only MISSING indexes cause runtime issues.")
