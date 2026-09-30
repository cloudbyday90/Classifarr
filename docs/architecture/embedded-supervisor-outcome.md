# Embedded supervisor outcome

Date: 2026-09-30. Implementation base: `434dd775`.

## Delivered

Implemented the [design](embedded-supervisor-design.md) with small ESM modules for
child-process observation, fixed-cluster control and shutdown coordination. The
packaged entrypoint activates supervision after existing bootstrap and privilege
drop. Node stops new HTTP admission promptly and coalesces shutdown signals.
No dependency, schema, role, credential, ownership, routing or version change was
introduced. The security-hardening review kept lifecycle work separate from the
unfinished production privilege boundary.

No existing Compose or Unraid template edit is needed to enable the supervisor
when an image containing it is deployed. The sample sixty-second grace period is
optional host headroom, not a remotely applied configuration or a prerequisite.
An image cannot extend Docker's deadline. Busy databases and stuck applications
can still require crash recovery after forced termination.

## Real container evidence

`npm run test:local:embedded-isolation-drill` passed using isolated production-image
builds, no published ports/provider access, generated project names and owned
synthetic volumes. It did not restart the live installation.

| Scenario | Observed result |
| --- | --- |
| Existing separate-identity rehearsal | Passed; 12.626 seconds, supervisor maximum RSS 93,716 KiB |
| Normal image, UID 1000, ten-second stop | Clean database state; stop plus verification 2.508 seconds |
| Root entrypoint, custom UID/GID 2345, ten-second stop | Clean database state; stop plus verification 2.568 seconds |
| Normal/custom restart | Synthetic committed row preserved; no crash recovery |
| Unexpected Node SIGKILL | Container failed nonzero after clean database shutdown |
| Unexpected database stop | Application drained; container failed nonzero |
| Frozen Node, host ten-second deadline | Container exit 137; restart recovered committed synthetic data through PostgreSQL recovery |

The forced-kill case is explicitly **not** a clean shutdown. Measurements are small
fresh-install checks, not loaded-system latency, total-memory or capacity claims.
All owned test containers, images and scratch volumes were removed after the run;
the disposable synthetic data is not retained. Live data and rollback images were
untouched.

Earlier iterations exposed two test-harness issues: a waiting in-container fault
injector was terminated when the container correctly exited, so injection now
uses non-waiting `pg_ctl` and waits from the host; a root Tini stripped of all
capabilities could not signal its custom-UID child, so that fixture retains
Docker's ordinary root `CAP_KILL`. This does not grant effective capabilities to
the non-root application or alter the production deployment's capability settings.

## Validation

Focused lifecycle, ownership and code-health tests: 30,678 passed across 12 suites.
Real PostgreSQL schema-maintenance, runtime-admission and ingestion-writer-fence
regressions: 45 passed across three suites.

Full backend coverage passed 47,583 tests across 1,565 suites in 545.893 seconds;
frontend coverage passed 5,795 tests across 411 files in 247.35 seconds. Backend
statement/branch/function/line coverage is 90.19/85.12/91.87/90.19%; frontend is
86.11/78.76/85.56/88.03%. Docker child execution is tested outside unit coverage.
The coverage ratchet passed without lowering any baseline. Backend/frontend lint,
types, frontend production build, both backend Knip modes, Markdown, copyright,
ESM checks, npm flag checks and diff whitespace checks passed.

Static ownership review passed with 490 unresolved paths and
`productionCompatible=false` unchanged; a clean drift check is not permission to
activate automatic recovery. Final read-only Docker inspection confirmed the
live image and start time were unchanged, healthy, with zero restarts.

The GitHub MCP open-PR search returned no open pull requests for this repository
on September 30. There was therefore no random open PR to implement; no PR was
merged or silently substituted with a closed one.

## Limits and next component

Production still uses the existing shared PostgreSQL/application identity and
authentication. No historical owner was fabricated, no unknown owner was adopted,
and the unresolved writer-compatibility backlog remains explicit. Interruptions
during the existing bootstrap/major-upgrade shell, published-image upgrades,
encrypted backup/restore and loaded shutdown are not certified by these checks.

Next: implement the **privileged provisioning/maintenance handoff**, with existing
volume upgrade, encrypted restore and custom-UID parity tested in isolation.
Acceptance requires runtime denial of administrator reconnect/file access and
successful maintenance only after runtime exit, without a new deployment-template
requirement. Complete writer capability migration before enabling automatic
legacy ownership recovery. Do not activate partial privilege separation or weaken
the unknown-owner safeguard to make that recovery appear complete.
