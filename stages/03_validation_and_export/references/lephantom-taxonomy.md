# lephantom-taxonomy.md — the 5-point citation audit (Stage 03 reference)

Implemented in `src/legal/citations/lePhantomCite.ts` (tests:
`tests/unit/lePhantomCite.test.ts`, `tests/unit/citationClassifier.test.ts`).

| # | Failure class | Meaning |
| --- | --- | --- |
| 1 | Non-existent citation | The reporter string points to no real case. |
| 2 | Case name mismatch | Volume/page exists — different case. |
| 3 | Incorrect pincite | The proposition sits on a different page than "at" claims. |
| 4 | Verbatim misquote | The quote has substituted or altered words. |
| 5 | Content misrepresentation | Case exists; the ratio does not support the proposition. |

Any failure ⇒ `HALLUCINATED` ⇒ the citation is omitted from the rendered
process (never rendered with a caveat).

## Terminal states

- `VERIFIED` — passed all five against a connected corpus.
- `UNVERIFIABLE` — no licensed backend connected; the surface says so.
  This is the standing state today (honesty contract) and flips to
  `VERIFIED` automatically when a `CorpusBackend` implementation is
  registered in `verificationHarness.ts`.
