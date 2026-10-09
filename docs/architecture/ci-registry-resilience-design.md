# CI registry diagnostics and bounded recovery

Date: 2026-10-09. Scope: trusted-main CI image pulls, not application recovery.

## Evidence and decision

The original database job hit an anonymous pull limit. After provisioning the
dedicated pull token, CI run 37992640685 attempt 2 and Resource Capacity run
37992640309 attempts 2–3 failed during login with HTTP 500 or authentication
timeouts. Neither proves invalid credentials or a global Docker outage.

Use a repository-local, dependency-free ESM action with a post-job logout. It
replaces the single-attempt login action in four existing trusted-main jobs.
Keep the same repository/ref/event boundary and read-only secret. PRs and tags
receive no new credentials. Publishing workflows and application safeguards stay
unchanged. This is workflow recovery, not a change to Docker's upstream action.

## Contract

- Before login, collect only booleans for Docker credential configuration and
  HTTP status/timing from two fixed public Docker endpoints. Discard response
  bodies, headers, URLs with account data, config values and child output.
- Configuration is read with a 64 KiB bound. A Testcontainers
  `DOCKER_AUTH_CONFIG` override blocks login instead of silently authenticating
  a different credential source. Probes are diagnostic, not authentication proof.
- One login at a time; at most three attempts, each capped at 30 seconds, with
  10 and 30 second delays. Only transport timeouts/resets and explicit HTTP
  500/502/503/504 failures qualify. Credentials, quota, certificate, malformed
  configuration, oversized output, cancellation and unknown errors stop.
- The PAT goes through stdin, never argv, shell interpolation or child env.
  Capture output privately with a 64 KiB bound and publish only fixed categories.
  SIGINT/SIGTERM cancel waits and active children. No persisted retry budget;
  a new job has a new bounded budget, never an internal unbounded restart.
- Logout is a post-job action even after login/consumer failure. Runner loss can
  prevent cleanup; use ephemeral hosted runners only. There is no anonymous or
  publishing-token fallback, `continue-on-error`, or relaxed receipt gate.
- In the database job, compare a real Docker CLI pull and a forced Testcontainers
  pull of the same pgvector image. Separate child processes bound each pull to
  180 seconds and suppress raw output. Both must succeed before integration tests.
  This verifies registry resolution, not PostgreSQL startup or integration tests.

## Options and recommendation stack

| Option | Advantage | Cost or limitation |
| --- | --- | --- |
| Safe diagnostics + bounded transient retry | Explains failure stage; tolerates brief outages | Small first-party action to maintain; cannot cure an outage or quota |
| Retry every failure | Simple | Hides invalid credentials and amplifies rate limits; rejected |
| Controlled GHCR mirror | Reduces Docker Hub dependency | Image provenance, updates and retention need separate maintenance; deferred |
| Buildx-only auth or publishing PAT | Easy alternative | Does not cover Testcontainers/Compose or grants unnecessary authority; rejected |

Recommended: retain the dedicated finite-expiry read-only PAT, guarded local
action, automatic logout, same-run pull comparison and existing acceptance gates.
Inspect the exact new hosted run before deciding whether a mirror is justified.
GitHub documents a public-image exemption for hosted runners: investigate the
original credential resolution rather than treating all hosted pulls as limited.

## Sources

Discovered/retrieved with MCP web research on 2026-10-09:

- [Docker troubleshooting](https://docs.docker.com/docker-hub/troubleshoot/):
  distinguish quotas, abuse limits and temporary service failures.
- [Docker login](https://docs.docker.com/reference/cli/docker/login/): stdin
  credentials, config storage and credential-helper precedence.
- [Docker maintainer retry discussion](https://github.com/docker/login-action/issues/750#issuecomment-4179229323):
  recovery belongs at the workflow boundary; no supported retry input is assumed.
- [GitHub runner limits](https://docs.github.com/en/enterprise-cloud@latest/actions/reference/limits):
  hosted-runner public-image exemption.
- [GitHub action metadata](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax?learn=create_actions):
  Node actions and post-job cleanup.
- [Testcontainers configuration](https://node.testcontainers.org/configuration/)
  and [image pulls](https://node.testcontainers.org/features/images/):
  credential override precedence and forced pull behavior.

No web UI changes are involved; accessibility standards do not require a UI
refactor for this CI-only work. See the separate outcome document for actual tests.
