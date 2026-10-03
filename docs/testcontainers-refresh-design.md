# Testcontainers refresh design

Research date: 2026-10-03. Update the PostgreSQL integration-test tooling from
12.1.0 to 12.2.0. No application runtime, database version, schema, deployment
template or release changes are intended.

## Decision and tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Adopt Testcontainers 12.2.0 with focused contracts and real database tests | Upstream log-stream cleanup and image-reference fixes | Docker integration must be revalidated | Recommended |
| Carry a local patch to 12.1.0 | Narrow source change | Unnecessary third-party fork to maintain | Reject |
| Refresh all remaining tooling together | Fewer update rounds | Harder to attribute failures | Defer Supertest and Knip |

Keep the repository's manifest range convention and exact lockfile resolutions.
Declare core `testcontainers` explicitly as a development dependency because the
new contracts use its public exports; keep it aligned with the PostgreSQL module.
This does not add another installed core copy. Preserve strict lifecycle-script
decisions, security overrides, automatic fixture cleanup and the existing pinned
Node 24.21.0/npm 12.2.0 toolchain.

## Official research

Sources were discovered through GitHub MCP, web search and npm registry metadata.

- [Testcontainers 12.2.0](https://github.com/testcontainers/testcontainers-node/releases/tag/v12.2.0),
  published September 28, includes consumer-driven log-stream disposal, preserved
  tag-plus-digest references and an optional never-pull policy. The registry's
  core engine requirement is Node >=22.22; the pinned runtime satisfies it.
  Neither core nor the PostgreSQL module has an install/postinstall hook.
- [Log-stream fix](https://github.com/testcontainers/testcontainers-node/pull/1432)
  closes the demultiplexed stream when its consumer closes, including a consumer
  that closes before Docker attaches. Verify transport disposal, not merely the
  returned reader's `destroyed` flag.
- [Image-reference fix](https://github.com/testcontainers/testcontainers-node/pull/1469)
  keeps tag and digest as separate fields and includes the digest in equality.
  Test these through the exported `ImageName` API without importing private files.
- [Container lifecycle guidance](https://node.testcontainers.org/features/containers/)
  documents explicit stop deadlines and disposable containers. Retain the existing
  per-run container and per-suite databases; do not use live appdata. The new
  never-pull option is not needed for these existing database fixtures.
- [Wait strategies](https://node.testcontainers.org/features/wait-strategies/)
  distinguish health checks from listening ports. Keep the module's health check
  and the existing SQL/schema preparation; do not replace readiness with a sleep.

Review the generated lockfile before allowing installation scripts. Do not infer
that unchanged transitive packages are newly fixed or that a clean audit proves
the dependency graph secure.

The [published-source comparison](https://github.com/testcontainers/testcontainers-node/compare/457707f3cd19b1ff9e34ed74d33beaca4c55f507...aa2d5a744a5ea0b686172307302ec8a4765b65ca)
uses the npm registry's `gitHead` values, not mutable branch heads. The PostgreSQL
module source is unchanged; its dependency on core is raised. Classifarr still
selects its existing explicit pgvector image rather than the upstream test image.

Core requires the npm `docker-compose` wrapper 1.5.0. Its
[published-source diff](https://github.com/PDMLab/docker-compose/compare/75a2dcb3c0c4e8bda54c9bac6bbb88dd897bf7f7...00c02e789b804869484058d1bdbb1fa49c55766e)
adds output truncation reporting and rejects truncated output before parsing.
The default capture limit remains large; this is not a new small memory cap for
Classifarr. It does not update the installed Docker Compose CLI or templates.
The wrapper has no install hook. No Classifarr runner directly imports it.

Initial lock generation also refreshed eleven compatible transitive packages.
Retain their previous reviewed resolutions; they are not required by this update.
In particular, keep the explicit denied `protobufjs@7.6.5` installer decision
instead of silently admitting a new installer version. No package is added to or
removed from the resolved graph, and only three package versions change.

## Verification plan

1. Add ESM contracts using public exports: tag/digest identity, real Docker log
   stream closure, and controlled early-consumer cancellation. Show the relevant
   regressions against 12.1.0 before updating.
2. Generate the server lockfile with scripts disabled; review every package
   addition, removal and version change. Clean-install under the unchanged policy.
3. Run the full disposable PostgreSQL/pgvector integration suite, including
   persisted extension upgrades, ownership/recovery and transaction tests.
4. Run backend lint, typecheck, both Knip modes, dependency tooling tests,
   dependency-tree checks and audits including development dependencies.
5. Document exact results and limitations separately. Do not reuse stale coverage
   reports or imply browser, live-provider or deployment verification.

## Existing CI failure and PR scope

The user supplied [run 37142677429](https://github.com/cloudbyday90/Classifarr/actions/runs/37142677429)
at `62f547ea976192b04b5ec37bbb81f016b64c8272`. Database tests passed; installation
acceptance failed after deliberate restore interruption, with exit 1 and no
recognized rejection signal. Its root cause remains unproven. That rehearsal
uses the Docker CLI, not Testcontainers: this dependency update is not its fix.
The [diagnostic work](architecture/restore-ci-diagnostics-outcome.md) preserves
evidence for recurrence without relaxing restore admission.

GitHub MCP and saved-login CLI both returned zero open Classifarr PRs during this
review. There is no candidate to select randomly; do not substitute an upstream
merged PR or perform a merge.

## Recommendation stack

1. Complete this isolated Testcontainers update and check current CI separately.
2. Review Supertest 7.3.1 next, then Knip 6.39.0 as a separate lint-tooling batch.
3. Keep Node typings on the runtime's 24.x line. Evaluate Vue TypeScript 7 apart.

Rollback is a reviewed revert of the dependency manifests, lockfile and matching
new contract expectations together. No data rollback or release operation is
needed. See [the outcome](testcontainers-refresh-outcome.md) for observed results.
