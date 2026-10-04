# Supervised schema maintenance outcome

Date: 2026-10-04. Branch: `main`. No release.
See the [design, tradeoffs and official research](supervised-schema-maintenance-design.md).

## Delivered

The compatible startup child now completes schema maintenance before assessing
optional profiling. The parent waits for successful child exit and stream closure
before launching the normal application. Mandatory schema deferral/failure cannot
be mistaken for optional profiling deferral. Restore-only startup skips this child.

The normal application independently verifies the packaged migration ledger and
ready restore gate in a read-only transaction, while holding runtime admission.
It does not seed the gate or retry migrations in web preflight. Internal routing
hints are rejected in saved deployment settings and cannot bypass external-mode
authority checks. Direct host startup retains its existing migration behavior.

All implementation modules are ESM. The existing schema-maintenance service,
restore/runtime lock, migration transactions and confirmed cancellation are
reused. No template, mount, grant, password, schema migration, release, provider
setting or historical ingestion ownership was changed. The worker is bounded to
one connection, 512 MiB V8 old space and a 15-minute lifetime; host shutdown keeps
the shorter existing drain limits. These are not total memory reservations.

## Local validation

- Combined targeted unit/regression run: 416 tests in 16 suites passed without
  skips. This is one deduplicated selection, not the full backend suite.
- Real PostgreSQL: 25 tests in two suites passed with no skips. Coverage includes
  idempotency, authenticated external roles, shared-runtime/exclusive-maintenance
  contention, restore exclusion, actual migration rollback and current/pending/
  future/missing schema. Compatible readiness works with existing credentials;
  those credentials are still refused by the strict external verifier.
- Full backend ESLint, typecheck and Knip passed. Static imports, copyright,
  migration naming and schema snapshot integrity passed. The initial design
  documentation check covered all 1,871 Markdown files without errors.
  The final design/outcome check passed all 1,872 Markdown files.
- The ownership gate passed after Git recorded the two worker renames. Before
  staging, the scanner correctly reported the deleted names still in the index;
  no missing-source check was waived. The explicit review covers only the changed
  boundary modules: 19 owned, 244 separately coordinated, 501 unresolved.
  `productionCompatible` remains false. No unresolved writer was promoted.
- Two current open-PR enumerations returned no open PRs. None could be randomly
  selected or implemented; no closed PR was substituted and no PR was merged.

## Image and schema evidence

- Tested runtime commit: `1af4704024d919e6839b337fa6e92c20e9aa87ce`.
  No-cache local Compose build passed, with OCI revision `1af47040`.
  Image ID:
  `sha256:af594e9f437ae85a465e5ba1a5d9b10270d60f1d2ab60a86129b818853e0caf4`.
  The client production build passed. Both build-time npm audits reported zero
  vulnerabilities; no npm warnings were observed.
- Four actual packaged-entrypoint scenarios passed on that image in disposable
  network-disabled containers: non-root UID 1000, read-only image, 1 CPU, 1 GiB,
  128 PIDs, synthetic tmpfs data and no application-source overrides.

| Scenario | Observed result |
| --- | --- |
| Fresh snapshot | Schema complete; profiling already active; healthy web |
| Missing optional profiling extension | Schema complete; extension installed; healthy web |
| Deliberately pending restore-gate seed | Worker applied the packaged seed, restored its ledger entry and ready gate before healthy web |
| Synthetic future ledger entry | Schema failed; no web supervision; database stopped; container exited 1 |

The pending fixture deliberately removes one idempotent seed ledger entry and its
gate from a current-schema synthetic database. It proves the startup handoff,
not an upgrade from a published historical image. Successful scenarios left no
startup child and shut down with exit 0 and no OOM. All four containers were removed.

- All ten owned PostgreSQL startup-smoke checks passed: delayed startup, existing
  owner refusal, WAL recovery, verified parent-worker PID reuse, foreign PID
  refusal, actual signal reporting, deadline, cancellation, invalid configuration
  and entrypoint TERM/INT forwarding. The disposable container was removed.
- After the no-cache build, the existing `dump-schema` implementation used this
  image's PostgreSQL 18 in an isolated database. The committed snapshot loaded,
  dumped, loaded into another fresh database and dumped again with zero drift.
  No local application data was used to generate it. The owned fixture was
  removed; no new schema file change was needed.

## Deployment and limits

Only local Compose service `classifarr` was recreated, preserving its existing
mounts. Container `61319a933178` started at `2026-10-04T20:07:04.868374264Z` on the
tested image. Its parent reported schema `complete`, profiling `already_active`,
then `maintenance_completed` before normal supervision. Node 24.21.0,
PostgreSQL 18.6, pgvector 0.8.7 and a ready restore gate were verified directly.

After the normal startup/import cycle:

- All eight owned ingestion states were complete and updated during this start.
  No ERROR entries were recorded for this container. Two `legacy_owner_unknown`
  warnings remained, with library 4's two and library 5's six old running markers
  unchanged; neither library acquired an invented ingestion-owner row.
- Docker health and `/health` were healthy/200. Unauthenticated library access
  returned 401. Restarts and reported OOM kills remained zero. The startup child
  was absent; the final database sample had five idle sessions, no active query
  besides the observer.
- Samples ranged from 0.51–26.73% CPU and 366.3–403.3 MiB memory; the final sample
  was 0.83% CPU, 403.3 MiB of 2 GiB (about 20%) and 38 PIDs. No uncontrolled process
  growth was observed in this short window. This is not sustained-load or leak
  evidence. Existing Compose CPU and PID limits remain unset.

For the tested code commit, OSV, Trivy, Gitleaks and copyright CI checks succeeded.
The [main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37230931493),
[CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/37230931256) and
[resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/37230931279)
were still running when these results were recorded. Local checks do not replace
those remote results.

An attempted rollback tag for the previous container image failed because Docker
could no longer resolve that image ID after the rebuild. No rollback tag was
created and no container snapshot was used as a substitute. This round does not
claim a retained previous-image rollback artifact. Application data and unrelated
containers were not removed. Unraid was not inspected or changed.

This remains compatible **shared OS/SQL authority**, not privilege isolation.
The internal hint is sequencing, not authentication. Readiness does not fence
non-cooperating writers. Existing legacy ownership warnings are not repaired by
this component, and no historical owner or stopped-writer proof is invented.
No browser/UI contract changed; this round makes no new accessibility claim.

## Recommendation stack

1. Keep the compatible startup worker: deterministic ordering and unchanged
   templates, at the cost of waiting for mandatory maintenance before web startup.
2. Next, compose an isolated restricted-runtime rehearsal for normal startup,
   classification, queue recovery and image-index maintenance. Test forbidden
   schema/role/HBA operations and the remaining privileged adapters before any
   production identity cutover. This establishes actual permission evidence;
   the cost is a broader compatibility matrix for existing non-root deployments.
3. Preserve reviewed legacy-ingestion recovery until every relevant writer can
   be fenced. Automatic takeover must not use record age or shared Plex access
   as proof of ownership. Local Docker and Unraid use separate databases.

The recovery and release-evidence skills kept synthetic rehearsal, local test
deployment and production ownership separate, and required exact-image evidence.
The following documentation-only commit records results without changing the
runtime code tested in the image. Remote CI remains separate from local evidence.
