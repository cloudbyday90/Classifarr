# Published Digest Consumer Smoke Acceptance

Status: implemented release-consumer acceptance tooling. Its release-specific
execution remains intentionally pending until a release candidate version,
source revision, and published digest are selected.

## Objective

10R.4.2 establishes an independent consumer check for a released Classifarr
container image. It verifies the exact immutable image the consumer will run,
then starts that image through an isolated Compose project and records only
bounded release evidence.

This is not a source-build test, an installation upgrade test, an active
installation approval, or compatibility-removal evidence. It is one limited
release gate.

## Research

GitHub documents consumer verification of container attestations with
`gh attestation verify` and an `oci://` fully-qualified image reference. An
attestation links the image to build provenance, but does not itself prove the
software is safe; the consumer must apply expected repository, workflow, and
source policies. [GitHub artifact attestation verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
and [artifact-attestation concepts](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
support that model.

Docker Compose supports immutable `image@sha256:...` references, and
`pull_policy: always` forces the image pull rather than accepting an unrelated
local build. Compose documents `--project-name` as the explicit namespace for
created resources, allowing this check to use a unique project rather than an
existing installation. [Compose service image and pull policy](https://docs.docker.com/reference/compose-file/services/)
and [Compose project names](https://docs.docker.com/reference/cli/docker/compose/)
support those controls. Compose's `config --quiet` validates the resolved
service model before it is started. [Compose config](https://docs.docker.com/reference/cli/docker/compose/config/)

## Options

### Reuse the installation Compose file

Pros:

- Uses the familiar deployment file.
- Requires little new automation.

Cons:

- Mounts the installation data directory and configured media path.
- Uses the installation's fixed host port and container name.
- Could alter or inspect an existing installation, so it cannot be a safe
  release-consumer check.

### Use a direct `docker run` command

Pros:

- Small command surface.
- Straightforward temporary container cleanup.

Cons:

- Does not exercise the supported Compose service settings.
- Duplicates the production security and health settings in shell arguments.

### Use a separate, digest-only Compose project

Pros:

- Exercises a Compose deployment while isolating resources by project name.
- Uses a disposable project-scoped named volume, no host ports, no media mount,
  no fixed container name, and no source-build fallback.
- Allows deterministic validation of the Compose security boundary in CI.

Cons:

- Adds a small Compose file and runner to maintain.
- Requires authenticated registry and GitHub CLI access when executed against a
  real published release.

## Final Recommendation Stack

1. Accept only `ghcr.io/cloudbyday90/classifarr@sha256:...` or
   `docker.io/cloudbyday90/classifarr@sha256:...`; reject tags and other image
   repositories before calling Docker.
2. Verify the selected digest with `gh attestation verify`, requiring the
   Classifarr repository, the pinned CI signer workflow, the selected full
   source revision, GitHub-hosted execution, and no public-good fallback.
3. Validate `docker-compose.release-smoke.yml`, then start it with a unique
   explicit Compose project name, `--pull always`, `--no-build`, `--wait`, and
   a bounded 30-300 second wait timeout.
4. Check `/health` and `/api/system/health/ready` from inside the service. The
   latter confirms the embedded database is ready after startup migrations;
   responses are discarded rather than recorded.
5. Tear down the project and its named volume on both success and failure.
6. Write a versioned JSON evidence file only after all checks and cleanup pass.
   It contains the immutable image, source revision, signer identity, timestamp,
   and check states. It never contains configuration, secrets, titles, policies,
   provider output, raw health responses, or container logs.

## Implementation

`scripts/lib/publishedDigestConsumerSmoke.mjs` owns input validation, bounded
command construction, the fail-closed lifecycle, and the redacted evidence
shape. `scripts/run-published-digest-consumer-smoke.mjs` is the CLI wrapper;
it accepts no arbitrary output path and writes evidence only under
`.tmp/release-consumer-smoke/` with owner-only file permissions.

`docker-compose.release-smoke.yml` starts a fresh Classifarr instance with a
project-scoped named volume. It does not declare `build`, `ports`, media mounts,
an external network, a fixed container name, or a restart policy. The entrypoint
starts as root only to initialize the disposable volume and then drops to the
configured Classifarr user, matching the image's designed lifecycle. Its runtime
filesystem remains read-only, capabilities stay limited, and temporary runtime
paths are mounted as no-exec tmpfs volumes.

`server/src/scripts/checkPublishedDigestConsumerSmokeCompose.mjs` is a CI guard
that rejects drift in these constraints. Unit coverage proves digest allowlisting,
consumer attestation verification, no-build Compose startup, readiness checks,
and teardown after a health failure.

## Release Execution

After the release candidate is published and attested, run:

```powershell
npm run release:smoke:published-digest -- `
  --image ghcr.io/cloudbyday90/classifarr@sha256:<published-digest> `
  --source-revision <full-release-commit-sha>
```

The operator must authenticate Docker to the selected registry when required and
must authenticate `gh` with permission to read the public attestation. The
command prints only the evidence path; it does not print the health response or
container logs. A successful execution produces the release-specific evidence
required before availability is communicated.

No such command has been executed in this implementation change because there
is not yet a selected release candidate. Unit tests and Docker Compose
configuration validation cover the command's deterministic behavior without
claiming release evidence that does not exist.

## Completion Criteria

The tooling is complete when it rejects a mutable or foreign image reference,
fails before Compose on an attestation mismatch, runs only a verified digest in
an isolated project, checks application and database readiness within a bounded
window, removes the project-scoped resources, and emits redacted success
evidence. Those conditions are implemented and covered by CI contract checks.

The release-specific acceptance completes only when the selected published
digest has successfully passed this command and its evidence is retained with
the release record.

## Next Task

**10R.4.3 Release Candidate Publication And Evidence Recording** is next. It
requires an intentional version and source-revision selection, tag publication,
successful provenance verification, this consumer smoke execution against the
published digest, and retention of the resulting release evidence before release
availability is communicated.
