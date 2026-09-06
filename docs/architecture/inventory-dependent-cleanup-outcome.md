# Inventory dependent cleanup outcome

## Decision and implementation

The [bounded cleanup follow-up](bounded-inventory-cleanup-outcome.md) is implemented:
automatic transitive foreign-key discovery and an isolated prototype for item and
parent dependents, including retained classification history. Discovery reports
unknown dispositions and cycles; it does not generate executable deletion SQL.

New ESM modules separate graph traversal, catalog/snapshot evidence, proposed
dispositions, item reservations, dependent batches, parent/history work, schema
guards and measurements. The existing cleanup transaction, admission and completion
logic is reused. Production routes, sync SQL, migrations and classification routing
are unchanged. No dependency, release or operator collection queue was added.

Run:

```bash
npm run inventory:deletion-plan
npm run benchmark:inventory-dependent-cleanup
```

Both commands reject connection arguments. The plan reads the repository schema;
the benchmark creates a disposable PostgreSQL 18.6 container with generated
credentials, performs no provider calls or production writes, and verifies cleanup.

## Automatic dependency findings

The source snapshot produced 62 reachable tables and 98 foreign-key edges. Its
fingerprint was `c1a53508f35be71a762101496b3a2272ca1327ea746ccdc21fc8ca35b15a9b0f`.
The existing snapshot parser cannot establish column arrays, indexes, validation,
enforcement or complete trigger semantics. Those gaps remain explicit; its possible
no-action/restrict references are not silently assigned a destructive disposition.

A separate catalog assessment of local Compose ran on 6 September 2026 at
14:18:26 -04:00 in a database-enforced read-only snapshot. It read zero item rows and
performed zero writes. The deployed graph fingerprint was
`daece6dde2870f52ed1c578efe4acc18fbed12eb8a39b045706e082f7c07c69c`.

| Measured property | Running Compose result |
| --- | --- |
| Structurally reachable tables | 59 |
| Foreign-key constraints, including transitive/parallel references | 95 |
| Non-internal triggers on those tables | 13 |
| Non-view rewrite rules | 0 |
| Structural cycles | 1 |
| Unvalidated / unenforced foreign keys | 0 / 0 |
| References without a proven qualifying B-tree index | 30 |
| References with a known proposed disposition | 9 |
| References whose disposition remains unresolved | 86 |

The cycle is `policy_intents.replaced_by_intent_id`, a self-reference with set-null
deletion behavior. It is structural evidence, not evidence that its rows should be
deleted. Likewise, traversal through retained history exposes requests and webhook
references without authorizing their deletion. The report withholds an execution
order when cycles or traversal gaps exist and always reports `executable: false`.

The three snapshot/deployment differences match earlier findings: observation scan
progress, profile inventory state and identity-review preview relationships are
absent from the running database. No upgrade or redeployment was performed.

Thirty references lack the specific index shape checked by this assessment. Examples
include request-to-library/history references, original/corrected library references
in learned corrections, and several policy-intent/history relationships. Partial or
alternative indexes may still be useful; inspect their predicates and query plans
before proposing new indexes. The report is a reproducible ledger, not an automatic
index migration or a claim that every possible access path is missing.

## Measured PostgreSQL 18.6 cleanup

| Phase | Sources deleted | Dependents deleted | History retained/detached | Parents deleted |
| --- | --- | --- | --- | --- |
| Prune one unseen item | 1 | 322 | 0 | 0 |
| Remove its library after pruning | 1 | 392 | 130 | 1 |
| Remove the remaining server fixture | 1 | 0 | 0 | 2 |

The first transaction deleted 128 dependents and retained the reserved source for
continuation. Subsequent pruning and library steps used at most 17 domain mutations
each across all counted tables. The server steps used at most one. Job/claim
bookkeeping, index maintenance and repair-cache invalidation are outside that row
budget; it is not a total I/O or latency guarantee.

All 130 history rows remained with unchanged audit payloads. Completed rows received
the existing library-deletion failure status/message and name fallback; integration
tests separately verify that existing names/errors and non-completed statuses remain
intact. A reserved item could not move during dependent draining. A new connection
resumed the job successfully. An unrelated library sync committed in 46.37 ms during
the target drain; this is a local measurement, not a service-level promise.

The lab graph contained nine structurally reachable tables and eleven FK edges.
The fixture intentionally uses restrictive FKs where production uses cascades so
forgotten work cannot hide inside a parent statement. Database schema cleanup was
verified after all measurements.

## Concurrency, preservation and failure checks

Twenty-one new PostgreSQL integration cases passed. With existing cleanup, sync and
scoped-repair regressions, **101 tests passed across five suites** in 58.505 seconds.
Integration used the existing PostgreSQL 18.4 image; the standalone benchmark used
18.6. The focused unit/code-health run passed 20,560 checks, including graph closure,
cycle handling, fingerprint reproducibility and no-argument command boundaries.

The database tests prove:

- Composite FK columns remain arrays; partial indexes and unvalidated constraints
  remain distinguishable from complete leading-key index evidence.
- Shared mutation limits hold at budgets of one, 17 and 128, including children
  whose population exceeds the item count by hundreds of rows.
- A move before reservation preserves the source and every dependent. After
  reservation, moves and new dependent writes reject until the drain completes.
- Admission races use real database locks. An admitted dependent makes fencing
  retry atomically; an in-flight reservation rejects a late child with `NOWAIT`.
- Parent dependents without a library are included in server cleanup. Unrelated
  servers and already-detached audit data are preserved.
- History cannot be deleted, silently detached or have its audit payload changed
  through the cleanup operation.
- Unknown cascades, watched-column changes, rewrite rules and modified lab helpers
  invalidate the stored contract before domain mutations.
- Checkpoint failures roll back mutations/reservations. Backend termination after
  committed partial progress leaves a resumable reservation and exact counters.
- Competing workers serialize progress without double counting. Completion replay
  is idempotent.

These checks do not prove whole-database crash recovery, portable restore behavior,
all production trigger semantics or owner-resistant authorization. The prototype
still requires a dedicated idle client and automatic forward recovery of claims.

## Repository verification

The full backend coverage run passed **30,276 tests across 1,069 suites** in
1,027.204 seconds. Server coverage was 89.64% statements/lines, 80.68% branches
and 91.93% functions. The coverage ratchet passed without changing its baseline.
The separate PostgreSQL integration cases above are not included in unit coverage.

Repository lint, configured server/client type checks, ESM import and strict mock
shape checks, server Knip checks, migration naming/schema integrity checks, Markdown
lint across 1,020 documents and the local Docker image build passed. The standalone
18.6 benchmark also verified removal of its disposable database resources.

Client source was unchanged, so frontend tests were not rerun. The combined coverage
ratchet used the retained client report: 85.88% statements, 77.65% branches, 84.89%
functions and 87.86% lines. These figures are not a fresh frontend test result.

## Recommendations and next item

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Keep automatic graph/catalog evidence | Discovers indirect references without operator collection | Domain dispositions still need code-backed decisions |
| Keep durable item reservations | Prevents deleting a moved survivor's dependents | Claimed items temporarily cannot move |
| Share one domain mutation budget | Makes dependent fan-out measurable and bounded | Adds transactions and bookkeeping |
| Preserve history with explicit semantics | Keeps audit payloads and established failure behavior | Other retained-reference families remain unadapted |
| Check the recorded schema before work | Detects uncounted cascades and guard changes | Adds catalog work and is not an authorization boundary |

Next: **prototype bounded preservation of restrictive library references**, starting
with `media_requests.routed_to_library_id` and `policy_feedback_log.selected_library_id`.
Their no-action constraints can block library removal; silently deleting request or
feedback history is not an acceptable resolution. Derive the retention/name-snapshot
contract from existing services and add bounded detach or retained-parent behavior
with admission, audit-preservation, rollback and reconnect tests. Verify relevant
index access paths from the generated ledger before choosing migrations.

Continue resolving the policy self-reference and other unknown dispositions before
claiming full graph compatibility. Automatic admission retries, abandoned-job/claim
recovery, manifest/history retention, least-privilege roles and sustained storage
evidence remain production gates. No operational labeling workflow was introduced;
semantic counter-evidence still requires independent evaluation and review-only use.

Final recommendation stack: automatic dependency evidence → explicit retention
contracts → durable scope/item admission → bounded dependent work → automatic
recovery/retention → least-privilege enforcement → production adoption assessment.

The separate [design](inventory-dependent-cleanup-design.md) records official
PostgreSQL and W3C research, August-baseline limitations and tradeoffs. GitHub MCP
returned no open PRs on 6 September 2026, so none was available for random local
implementation. No external PR was merged and no release was created.
