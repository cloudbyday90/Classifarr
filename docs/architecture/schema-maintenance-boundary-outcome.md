# Schema maintenance/startup boundary: outcome

Date: 2026-09-30. Base revision: `428d23d262ae5f9fcd87f08b03d9b975319b0fd8`.

## Delivered

Implemented the [design](schema-maintenance-boundary-design.md) as modular ESM:
a one-shot schema command, exclusive maintenance session, read-only authority and
ledger checks, and startup ordering before normal services load. Existing embedded
startup remains the default; the entrypoint rejects unsupported external mode.
No production credential migration, automatic legacy adoption or release is added.

The security-hardening review led to an explicit stop between this shared component
and live activation: embedded OS identity, trust authentication and privileged
index/restore paths still need migration. Merely renaming the runtime SQL role
would not establish that boundary.

## Validation

Focused unit tests passed 64 cases in the schema command, application startup and
preflight suites. Focused real-PostgreSQL tests passed 45 cases across schema
maintenance, runtime admission and the existing authenticated-role writer fence.
These include actual fresh-schema initialization, repeat execution, restricted
login after reconnect, elevated attributes, non-inheriting membership, ownership,
missing/pending/future ledger, competing runtime/restore/maintenance sessions and
rollback of a failed migration's DDL and ledger write.

The first integration attempt had one test-fixture error: `verifying` is not a
valid restore-gate state. The fixture now uses the actual `requires_maintenance`
state; the full focused run passed. No production constraint was relaxed.

The entrypoint was also executed from a read-only bind mount in disposable,
network-disabled containers. Both `external` and invalid mode settings exited 1
at the early guard, before PostgreSQL or application startup. No live mounts were
provided. The command's `--help` runs without opening a database.

The ownership review gate tracks six new/changed boundary modules and retains all
490 pre-existing unresolved paths. Passing means reviewed static drift, not that
production writers are all fenced. No threshold or unrelated debt was waived.

Full backend coverage passed **47,384 tests in 1,559 suites** (541.6 seconds).
Frontend coverage passed **5,795 tests in 411 files** (239.1 seconds). An additional
focused run of the startup, schema and affected Compose contracts passed 134 tests
after forwarding the schema-mode environment through Compose.

Server/client lint and type checks, development/production dependency checks,
copyright, Markdown lint, npm flags, ESM static-import/mock-shape checks, the
ownership gate and whitespace checks passed. Coverage is recorded below; no
threshold was lowered.

| Workspace | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Server | 90.21% | 85.08% | 91.88% | 90.21% |
| Client | 86.11% | 78.76% | 85.56% | 88.03% |

## Deployment and resource evaluation

The user requested a local no-cache Compose rebuild after tests. The planned
deployment retains the prior image for rollback and persistent mounts, and leaves
schema mode at the existing `startup` default. No manual library/ownership changes
or maintenance-credential installation are part of that restart.

Before rebuild, container `15ac2c99134d` was healthy, had no reported OOM kill and
cgroup v1 memory failure count 0. Its memory cap was 2 GiB, with no CPU quota or PID
cap. Samples ranged from 345 to 405 MiB and included a short 186% CPU sample followed
by less than 1%. A later PostgreSQL snapshot showed 15 idle client sessions and no
active query. These short samples do not establish peak capacity or exclude every
possible runaway workload. CPU and PID limits remain unchanged.

Post-rebuild observations will be added after deployment.

## PR and next work

Two GitHub MCP searches on September 30 returned no open PRs for this repository.
No random open PR could be selected; no closed PR was substituted or PR merged.

Recommended next component: isolate embedded database/application OS identities
and authentication, with a disposable upgrade/restore/indexing acceptance test.
The pass condition is that normal Node cannot reconnect as bootstrap, access
maintenance secrets, alter PostgreSQL data or modify executable code, while the
platform's maintenance features still work. Then migrate all inventory writers
before permitting confirmation-free legacy recovery. See the design's option
table and ordered recommendation stack for the advantages and remaining costs.
