# DRAFTPRO/ALOA STABILITY, ROUTING, AND CITATION CLASSIFIER FIX

## SCOPE
Four defects. Fix in order. Do not proceed to the next until the current one has a passing acceptance check. Do not refactor unrelated code. Do not touch the existing streaming/checkpoint-based HTML validation pipeline except where explicitly instructed.

---

## 1. PDF/DOCX SAVE PIPELINE — "Failed to fetch" + 3min hang

### Diagnose first, fix second
Do not guess. Before writing any fix:
1. Log and report the actual failure point: is the request never reaching the endpoint (network/CORS), reaching it and timing out (server-side processing), or reaching it and erroring (payload rejection, size limit, malformed HTML)?
2. Report payload size of a representative failing document.
3. Report the configured timeout on both the client fetch call and the server/function handler.
4. Report whether the failure is reproducible on a small (1-page) document or only on larger ones.

### Fix requirements (apply based on diagnosis)
- If payload-size-driven: stream or chunk the HTML-to-PDF/DOCX conversion rather than sending the full canvas HTML in one request.
- If timeout-driven: either raise the timeout to match realistic processing time AND add a queued/async job pattern (submit → poll/status → ready), or reduce processing time to fit the existing timeout. Prefer async job pattern for anything that can exceed 5s.
- Client UX: button shows a loading/spinner state labeled "Saving…" for the duration; on failure, the toast must state the actual failure reason (timeout vs. server error vs. network), not a generic "Failed to fetch."
- On success: file is persisted to storage, immediately previewable from the Documents hub, and reopenable in DraftPro from that preview with one click — no re-fetch-from-scratch required.

### Acceptance criteria
- [ ] Save-to-PDF completes in under 10s for a 5-page document.
- [ ] Save-to-DOCX completes in under 10s for a 5-page document.
- [ ] Failure toast (if triggered) states specific cause, not generic fetch failure.
- [ ] Saved file previews correctly in Documents hub.
- [ ] Saved file reopens in DraftPro with content intact.

---

## 2. `/documents` REFRESH CRASH — empty-selection state

### Root cause
Detail preview panel throws when `id` param is empty/invalid on direct load or refresh — no null-state guard.

### Fix requirements
- Wrap the Document Detail preview panel in an Error Boundary that catches render failures and falls back to a safe default view rather than surfacing the raw React error.
- Independently of the Error Boundary, add an explicit guard: if no document is selected or the URL `id` is empty/invalid, render this empty state instead of attempting to render detail content:
  > "Select a document from the list to preview its contents or open it in DraftPro."
- This must hold on: direct navigation to `/documents` with no id, refresh with no id, and refresh with a stale/deleted id.

### Acceptance criteria
- [ ] Refreshing `/documents` with no id selected shows the empty state, not an error.
- [ ] Refreshing with a deleted/invalid id shows the empty state, not an error.
- [ ] No console error thrown in either case.

---

## 3. DRAFTPRO NEW-TAB ROUTING — regression

This was previously fixed and has regressed. Do not re-apply the same partial fix — audit for the actual regression source.

### Fix requirements
1. Search the full codebase for every navigation path that can lead to `/editor` (DraftPro) — sidebar links, buttons, programmatic `navigate()`/`history.push()` calls, menu items, keyboard shortcuts. List every instance found before editing anything.
2. For each instance, confirm it uses `window.open('/editor?draftKey=...', '_blank', 'noopener')` or a router `<Link to="..." target="_blank" rel="noopener">` — not a same-tab `navigate()` call.
3. Explicitly check for: a wrapping `onClick` handler that calls `preventDefault()` and then does a same-tab `navigate()` after the `target="_blank"` was already set (this is the most common cause of exactly this kind of regression — the anchor's `target` attribute gets overridden by JS-level navigation logic that runs after).
4. Add a lint rule or code comment marker (`// DRAFTPRO-NEW-TAB — do not convert to same-tab navigation`) at each confirmed correct instance so this doesn't silently regress again.

### Acceptance criteria
- [ ] List of every DraftPro entry point found, with confirmation each opens in a new tab.
- [ ] Closing the ALOA/Aria tab after opening DraftPro does not affect the DraftPro tab's draft state.
- [ ] Regression marker/comment added at each fix site.

---

## 4. CITATION CLASSIFIER — general taxonomy, not binary

### Problem with current implementation
Only distinguishes Statute vs. Case Law, and applies Case Law completeness rules (volume/reporter/court) to non-case-law citations, incorrectly flagging valid statute citations (e.g., "Companies and Allied Matters Act (CAMA) 2020") as incomplete.

### Required taxonomy
Classify every citation into one of these classes before running any completeness check. Do not default unclassified citations to Case Law rules.

| Class | Trigger pattern | Completeness requires |
|---|---|---|
| Statute / Act / Regulation | Contains "Act", "Regulations", "Code", known abbreviations (CAMA, NDPA), or "Constitution" | Title + Year. Section number if a specific provision is referenced in the text. NO reporter/volume/court required. |
| Case Law | Contains " v " or " v. " between two party-name-like tokens | Party names, Year, Volume/Reporter (e.g. NWLR, LPELR), Court identifier |
| Constitutional Provision | "Constitution" + section/article reference | Instrument name, Year, Section/Article number |
| Contract / Document Clause | Reference to an uploaded or referenced agreement, clause, or exhibit | Document identifier, clause/section number |
| Direct Quote / Statement | Quoted text attributed to a person, source, or document not otherwise classified above | Source identity, and page/paragraph/timestamp if available |
| Secondary Source | Textbook, journal article, commentary | Author, Title, Year, page if pinpointed |

If a citation doesn't clearly match any row, classify as "Unclassified" and do not flag it as incomplete — flag it as "needs manual review" instead. Never silently apply Case Law rules as a default.

### Pinpoint extraction
For every citation, extract and display the specific section/clause/paragraph actually cited in the document text (e.g., "Section 21, CAMA 2020") in the citation side panel — not just the instrument name. If the drafted text references a provision without a specific section number, flag that citation as "needs pinpoint" rather than "incomplete."

### Footnote rendering
- Replace the current bottom-of-document markdown source table entirely.
- Render numbered superscript markers (¹) inline at point of citation in the document body.
- Render corresponding footnotes at the bottom of the canvas page margin, not as a table — standard footnote block format.
- Do not default to OSCOLA or Bluebook styling — this platform targets the Nigerian market. Use a Nigerian legal citation convention as the default footnote format, and make the citation style configurable per document if multiple conventions need support later. Flag this as a decision point rather than silently picking one — confirm the default convention before implementing if not already specified elsewhere in the app.

### Acceptance criteria
- [ ] "Companies and Allied Matters Act (CAMA) 2020" citation is classified as Statute and marked complete without a reporter/volume warning.
- [ ] A case law citation missing its reporter is correctly flagged incomplete.
- [ ] Side panel shows the specific section cited (e.g. "Section 21") for statute citations where the document text specifies one.
- [ ] Footnotes render as inline superscript + bottom-margin footnote block, not a bottom table.
- [ ] Footnote citation style is confirmed (Nigerian convention default) rather than defaulted to OSCOLA/Bluebook without sign-off.

---

## DELIVERABLE
Provide the refactored React/TypeScript code for all four fixes, plus a written confirmation against each acceptance checklist above before considering this complete. Flag anything deferred, with reason.
