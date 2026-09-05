#!/usr/bin/env python3
"""
audit-identity.py — CI gate (plan Round 16): FAIL the build if any public
Convex function trusts caller-supplied identity.

History this guards against:
  - R16/Task-19 swept the `userEmail` convention (174 functions) but a SECOND
    naming convention escaped: `tokenIdentifier` + the email-matched
    `requireFounder` guard — anyone who knew the founder's email could
    suspend users, block IPs, flip feature flags, approve subscriptions, and
    (via unguarded createFounderAccount) mint a whole new Founder.
  - getUserApiKey / saveUserApiKey returned/overwrote a user's Gemini API key
    given only their email.

VIOLATION classes:
  V1  Public function (query/mutation/action) whose args validator contains
      an identity field (userEmail / email / tokenIdentifier / userId /
      founderEmail) but NO sessionToken — the caller-supplied identity is
      the only identity.
  V2  A guard invocation (requireFirmUser / requireAdmin / requireFounder /
      requireSentryAuth / requireStaffCaller / requirePortalCaller /
      requireFounderCaller / resolveCaller) that does NOT receive
      sessionToken — email-only guard wiring.
  V3  The inline "email-matched founder" pattern:
      users.find(u => u.role === 'Founder' && u.email === args.X)
      — the exact spoofable pattern that escaped the Task-19 sweep.

Exit 1 on any violation (after printing them). Allowlist: pre-auth flows
(login, signup, verification, public forms) that necessarily accept emails
and grant no privilege.

Usage: python3 scripts/audit-identity.py   (from repo root)
"""
import re
import sys
import glob
import os

# ── config ──────────────────────────────────────────────────────────────────
IDENTITY_FIELDS = {"userEmail", "email", "tokenIdentifier", "userId", "founderEmail"}
GUARDS = [
    "requireFirmUser",
    "requireAdmin",
    "requireFounder",
    "requireSentryAuth",
    "requireStaffCaller",
    "requirePortalCaller",
    "requireFounderCaller",
    "resolveCaller",
    # NOTE: requireEstateCommunityAccess is deliberately NOT here — it is a
    # plan/entitlement gate ("does this firm have the feature"), not an
    # identity gate. Identity is enforced by the requireAdmin/requireFirmUser
    # call that precedes it in every handler.
]
DEF_RE = re.compile(
    r"export const (\w+)\s*=\s*(query|mutation|action)\(\{"
)
IDENTITY_FIELD_RE = re.compile(r"^\s*(\w+)\s*:\s*v\.")
INLINE_FOUNDER_RE = re.compile(
    r"role\s*===\s*'Founder'.*?email.*?(===|\.toLowerCase\(\)\s*===).*?"
    r"|email.*?\.toLowerCase\(\).*?role\s*===\s*'Founder'"
)
# pre-auth / no-privilege endpoints that necessarily take an email
ALLOWLIST = {
    # login gateway + signup + email verification + password reset flows
    ("myFunctions", "verifyLogin"),
    ("myFunctions", "getUser"),  # NDPA-projected lookup; login flow needs it
    ("myFunctions", "verifyCode"),
    ("myFunctions", "startSignup"),
    ("myFunctions", "startRegistration"),
    ("myFunctions", "checkEmailAvailability"),
    ("myFunctions", "requestPasswordReset"),
    ("myFunctions", "resendVerificationCode"),
    ("myFunctions", "confirmEmailChange"),
    # public intake forms (no privilege, no data read)
    ("salesInquiries", "submitSalesInquiry"),
    ("feedback", "submitFeedback"),
    ("feedback", "submitDataRestoreRequest"),
    ("portalSecurity", "checkEmailForPortalConflict"),
    ("founderMetrics", "createFounderAccount"),  # bootstrap-only (countFounders)
    # marketing site contact capture
    ("feedback", "submitContactSales"),
}


def match_brace(text, open_idx):
    depth, k = 1, open_idx + 1
    while k < len(text) and depth > 0:
        if text[k] == "{":
            depth += 1
        elif text[k] == "}":
            depth -= 1
        k += 1
    return k


def audit():
    violations = []
    root = os.path.join(os.path.dirname(__file__), "..", "convex")
    root = os.path.normpath(root)
    files = sorted(glob.glob(os.path.join(root, "*.ts")))

    for path in files:
        module = os.path.basename(path)[:-3]
        with open(path) as f:
            src = f.read()

        # ── V1: identity validator without sessionToken ──────────────────
        for m in DEF_RE.finditer(src):
            name, kind = m.group(1), m.group(2)
            if (module, name) in ALLOWLIST:
                continue
            nxt = DEF_RE.search(src, m.end())
            seg = src[m.start(): (nxt.start() if nxt else len(src))]
            ai = seg.find("args: {")
            if ai == -1:
                continue
            ob = seg.find("{", ai)
            cb = match_brace(seg, ob)
            block = seg[ai:cb]
            fields = [
                IDENTITY_FIELD_RE.match(l).group(1)
                for l in block.splitlines()
                if IDENTITY_FIELD_RE.match(l)
            ]
            ident = [f for f in fields if f in IDENTITY_FIELDS]
            if ident and "sessionToken" not in block:
                violations.append(
                    f"V1 {module}.ts :: {name} ({kind}) — validator has "
                    f"identity field(s) {ident} but no sessionToken"
                )

        # ── V2: guard invocations without sessionToken ─────────────────────
        # callerAuth.ts IS the guard module — its internal `resolveCaller(ctx, opts)`
        # delegations pass a typed opts object that includes sessionToken.
        if module != "callerAuth":
            for g in GUARDS:
                for gm in re.finditer(rf"{g}\(", src):
                    start = gm.end()
                    # skip matches inside comments (// … or /* … */)
                    line_start = src.rfind("\n", 0, gm.start()) + 1
                    if "//" in src[line_start: gm.start()]:
                        continue
                    # skip DEFINITIONS: preceded by 'function'
                    before = src[max(0, gm.start() - 30): gm.start()]
                    if re.search(r"\bfunction\s*$", before):
                        continue
                    # capture to the MATCHING close paren
                    depth, j, call = 1, start, ""
                    while j < len(src) and depth > 0:
                        if src[j] == "(":
                            depth += 1
                        elif src[j] == ")":
                            depth -= 1
                            if depth == 0:
                                break
                        call += src[j]
                        j += 1
                    if "sessionToken" in call:
                        continue
                    # call-site shapes: first arg ctx (positional) or opts object
                    stripped = call.lstrip()
                    if stripped.startswith("ctx") or stripped.startswith("context"):
                        depth, commas, j = 0, 0, 0
                        while j < len(call):
                            c = call[j]
                            if c in "([":
                                depth += 1
                            elif c in ")]":
                                depth -= 1
                            elif c == "," and depth == 0:
                                commas += 1
                            j += 1
                        if commas < 2:
                            fn = enclosing_function(src, gm.start(), module)
                            if fn and (module, fn) in ALLOWLIST:
                                continue
                            violations.append(
                                f"V2 {module}.ts :: {fn or '?'} — {g}(ctx, …) called "
                                f"without sessionToken: {g}({stripped[:60]})"
                            )
                    elif stripped.startswith("{"):
                        if "sessionToken" not in call.split("}")[0]:
                            fn = enclosing_function(src, gm.start(), module)
                            if fn and (module, fn) in ALLOWLIST:
                                continue
                            violations.append(
                                f"V2 {module}.ts :: {fn or '?'} — {g}({{…}}) opts "
                                f"object has no sessionToken"
                            )

        # ── V3: inline email-matched founder gate ─────────────────────────
        for vm in INLINE_FOUNDER_RE.finditer(src):
            fn = enclosing_function(src, vm.start(), module)
            ctx = src[max(0, vm.start() - 100): vm.start() + 200]
            if "args." in ctx or "tokenIdentifier" in ctx or "founderEmail" in ctx:
                violations.append(
                    f"V3 {module}.ts :: {fn or '?'} — inline email-matched "
                    f"founder gate (spoofable pattern)"
                )

    return violations


def enclosing_function(src, pos, module):
    """Best-effort: the last export const <name> = <kind>({ before pos."""
    last = None
    for m in DEF_RE.finditer(src[:pos]):
        last = m.group(1)
    return last


def main():
    violations = audit()
    if violations:
        print(f"❌ IDENTITY AUDIT FAILED — {len(violations)} violation(s):\n")
        for v in violations:
            print(f"  - {v}")
        print(
            "\nPublic Convex functions must resolve identity from the verified "
            "bearer session (sessionToken), never from caller-supplied "
            "email/userId. Fix the function, or — if it is a genuine pre-auth "
            "flow — add it to the ALLOWLIST in scripts/audit-identity.py with "
            "a justification comment."
        )
        sys.exit(1)
    print("✅ IDENTITY AUDIT PASSED — no public function trusts caller-supplied identity.")


if __name__ == "__main__":
    main()
