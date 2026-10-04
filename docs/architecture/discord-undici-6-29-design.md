# Discord HTTP transport refresh: design

Research date: 2026-10-04. Baseline: `6b9f69e4`, clean `main`.

## Decision

Update only the server's two scoped Undici overrides from **6.28.1 to 6.29.0**.
Installed `discord.js` 14.27.0 and `@discordjs/rest` 2.6.2 both declare `^6.27.0`;
the candidate satisfies that range. Keep Classifarr's direct Undici 8.11.2,
Discord itself, the Node 24.21.0/npm 12.2.0 toolchain and strict install policy
unchanged. No new runtime service, configuration, schema or deployment step.

The dependency-update skill requires a reviewed lockfile and tests of the actual
nested transport. Existing Discord tests mostly mock the network; the root
Undici tests exercise a different major and cannot substitute for these checks.

## Research and applicability

URLs were discovered through web search/release links and registry metadata,
then retrieved; release diffs were inspected through the saved GitHub CLI login.

- [Undici 6.29.0 release](https://github.com/nodejs/undici/releases/tag/v6.29.0)
  includes retry-body settlement and upgrade-diagnostics fixes. Published
  September 25, 2026; registry metadata requires Node >=18.17, adds no dependencies
  and has no install/postinstall hook. Our pinned Node satisfies the engine.
  The [upstream support table](https://github.com/nodejs/undici) lists 6.x through
  April 30, 2027; prefer a future parent-supported migration over a forced major.
- [Retry fix](https://github.com/nodejs/undici/pull/5778): a terminal response on
  a resumed request must settle the body already exposed to its caller, rather
  than replace that response. Test this with a real truncated loopback response.
  Classifarr does not currently install a RetryAgent for Discord: this is a
  dependency regression check, not a claim that a reported app failure used it.
- [Upgrade lifecycle fix](https://github.com/nodejs/undici/pull/5833): protocol
  upgrades should complete their diagnostic lifecycle. Test successful and
  rejected HTTP/1.1 upgrades without contacting the Discord Gateway. This does
  not establish complete Gateway or HTTP/2 compatibility.
- [Discord's versioned REST defaults](https://discord.js.org/docs/packages/discord.js/14.27.0/DefaultRestOptions:Variable)
  describe its own retries, timeout and request adapter. Preserve those defaults
  in production; tests use short explicit budgets and a local API origin.
- [Undici resource guidance](https://github.com/nodejs/undici#garbage-collection)
  requires consuming or cancelling response bodies. Test-owned agents, sockets
  and servers must be closed explicitly; do not depend on garbage collection.

This is a maintenance update, not remediation of a newly established advisory.
The baseline server npm audit, including development dependencies, has zero
findings. Audit again after installation and scan all lockfiles with OSV.

## Options and tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Pin compatible 6.29.0 | Upstream fixes within both parent ranges | Two production package records to verify | Adopt |
| Keep 6.28.1 | No dependency change | Retains fixed lifecycle defects | Decline |
| Force Discord onto Undici 8 | One transport major | Outside parent ranges; avoidable API risk | Decline |
| Replace Discord integration | Full transport ownership | Large unrelated rewrite and maintenance burden | Defer |

## Verification plan

1. Add ESM contracts under normal Jest discovery, using bounded native Node
   subprocesses for real package resolution. Run the new lifecycle cases on the
   old graph to distinguish regression assertions from version-only checks.
2. Exercise both nested Undici copies: terminal retry responses, successful and
   rejected upgrades. Exercise `Client.rest` through its real default adapter:
   JSON notification payloads, authorization failures, finite 5xx retries and
   cancellation. Use synthetic credentials and loopback only, no login or DB.
3. Generate the lockfile with scripts disabled; inspect every changed package,
   registry integrity and lifecycle hook before a strict clean install.
4. Validate dependency tree, audit/OSV, targeted Discord/HTTP tests, server
   coverage, lint, typecheck, knip and dependency-toolchain policy. No relaxed
   assertions, coverage thresholds, advisory exclusions or script permissions.
5. Record observed outcomes separately; update Unreleased and review staged
   changes/secrets before committing and pushing on `main`. No release or tag.

GitHub MCP and the saved CLI login both returned zero open Classifarr PRs on
October 4. No random PR can be selected; do not substitute an upstream merged PR.

## Recommendation stack

Adopt the compatible transport refresh, retain the separate supported majors,
then inspect remaining runtime/tooling maintenance in a separate batch. Keep
live Discord, image acceptance and accessibility claims separate from these
loopback HTTP checks. This backend-only change does not alter the UI.
