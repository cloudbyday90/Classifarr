# Client Axios 1.21 adoption design

Date: 2026-11-02 (America/New_York). Status: agreed; implemented and verified.
Outcome: [installation, behavior and audit](client-axios-1-21-outcome.md).

## Random PR selection

GitHub MCP found four open Dependabot PRs: 574, 575, 576 and 578. One uniform
PowerShell Get-Random selection chose
[PR 575](https://github.com/cloudbyday90/Classifarr/pull/575), reviewed at head
c36124db7519241f66218d560198e0736a081b02 against intake base
f89e35b68c4420ef03d7d06b459d853d420f0fee. Current main is
6f0b7c3301cbc141397449785970a70a7ee035d6. The selection receipt is private under
.tmp. Keep the work on main and do not merge the PR.

All four PRs were created today and are mergeable. Being one implementation
commit behind main is not sufficient reason to rewrite a fresh independent
branch. Recheck at delivery and rebase only genuinely stale applicable branches.

## Proposed adoption and compatibility

Adopt only the client Axios 1.20.0 to 1.21.0 update. Pin the direct dependency
exactly to 1.21.0 under the repository workflow, rather than retaining the PR's
caret. Review the npm-generated lockfile before installing. Root Axios and the
other tooling PRs stay separate; there is no coupled server Axios update here.

The maintainer's 1.21 release notes identify changed header-default recognition,
response timing and XHR lifecycle/XSRF handling. Classifarr uses plain default
header maps and AxiosHeaders.from for explicit CSRF injection. It does not need
to enable the new optional Basic-auth behavior or expose response duration.
Inspect actual request behavior rather than relying only on mocked Axios tests.

Preserve the centralized API layer, named leaf functions, credentials, CSRF
injection, authentication refresh, redirect suppression, cancellation and existing
skipAutomaticRetry boundaries. Do not use the update to broaden automatic replay
or change application retry policy. No new UI or telemetry is needed.

## Tradeoffs and recommendation stack

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Keep 1.20.0 | Avoid a minor-version compatibility review | Defers current upstream fixes | Not preferred |
| Exact client 1.21.0 | Small reviewed update at the selected PR boundary | Needs real header/transport and browser validation | Recommend |
| Update root and client together | Align versions | Broadens the randomly selected PR and failure attribution | Defer root PR |
| Change transport retry/auth policy too | Could address separate design questions | Adds unrelated command/replay semantics | Exclude |

Recommendation stack: review exact release/registry evidence, generate and
inspect the lockfile with scripts disabled, install under the unchanged reviewed
policy, prove unmocked Axios and production-browser behavior, then run client and
shared dependency/coverage gates. Document audit results without treating an
outdated version or a clean audit as proof of safety.

## Baseline and verification

Pinned Node 24.22.1 and npm 12.2.1 remain in use. npm outdated reports installed
1.20.0, wanted/latest 1.21.0. Registry metadata and distribution integrity were
retrieved for exact version 1.21.0. Root/server/client manifests and .npmrc
policies were inspected. Preserve strict-allow-scripts and explicit installer
decisions; inspect the published artifact's lifecycle flags before npm ci.

Review every package addition/removal and transitive version change. Run npm ci,
npm ls --all and full client npm audit including development dependencies. Keep
existing overrides, script controls and peer checks. Never use audit fix --force.

Add focused unmocked Axios compatibility checks for headers/configuration and
the central transport's CSRF and no-replay behavior. Run existing transport/API
tests, client lint/typecheck, fresh coverage and build, and the existing
production-browser policy-route asset suite. Run shared tooling dependency
policy and coverage ratchet with current reports. Backend changes are verified
separately under the reservation-fence batch. Record exact results and limitations
in a separate outcome, update Unreleased and commit/push without release or
deployment. The separate outcome records installation and observed results.

## Official sources

Discovered through GitHub/search MCP and read on 2026-11-02:

- [Axios maintainer releases](https://github.com/axios/axios/releases):
  the 1.21.0 section records compatibility and browser behavior changes. Release
  notes are dated October 21; GitHub displays publication on October 26.
- [Selected Classifarr PR](https://github.com/cloudbyday90/Classifarr/pull/575):
  immutable head and reviewed client-only diff recorded above.
- [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html):
  preserve explicit command no-replay boundaries while testing the HTTP upgrade.

The exact-version npm metadata receipt remains under .tmp. No version-specific
engine or security guarantee is inferred from missing registry fields.

Audit follow-up: the existing root/client follow-redirects 1.16.1 overrides are
affected by a newer cross-realm sensitive-header advisory. The approved batch
preserves those overrides. Prioritize their coupled 1.16.2 update and cross-realm
regressions next; Axios adoption alone does not resolve that underlying finding.
See the [audit evidence](client-axios-1-21-outcome.md).
