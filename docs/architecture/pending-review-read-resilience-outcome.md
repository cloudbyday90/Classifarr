# Pending review read resilience outcome

November 24, 2026. The [design](pending-review-read-resilience-design.md)
records the source review, options, and agreed safeguards.

Native review requires both saved destination IDs to identify the same
positive PostgreSQL INTEGER. Valid numbers and canonical decimal strings
retain the same answer fingerprint. A malformed row stays visible with
Retry Classification and receives the existing stale `409` if submitted.
Completed, row-bound receipts retain their replay behavior.

One failed context lookup leaves its rows visible with a refresh instruction.
Identical contexts share the same result within a request. The application
logs the failure without recording an error in PostgreSQL from this path.
Healthy rows keep their answers. A primary query failure returns `503`,
with the shared timeout response for a statement timeout. Command Center
distinguishes unavailable and confirmed empty reads, and a read refresh
uses the existing GET. Bulk actions leave unverified items out of their writes.

## Local verification

- The 18 isolated PostgreSQL cases passed. They covered malformed and
  conflicting destination metadata beside a valid row, canonical encoding
  stability, locked refusals, existing completed replay, a confirmed empty
  read, and injected primary and per-context failures. Both rows sharing a
  failed lookup used the same unavailable result. The next read recovered.
- All 421 focused backend tests passed. The 12 Chromium cases exercised
  loading, the primary outage, a blocked row, and a confirmed empty list.
  The new browser case waited for the existing transport retries to finish
  and verified keyboard refresh without a classification write.
- The full client run passed 7,739 tests across 491 files. The production
  build, lint, type checks, preflight, ESM, and policy gates passed. All three
  workspace dependency audits returned zero findings.
- The full backend run passed 64,593 tests across 1,958 suites with one
  existing skip. The coverage ratchet passed at 89.33% backend and 89.58%
  client line coverage. The local Classifarr container retained its identity,
  start time, and health.

GitHub listed no open PRs at intake or during local verification.

## Next recommended item

Validate the selected library before building a native persistence envelope.
Astra found that the writer still coerces its input before storing both
copies. Verify the actual producer inputs and reuse the exact parser at that
boundary, so a coercible alias cannot become two apparently canonical IDs.
