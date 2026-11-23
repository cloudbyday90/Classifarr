# Exact pending-answer fingerprints and receipt replay outcome

November 22, 2026 Eastern. See the
[design](pending-answer-fingerprint-replay-design.md) for sources and tradeoffs.

## Implementation

The v1 answer builder preserves exact History identity through the PostgreSQL
BIGINT range. Safe IDs continue to use the original numeric serialization,
and larger IDs use canonical decimal strings. New receipts carry the ID of
the History row used for resolution.

Completed route replay verifies a present History ID alongside its existing
version, fingerprint, action and destination checks. An unbound legacy
receipt can still replay for a safe row under the existing checks. Cleanup
validates the whole batch before opening its transaction and checks the
receipt against the locked row and current question before resolving.
Pending answers and cleanup writes admit safe positive History IDs only.

## Verification

- The baseline builder produced identical fingerprints for adjacent large
  rows with the same contract fields. The focused run passed all 255 tests
  across 23 suites. It pinned pre-change v1 bytes for safe normalized and
  native contracts and verified exact large IDs and invalid ID refusal.
- All 12 scoped PostgreSQL tests passed. The HTTP fixture verified exact
  bound and legacy replay, rejection of a mismatched row binding, one route
  call after completion, and refusal of a mixed cleanup selection before
  any History row changed. The cleanup replay unit fixture verified that a
  mismatched receipt never reaches destination lookup or resolution SQL.
- Fresh backend coverage passed 64,300 tests across 1,957 suites with one
  test skipped. The coverage ratchet passed with the verified client tree,
  lockfile and coverage report from the preceding run. Lint, type checks,
  preflight, ESM checks, policy gates and Markdown lint passed.
- Astra reviewed the fingerprint and replay paths. GitHub's open PR list
  was empty at intake and verification.

## Next recommended item

Apply the receipt identity check to the shared exact-item learning execution
state, which supplies exact-item memory and destination evidence. Then trace
the remaining transport boundaries before widening pending-answer admission.
