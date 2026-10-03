# Manual Queue Routing Results

Reviewed: 2026-10-03. No release, version bump or deployment change.

## Outcome

Manual queue classification now commits the selected library and an unconfirmed
routing marker before contacting Radarr/Sonarr. The provider call no longer holds
a PostgreSQL transaction, row lock or checked-out transaction connection open.
The final routing outcome is saved only if its classification, library, attempt
token and original pending state still agree.

Two small ESM services separate local record preparation from safe routing
outcome normalization/persistence. `QueueAdminService` only coordinates those
steps and the existing verified provider adapter. The source queue payload is
unchanged. Previous outcome links are not copied into the new manual observation.

The endpoint still returns HTTP 200 when the selection was saved. Its new
`routing.routed` and `routing.recorded` fields explicitly distinguish confirmed
routing from saved classification and from an outcome-write failure. Unknown
provider results and raw exceptions never become success or expose credentials.
History says “Routing unconfirmed” for interrupted work. The client API disables
automatic retries for this write; no current Vue component calls that endpoint.

## Failure behavior

| Failure or competing action | Result |
| --- | --- |
| Selection transaction fails or commit is uncertain | No provider call |
| Another request handles the same completed task | Existing invalid-state conflict; no second provider call |
| Provider rejects, throws or returns an invalid result | Selection remains saved; normalized failure recorded |
| Final persistence fails | Original unconfirmed marker remains; no queue reset or provider replay |
| Another action changes the decision/token/state | Late outcome is refused; newer history is preserved |
| Process stops between commit and outcome recording | Unconfirmed history requires review; no automatic recovery claimed |

This does not atomically commit an external provider and PostgreSQL, guarantee
exactly-once effects or prevent every concurrent configuration change. Explicit
reprocessing is a different operator action, not duplicate-request replay.

## Validation

- Reproduced provider I/O inside the transaction before the change; the same
  regression passes with the transaction released before routing.
- Focused backend validation: 69 tests passed. Cases include failed commit,
  provider failure, malformed result, wrong media type, inactive/missing library,
  non-pending task, forged/stale routing metadata and failed conditional writes.
- Real PostgreSQL integration: ten tests passed, including a concurrent duplicate,
  `FOR UPDATE NOWAIT` during the provider callback, transaction rollback, final
  persistence failure, and changed status/library/attempt-token guards. This run
  used the existing isolated Testcontainers harness, not the live database.
- Focused frontend validation: 16 tests passed, including the mounted History
  label and raw API response/automatic-retry behavior.

- Full backend coverage run: 50,141 passed, one Windows-only skip and one SQL
  composition annotation failure. The SQL builder uses fixed text and bound
  values; after documenting that boundary in the required same-line annotation,
  the complete code-health suite plus all three affected unit/route suites passed
  on rerun: 31,658 tests. No test or threshold was removed or weakened.
- Full frontend coverage run: all 416 files and 5,914 tests passed.
- The Windows skip was separately executed with real Linux filesystem calls in
  an isolated Node 24.21.0 test container: five passed, zero skipped. The current
  filesystem test and implementation were mounted read-only; no network or live
  data mounts were used. This was not a rebuild/restart of the running service.
- Lint, both type checks, CI preflight, static ESM/mock-shape checks, the coverage
  ratchet, all 1,784 Markdown files and the frontend production build passed.
  Server line/branch coverage was 90.06%/85.49%; client was 88.12%/78.96%.

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs.
There was no PR to randomly select or implement; none was merged. All seven
workflows for the preceding commit `2f33efdb` completed successfully; those are
not a claim about this new commit's CI. No production provider request was made
by tests.

## Recommendation and next work

Adopt the [researched design stack](manual-queue-routing-design.md): short
transaction, durable unconfirmed marker, bounded provider verification,
conditional outcome persistence and explicit feedback. Benefits are shorter
locks, preserved operator intent and accurate outcomes. The trade-off is that
interrupted work remains reviewable rather than automatically retried.

Next: define a durable, frozen provider-intent contract and a read-only recovery
probe for unconfirmed outcomes across restarts. Require current authorization,
bounded work and exact provider/identity/destination matching before proposing
any replay. Existing history contains the selection but not a complete immutable
provider/configuration revision; the new marker alone must not authorize replay.

The separately reported legacy ingestion warning is evaluated in the
[ownership diagnosis](legacy-ingestion-ownership-2026-10-03.md); this routing
change does not clear or adopt old ingestion records.

Follow-up implemented on 2026-10-03: [saved verification intent and on-demand
read-only provider checks](manual-routing-check-outcome.md). Observations do not
replace the original write outcome or authorize replay.
