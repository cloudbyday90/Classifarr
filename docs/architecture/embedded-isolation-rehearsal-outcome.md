# Embedded isolation rehearsal outcome

Date: 2026-09-30. Base revision: `035bb06e`.

## Delivered and observed

Implemented the [rehearsal design](embedded-isolation-rehearsal-design.md) with
modular ESM: an isolated Compose launcher, environment/authentication contract,
process lifecycle helpers, runtime and maintenance probes, and a bounded driver.
The live installation, credentials, historical ownership and deployment defaults
remain unchanged. No release or production privilege cutover is part of this work.

Initial Docker runs passed the real schema command twice, restricted-role negative
checks, actual fresh app startup, unauthenticated API denial, maintenance exclusion,
Node SIGTERM, dump/restore, the real image-index worker, clean PostgreSQL shutdown,
restart and readmission. The second run also verified the restored database using
the restricted login and checked the container mount/network layout. It completed
in 12.76 seconds, excluding image build/cleanup. The supervisor's maximum RSS was
93,596 KiB; this is not total container memory or a workload capacity measurement.

Each completed launcher removed only its own test image, container and two scratch
volumes. Those synthetic databases are not retained. Live data and rollback images
were untouched.

## Validation record

Targeted unit tests cover project collisions, inventory/config/build/run/cleanup
failures, isolated environment guards, timeout and abnormal process exits, startup
failure, unexpected successful maintenance admission, restore/index failure,
unclean database state and authentication bypass. One initial test used Jest's
property replacement on the read-only `process.platform` field; it was corrected
to restore its original property descriptor. No production behavior was relaxed.

The final expanded Docker run passed in 12.542 seconds (excluding build/cleanup),
with supervisor maximum RSS 96,020 KiB. It includes standalone probe-environment
guards, restricted-role verification of the restored database and zero persisted
startup ERROR records. This third run again cleaned only its generated resources.

Focused unit/code-health/ownership checks passed 30,492 tests across four suites,
including 40 new targeted cases. Real PostgreSQL schema maintenance, runtime
admission and writer-fence regression checks passed 45 tests across three suites.
The seven new source-review dependencies are pinned; all 490 previously unresolved
writer paths remain unresolved and `productionCompatible` remains false.

Full backend coverage passed **47,483 tests in 1,562 suites** (549.67 seconds).
Frontend coverage passed **5,795 tests in 411 files** (258.35 seconds). Server/client
lint, type checks, frontend build, both dependency checks, copyright, Markdown,
ESM import/mock-shape, npm flag, ownership and whitespace checks passed. The
coverage ratchet passed without baseline changes.

| Workspace | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Backend | 90.19% | 85.11% | 91.87% | 90.19% |
| Frontend | 86.11% | 78.76% | 85.56% | 88.03% |

The environment/authentication contract has 100% unit coverage; the driver has
94.16% statement and 97.29% branch coverage. The real child probes run in Docker,
outside the unit coverage collector. They are not excluded to inflate coverage.

A final read-only Docker check confirmed the live image remained
`sha256:44bf74930e6a5e09d4b7c86ee4079eca92b473ad15e42dedf1efc8d6f6854682`,
healthy with zero restarts and unchanged start time (16:30:33 UTC). This round
does not claim that the live ownership warnings have disappeared.

## Limits and next work

This verifies a disposable embedded candidate, not a published-image upgrade,
configured-library workload, encrypted application restore or full inventory
capability migration. The bootstrap administrator still exists behind a different
OS identity. Runtime retains broad ordinary DML; automatic legacy adoption remains
unsafe and disabled. The supervisor is a test driver, not the production PID-1
lifecycle implementation. Its internal Node SIGTERM test does not certify the
ordinary image's container-stop behavior.

Two GitHub MCP searches on September 30 returned no open PRs for this repository. There
was no random open PR to implement; no closed PR was substituted or PR merged.

Next: turn the proven boundaries into an opt-in embedded supervisor/provisioning
component, then exercise supported upgrades, custom UIDs and complete maintenance
workflows. Do not broaden live privileges just to make a failing feature pass.
