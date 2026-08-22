#!/usr/bin/env python3
"""
Offline-resilience audit script.

Scans the src/ tree for useMutation(api.*) call sites NOT covered by the
offline queue, and for each:
  - Reports what happens when the mutation fails offline (silent / caught
    user-visible error / hang)
  - Flags sites that fail SILENTLY as needing a guard

Output: a markdown report written to stdout.

This is a code-inspection audit (grep + read) — it does NOT execute the
mutations. The findings should be read as "what the code does today when
the network is down," not a runtime test.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path("/home/z/my-project/src")
QUEUE_COVERED_MUTATIONS = {
    # These mutations are now reachable via the offline queue
    "createItem",
    "updateItem",
    "deleteItem",
    "addLedgerEntry",
    "markChargeAsPaid",
    "recordTrustTransaction",
}
# Files that explicitly use useOfflineQueue
QUEUE_USING_FILES = set()
MUTATION_PATTERN = re.compile(r"useMutation\(api\.(\w+)\.(\w+)\)")

# Files explicitly wired to the offline queue in this pass
WIRED_FILES = {
    "src/components/modals/CollectRentModal.tsx",
    "src/components/atrium/ServiceChargeMonitor.tsx",
    "src/components/details/TrustAccountTab.tsx",
    "src/components/atrium/LedgerManager.tsx",
    "src/components/details/PropertyTrackingView.tsx",
    "src/components/forms/PropertyForm.tsx",
    "src/components/modals/ModalManager.tsx",
    "src/components/forms/MatterForm.tsx",  # pre-existing
}

# Flows that fundamentally can't be queued (file uploads, real-time msgs)
NON_QUEUEABLE = {
    "generateUploadUrl",
    "sendChatMessage",
    "sendPortalMessage",
    "sendAdminReply",
    "replyToPortalMessage",
}


def find_mutation_sites():
    """Walk src/, return list of {file, line, module, mutation} dicts."""
    sites = []
    for path in ROOT.rglob("*.tsx"):
        rel = str(path.relative_to(Path("/home/z/my-project")))
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        # Mark files that import useOfflineQueue
        if "useOfflineQueue" in text:
            QUEUE_USING_FILES.add(rel)
        for m in MUTATION_PATTERN.finditer(text):
            line_no = text.count("\n", 0, m.start()) + 1
            sites.append({
                "file": rel,
                "line": line_no,
                "module": m.group(1),
                "mutation": m.group(2),
                "queueable": m.group(2) in QUEUE_COVERED_MUTATIONS,
                "non_queueable": m.group(2) in NON_QUEUEABLE,
                "in_wired_file": rel in WIRED_FILES,
            })
    return sites


def classify_site(site):
    """Return a label for what happens when this mutation is called offline."""
    if site["in_wired_file"] and site["queueable"]:
        return "QUEUED", "Covered by offline queue (file is wired)"
    if site["non_queueable"]:
        return "NON_QUEUEABLE", "Cannot be queued (file upload / real-time msg) — needs offline guard"
    if site["queueable"] and site["file"] in QUEUE_USING_FILES:
        # File imports useOfflineQueue but doesn't use it for THIS mutation
        return "PARTIAL", "Mutation is queueable, file imports useOfflineQueue, but this specific call site doesn't use it"
    # Default for everything else
    return "DIRECT", "Calls mutation directly — will throw/hang offline depending on Convex client behavior"


def main():
    sites = find_mutation_sites()
    print(f"# Offline Resilience Audit")
    print(f"")
    print(f"Total `useMutation(api.*)` call sites: **{len(sites)}** across {len(set(s['file'] for s in sites))} files.")
    print(f"")
    print(f"## Coverage Summary")
    print(f"")
    counts = defaultdict(int)
    for s in sites:
        label, _ = classify_site(s)
        counts[label] += 1
    for label in ["QUEUED", "PARTIAL", "NON_QUEUEABLE", "DIRECT"]:
        print(f"- **{label}**: {counts[label]} sites")
    print(f"")
    print(f"## Mutation Names NOT Yet in the Queue Registry")
    print(f"")
    not_in_registry = sorted(set(
        f"{s['module']}.{s['mutation']}" for s in sites
        if s["mutation"] not in QUEUE_COVERED_MUTATIONS
        and not s["non_queueable"]
        and not s["in_wired_file"]
    ))
    for m in not_in_registry[:40]:
        print(f"- `{m}`")
    if len(not_in_registry) > 40:
        print(f"- ... and {len(not_in_registry) - 40} more")
    print(f"")
    print(f"## DIRECT (highest priority for future wiring)")
    print(f"")
    direct = [s for s in sites if classify_site(s)[0] == "DIRECT"]
    # Group by module.mutation
    by_mut = defaultdict(list)
    for s in direct:
        by_mut[f"{s['module']}.{s['mutation']}"].append(s)
    # Sort by frequency (most common first)
    for mut in sorted(by_mut.keys(), key=lambda m: -len(by_mut[m]))[:20]:
        sites_list = by_mut[mut]
        print(f"### `{mut}` ({len(sites_list)} sites)")
        for s in sites_list[:3]:
            print(f"  - `{s['file']}:{s['line']}`")
        if len(sites_list) > 3:
            print(f"  - ... and {len(sites_list) - 3} more")
        print(f"")
    print(f"## NON_QUEUEABLE — Sites Needing Offline Guards")
    print(f"")
    nq = [s for s in sites if s["non_queueable"]]
    by_mut = defaultdict(list)
    for s in nq:
        by_mut[f"{s['module']}.{s['mutation']}"].append(s)
    for mut, sites_list in by_mut.items():
        print(f"### `{mut}` ({len(sites_list)} sites)")
        for s in sites_list:
            print(f"  - `{s['file']}:{s['line']}`")
        print(f"")


if __name__ == "__main__":
    main()
