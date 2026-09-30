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
ownership gate, coverage ratchet and whitespace checks passed. Coverage is recorded below; no
threshold was lowered.

| Workspace | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Server | 90.21% | 85.08% | 91.88% | 90.21% |
| Client | 86.11% | 78.76% | 85.56% | 88.03% |

## Deployment and resource evaluation

The user requested a local no-cache Compose rebuild after tests. The completed
deployment retains the prior image for rollback and persistent mounts, and leaves
schema mode at the existing `startup` default. No manual library/ownership changes
or maintenance-credential installation are part of that restart.

Before rebuild, container `15ac2c99134d` was healthy, had no reported OOM kill and
cgroup v1 memory failure count 0. Its memory cap was 2 GiB, with no CPU quota or PID
cap. Samples ranged from 345 to 405 MiB and included a short 186% CPU sample followed
by less than 1%. A later PostgreSQL snapshot showed 15 idle client sessions and no
active query. These short samples do not establish peak capacity or exclude every
possible runaway workload. CPU and PID limits remain unchanged.

Built from clean commit `1e068cfaea8dc7b68f520898c2c085798a1ea9af` with
`node scripts/docker-compose-smart.mjs build --no-cache --require-provenance classifarr`.
Recreated only Classifarr using `up -d --no-build --force-recreate --wait` through
the same helper. Running image:
`sha256:44bf74930e6a5e09d4b7c86ee4079eca92b473ad15e42dedf1efc8d6f6854682`.
Rollback image: `classifarr:rollback-schema-boundary-20260930`, retaining
`sha256:d00ebe1ae5878fbfd69f7c27c18530ce847d68ef8a4da1273bcfb2553656ec82`.
No Docker volumes or persistent directories were removed; unrelated containers
were not changed. The final documentation-only commit is not the image revision.

Container `59efef859783` started at 16:30:33 UTC. Over the following five minutes:

- Docker and `/health` reported healthy/database connected; the web page returned
  200 and unauthenticated `/api/libraries` returned 401.
- Restarts, reported OOM kills and cgroup memory failures remained zero.
  Memory samples were 333–392 MiB of 2 GiB; CPU fell from 24.99% during startup to
  roughly 0.4–0.5%. PID/thread samples were 27–37. The later database snapshot had
  four idle clients and no active query. No uncontrolled process growth was seen
  in this short window; CPU/PID quotas remain unset.
- The restore gate was `ready`; the existing bootstrap role still had superuser,
  create-role and bypass-RLS attributes. No credential cutover is claimed.
- **Legacy ownership warnings returned for libraries 4 and 5.** This component
  does not resolve those records. Existing inventory and the review safeguard
  were preserved; no historical owner was fabricated.
- No error-level application events, source-pair-unavailable failures or TMDb
  identity-not-found events appeared in the inspected window. This is not proof
  that intermittent/provider errors are permanently eliminated.
- Three slow-query warnings and one optional startup performance-receipt warning
  appeared. Pool wait was negligible in the first two slow samples; execution was
  approximately 0.92 and 1.37 seconds. The receipt warning has a separate
  [reproduced follow-up](startup-telemetry-lock-scope-follow-up.md).

PostgreSQL performed automatic recovery after reporting an interrupted shutdown,
then reached ready. This was not evidence of a clean database shutdown. Include
ordered Node/PostgreSQL shutdown in the forthcoming embedded cutover rehearsal.

## PR and next work

Two GitHub MCP searches on September 30 returned no open PRs for this repository.
No random open PR could be selected; no closed PR was substituted or PR merged.

The optional telemetry follow-up is now implemented and tested; see its
[outcome](startup-telemetry-lifecycle-outcome.md). It preserves the inventory scope
guard while isolating delayed receipt lifetime.

The [embedded isolation rehearsal](embedded-isolation-rehearsal-outcome.md) now
tests separate identities, denied bootstrap reconnect/file access, fresh startup,
database-tool restore/index handoff and clean shutdown/restart. It does not certify
published upgrades or the full encrypted application restore workflow. Next build
the production supervisor/provisioning component and complete those compatibility
gates, then migrate all inventory writers before confirmation-free legacy recovery.
