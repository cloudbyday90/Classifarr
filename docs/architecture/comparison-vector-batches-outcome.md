# Bounded comparison vector decoding outcome

Date: 2026-10-06. [Design and official sources](comparison-vector-batches-design.md).

## Implementation

A small ESM vector reader decodes batches before requesting more encoded rows.
The representative/comparison repository uses it inside its existing repeatable-read,
read-only transaction. Both refreshers now pass their existing abort signal into
initial and fresh verification reads. Other consumers retain their existing
capture/decode behavior. No memory safeguard, retry budget, schema, dependency,
vector value, fingerprint algorithm or publication criterion changed.

The batch is at most 256 rows and 262144 components. The final private map still
holds the admitted snapshot. This reduces the lifetime of encoded rows, not the
size of every downstream allocation; runtime improvement requires measurement.

## Verification so far

- Focused service tests: 12 suites, 187 tests passed. Covers exact values and
  fingerprints, row/component bounds, complete-input validation, corrupt and
  out-of-scope rows, cancellation before and during SQL, and cooperative shutdown.
- Isolated PostgreSQL tests: three suites, 25 tests passed. Concurrent deletion
  and replacement in a later batch remain invisible to the current snapshot and
  visible to the next read. Aborted reads roll back without partial publication.
- Server lint and typecheck passed. Full-suite and image measurements follow.
- Static ownership review detected the changed repository source. Reviewed its
  complete query adapter and bounded reader: same read-only transaction, no new
  protected inventory DML, and unchanged analysis digest. Updated only that
  source digest and its existing review explanation; unresolved debt remains.
- [PR #555 trial](node-types-pr555-outcome.md) failed the unchanged Node-major gate
  and was reverted without installation or merge. No dependency edits remain.

No release or Unraid change. Record image identities, no-cache rebuild, schema
checks, measured results and final recommendation below after they complete.
