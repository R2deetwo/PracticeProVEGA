#!/usr/bin/env python3
"""
Insert requireEstateCommunityAccess() calls into all estateCommunity.ts handlers.

For each handler, find the first auth call (requireAdmin or requireFirmUser)
and insert requireEstateCommunityAccess immediately AFTER it.

Skip handlers that don't take firmId in args (none in this file — all do).
"""
import re
from pathlib import Path

PATH = Path("/home/z/my-project/convex/estateCommunity.ts")
text = PATH.read_text()

# Pattern: "const auth = await requireAdmin(ctx, args.userEmail);\n" or
#          "await requireFirmUser(ctx, args.userEmail);\n"
# Insert "await requireEstateCommunityAccess(ctx, args.firmId || auth.firmId);\n" after.
#
# We need to handle both:
#   - requireAdmin returns `auth` → use auth.firmId (preferred) or args.firmId
#   - requireFirmUser returns `auth` → use auth.firmId or args.firmId
#
# For handlers that use `const auth = await requireFirmUser(...)`, the
# subsequent lines already reference auth.firmId. We'll insert
# `await requireEstateCommunityAccess(ctx, auth.firmId || args.firmId);`
# which is safe for both paths.

# Count how many handlers already have the call (idempotency)
existing_count = text.count("await requireEstateCommunityAccess(ctx,")
expected = 18  # rough count

if existing_count >= 10:
    print(f"Already has {existing_count} requireEstateCommunityAccess calls — skipping")
    raise SystemExit(0)

# Find every "const auth = await requireAdmin(ctx, args.userEmail);" line and
# every "await requireFirmUser(ctx, args.userEmail);" line that's NOT already
# followed by requireEstateCommunityAccess.
#
# Use a simple line-based scan to insert.

lines = text.split("\n")
out = []
inserts = 0
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    # Check if this line is an auth call we should gate
    if (
        ("requireAdmin(ctx, args.userEmail)" in line or "requireFirmUser(ctx, args.userEmail)" in line)
        and "await requireEstateCommunityAccess" not in line
    ):
        # Look at next non-empty line — if it's already requireEstateCommunityAccess, skip
        next_idx = i + 1
        while next_idx < len(lines) and lines[next_idx].strip() == "":
            next_idx += 1
        if next_idx < len(lines) and "requireEstateCommunityAccess" in lines[next_idx]:
            i += 1
            continue
        # Determine firmId source: if line has "const auth =", use auth.firmId;
        # otherwise use args.firmId.
        if "const auth =" in line:
            gate_line = "    await requireEstateCommunityAccess(ctx, auth.firmId || args.firmId);"
        else:
            gate_line = "    await requireEstateCommunityAccess(ctx, args.firmId);"
        out.append(gate_line)
        inserts += 1
    i += 1

PATH.write_text("\n".join(out))
print(f"Inserted {inserts} requireEstateCommunityAccess calls")
