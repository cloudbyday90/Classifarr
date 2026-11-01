# Inventory refresh readiness cancellation outcome

Date: 2026-10-31 (America/New_York). Status: implemented and verified locally on
main. See the separate [design, official research and tradeoffs](inventory-refresh-readiness-cancellation-design.md).

## Implemented behavior

The description and representative refresh runtimes now opt into a small
readiness guard. Other shared readiness callers retain their existing behavior.
The guard starts a three-second probe budget before connection acquisition,
forwards caller/stop cancellation through the existing explicitly read-only
database path and rechecks all fences before invoking heavy work. It clears the
probe timer before worker execution, preserving the worker's own budget.

One coalesced flight retains the first caller's arguments and cancellation
authority. A pre-aborted caller never queries; a pre-aborted joiner receives a
cancelled result without affecting the owner. Later joining signals cannot cancel
the first owner. Stop permanently fences the wrapper and aborts its probe and
underlying worker. Local deadlines and occupied scopes return deferred/unavailable
without new readiness warnings, cooldowns, replay or recovery claims.

The database module owns two fixed admission scopes, one per refresh type. A
scope remains occupied through both read cleanup and the actual pool acquisition
promise's settlement. There is no admission queue. This survives runtime stop and
replacement against the same database module. A late pool grant after abort
returns without BEGIN, SQL or worker invocation; the next normal tick can run
fresh after drain. Unknown scopes and unsigned/write use fail before acquisition.
The existing ownership assertion stays before admission and around guarded reads.
Ordinary transactions and other abortable consumers keep their existing paths.

The readiness callback runs the unchanged SELECT. It no longer resets a local
three-second SQL timeout after acquisition: the shared runner's remaining-time
minimum preserves shorter inherited settings. Existing targeted same-role
cancellation, exact backend/start binding, two control slots, bounded control
cleanup and uncertain-client discard remain intact. No private pg queue mutation,
new pool, role grant, global timeout, write retry or query replay is added.

Native query failure eligibility is bound to the exact probe signal at the query
boundary while live, before the shared runner can replace SQLSTATE 57014 with
AbortError. The reader preserves that original observed failure for existing
diagnostics. Cleanup crossing the local deadline cannot erase earlier valid
query evidence, and reuse of an exception cannot transfer proof to another
expired probe. Exceptions first observed after local abort cannot upgrade that
abort into SQL proof. Application row-projection failures remain unknown;
stop/caller cancellation stays quiet. Existing bounded diagnostic persistence
and worker storage cooldowns/caches are unchanged.

The process remains automatic on existing schedules and status surfaces. No UI,
operator CLI trigger, setting, endpoint, job, schema, provider operation, routing,
learning, deployment, release, production cleanup or restart is added.

## Verification

The new regression failed on both old runtimes: an already-aborted caller still
performed a readiness transaction and returned a database-derived deferral. It
now returns cancelled without acquiring or querying.

Expanded focused tests passed thirty suites / 433 tests. They cover the exact three-second
boundary, pre-abort, owner/joiner coalescing, stop, late result/error containment,
no probe deadline during heavy work, slot retention through pending acquisition
and read cleanup, independent scopes, synchronous failures, unknown/repeated or
retained acquisition rejection and invalid transaction options. Existing cache,
cooldown, generic readiness and database cancellation regressions pass.

Isolated PostgreSQL compatibility passed six suites / 47 tests using the actual
production database factory. A saturated one-client pool with a twenty-second
connection timeout retains exactly two queued acquisitions through repeated
runtime replacements, then releases late grants without SQL. A three-second
pool-wait timeout defers quietly and does not start work on late grant. Both
refresh types cancel genuinely blocked readiness SQL while another reader and
subsequent pool use succeed. A shorter inherited SQL deadline remains effective
when control transport is unavailable and preserves actual 57014 evidence.
Existing 53100/42501/57014 warning persistence, ordinary-role cancellation,
connection recovery and durable comparison recovery also pass.

The diagnostic integration fixture now forwards read options to the production
factory instead of relying on the default facade that ignores them. Its shorter
test-only server timeout proves native cancellation before local abort. No physical
disk was filled and no production database or container was changed.

The initial ownership gate rejected the two changed source pins. Reviewed the
complete database module, read runner, admission/lease logic, readiness reader,
guard, query observers, runtime callers and PostgreSQL evidence before updating
only those pins and their existing unresolved review rationales. Baseline revision,
classifications, analysis digests and the one-hundred-group limit remain unchanged.
The gate passes with productionCompatible: false; reviewed drift does not
authorize unresolved writers or establish release readiness. Repository gate
checks passed two suites / 37,423 checks. Fixture rejection ownership is explicit;
fresh-install runtime assertions now verify the new read-only options and the
unchanged transaction behavior of the two non-opted-in runtimes.

Backend lint/type checking, both dependency scans, static ESM import/mock shape
checks, copyright, four policy gates, Markdown lint and whitespace checks passed.

Full backend coverage passed 1,911 suites / 61,941 tests, with one existing skipped
test. Coverage was 89.22% statements/lines, 86.63% branches and 90.74% functions.
Scoped admission reached 100% across these metrics; the new guard reached 100%
statements/lines/functions and 92.30% branches. The coverage ratchet passed without
baseline changes. It reused the October 30 client report because client source is
unchanged; no fresh frontend test/build run is claimed. Staged secret scanning
also passed.

Artifact maintenance reused the same-day verified inventory. Fresh results,
backups and recovery/reference images remain protected; this batch removed no
files or images. Isolated PostgreSQL containers are gone. The Classifarr container
retained its identity, image, start time and healthy state. An unrelated transient
container appeared in shared Docker listings; it was not managed by this batch
and its cause is unassessed. No image build, deployment or restart occurred.

## Limits and next item

The three-second timer and up to 1.5 seconds of existing cancellation cleanup are
local budgets, not a hard event-loop or server-termination guarantee. Setup SQL
before the shared runner's local settings retains connection defaults. Control
failure can leave remote SQL until its server timeout; successful cancellation
dispatch is not proof of termination. A very long pool timeout can keep a scope
deferred until that specific request drains, without accumulating new requests.

Admission is per database module/process and resets with its pool at restart;
there is no cross-process lease. Scope cleanup does not claim that a remote
backend has physically terminated. A native setup/commit cancellation whose
original proof was replaced remains unknown. The legacy shared readiness wrapper
continues to serve other callers; this batch grants them no new semantics.

The source-pair portion is now addressed by the separate
[automatic source-pair readiness outcome](automatic-source-pair-readiness-outcome.md).
Library comparison and inner workload polling remain separate follow-ups.
Preserve separate evaluation
and budgeted-inference authority along with their ownership, resource and
evidence contracts. Resume Unraid
classification-evidence assessment after a separately authorized deployment;
this commit does not deploy or establish classification accuracy.

GitHub MCP found no open PRs, including Dependabot, so no random PR or stale
dependency PR was applicable. No PR was merged and no dependency changed.
Unreleased records the automatic readiness behavior.
