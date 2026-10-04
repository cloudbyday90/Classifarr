# Restricted-runtime classification rehearsal

Reviewed 2026-10-04. This extends the existing embedded isolation drill; it does
not change production identities, saved templates or ingestion ownership.

## Contract

The current drill proves startup and maintenance boundaries but does not prove
that a restricted application can persist useful classification decisions. Add
two synthetic source-library decisions (movie and TV) to the real normal runtime,
then verify their exact results after shutdown, database restart and dump/restore.
The application uses the existing `cf_runtime` non-owner login, external schema
mode and peer authentication. Real bootstrap, services and persistence remain
enabled. The fixture calls the classification service in that application process;
it is not a public classification HTTP or external-provider acceptance test.

An empty scratch database is required. No media server, provider credential or
external network is supplied. Optional embeddings remain disabled. The fixed
source-library path supplies complete synthetic metadata and must produce exactly
two completed decisions, the intended libraries and no downstream route. Reading
results must never replay classification. Unknown or duplicate results fail.

The runner retains one application process, a five-connection application pool,
2 GiB memory, two CPUs, 128 PIDs, read-only image and disposable named volumes.
Verification polls within 30 seconds, uses bounded SQL/connection timeouts, and
does not retry writes. Abnormal exit or timeout fails; the parent joins the web
process before stopping PostgreSQL. Interrupted fixtures are discarded, not
recovered against application data. No new automatic service runs on installations.

The existing role/schema/HBA denials, queue-budget handoff, index maintenance,
restore exclusion and compatibility profiles remain required. Ordinary table DML
in this rehearsal is intentionally broader than a future execute-only ingestion
gateway. Passing it is not proof of complete production privilege separation.

Add an optional immutable local image ID to the existing launcher. Validate the
image before mutation, create only collision-checked random-project aliases, run
without building or pulling, and remove only those aliases and owned resources.
Never delete the caller's image ID. The default source-build mode remains available.

Run `node scripts/run-embedded-isolation-drill.mjs --image sha256:<64 hex digits>`
after building. A mutable tag, missing image or untagged image is rejected before
mutation; the caller's existing tag must remain available throughout the run.
Without arguments the existing launcher builds from the checkout instead.

## Alternatives and recommendation

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Health checks only | Fast | Does not prove classification writes work |
| Extend the restricted drill (chosen) | Real process, SQL and restart evidence | Synthetic source-library path only |
| Production identity cutover now | Immediate separation | Unproven existing-template and privileged-adapter coverage |

Recommendation stack: prove restricted classification now; next extend authenticated
request/policy routing and remaining privileged adapters; only then propose a
production identity migration with explicit compatibility and rollback evidence.
Legacy ownership recovery remains separately reviewed and fenced. Sharing Plex
does not share ownership when local and Unraid databases are separate.

## Official sources

Sources discovered through web search and retrieved 2026-10-04:

- [PostgreSQL peer authentication](https://www.postgresql.org/docs/18/auth-peer.html):
  map kernel-established OS identities, not an application-supplied administrator name.
- [PostgreSQL HBA rules](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html):
  first-match rules and explicit rejection prevent an unintended fallback.
- [PostgreSQL privileges](https://www.postgresql.org/docs/current/ddl-priv.html):
  object ownership and ordinary DML are different; test forbidden owner operations.
- [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html):
  any future privileged gateway needs a trusted search path and selective EXECUTE grants.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  specify independent resource bounds instead of relying on Docker defaults.
- [Node.js child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  fixed executable/argument arrays, no shell and bounded child lifetime.

No browser contract changes; no new W3C accessibility conformance is claimed.
Implementation results belong in the separate outcome document.
