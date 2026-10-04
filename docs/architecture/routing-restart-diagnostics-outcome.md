# Routing restart diagnostics: outcome

Date: 2026-10-04. See the separate [design and alternatives](routing-restart-diagnostics-design.md).

## Delivered

Routing rehearsals now retain safe container state and recognized lifecycle
events before cleaning up a failed, exactly named and labelled fixture. The
report identifies exit-code, OOM and startup-running assertions. It does not
publish arbitrary assertion diffs, Docker errors, credentials or raw log tails.
The shared startup collector also recognizes the fixed PostgreSQL PID-lock
refusal message without exposing its PID/path. Collection runs only on failure,
with bounded commands; it cannot replace the original error or prevent cleanup.

No runtime ownership rule, restart delay, retry budget, health timeout or release
gate was relaxed. There is no new background worker, dependency, migration or UI.
The change fixes lost diagnostic evidence; it does not claim that every possible
database startup failure is repaired.

## Historical-source investigation

The original [CI run 37217414273](https://github.com/cloudbyday90/Classifarr/actions/runs/37217414273)
failed at `forced-restart` on `cbad9423832881db808aaa183e0eda1b34c2b806`.
Its original diagnostic does not identify which assertion failed.

A clean Git archive of that revision was built locally as
`sha256:5bb4a0e0d473a885669e0d9666da811e83b4df39437584000ce9ee39cc197f6c`.
This is a historical-source rebuild, **not the original CI artifact**. The
unchanged production entrypoint ran in the existing bounded, network-isolated
fixture, with baseline
`sha256:6c04c447e6a32d53c708e316f5ea0aeecaa0264579cda3e8f5b31bc0d2bfae67`
(revision `eef03e57ffdd26d638f32f1593c424b438041ea2`).

One full routing replay reproduced the forced-restart failure. The enriched
diagnostic identified `startup_running`: the restarted container exited 1 with
no OOM, and `EmbeddedDatabaseStartup` reported
`database_startup_process_exited`. This narrows the local failure to PostgreSQL
startup. Its underlying PostgreSQL refusal was not retained in that first run;
it does not prove a PID collision, storage failure or the original CI cause.

A subsequent full replay passed all eight phases, preserving history, retry
budgets and authentication pauses, with two movie reads, two TV reads and zero
provider writes. Five additional crash/restart cycles on a disposable unseeded
database also passed; those simpler cycles are not routing acceptance evidence.
Passing retries do not erase the reproduced failure. No stale PID file was
removed, no other process was signalled and no automatic startup retry was added.

The newer [CI run 37219904673](https://github.com/cloudbyday90/Classifarr/actions/runs/37219904673),
on earlier `main` revision `338c2607454f267c418dd8c8d154504d990a5fb5`, passed
its installation and database jobs. That is separate evidence, not a validation
of this uncommitted patch or a causal explanation of the original failure.

## Verification

- Regression-first checks failed before implementation: missing owned-container
  diagnostic capture and missing named exit/OOM assertions. Tests also exposed
  Node's appended assertion diff and cross-realm error handling; both are covered.
- Script and ownership unit scope: 145 suites / 1,946 tests passed. After adding
  the final fixed PostgreSQL marker test, the focused diagnostic/installation
  scope passed 6 suites / 173 tests. No skips in these runs.
- Real isolated PostgreSQL legacy reconciliation and recovery progress:
  2 suites / 55 tests passed. These use synthetic libraries and credentials;
  they do not recover the local installation or Unraid.
- Forced startup failure injection against image
  `sha256:7394abf66fb6a88d3ad07d176336ca5d5ca809b508ba8b8229905fce361cfa34`
  (revision `cb65ccc96211c3c45b14a66f48a16e067ddc14bc`) produced the expected
  startup-running failure, exited state, code 137 and no OOM. A second kill
  immediately after restart is a deliberate diagnostic test, not a passing
  routing acceptance scenario. The owned fixture and volume were cleaned up.
- Backend test lint, backend type checking, Markdown lint, copyright, migration
  naming/schema integrity and installation workflow contracts passed. Ownership
  drift passed without refreshing its baseline; `productionCompatible` remains
  false for the existing writer debt. Full application/frontend suites were not
  repeated for this tooling-only patch.

## Ownership is a separate issue

The [local ownership diagnosis](legacy-ingestion-local-diagnosis-2026-10-04.md)
matches the reported container hostname to local Docker and records eight old
running import markers without owner records. The user confirmed a separate
production database on Unraid, sharing only Plex. Unraid was not inspected,
recovered or restarted. No operator attestation was fabricated and no legacy
record was automatically claimed.

PostgreSQL's process PID lock and Classifarr's per-library import ownership are
different mechanisms. Neither a successful image build nor a database restart
can certify a legacy import's owner.

## Delivery and next work

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs.
There was no eligible PR to choose; none was substituted, merged or closed.
Changes stay on `main`, under Unreleased, with no version, tag or release change.

Recommendation: retain strict restart checks and the new safe evidence. Capture
the precise PostgreSQL refusal on the next failing isolated replay/CI run before
implementing a startup repair. For local legacy imports, use reviewed recovery;
for future automatic takeover, finish the existing database-enforced writer
boundary rather than assigning historical rows a new owner.
