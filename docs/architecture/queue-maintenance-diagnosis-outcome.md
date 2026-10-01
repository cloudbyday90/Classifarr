# On-demand queue maintenance diagnosis outcome

Date: October 1, 2026. Backend-only change; no release or live deployment.

## Delivered behavior

The [design and official-source research](queue-maintenance-diagnosis-design.md)
are implemented in three small ES modules: the fixed catalog query, validated
diagnostic projection and failure classification. Existing maintenance execution,
durable admission and scheduler services integrate them. No singleton expansion,
new daemon, timer, schema, API, UI, credentials or Compose/Unraid edits are needed.

An unsuccessful reserved recovery attempt produces a fixed failure category and
one suggested next step. A diagnostic also runs on the first transition to the
three-attempt limit, or when a subsequent deferred check notices an interrupted
reserved attempt. Ordinary healthy/fresh/busy checks and successful interventions
do not collect this evidence. Existing cooldown and attempt limits still apply.

| Evidence | Example next step |
| --- | --- |
| Queue lock interference | Review active queue maintenance or schema work |
| Hour-old open or prepared transaction | Review it with its owner; do not terminate or roll back automatically |
| Replication tuple-retention horizon | Review replica health and slot ownership; do not drop slots |
| Incomplete activity visibility | Ask an authorized administrator to inspect; do not broaden application grants |
| Canceled operation | Review duration and cancellation events; cancellation does not prove timeout |
| Lost connection or exhausted session budget | Review connectivity/restarts or database load; keep cooldown and retry limits |
| No specific blocker observed | Compare Logs and pressure observations; do not treat this as a health verdict |

The existing structured Logs retain the fixed message, next step, failure
category, visibility and aggregate counts. This is not a new historical metrics
store or a claim to have identified a production blocker.

## Safety and limits

The diagnostic is one read-only catalog SELECT on the existing pinned session,
with a three-second statement limit inside its sixty-second overall budget.
Known session loss or budget exhaustion returns an unavailable diagnosis without
reconnecting. Other diagnostic failures do not retry or turn a failed repair into
success. Existing maintenance locks and connection disposal remain unchanged.

No SQL text, PID, user/application/slot name, address or media/configuration
content enters the diagnostic. Counts are validated; malformed or inaccessible
evidence remains unavailable or limited. Physical replication slots are
cluster-wide; logical slots are database-scoped. A slot's `catalog_xmin` alone is
not treated as retaining ordinary queue tuples. The one-hour transaction cutoff
is a product heuristic, not proof that a transaction caused a failure.

Durable transition admission suppresses repeated interrupted/attempt-limit
snapshots across cooperating instances. A crash after admission but before
logging can lose the snapshot: delivery is best-effort, not exactly-once.
Point-in-time evidence can also miss a transient blocker. Diagnostics cannot
kill sessions, drop slots, change retention, reset attempts or grant authority.

The current production database identity is unchanged. These additions work
with existing installations without requiring a template update. Future
restricted-runtime maintenance authority remains a separate component.

## Validation

- Targeted unit/adapter tests: 166 passed in nine suites.
- Real PostgreSQL tests: 20 passed in two suites, including seven new diagnostic
  tests. They verify read-only execution, actual lock interference without
  terminating its owner, live transaction horizons, restricted visibility,
  disabled tracking, durable interrupted-attempt admission and healthy no-work
  behavior. Old prepared/replication positive projections are unit-tested, not a
  production replication fault drill.
- Frontend coverage: 5,795 tests in 411 suites passed; production build passed.
- Backend coverage: 48,252 tests in 1,584 suites passed; one existing skip.
  All three new diagnostic modules have 100% line/branch coverage. The combined
  backend/frontend coverage ratchet passed without baseline changes.
- Ownership unit regression: 39 tests passed. Reviewed source inventory:
  19 owned, 180 separately coordinated and 490 unresolved paths; existing
  unresolved paths were not waived or certified compatible.
- Lint, types, copyright, Knip, ESM imports/mock shapes, migration naming/schema
  integrity, Markdown (1,715 files) and policy gates passed.
- The initial full backend run began before its reviewed-file manifest was
  updated and failed that gate. It was stopped and restarted after the source
  and manifest were finalized; the clean run passed as recorded above.

## Recommendation and next component

Keep PostgreSQL autovacuum first, bounded conditional recovery second and
on-demand diagnosis third. Benefits: useful failure evidence, low idle overhead,
no new deployment requirement and unchanged repair authority. Costs: incomplete
point-in-time visibility and best-effort diagnostic delivery, rather than
continuous monitoring or guaranteed causal explanations.

The next high-value component is a **fixed-capability maintenance handoff for a
restricted runtime**. Reuse the existing trusted maintenance child and admission
contracts so the runtime can request only named, bounded operations without
holding administrator credentials. Acceptance should demonstrate request
authentication, fixed operation scope, concurrency/deadline limits, restart
recovery and denial of arbitrary SQL, while requiring no edits to existing
Compose or Unraid templates. This is proposed next work, not authority added by
this change.

## Delivery scope

GitHub MCP and a saved-login GitHub CLI check both returned no open PRs. There
was no random open PR available to implement; none was invented, merged or
closed. No live database maintenance, container restart, image publication,
release, tag or dependency change was performed in this round.
