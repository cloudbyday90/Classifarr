# Outlier-aware library recovery: outcome

Date: 2026-09-19. Implements the next item from the
[previous commit's outcome](neighborhood-backfill-outcome.md), following the
[separate design and research](outlier-aware-recovery-design.md).

## Root cause and change

Commit `8c71a9e1` safely prioritized missing supported groups, but two real libraries
could not establish recovery references because their selected fits discarded
tiny groups. Reconstructing memberships from surviving centroids could not account
for those omitted descriptions without inventing support.

The fit now optionally retains its selected group members and an explicit
unassigned set. A small ESM membership service checks exact source coverage,
exclusive library/media scope, duplicates, group counts, representative membership
and supported centroids before publication. Invalid membership uses existing
redacted diagnostics and bounded rebuild backoff. References own their arrays so
later mutation of a caller's profile cannot alter published recovery priorities.

Only background profiles opt in. The private contract advances to
`inventory_representative_profile_v4`, with a conservative 192-byte cache-weight
allowance per selected source hash. Default geometry, multi-start selection,
historical benchmark outputs, live scoring and routing behavior remain unchanged.

Unassigned descriptions are not labeled erroneous or misfiled. They still receive
ordinary backfill and may join supported groups in a future complete fit. They
cannot inflate support or receive priority as members of a group they did not join.

## Local Compose assessment

The rebuilt Compose container was healthy with its read-only root filesystem
preserved. An assessment streamed over standard input used database-enforced
read-only sessions, cached vectors and model identity inspection. It verified a
fresh matching source/configuration before publishing private in-memory references.

| Measurement | Result |
| --- | --- |
| Current libraries / distinct cached descriptions | 10 / 6,652 |
| Libraries eligible for targeted recovery, before → after | 8 → 10 |
| Formerly excluded libraries admitted with validated groups | 2 |
| Libraries exercised with synthetic missing-group masks | 5 movie + 5 TV |
| Supported-group descriptions masked in memory | 448 |
| Unassigned descriptions additionally masked | 2 |
| Descriptions prioritized | Exactly the 448 supported members |
| Unknown libraries after validation | 0 |
| Outstanding group priorities after restoration | 0 |
| Assessment database writes / embedding calls / generation calls | 0 / 0 / 0 |

No live descriptions were deleted, changed or reclassified. The two unassigned
descriptions remained outside group priority. This proves recovery coverage and
accounting for this snapshot, not classification accuracy or correct existing
library placement. The application's normal background workers remain enabled;
the zero-write/call counts describe the assessment itself.

## Verification

- Focused regression: 4 suites, 92 tests passed, including historical geometry
  digests, malformed/sparse partitions, source changes, cancellation and recovery.
- PostgreSQL integration: 2 suites, 13 tests passed. A real worker/pgvector test
  expired four supported members and two outliers across movie and TV libraries;
  priority contained only the four members and ordinary backfill restored all six.
  No media routing task was created. Existing durable retry/restart tests passed.
- Client: all 368 suites / 5,120 tests passed with coverage.
- Server: all 1,297 suites / 37,687 tests passed. Coverage: 90.17% statements/lines,
  82.67% branches and 92.27% functions. Client coverage: 85.61% statements,
  77.56% branches, 85.08% functions and 87.66% lines. The coverage ratchet passed.
- Preflight, server/client type checking, test/security/client lint, Markdown,
  ESM import/mock contracts and dependency checks passed.
- [PR #535](pr-535-local-node-types-validation.md) was applied locally, not merged.

The preceding commit's CI/CD application and database jobs and its CodeQL,
Gitleaks, Copyright, OSV and Trivy workflows succeeded. Those results do not
substitute for the new commit's hosted checks. Local lint and `git diff --check`
passed; private scripts/reports remain ignored under `.tmp/`.

## Recommendation and next component

Keep the selected-partition → validation → bounded recovery-reference → fair
backfill stack. Its benefit is automatic recovery for valid groups even when a
library contains outliers, without new inference or operator steps. Its cost is
bounded hash storage and source-component validation work. Forcing outliers into
the nearest retained group would be cheaper but would invent support; reject it.

Next, evaluate **library-evidence candidate selection for unseen and unusual
items** using the existing held-out and shadow paths. Include minority groups,
unassigned descriptions and concentrated missing-data cases across every movie/TV
library, with identity/description leakage excluded. Compare current candidate
selection against recovered group evidence, measure wrong-destination suggestions
and abstentions, and fix the largest demonstrated error class. Existing placement
is a comparison signal, not ground truth. Do not raise policy confidence or promote
shadow evidence to automatic routing merely because recovery coverage is now 10/10.

The first follow-up found and fixed an independent-start comparison defect, with
paired read-only evaluation documented in the
[candidate-stability outcome](independent-candidate-stability-outcome.md).
That result improves diagnostic reliability, not semantic routing authority.

## Remaining limits and rollback

References remain process-local with a 30-minute TTL. Restarts, expired references,
changed source membership or embedding configuration fall back to ordinary backfill.
Partial/unconverged fits cannot establish a new complete reference. Validating a
group's geometry does not establish its semantic destination or user intent.

Rollback is a new commit reverting membership capture/validation and restoring
the prior private profile contract and conservative recovery behavior. Existing
vector checkpoints and retry journals remain usable. The dependency update can
be reverted independently. No database migration, product-version bump, release
or tag is included.
