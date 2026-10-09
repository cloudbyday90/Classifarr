# CI registry resilience outcome

Date: 2026-10-09. Baseline: clean main `3f9cf9e0a16fc4912a2565c0bf938618a3ebac22`.
See the [design and official-source review](ci-registry-resilience-design.md).

## Implemented

Four trusted-main consumers now use a dependency-free local ESM action with
bounded transient retries, safe config/connectivity summaries and post-job logout.
The database job compares real Docker CLI and Testcontainers pulls before tests.
Quotas, bad credentials, TLS failures, unknown errors and exhausted budgets stay
blocking. Publishing secrets, PR exposure, application memory limits and existing
installation/receipt gates are unchanged.

## Verification

- Seven targeted registry, workflow, installation and diagnostic suites:
  **337 tests passed**. Real subprocess tests cover stdin-only credentials,
  stripped child secret environment, bounded output, timeout, cancellation,
  launch failure and nonzero action-CLI errors. Workflow mutations reject removal
  of post-job logout, widened event scope and masked pull-comparison failures.
- Actual local Docker CLI and forced Testcontainers pulls both succeeded for
  `pgvector/pgvector:0.8.7-pg18`. No containers or database writes are used by this
  comparison. This is not proof of hosted credential validity.
- Runtime-installation workflow validator, scoped ESLint, backend typecheck,
  both Knip modes, tooling tests, copyright and Markdown checks passed.
- [Random PR 555](pr-555-node-types-outcome.md) was implemented and tested locally,
  then restored because Node 26 declarations conflict with the Node 24 runtime.

## Local image and database verification

The initial no-cache build succeeded from a dirty worktree and correctly used
`VCS_REF=unknown`; it was not installed or used as maintenance evidence.
After committing, a second no-cache build with `--require-provenance` used clean
source `b7679b290422d91ced383c43b7138fbd433f9378`.

- Docker's inspected local image ID:
  `sha256:2a9a022f87712a67bdc8563a319df4a38d1c4ebf65d3971d615d094f40959f8b`.
  The build's config digest is distinct:
  `sha256:5be0643e7da89480d9e8c04662d4fe577dcce1a7ddb4d36cdeabd5ef96bf0969`.
  Neither is claimed as a published, signed release identity.
- Recreated only the local `classifarr` service with its existing Compose files
  and mounts, without rebuilding during replacement. Docker reports healthy and
  the source label matches the code commit. A short observation was about
  356 MiB / 2 GiB; this is not a sustained memory study.
- Ran the existing isolated schema-container `--dump` path using the inspected
  image ID: successful startup, schema dump and owned-resource cleanup. The
  generated schema is byte-for-byte unchanged in Git. No live database dump.
  An initial attempt with the config digest could not create a container; it
  left no test container and was corrected to the actual inspected image ID.

## Hosted progress

For code commit `b7679b29`, [CI run 37996797010](https://github.com/cloudbyday90/Classifarr/actions/runs/37996797010)
passed trusted authentication in the database and installation jobs, and the
Docker CLI/Testcontainers same-image comparison passed. Database tests started.
[Resource run 37996796737](https://github.com/cloudbyday90/Classifarr/actions/runs/37996796737)
also passed authentication and started its resource gate. These observations
do not yet claim whole-job success or post-job cleanup. OSV, Trivy, Gitleaks and
copyright workflows passed; the other jobs were still running at this checkpoint.

## Limits and next check

Remote login success above comes from that exact hosted run, not local tests.
Inspect test completion and post-job logout separately before claiming full CI.
The recovery skill drove explicit failure categories and bounded retries; the
release-evidence skill kept receipt gates and evidence identities intact.

No release, image publication, PR merge, Unraid mutation or shared Ollama change.
Next: use the hosted diagnostics to locate any remaining daemon/network or
credential-resolution failure before introducing a registry mirror.
The separate [Unraid investigation](unraid-stop-investigation-outcome.md) found
an internal database-probe timeout followed by supervised shutdown; diagnosing
that probe's latency is the next production-runtime priority.
