# Branch protection on main — what is enforced, and the path to the full gate

> Security review 2026-11-18 finding: "main isn't actually gated — no required
> status checks, no required pull request." This documents what is enforced
> today, what was TESTED (live, on a throwaway branch), and the one
> architectural change needed before the full gate can go active.

## What is enforced right now (ruleset `main-history-integrity`, ACTIVE)

- `non_fast_forward` — nobody force-pushes over main's history (except the
  owner, who is on the bypass list for disaster recovery).
- `deletion` — main cannot be deleted.
- All changes land through pull requests in practice (PRs #2–#14 all did),
  and every PR runs the "Typecheck + unit tests" gate + CodeQL + the e2e
  smoke before merge.

## What blocks the full gate (tested live, 2026-11-18)

We probed ruleset semantics on a throwaway branch before touching main:

| Configuration tested | Direct push result |
|---|---|
| `pull_request` rule (require PR, 0 approvals) | **REJECTED** — "push declined due to repository rule violations" |
| `required_status_checks` rule (Tests check) | **REJECTED** — same |
| Same rules + owner on the bypass list | **ALLOWED** for the owner |
| Adding `github-actions` (Integration 15368) as a bypass actor | **API rejects it** — "Actor GitHub Actions integration must be part of the ruleset source or owner organization" (personal-repo limitation) |

The blocker: `build-apk.yml` pushes a `chore: bump patch version` commit
**directly to main** as `github-actions[bot]` with `GITHUB_TOKEN`, mid-run.
Under a `required_status_checks` or `pull_request` rule, that push is declined,
the workflow aborts (by design — the race-safe push step fails loudly), and
every APK release breaks. On personal accounts the Actions bot cannot be added
to a ruleset bypass list, so the only clean fix is to change the bump flow.

## The blueprint (activate after the bump flow moves to PR-based pushes)

```json
POST /repos/R2deetwo/PracticeProVEGA/rulesets
{
  "name": "main-full-gate",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [ { "actor_id": 80827470, "actor_type": "User" } ],
  "rules": [
    { "type": "required_status_checks",
      "parameters": { "required_status_checks": [ { "context": "Typecheck + unit tests" } ],
                      "strict_required_status_checks_policy": false } },
    { "type": "pull_request",
      "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
                      "require_code_owner_review": false, "require_last_push_approval": false,
                      "required_review_thread_resolution": false } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
```

(Evaluate-mode rulesets — which would report violations without blocking —
require GitHub Enterprise, so the blueprint lives here instead.)

## The prerequisite change, in one paragraph

Move the version bump from a direct push to a bot-opened PR: the workflow
creates `bump/<run_number>`, opens a PR titled WITHOUT `[skip ci]` (the PR must
run its checks so the required check reports), puts `[skip ci]` only in the
merge-commit message so the merged bump does not trigger another build, and
lets auto-merge land it once "Typecheck + unit tests" passes. Concurrent runs
need the existing rebase-retry logic carried over to the PR flow. After one
supervised green release run under the new flow, activate the blueprint above
(one API call) — at that point every change to main passes the test gate by
construction, and the owner keeps an emergency bypass.
