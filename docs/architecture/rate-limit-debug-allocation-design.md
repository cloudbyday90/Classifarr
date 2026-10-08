# Rate-limit debug allocation update

Date: 2026-10-08. Scope: server express-rate-limit 8.7.0 → 8.7.1.

## Research and finding

The [previous recommendation](dotenv-boolean-options-outcome.md) selected this
patch before YAML and tooling updates. Fresh npm registry checks confirm 8.7.1
as the compatible patch. The official
[changelog](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/reference/changelog.mdx)
and [PR #684](https://github.com/express-rate-limit/express-rate-limit/pull/684),
retrieved through GitHub MCP, describe skipping request-info enumeration when
debug logging is disabled. The
[release comparison](https://github.com/express-rate-limit/express-rate-limit/compare/v8.7.0...v8.7.1)
contains one runtime-source change: guard `Object.entries(info)` with
`debug.enabled`. Release head: `c2e30b340189e287123cf5bfd89526dd2ea07d3f`;
8.7.1 was published on October 6. The upstream bundle target also changes from
ES2022 to ES2020, still compatible with Node 24. Upstream development/workflow
changes are not additional application dependencies.

Registry metadata retains Node >=16, Express >=4.11 and the debug/ip-address
dependencies. Node 24.21.0 and Express 5.2.1 meet these requirements. There is no
native build or platform restriction. Retain the reviewed ip-address 10.7.1
override and all strict lifecycle-script decisions. Generate the lockfile with
scripts disabled, review every change, then use normal frozen installation under
the [npm install policy](https://docs.npmjs.com/cli/commands/npm-ci/).

The official [debugging guide](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/guides/debugging.mdx)
documents the `express-rate-limit` DEBUG namespace. Test both states in separate
processes so developer environment settings cannot invalidate the comparison.
The [proxy guide](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/guides/troubleshooting-proxy-issues.mdx)
explains why the actual client-IP boundary matters. Keep existing proxy trust,
IPv4/mapped-address and IPv6 subnet behavior; do not turn off validation or trust
arbitrary forwarded headers to obtain a pass.

## Design and security boundary

Keep production configuration, routes, client contracts, database schema and
memory safeguards unchanged. Existing modular `rateLimits.mjs` configuration
already separates policy from the dependency. No service wrapper or singleton
is needed for this package-only correction.

Add ESM installed-package tests for production login, refresh and password-change
quotas, rejection bodies, retry metadata, disabled legacy headers, untrusted
forwarded-header diagnostics and fail-closed store errors. Reuse existing
real-HTTP IPv4/IPv6 and proxy compatibility tests. Add a small synthetic subprocess
fixture which observes whether the exact request-info object was enumerated,
without retaining it or mocking the limiter. Check debug output remains available
when explicitly enabled. This demonstrates avoided work, not a memory benchmark,
retained-heap improvement or a fix for comparison-worker memory pressure.

## Alternatives and recommendation stack

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Upstream patch plus installed-package tests | Avoids unnecessary request allocation; preserves existing policy | Small regression fixture to maintain | Recommended |
| Keep 8.7.0 | No dependency change | Retains confirmed avoidable work | Reject |
| Fork or replace rate-limit middleware | More implementation control | Reimplements security-sensitive semantics without need | Reject |
| Batch YAML and tooling with this patch | Fewer builds | Harder regression attribution | Defer |

Use the pinned Node/npm toolchain → strict install policy and exact reviewed
lockfile → real-HTTP security regressions → backend checks → clean-source no-cache
image build → isolated installed-image/schema checks → backed-up local replacement.
No release, version bump, template changes, safeguard relaxation or Unraid access.

## Random PR trial

Fresh saved-login enumeration found open PRs #555 and #556. One PowerShell
`Get-Random` draw selected [#556](https://github.com/cloudbyday90/Classifarr/pull/556),
head `9d74537d7917c248d15926f37b2e40ceba7559a4`. GitHub MCP retrieved its exact
server manifest/lock patch: Node declarations 24.19.1 → 26.6.4 and accompanying
undici-types. Apply it locally and run the existing Node-major gate before install.
Do not retain an incompatible trial, merge the PR or weaken the deployed Node 24
contract. Record the actual outcome separately.

## Verification plan

First demonstrate the disabled-debug regression on 8.7.0. Then review the complete
lockfile delta, run clean install/tree/audit checks, focused and full backend unit
tests, lint, typecheck, Knip, dependency tooling and documentation checks. Test
installed dependencies in the actual Linux image without production appdata or
external network. Dump and verify schema in disposable databases after rebuilding.
Preserve the current local image and a verified database archive before replacing
local Compose. Observe health, authentication, errors and bounded memory readings;
report limits and remote CI status separately in the outcome document.
