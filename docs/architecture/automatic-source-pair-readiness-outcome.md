# Automatic source-pair readiness outcome

Date: 2026-10-31 (America/New_York).
Design: [agreed boundary, research and alternatives](automatic-source-pair-readiness-design.md).

## Result

Automatic source-pair evaluation/capture now uses the shared bounded preflight.
The probe has a three-second budget from pool acquisition through accepting its
result, plus the existing cancellation cleanup of up to 1.5 seconds. Its new
fixed database-module admission slot remains occupied through read cleanup and
the actual acquisition's settlement. Replacement runtimes defer without adding
another queued request. A late grant returns without BEGIN or SQL; only a fresh
automatic tick can try again.

The shared lifecycle is isolated in boundedInventoryReadinessGuard; the plain
fixed-SELECT reader and timeout live in boundedInventoryReadinessReader. The
refresh entry point is a thin adapter retaining its native-query diagnosis and
exact-signal proof. Its accepted scopes remain description and representative;
source-pair failures remain quiet deferred/unavailable results. Legacy generic
readiness and library comparison are unchanged.

Pre-aborted ticks do not acquire. Coalesced flights retain the first owner's
arguments; an already-aborted joiner gets its own cancelled result. Stop and
owner abort fence late ready results. The probe timer clears before the unchanged
evaluator-then-capture composite runs. Both child stop paths and the returned
evaluator result are preserved. Caller abort owns preflight only; it does not
permanently stop admitted workers.

Evaluation completion is not inference authorization. Stored completed replay,
budget/window/cooldown, workload admission, reservation, checkpoint and publication
checks remain independent and unchanged. The default-off budget stays off. No
new operator command, UI, endpoint, job, setting, schema, provider capability,
routing, learning, release, deployment or production mutation is introduced.

## Verification

Before implementation, two regressions failed against the original source-pair
factory: a pre-aborted tick still called readiness, and stop did not abort the
pending read. Both now pass. Focused lifecycle, scheduling, inference-permission,
refresh diagnostic, admission and repository checks passed twelve suites /
37,550 tests, including the repository's generated code-health checks.

The first isolated PostgreSQL pass covered seven suites / sixty-five tests:
refresh diagnostics, actual cancellation and client recovery, source-pair
evaluation, adjudication budget and workload controls. The finalized expanded
readiness suite passed ten tests. It uses the production database factory with
an isolated database, including a twenty-second connection timeout and a
one-client saturated pool. All three scoped requests remain bounded through ten
runtime replacements, late grants execute no SQL, and fresh ticks resume normal
readiness. All three runtimes cancel actual blocked SQL without interrupting
another reader. Shorter inherited SQL deadlines remain effective when control
transport is unavailable; refresh native 57014 proof survives while source-pair
results remain quiet. PostgreSQL confirms the source-pair probe is read-only and
leaves evaluation, budget and capture state unchanged on refusal.

The ownership gate initially rejected three exact source entries. Reviewed the
complete new reader/lifecycle, refresh reader/adapter, source-pair composition,
fixed readiness SQL, production database adapter, scoped admission and read
cancellation boundaries before updating two source pins and adding the new
reader under the existing unresolved composition review. Analysis digests,
baseline revision, classifications and the one-hundred-group limit stay
unchanged. The gate passes with productionCompatible: false: static review does
not authorize unresolved writers or establish release readiness.

Backend lint/type checking, both dependency scans, static ESM import/mock shape
checks, copyright, four policy gates, Markdown lint, whitespace and staged secret
checks passed.

Full backend coverage passed 1,912 suites / 61,977 tests, with one existing skip,
in 975.652 seconds. Coverage was 89.22% statements/lines, 86.64% branches and
90.75% functions. The shared guard reached 100% statements/lines/functions and
97.36% branches; the plain reader, refresh adapter and scoped admission reached
100% across those metrics. The coverage ratchet passed without baseline changes.
It reused the October 30 client report because client source is unchanged; no
fresh frontend test/build is claimed.

Artifact maintenance reused the same-day verified growth inventory and took fresh
Docker/context snapshots around PostgreSQL testing. Current evidence, backups
and recovery/reference images remain protected; no files or images were removed.
Isolated PostgreSQL containers are gone. Classifarr retained its identity, image,
start time and healthy state. An unrelated transient container appeared in the
shared Docker inventory; it was left alone and its cause is unassessed. No image
build, deployment or restart occurred.

## Limits and next recommendation

Timers are local budgets, not hard event-loop or server-termination guarantees.
Setup before the runner's local SQL settings retains connection defaults.
Cancellation dispatch does not prove remote termination; an unavailable control
connection can leave SQL until the server timeout. A queued acquisition cannot
be removed through pg's public API, so its scope can remain deferred until the
actual promise settles. Admission is process/database-module state and resets
with its pool; it is not a cross-process lease.

Next: design bounded cancellation for capture's inner workload checks. They
currently read budget/readiness before work, every two seconds and before a
reservation, and finalization awaits an outstanding poll. Separate genuinely
read-only SELECTs from repository methods that insert, reset or prune. Preserve
independent budget/revision/window checks, charged reservations and uncertain
provider outcomes. This requires its own complete planning agreement; the outer
preflight change does not bound active capture shutdown. Library comparison and
caller cancellation of admitted workers remain separate follow-ups.

GitHub MCP found no open PRs, including Dependabot, so no random PR, stale rebase
or dependency implementation was applicable. No PR was merged. Unreleased
records this automatic behavior; the recommendation stack and pros/cons are in
the design document.
