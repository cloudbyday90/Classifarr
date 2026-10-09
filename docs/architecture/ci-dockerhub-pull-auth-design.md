# Docker Hub CI pull authentication design

Date: 2026-10-09. Scope: trusted main-branch test jobs, not image publishing.

## Problem and decision

The database job in [CI run 37990799264](https://github.com/cloudbyday90/Classifarr/actions/runs/37990799264)
failed before its integration suites: Testcontainers could not pull
`pgvector/pgvector:0.8.7-pg18` because Docker Hub's anonymous pull allowance was
exhausted. The simultaneous installation/resource failures did not expose the
same underlying error; they remain unconfirmed, not attributed by association.

Use a dedicated Docker Hub pull-only PAT, stored as the repository Actions
secret `DOCKERHUB_PULL_TOKEN`, paired with the existing `DOCKERHUB_USERNAME`.
Do not reuse or fall back to the publishing secret `DOCKERHUB_TOKEN`.

## Trust and execution boundary

Authentication requires all three conditions:

- Repository is `cloudbyday90/Classifarr`.
- Ref is exactly `refs/heads/main`.
- Event is `push` or `workflow_dispatch`.

Both same-repository and fork PRs, other branches and tag runs skip the new
login. Existing release publishing credentials, permissions and approval gates
are unchanged. Extending authentication to tag-only release acceptance requires
a separately reviewed trust decision; this change does not fix that exposure.

The four consumers are Build and Test, Tests with Database, Fresh Install and
Published Upgrade, and Queued Work Recovery and Resource Safety. Each logs in
immediately before its first image-consuming step with the already-used
`docker/login-action` v4 commit `dbcb813823bdd20940b903addbd779551569679f`.
The action's post-job logout is explicitly enabled. No shell interpolation,
job-wide secret environment, credential artifact, extra GitHub permission,
self-hosted runner or pre-job Docker service is introduced.

The login is deliberately required on trusted main. Missing credentials fail
the named authentication step; rejected or expired tokens fail login. Neither
case silently returns to anonymous pulls or the publishing token. Tests and
receipts remain blocked when prerequisites fail. GitHub-hosted runner credentials,
when supplied by the platform, are left untouched on skipped PR/tag paths.

These are job-local Docker credentials, not Buildx-only scoped credentials:
Testcontainers, Compose and the Docker CLI must all see the same authentication.
The action cannot prove that a stored PAT is read-only; the maintainer must
select and verify that permission in Docker's token settings.

## Options and recommendation

| Option | Benefit | Cost or limit |
| --- | --- | --- |
| Dedicated pull-only PAT | Separately revocable; no publishing authority in tests | Requires secure setup and rotation; account rate limits still apply |
| Reuse publishing PAT | No additional secret | Unnecessary image-write authority; rejected |
| Anonymous pulls and retries | No stored credential | Repeats quota failures; PR paths remain subject to this limitation |
| Mirror/cache or federated identity | May reduce pull volume or long-lived credentials | Separate registry/account design and verification; deferred |

Recommended stack: read-only/public-read-only PAT with finite expiry, GitHub
Actions secret storage, immutable login action, exact main-event guard,
automatic logout, and existing workflow mutation tests. If authenticated limits
persist, measure image pull volume and consider caching; do not weaken tests
or expose credentials to PRs.

## Official sources

- [Docker PAT creation and rotation](https://docs.docker.com/security/access-tokens/personal-access-tokens/):
  permission selection, finite expiry and independent revocation.
- [Docker login action](https://github.com/docker/login-action): authentication,
  post-job logout and the difference between Docker-wide and Buildx-only credentials.
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets):
  secure inputs, missing-secret behavior and fork restrictions.
- [Docker Hub pull limits](https://docs.docker.com/docker-hub/usage/pulls/):
  authentication changes quota attribution; it is not universally unlimited.

Sources discovered with MCP search and read on 2026-10-09. The v4 commit was
also checked against the upstream GitHub tag. See the separate
[setup and validation outcome](ci-dockerhub-pull-auth-outcome.md).
