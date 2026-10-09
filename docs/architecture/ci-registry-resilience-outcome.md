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

The initial no-cache build succeeded from a dirty worktree and correctly used
`VCS_REF=unknown`; it is not release or maintenance evidence. A clean committed
rebuild, local replacement and isolated schema dump are recorded below once done.

## Limits and next check

No remote login success is claimed from local tests. Inspect the exact pushed
commit's authentication, same-image pulls, test execution and logout separately.
The recovery skill drove explicit failure categories and bounded retries; the
release-evidence skill kept receipt gates and evidence identities intact.

No release, image publication, PR merge, Unraid mutation or shared Ollama change.
Next: use the hosted diagnostics to locate any remaining daemon/network or
credential-resolution failure before introducing a registry mirror.
