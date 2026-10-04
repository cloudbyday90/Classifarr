# Ingestion identity cancellation outcome

Date: 2026-10-04. See the separate
[design, official research and tradeoffs](ingestion-identity-cancellation-design.md).

## Delivered

The existing import owner's cancellation signal now reaches identity planning,
cached-proof checks, TMDb external-ID/detail reads, and source revalidation.
Pending rate-limit waits remove their timers/listeners on cancellation. Recovery
does not reinterpret a cancelled operation as a provider failure or proceed to
fallback persistence. Plex, Jellyfin and Emby identity reads also enforce the
same 1 MiB decoded-response limit already used for TMDb identity reads.

The change extends existing small ESM modules and the existing TMDb facade; it
does not introduce another singleton, package, scheduler, schema migration or UI.
Ordinary no-signal callers remain supported. Existing generation/ownership checks,
independent identity evidence, attempt limits and durable cooldowns remain intact.

## Diagnosis is not live repair

The current local warnings were traced with read-only SQL: eight old running
markers across two enabled movie libraries have no matching ingestion ledger.
A third library completed import with one TVDB conflict recorded as
`insufficient_evidence`. This patch does not manufacture ownership, choose a
disputed ID, retire those legacy records or claim those warnings are fixed.

Use the existing reviewed **Recover and resume import** action after verifying
older instances and external writers have stopped. That is a one-time operator
decision, not something proved by container age, memory usage or a rebuild.

## Verification

- Regression-first: six cancellation-boundary tests failed on the old code and
  passed after the fix. Cached-proof cancellation, cancellation between two TV
  identity lookups, pending token cancellation and workflow callbacks are covered.
- Focused unit/transport run: 111 tests passed across five suites. Actual native
  HTTP tests cover pre-cancelled requests, stalled response closure, decoded gzip
  response limits and cancelled TMDb rate admission. Separate Plex/Jellyfin/Emby
  adapter tests also passed.
- Isolated PostgreSQL: 97 tests passed across four suites, including recovery,
  legacy reconciliation, identity persistence and fairness. The new test observes
  the actual HTTP request and durable claim, terminates only the synthetic
  library's owning database backend, and verifies prompt transport cancellation,
  unchanged inventory, no false completion/outcome, and preserved identity retry
  state across full import replay. Only the synthetic import retry deadline is
  advanced; the identity cooldown is not reset. This does not prove that a real
  one-day cooldown elapsed.
- Linux container: 85 tests passed across five suites, zero skipped, including
  the real directory-fsync test and cancellation tests. The container had no
  external network, read-only source/root, bounded CPU/memory/PIDs and no live data.
- Backend lint, type checking, normal/production dependency analysis, migration
  integrity, copyright, npm flags, static-import, ESM mock-shape and Markdown
  checks passed. The ownership drift gate passed after reviewing exactly three
  changed fingerprints: the import runner's signal handoff and two read-only
  source adapters. Their SQL analyses and review categories are unchanged.
  `productionCompatible` remains false for existing unresolved writer debt.

- Full backend coverage run: 1,668 suites / 51,340 tests passed, one test failed,
  and one Linux-only filesystem test was skipped on Windows (694 seconds). The
  sole failure was an exact request-options expectation missing `signal: null`.
  After correcting that test-only assertion, Jest's `--onlyFailures` rerun passed
  all 23 tests in the affected suite. Runtime code did not change; the full suite
  was not repeated after that assertion update. The Linux run above covers the skip.
- Backend coverage: statements/lines 90.05%, branches 85.53%, functions 91.45%.
  Full frontend coverage run: 434 suites / 6,294 tests passed in 181 seconds,
  with statements 86.67%, branches 79.55%, functions 86.22% and lines 88.55%.
  The unchanged ratchet passed with both fresh reports. Frontend build and
  TypeScript checks passed. Additional ID-matching and adapter regressions
  passed 178 tests across six suites. The staged secret scan found no leaks.

## No-cache Compose rebuild and schema dump

Built with `docker compose build --no-cache` and revision
`cb65ccc96211c3c45b14a66f48a16e067ddc14bc`, then recreated only the existing
`classifarr` service with `--no-deps --no-build --force-recreate --wait`.
The local immutable image ID is
`sha256:7394abf66fb6a88d3ad07d176336ca5d5ca809b508ba8b8229905fce361cfa34`.
The container started at `2026-10-04T17:04:39.829313218Z`. It returned HTTP 200,
became healthy and reported zero restarts and no OOM. Runtime checks confirmed
Node 24.21.0, PostgreSQL 18.6 and pgvector 0.8.7.

The existing data/media mounts, UID/GID 1000, read-only root and 2 GiB memory
limit were preserved. No CPU quota is configured. Other running containers
were untouched. Spot samples were 365 MiB / 0.68% CPU / 48 PIDs soon after
startup and 385.5 MiB / 0.53% CPU / 39 PIDs after the startup imports. This is
short-window evidence, not a sustained-load or memory-leak certification.

Eight libraries completed their normal startup imports. Read-only inspection
through that cycle found two `legacy_owner_unknown` warnings and no ERROR rows.
The same eight legacy running markers and one unresolved TVDB conflict remain.
There was no repeated source-item warning in this window; its persisted
`insufficient_evidence` observation proves it was not silently resolved.
No live connection was deliberately terminated and no recovery attestation was
submitted. The cancellation fault was tested only in disposable fixtures.

After rebuilding, the existing `dumpSchema` generator ran against a disposable,
network-isolated PostgreSQL instance from this exact image, seeded from the
committed schema. The generated snapshot loaded into a second fresh database
and dumped identically; `database/schema/current.sql` has zero Git diff.
The labelled temporary container was removed and its absence verified. Migration
and ownership checks passed again. No live database was used to generate schema,
and no new migration or release was created.

## Linked CI run: separate unresolved failure

[Run 37217414273, attempt 1](https://github.com/cloudbyday90/Classifarr/actions/runs/37217414273)
tested the previous revision `cbad9423832881db808aaa183e0eda1b34c2b806`, not
the cancellation commit. The Build and Test and Tests with Database jobs passed.
Installation acceptance reached `routing_arm-crash`, then emitted
`ROUTING_FAILURE {"phase":"forced-restart","reason":"assertion_failed"}`.
Its downloaded same-run receipt is blocked at `routing_rehearsal`; the downstream
release readout failed and publication was skipped. A passing local rebuild does
not override this failed CI result.

The available diagnostic does not distinguish a wrong exit code, an OOM flag,
or an early startup exit. Those are investigation branches, not established
causes. Neither this CI failure nor a disposable crash test proves anything
about the stopped-writer attestation required by the Movies warning.

The existing isolated routing runner then passed all eight phases locally using
the new candidate image above and historical baseline
`sha256:6c04c447e6a32d53c708e316f5ea0aeecaa0264579cda3e8f5b31bc0d2bfae67`
(revision `eef03e57ffdd26d638f32f1593c424b438041ea2`). The synthetic container
reported exit 137 after SIGKILL and exit 0 after graceful stop, neither with OOM.
It preserved retry budgets, credential pauses and history, made two movie reads
and two TV reads, performed zero provider writes and verified resource cleanup.
No checks or assertions were changed. This did not reproduce the CI failure on
the different earlier candidate image; the CI root cause remains unconfirmed.

[Docker kill](https://docs.docker.com/reference/cli/docker/container/kill/) and
[Docker wait](https://docs.docker.com/reference/cli/docker/container/wait/) were
discovered through search and read on 2026-10-04. They distinguish signal delivery
from observing process exit; they do not establish which CI assertion failed.

## Delivery and recommendation

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs.
There was no PR to choose randomly; none was substituted, merged or closed.
Work remains on `main`, with Unreleased notes and no release/version/tag change.

Keep lease cancellation → cancellable token admission → bounded HTTP → existing
fenced persistence. It removes obsolete work without weakening ownership or
identity requirements. The limitation is that only supplied cancellation signals
are covered: a healthy owner is not yet cancelled simply because an operator
changes source configuration or requests shutdown. Database operations are not
made cancellable by this patch.
An unusually large legitimate source response also defers at the 1 MiB boundary;
the limit is intentional, and an oversized reply is never accepted as identity proof.

Next priority: identify the failing forced-restart assertion in the linked CI
run and prove the repair against a matching image, without weakening the gate.
After that, define and test deliberate import-stop/configuration-change
cancellation through the same boundary. Immediate local recovery still requires
the stopped-writer review above. The recovery-change skill kept those permissions
separate and required real HTTP/database failure tests; the release-evidence
skill prevented substituting this local image for the failed CI image.
Plainspoken kept the user-facing summary short while retaining the evidence here.
