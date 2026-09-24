# Durable correction outcome capture: outcome

Status: implemented locally, Unreleased, September 24, 2026. See the separate
[design, research, and tradeoffs](correction-outcome-capture-design.md).

## Delivered

API corrections, Discord corrections, and reclassification now use a shared ESM
writer. Each correction event and eligible evaluation snapshot are inserted in
one SQL statement. Normal corrections automatically capture evidence; no new
approval, acknowledgement, API, dashboard, or AI request is required.

Snapshots contain only an event ID, typed identity key, selected library ID, and
timestamp. Typed TMDB identities work for movies and TV. Source-only capture
requires a source-library history observation with an exact inventory item and
library pointer, matching type/title/year, and no TMDB identity. It stores the
existing scoped source hash, not the raw source ID or media metadata. Missing or
inconsistent identity saves the ordinary correction but supplies no evaluation
label. A changed source key or newly attached TMDB ID does not automatically
inherit a source-only label; identity reconciliation is not inferred here.
When that source alias is still known after TMDB attachment, its evidence group
is nevertheless held out from evaluation training to avoid self-evidence leakage.

Captured outcomes survive correction-event retry cleanup and history deletion.
Deleting their destination library removes them. Evaluation excludes inactive or
wrong-type destinations, future/expired snapshots, and conflicting labels. The
paired evaluator accepts source-only labels and excludes their whole known
identity/description group from training. Quality labels remain explicit choices,
not proof of successful physical routing or independent blind judgments.

Startup and scheduled queue maintenance delete at most 1,000 expired snapshots
per run, under the existing maintenance serialization. Failed cleanup is retried
on a later tick; query-time expiry still applies. Snapshots and legacy correction
reads have a 30-day window. Existing feedback retention is unchanged. A migration
and canonical PostgreSQL 18.6 fresh-install snapshot are included; no historical
status-based labels are fabricated and no migrations were applied to user data.

Discord persistence is now transactional, locks duplicate actions, and validates
destination activity/type. Reclassification persistence is transactional, rejects
identity/destination drift, and no longer writes a nonexistent history column.
External moves remain outside that database transaction.

## Evidence and verification

The read-only local aggregate check found 41 corrected/reclassified history rows,
but zero correction events, feedback rows, eligible feedback labels, or feedback
receipts. These counts explain the empty evaluation input; they do not prove
which historical operation removed or omitted events. No individual title,
description, actor, credential, or library name was exported.

Completed checks:

- Full backend unit run: 1,414 suites / 41,450 tests passed. Final focused run
  after adding cleanup/alias coverage: six suites / 95 tests passed.
- Full isolated PostgreSQL integration run: 153 suites / 1,741 tests passed;
  one pre-existing suite/test remains skipped. Final focused capture and
  reclassification persistence run: two suites / 14 tests passed.
- Real-schema tests cover API capture, source-only consistency, source drift,
  snapshot-write failure, transactional rollback, retry/history deletion,
  same-destination and missing-actor exclusions, library deletion, expiry without
  legacy resurrection, and bounded cleanup. External moves are mocked in the
  reclassification persistence tests; no real files were moved.
- Server/client typechecks, server lint, unused dependency/export checks, ESM
  static-import/mock-shape checks, Markdown/RAG API documentation lint, copyright,
  migration integrity, and whitespace checks passed. The existing non-literal
  filesystem-path lint warning in `captureOperatorCorrectionFrozenPolicy.mjs`
  remains; no new lint warnings were introduced.
- Built an isolated test image (including the client production build), generated
  the schema using the application's PostgreSQL 18.6 runtime, and passed the
  fresh-container schema comparison. Temporary test containers/data were removed.
  The running application container, persistent data, and routing settings were
  not changed. Client unit tests were not rerun: no client/API contracts changed.

Synthetic tests verify the capture contract; they do not establish real-library
accuracy. The live instance cannot collect these new snapshots until a planned
release deploys the migration and code together.

## PR and release boundary

The repository-scoped GitHub MCP open-PR search returned zero open PRs on
September 24. No random open PR could be selected; none was merged or fabricated.
No release, tag, version bump, or deployment was created.

## Next high-value component

Implement **durable, resumable reclassification move recovery**. Inspection found
that `reclassificationQueries.rollback()` currently only logs an attempt. A file
or *arr move can therefore succeed while a later database operation fails; this
patch must not claim physical compensation.

Use a bounded operation ledger and idempotent state transitions to record intended
destination, external step completion, database commit, and reconciliation state.
On restart, verify actual paths and *arr state before retrying or compensating;
never blindly repeat a move. Keep this separate from preferred-destination
evaluation labels. Test crashes between every boundary and duplicate requests.

Recommendation stack: retain explicit correction evidence automatically → make
external move recovery durable → deploy through the planned release process →
rerun the paired 300-case evaluation as genuine labels accumulate → use measured
results to improve ranking. Do not add another user-review gate or infer truth
from current placement.
