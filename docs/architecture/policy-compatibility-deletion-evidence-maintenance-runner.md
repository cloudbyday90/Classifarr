# Policy Compatibility Deletion Evidence Maintenance Runner

## Intent

The compatibility-deletion evidence generator needs current database access, a
reviewed source checkout, and a safe way to reach the embedded PostgreSQL
instance. The production application image deliberately does not include the
source-tree command entry points, and host PostgreSQL access is deliberately
not exposed. Copying unreviewed source into the application container or
mounting the Docker socket into the application would weaken both boundaries.

This component introduces a noninteractive maintenance runner that creates only
a current, read-only execution-plan evidence bundle. It never approves a
manifest, deletes a path, changes policy storage, runs an application endpoint,
or bypasses the later execution gate.

## Official-Source Research

- Docker documents `docker run` controls for read-only root filesystems,
  dropped capabilities, `no-new-privileges`, temporary filesystems, bind mounts,
  network selection, and automatic container removal. The runner uses those
  controls to create a short-lived helper with one read-only source mount and
  one narrowly writable evidence-output mount.
- Docker networking documents `container:<name>` network mode. The helper uses
  the existing application network namespace only so it can reach the embedded
  database listener on `localhost`; it does not receive the application data
  volume or Docker socket.
- PostgreSQL documents `default_transaction_read_only` as a client connection
  default. `PGOPTIONS` sets it for the helper connection, while the generator
  continues to use the existing read-only data-loading contracts.
- OWASP recommends allowlist input validation before processing. The command
  accepts only explicit options, a reviewed checkout path, a new `.json` output
  under `.tmp`, a running container, and an exact immutable image revision.

Sources:

- [Docker `container run` reference](https://docs.docker.com/reference/cli/docker/container/run/)
- [Docker networking overview](https://docs.docker.com/engine/network/)
- [PostgreSQL client connection defaults](https://www.postgresql.org/docs/current/runtime-config-client.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

## Options Considered

### Run The Generator In The Application Container

Pros:

- reaches the embedded database without additional networking.

Cons:

- breaks the production-image and source-checkout boundary,
- risks production runtime drift and writable application state,
- makes it easier to conflate maintenance collection with application behavior.

Decision: rejected.

### Expose PostgreSQL To The Host

Pros:

- lets host tooling connect directly.

Cons:

- expands the database network attack surface,
- requires durable connection credentials outside the container boundary,
- is unnecessary for a maintenance-only operation.

Decision: rejected.

### Run A Provenance-Bound, Read-Only Helper

Pros:

- uses the existing embedded database listener without publishing it,
- retains a reviewed source checkout and exact immutable image identity,
- mounts source read-only, writes only the requested evidence file under `.tmp`,
- drops Linux capabilities, prevents privilege escalation, uses a read-only
  root filesystem, and bounds memory, process count, and statement time,
- preserves an unattended `0` ready, `1` blocked, `2` failure contract.

Cons:

- custom/local images without a full OCI revision label intentionally block,
- requires Docker access from the maintenance host,
- cannot and should not collect approval, backup/restore, or deletion evidence.

Decision: selected.

## Final Recommendation Stack

1. Require a clean reviewed checkout and resolve its full Git revision.
2. Inspect the explicitly named running container and require a numeric
   non-root-or-rootless-compatible container user plus an immutable image ID.
3. Require the image's `org.opencontainers.image.revision` label to be a full
   revision exactly matching the reviewed checkout before creating the helper.
4. Start one ephemeral helper in the application container's network namespace
   with no Docker socket, no application-data mount, a read-only source mount,
   and a single writable `.tmp` output directory.
5. Require PostgreSQL read-only default transactions and bounded connection and
   statement limits.
6. Treat a blocked or failed evidence bundle as a diagnostic outcome only. A
   ready evidence bundle still proceeds through the existing execution-plan and
   named-actor approval gates before any controlled removal can occur.

## Operational Contract

The public command is:

```powershell
npm run policy:compatibility-deletion-maintenance-evidence -- `
  --container classifarr `
  --input .tmp/policy-storage/reviewed-evidence-input.json `
  --output .tmp/policy-storage/current-execution-plan-evidence.json
```

Input and output must remain inside the reviewed checkout. Output must be a new
`.json` file below `.tmp`. The command does not accept a free-form image,
database URL, shell command, source root, output directory, timestamp, or
approval flag.

The GitHub image build already passes `VCS_REF=${{ github.sha }}`. A custom or
local image with an `unknown` revision is intentionally blocked before the
runner starts a helper or reaches the database. Build a reviewed local image
with the exact checkout revision when maintenance evidence is needed:

```powershell
$revision = git rev-parse HEAD
docker compose build --build-arg "VCS_REF=$revision" classifarr
docker compose up -d --no-deps classifarr
```

Exit outcomes:

| Exit | Status | Meaning |
| --- | --- | --- |
| `0` | `ready` | A valid evidence bundle was collected and is ready for later planning. |
| `1` | `blocked_by_worktree`, `blocked_by_image_provenance`, or `blocked_by_evidence` | Safe preconditions or readiness were not met. No approval or deletion occurred. |
| `2` | `failed` | Input, environment verification, helper execution, or output validation failed. |

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionEvidenceMaintenanceRunner.mjs` as the injected
  ESM orchestration boundary and a thin public CLI entry point.
- Strict allowlist argument parsing and reviewed input/output path validation.
- Clean-worktree, exact revision-label, running-container, image-ID, and
  container-user verification before helper execution.
- A short-lived helper with `--read-only`, dropped capabilities,
  `no-new-privileges`, a bounded `/tmp`, restricted resources, and no image
  pull.
- Source mounted read-only and a newly prepared `.tmp` output directory mounted
  as the helper's only writable repository path.
- Read-only PostgreSQL defaults plus bounded pool, connection retry, and
  statement-timeout settings.
- Focused tests for ready, blocked, dirty-checkout, failed-Git-status,
  provenance-mismatch, invalid-output, and inconsistent-helper outcomes.

Not implemented:

- no Docker socket access,
- no application-container execution,
- no database write or schema change,
- no manifest approval or named-actor confirmation,
- no compatibility-path deletion, Git mutation, or restart automation.

## Next Step

Proceed with **8R.16.2: Preflight Evidence Collection Boundary**. It should
collect only machine-verifiable execution-gate preflight state, preserve the
same provenance and read-only containment model, and leave backup/restore
attestation plus named-actor approval as explicit, separate gate inputs.
