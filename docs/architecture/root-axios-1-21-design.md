# Root Axios 1.21 local adoption design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and locally verified.
Outcome: [local adoption and verification](root-axios-1-21-outcome.md).

## Random selection and immutable input

GitHub MCP found three open Dependabot PRs: 574, 576 and 578. One uniform
PowerShell Get-Random selection chose
[PR 574](https://github.com/cloudbyday90/Classifarr/pull/574), reviewed at head
83da9e8766c19c3d310870c530563a45ee49e99f against intake base
f89e35b68c4420ef03d7d06b459d853d420f0fee. Current main is
f12c0301a862c56bf7c9127f9cc4297e87faa0e5. The selection receipt is under .tmp.

All three PRs were created today and are mergeable. Their independent changes
being behind recent main commits do not alone make them stale. Recheck at
delivery; rebase only a genuinely stale applicable branch, without merging a PR
or sending bot comments merely to manufacture cleanup.

## Proposed change and boundaries

Adopt only the PR's root Axios 1.20.0 to 1.21.0 update, using an exact 1.21.0
direct pin under repository policy rather than its caret. Client Axios is already
1.21.0. Keep its direct version and the server tree unchanged.

The coupled redirect overrides are a separate security change documented in the
[cross-realm design](redirect-cross-realm-fix-design.md). Inspect the root lock's
Axios and redirect changes separately; neither justifies unrelated resolution
churn, install-script changes or dependency downgrades.

Root Axios consumers found in source are developer scripts for local model
inspection and drop simulation. Do not execute those scripts against the user's
network. Use the existing actual Axios Node GET control and bounded synthetic
JSON POST checks through loopback fixtures. Preserve credentials, ordinary
headers, method/body behavior and redirect limits.

The maintainer's 1.21 notes call out changed header-default recognition and
Node/browser request handling. Inspected root callers use ordinary option maps;
no custom header-default class was found. Do not enable optional Basic-auth
encoding, add response-timing telemetry or change application retry policy.

## Alternatives and recommendation stack

| Choice | Benefit | Cost or remaining boundary | Decision |
| --- | --- | --- | --- |
| Exact root Axios 1.21.0 | Implements selected PR and aligns root/client direct versions | Requires real Node compatibility evidence | Recommend locally |
| Keep root 1.20.0 | Separates a minor update from security patch | Leaves the selected applicable PR unimplemented | Not preferred |
| Upgrade all remaining PRs | Fewer update sessions | Mixes unrelated client/server tooling | Exclude |
| Replace root transport | Could remove this dependency | Larger behavioral change without demonstrated need | Defer |

Recommendation stack: review immutable PR/release/registry inputs, pin the direct
version, generate locks with scripts disabled, inspect every delta, strictly
install root/client, then verify actual HTTP behavior and audits. No new service
abstraction is necessary for this bounded dependency update.

## Verification and delivery

Pinned Node 24.22.1/npm 12.2.1 remain in use. npm outdated reports installed
1.20.0 and wanted/latest 1.21.0. npm explain confirms the existing parent accepts
follow-redirects ^1.16.0. Keep strict-allow-scripts, all other overrides and
reviewed lifecycle decisions. Inspect registry metadata before installation.

Run npm ci, npm ls --all, full audits and the dependency-tooling suite in the
appropriate independent roots. Retain the existing real Axios credential and
GET controls, add JSON POST behavior, and run the affected root/client quality
gates. No production/provider request, server dependency change or backend
behavior change is required. Coverage evidence reuse is conditional on unchanged
backend source/tree and must be stated in the outcome.

Write a separate observed outcome, update Unreleased and commit/push on main.
Keep the PR unmerged. No application version bump, release, deployment, new UI,
CLI workflow, setting or job is part of this adoption.

## Official sources

Discovered through GitHub/search MCP and read on 2026-11-02:

- [Selected PR 574](https://github.com/cloudbyday90/Classifarr/pull/574):
  reviewed root-only diff and immutable head recorded above.
- [Axios maintainer releases](https://github.com/axios/axios/releases):
  the 1.21.0 section identifies header-default compatibility and request-handling
  changes; keep verification specific to used options and adapters.
- [npm package.json documentation](https://docs.npmjs.com/cli/configuring-npm/package-json/):
  explicit manifest and override handling with reviewed lockfile generation.

Exact-version registry and audit results are recorded privately under .tmp;
the separate outcome records observed behavior and unresolved findings.
