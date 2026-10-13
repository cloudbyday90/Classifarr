# Local Docker rebuild rollback protection

Date: 2026-10-13. Scope: local source rebuilds, not release publication.

## Problem and decision

The preceding OMDb rebuild replaced a mutable tag before preserving the image
used by the running container. Docker could then no longer inspect that exact
image ID. An older retained image was available, but was not an exact rollback.

Extend smart Compose with an explicit `--protect-running-image` mode for one
selected service. Enable it in both rebuild npm commands. Preserve the existing
container's exact image before building, verify it again after building and before
replacement, and never stop the old container merely to start a build.

## Official research

Sources discovered and read through MCP on 2026-10-13:

- Docker's [image tag reference](https://docs.docker.com/reference/cli/docker/image/tag/)
  supports creating a second reference directly from an image ID. The design uses
  the container's actual image ID, not its configured mutable image name.
- Docker's [image listing reference](https://docs.docker.com/reference/cli/docker/image/ls/)
  explains that rebuilding can move a tag away from its old image and that multiple
  tags do not duplicate an image's storage. A retained tag is cheap but is still
  mutable; verification, not its name alone, establishes the expected identity.
- Docker's [Compose ps reference](https://docs.docker.com/reference/cli/docker/compose/ps/)
  scopes discovery to a project and supports stopped containers, full IDs and
  exclusion of orphaned services. Discovery must not depend on a global container
  name such as `classifarr`.
- Docker's [Compose service reference](https://docs.docker.com/reference/compose-file/services/)
  defines the project/service labels used to cross-check the selected container.
- Docker's [Compose up reference](https://docs.docker.com/reference/cli/docker/compose/up/)
  documents recreation, `--no-build`, `--no-deps`, `--pull never` and `--wait`.
  Separate build and replacement steps permit a verification between them.

These are local image checks, not registry digest verification, signed provenance
or proof that an old application can safely open an upgraded database.

## Options and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Save the image after building | No new workflow | Too late if the old image reference is lost | Reject |
| Commit the running container | Captures a runnable filesystem | Captures runtime changes and potentially sensitive configuration; not the original image | Reject |
| Export every image to an archive | Independent copy outside Docker | More disk and time; separate restore verification needed | Defer |
| Retain and verify an exact local image reference before build | Small, deterministic, no app/data mutation | Docker administrators can remove or retag it; disk retention remains manual | Select |

Recommended stack: clean source provenance, pre-build exact-image retention,
post-build and pre-replacement checks, separate consistent data backup, isolated
candidate evaluation, then scoped replacement and health evaluation. Keep existing
memory, permissions and authentication safeguards unchanged.

## Contract

- Protection is opt-in for the general wrapper and enabled by the rebuild aliases.
  It accepts only a single explicit service and a conservative set of build/up
  options. Combined build-and-up is refused: use build, then up with `--no-build`,
  `--no-deps` and `--pull never`. Unprotected development commands remain available
  but do not carry this guarantee.
- Resolve the same Compose files, project and environment for discovery and action.
  Read the resolved model internally; never emit its environment/configuration.
  Verify the service exists and compare project/service labels on the full-ID
  container. Multiple instances, one-off containers and transitional states fail
  closed. Running, exited and created containers can be protected.
- Use `classifarr-local-rollback:<full-container-id>` as the retained reference.
  Never overwrite an existing conflicting reference. Inspect both source ID and
  retained tag for exact equality; do not substitute a child manifest, config hash,
  revision label or an older image.
- Build can create the reference; replacement only verifies it and cannot create
  missing evidence after the fact. A missing source image, failed discovery, wrong
  tag, failed command or identity change stops the requested action. Recheck after
  a successful build. Failure leaves retained images and the existing container
  alone; no automatic rollback, pruning, release or image push occurs.
- No existing service container means a first installation, explicitly reported as
  having no rollback image. Recheck that discovery remains unchanged before action.
  Do not run Compose down between the steps: removing the container discards the
  identity used by this check. Keep the same project/files/service on both commands.
- Use bounded metadata commands and sanitized failures. Dry-run makes no Docker
  changes. Concurrent administrator Docker operations are outside the guarantee:
  checks detect observed drift but Docker has no atomic compare-and-recreate API.
  Run the workflow exclusively; retained tags are not immutable or backups.

## Verification plan

Injected-command tests cover identity, labels, missing/ambiguous evidence, failures,
idempotent retention, drift, stopped/fresh installs, argument rejection, dry-run,
and refusal before the actual build/up call. Exercise the real CLI and Docker on
owned disposable fixtures, including mutable tag replacement and rejection of a
wrong rollback tag. Do not inject failures into live appdata. Verify fixture cleanup.
Then rebuild the local application without cache, retaining its exact current image
first, perform backup and candidate checks, and verify health/security after scoped
replacement. Record actual results separately in an outcome document.

## Operator workflow

For the repository's default Compose project, use
`npm run docker:smart:provenance-rebuild` after making a consistent backup. For a
custom overlay, keep the same files and project on both commands; for example:

```powershell
node scripts/docker-compose-smart.mjs -f docker-compose.yml -f local-overlay.yml build --no-cache --require-provenance --protect-running-image classifarr
# Evaluate the built image and verify the separate data backup before replacement.
node scripts/docker-compose-smart.mjs -f docker-compose.yml -f local-overlay.yml up -d --no-build --no-deps --pull never --force-recreate --wait --protect-running-image classifarr
```

The wrapper prints the exact retained tag and image ID. Keep that record with the
backup and deployment notes. It never removes retained tags; clean them up only
after deciding their rollback is no longer needed. `--dry-run` validates arguments
but does not verify Docker state or create a retained image.

If protection fails, leave the old container in place. Confirm Docker is available,
the selected Compose files/project/service are correct, and the printed error:

- `rollback_reference_conflict` or `rollback_image_mismatch`: a retained tag points
  to another image; investigate before any tag changes or container replacement.
- `rollback_container_changed` or `rollback_ambiguous_container`: another operation
  changed the service or more than one instance exists. Stop concurrent rebuilds
  and inspect the selected project; do not delete containers to bypass this check.
- `rollback_docker_command_failed`: a bounded Docker read/tag command failed,
  including unavailable source images or missing pre-build tags. Inspect the
  selected container's `.Image` and use `docker image inspect` for that exact ID
  and the retained tag. Do not substitute an older image silently.

This workflow does not automate database restore or downgrade. Do not start an old
image against a migrated database without separately verified compatibility or a
reviewed restore procedure. The synthetic rehearsal can be rerun with
`node scripts/verify-local-docker-rollback.mjs`; it creates no application data and
does not start its deliberately non-runnable synthetic image.

No open GitHub PRs were available at initial enumeration. Recheck before handoff.
Per the user's direction, release preparation follows this work unless a clear bug
or major blocker is found; additional optimizations are deferred.
