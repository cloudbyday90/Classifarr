# Exact pending-answer destination IDs outcome

November 24, 2026. The [design](pending-answer-destination-id-design.md)
records the source review, options and agreed compatibility boundary.

The answer command now admits positive INTEGER destinations from 1 through
2,147,483,647 as numbers or canonical decimal strings. The route returns
its existing `400` for invalid values before any library lookup. The shared
resolver checks the same shape before starting a transaction. The browser
preserves a selection until the payload builder validates it, and Confirm
All uses exact recommendation IDs. Compact Discord answers already use the
same range.

Cleanup uses an explicit saved-answer decoder with the previous decoding
rules. A saved destination can still be recovered after its row binding,
fingerprint, freshness and library checks pass. Completed replays keep their
existing comparison. New receipts still record numeric destinations. API
callers sending aliases such as padded strings must use the supported form.

## Verification

- All 168 focused server and 91 focused client tests passed. They covered
  rejection before lookup or transaction, canonical strings, numeric
  payloads, and client single and bulk answer construction.
- All 15 PostgreSQL tests passed across three suites. The web path resolved
  the INTEGER maximum from a canonical string and replayed the saved result
  with a numeric command and one routing call. A padded historical receipt
  replayed through both completed resolution and cleanup. History ID
  binding and the compact Discord flow passed their existing checks.
- All 7,730 client tests passed across 491 files, and all 11 Chromium
  pending-review tests passed. They exercised keyboard choice and Confirm All.
  The production build, lint, type checks, preflight, ESM and policy gates
  passed. All three workspace dependency audits returned zero findings.
- The full server run passed 64,558 tests across 1,958 suites with one
  existing skip. The coverage ratchet passed with 89.33% server and 89.58%
  client line coverage. The local Classifarr container kept its identity,
  start time and health.

GitHub listed no open PRs at intake or before delivery.

## Next recommended item

Audit persisted policy and library candidate IDs before loading pending-list
freshness. Astra traced both arrays to PostgreSQL `integer[]` parameters.
An out-of-range stored ID can fail the lookup and the outer catch can then
return an empty list. Verify this in isolated PostgreSQL with a valid neighbor,
and keep the affected question retryable while preserving valid fingerprints.
