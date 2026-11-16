# engine-map.md — the deterministic engines (Stage 01 reference)

| Concern | Engine | Seeded today | How to extend |
| --- | --- | --- | --- |
| Court routing | `src/legal/jurisdictionMatrix.ts` | FHC s.251(1) heads, NICN s.254C, State residual | Add a typed row + test; cite the constitutional head |
| Limitation | `src/legal/limitationEngine.ts` | Lagos + federal POPA | Add state → cause table rows with citation; unseeded states carry verify notes, never guesses |
| Tenancy notices | `src/utils/tenancyNoticePeriods.ts` | General framework + Lagos 2011 (corpus-linked) | Add encoded statutes to `ENCODED_TENANCY_STATUTES` only after corpus entry exists |
| Frontloading | `src/legal/frontloadingGate.ts` | High Court civil procedure bundle | Extend checklist per rules update; advisory severity |
| Signature/RPC | `src/legal/signatureCompliance.ts` | NBA seal & stamp, practitioner details | Regex + rules, advisory findings |
| Aggregated gate | `src/legal/complianceGate.ts` | combines the above | New gates register here |

**Verification discipline:** every row carries its citation. Pinpoint
section numbers are only asserted once verified against the corpus
(see `convex/legalCorpus.ts`); until then the row states the framework and
flags verification.

**One table, one truth:** if a countdown, a draft, and a public answer all
need the notice period, they all read `tenancyNoticePeriods.ts` — the R3.2
lesson (a divergent second table is how the site and the app disagree).
