# Native Intent Reconciliation Runtime Provenance

Status: implemented on 2026-07-16 as Task 8R.3.2.8 of the policy-builder
intent-model roadmap.

## Problem

The reconciliation ledger already retained a bounded failure stage, reason,
category, and correlation ID. That was enough to describe the failure class,
but not enough to determine whether the running service contained the source
revision that was expected to handle it. A stale container can therefore look
like a current-source regression.

Runtime provenance must improve support evidence without making the container,
Docker daemon, environment, or mutable image tag a policy dependency.

## Official-Source Research

- [Docker Compose production guidance](https://docs.docker.com/compose/how-tos/production/)
  requires rebuilding and recreating a changed service for deployed code to
  take effect. Application code cannot safely assume a source checkout and a
  running image are the same build.
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
  explains that tags are mutable and that `--no-cache` rebuilds every Dockerfile
  layer. A mutable tag is not adequate failed-run provenance.
- [Docker image digests](https://docs.docker.com/dhi/core-concepts/digests/)
  distinguishes immutable digest identity from mutable tags. The application
  should not attempt to discover image metadata through a Docker socket; CI
  should provide an immutable source revision at build time instead.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends useful, protected event data and warns against both sensitive
  disclosure and alarm fog. Provenance needs a fixed allowlist, not arbitrary
  environment capture.

## Options

1. Keep only the existing failure correlation ID and contract version.
   - Pros: no schema change.
   - Cons: cannot distinguish stale deployment from current-source failure.
2. Persist arbitrary image tags, container IDs, labels, or environment values.
   - Pros: may expose more deployment detail.
   - Cons: tags are mutable; container metadata can be absent or sensitive;
     Docker socket access expands the runtime trust boundary.
3. Persist a normalized release version and CI-provided Git revision with every
   reconciliation run.
   - Pros: bounded, release-correlated, works without Docker access, and is
     available in the existing read-only status model.
   - Cons: local builds without an explicit revision remain `unknown`; the
     evidence diagnoses a stale build but does not update it automatically.

## Decision

Use option 3.

`nativeIntentReconciliationRuntimeProvenance.mjs` accepts only:

- a release-shaped application version, maximum 80 characters; and
- a 7-to-64 character hexadecimal Git revision.

The module ignores image tags, digests, container IDs, arbitrary environment
keys, exception text, and labels. Invalid input becomes `unknown` for the app
version and `null` for the revision. Existing ledger rows receive the explicit
historical `unknown` value through the migration default rather than a guessed
value.

The Docker release job passes `github.sha` as `VCS_REF`. The production image
exposes that value as `CLASSIFARR_BUILD_REVISION` and OCI revision metadata.
The running Node process uses only the bounded environment value; it does not
inspect Docker or query the host.

## Security And Operational Boundaries

- Reconciliation run rows retain only `runtime_app_version` and optional
  `runtime_build_revision` under database check constraints.
- The service normalizes provenance again before returning it, persisting it,
  or logging it. A malformed test double or database row cannot reach the
  administrator status response.
- The administrator status page remains read-only. It displays the latest
  run's runtime evidence but adds no conversion, retry, rebuild, or update
  action.
- A version mismatch remains a deployment operation: rebuild and recreate the
  Compose service using the deployment process. The application must not use a
  Docker socket or self-update its image.

## Final Recommendation Stack

1. Build a release image with a CI-supplied immutable Git revision.
2. Persist only normalized release version and revision beside each bounded
   reconciliation run.
3. Return that same normalized provenance through the existing administrator
   status contract.
4. Use a rebuild-and-recreate deployment when source and running build differ.
5. Keep deployment internals, raw environment values, image tags, and container
   control outside the application and policy engine.

## Verification

- Focused contract tests prove valid values are retained, revisions normalize
  to lowercase, and arbitrary environment or image metadata cannot escape.
- Ledger tests prove the bounded values are inserted with the run header.
- Status tests prove historical rows are safe and malformed database fields are
  reduced to `unknown`/`null`.
- The Docker-backed schema snapshot applies the migration to a fresh database
  and verifies `current.sql` against the authoritative container path.
