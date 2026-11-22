# Exact History IDs for manual routing checks outcome

November 22, 2026 Eastern. Implementation of the approved
[design and research](manual-routing-check-bigint-design.md).

Manual and scheduled routing checks use exact History IDs through the signed
BIGINT maximum. All three admin routes validate a full decimal ID before
selecting a row. The coordinator and checker normalize safe numbers and their
canonical strings to the same key. Adjacent large IDs stay distinct. The
existing History controls accept the database's numeric or string ID and send
the exact digits through their existing API paths. Partial paths and unsafe
client numbers fail before selecting a record.

The migration widens the background check state key while keeping its
cascading History foreign key, due index, saved attempt binding and cooldown
state. Scheduled work uses the same opt-in and attempt budget. The provider
read still uses the saved TMDB or TVDB ID and the same destination checks.
Authorization, rate limits, provider cooldowns, response shapes and accessible
status feedback keep their existing behavior.

The direct type conversion takes a table lock and rewrites the state table.
Local fixtures establish the bound, rollback and schema behavior. Deployed
rewrite time depends on actual table size and contention. If an older build
is restored, its old parsing limits still apply even with the widened table.

## Verification

- All 30 focused HTTP/PostgreSQL tests passed with coverage. They exercise
  adjacent IDs above JavaScript's safe range and the BIGINT maximum, exact
  targeting, unchanged provider identities, invalid-input refusal, admin
  authorization, saved eligibility, scheduling and cascading deletion.
- The populated PostgreSQL upgrade preserves existing rows and due index.
  The packaged PostgreSQL 18.7 schema comparison and fresh snapshot load
  passed. The ownership review retains the existing classifications.
- PostgreSQL 17.11 returned `55P03` under a conflicting lock and preserved
  the old integer row. After lock release, the upgrade preserved its budget
  and enabled state, accepted the BIGINT maximum, and retained the cascade.
- All 86 focused server and 46 focused client tests passed. The existing
  Chromium step passed all 20 cases with the new History test. Both History
  feedback browser cases passed in the separate local run. The client build,
  lint, type checks, preflight, and affected policy and ESM gates passed.
  The full client coverage run passed 7,597 tests with 89.62% line coverage.
- Astra reviewed admission, authorization, schema compatibility and the
  test for two concurrent distinct large IDs. GitHub had no eligible open
  PR or Dependabot branch at intake.

## Next recommended item

Audit the shared routing-metadata writer. It still converts the History ID
to a JavaScript number before it can record an already-issued provider
operation's outcome. Trace its manual and automatic callers together so
exact persistence preserves each caller's attempt guards and replay rules.
The two reclassification references are the next schema candidates after
that audit.
