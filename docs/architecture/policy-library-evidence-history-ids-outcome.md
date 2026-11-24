# Exact History IDs in policy-library evidence outcome

November 23, 2026. See the [design and source review](policy-library-evidence-history-ids-design.md).

The four read-only evidence collectors use the existing History creation
timestamp. That restores the real loader on the current PostgreSQL schema.
Creation time describes the History row. The separate correction timestamp
continues to describe the correction record.

Pending answers, final outcomes, routing outcomes, and manual corrections use
canonical decimal History IDs in their existing keys. Correction row IDs retain
their positive PostgreSQL `integer` range. Unusable identifiers and missing
correction links are filtered. Fresh projections can produce different hashes
where an earlier conversion changed a key. Existing snapshots retain their
original bytes and fingerprints.

## Verification

- The isolated PostgreSQL 18 loader returned `blocked_by_source_collection`
  on the original code. The patched loader audits all four sources and includes
  distinct entries for identical observations on adjacent large History IDs.
  The fixture also checks the BIGINT maximum, safe legacy keys, correction
  links, genre evidence, and identical fingerprints on repeat collection.
- The focused 143 tests cover the collector, loader, envelope, and fingerprint
  consumers. The invalid-ID regression demonstrates that the old coercion
  rounded the BIGINT maximum and accepted malformed values as different IDs.
- The ownership inventory found the same analysis and indirect-query findings
  for all four collectors. Only their reviewed source hashes changed.
- The full server run passed 64,577 tests across 1,958 suites with one existing
  skip. The coverage ratchet passed at 89.33% server and 89.58% client line
  coverage. Client coverage came from the previous tested revision after the
  source tree and report were verified unchanged.
- Lint, type checks, preflight, ESM, policy gates and Markdown checks passed.
  npm reported zero advisories across all three workspaces.

GitHub listed no open PRs at intake or before delivery.

## Next UUIDv7 readiness item

Audit the pending-question cleanup apply and replay services. Both still use
the safe-number History ID parser even though answer fingerprints can carry
larger exact IDs. Trace batch normalization, row locking, receipt binding, and
completed replay before considering a wider cleanup input contract. See the
[pending-answer fingerprint and replay outcome](pending-answer-fingerprint-replay-outcome.md).
