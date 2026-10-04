# Discord HTTP transport refresh: outcome

Date: 2026-10-04. Starting revision: `6b9f69e4`. Branch: `main`.
Local toolchain: Node 24.21.0 / npm 12.2.0 on Windows.

## Delivered

Both server-scoped Discord Undici overrides now pin **6.29.0**, up from 6.28.1.
Only the version, registry URL and SHA-512 integrity fields changed in the two
corresponding lockfile records. No packages were added or removed. Integrity
matches the registry metadata; no lifecycle hook or install permission changed.
Discord 14.27.0, REST 2.6.2 and Classifarr's direct Undici 8.11.2 are unchanged.

Added three Jest cases running thirteen native Node contracts, all ESM:

- Each nested transport is checked independently, including a partially consumed
  response followed by terminal 300/404/416 replies and accepted/rejected
  HTTP/1.1 upgrade diagnostics.
- The actual `Client.rest` adapter sends a synthetic notification to loopback,
  preserves JSON and authorization, exposes a 403 without retry, stops a 503 at
  the configured retry count, honours cancellation and permits a subsequent call.
- Child processes have a 15-second deadline, 128 MiB V8 heap limit and bounded
  captured output. They do not inherit tokens, proxy settings or NODE_OPTIONS.
  No Gateway login, external API, database or live application data is used.
  Test-owned sockets, agents, clients and diagnostic subscriptions are cleaned up.

The heap limit is not an operating-system RSS cap. The tests do not prove all
Discord Gateway, HTTP/2, large-response or deployment behavior. No production
RetryAgent or retry-policy change was introduced.

Dependency validation also found an existing unused re-export statement in
`presetsRouteShared.mjs`. Removed that statement after searching all callers;
the canonical `customPresetKey.mjs` utility and route/service imports remain.
This is not attributed to the Undici update.

## Observed verification

- The old graph's accepted-upgrade test missed the expected headers/completion
  events; rejected upgrades passed. Both nested old transports hit the process
  deadline during the partial-response case. The real Discord REST contract
  already passed before the update. All thirteen contracts passed after it.
- Lockfile generation with scripts disabled, strict clean `npm ci` and
  `npm ls --all` passed. Server npm audit including dev dependencies found
  **zero vulnerabilities** before and after. OSV Scanner 2.6.0 scanned **1,142
  entries across all three lockfiles**, with no issues and no advisory exclusions.
  These are point-in-time scanner results, not a guarantee of vulnerability-free code.
- Targeted Discord and HTTP checks: **17 suites / 172 tests passed**, no skips.
  Preset routes/save checks after removing the unused re-export: **3 suites /
  29 tests passed**, no skips.
- Server lint, scoped typecheck, normal/production knip and all **30** dependency
  policy tests passed. Copyright and npm CLI flag checks passed.
- Full backend coverage: **1,657 suites / 50,782 tests passed** in 591.475s.
  The one Windows skip is the pre-existing Linux directory-fsync case, executed
  separately below. Statements/lines: **90.04%**; branches: **85.51%**;
  functions: **91.55%**. No coverage threshold changed.
- Isolated Linux AMD64: **2 suites / 8 Jest cases passed**, zero skips, including
  all thirteen native Discord contracts and all five migration-tree cases.
  Used Node 24.21.0/npm 12.2.0 and a strict Linux install of the current lockfile.
  The directory-fsync check ran real Linux operations on synthetic files.
- Static-import checks, repository Markdown validation, whitespace checks and
  the staged secret scan passed.

During test development, Node's default reporter differed from the expected TAP
format. The fixture now selects TAP explicitly and runs without a nested test
process, so its execution deadline cannot leave a test-runner grandchild behind.
The initial npm-forwarded targeted command was rejected by npm 12's strict CLI
policy; validation uses the existing Node Jest runner directly. No policy was relaxed.

The first disposable Linux build correctly refused to copy test files excluded
by the production `.dockerignore`. The test image instead installs development
dependencies and mounts current source read-only, following the existing
[Linux testing guidance](../testing-linux-filesystem.md). Production build
exclusions are unchanged. Tests run with network disabled, dropped capabilities,
no-new-privileges, a read-only root, a 128 MiB temporary filesystem, two CPUs,
1 GiB memory and 128 PIDs. No Windows `node_modules` or live appdata is mounted.
The container is removed on exit; its local test image is
`sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`.
This is not an application image rehearsal, ARM64 validation or power-loss test.

Ignored local evidence: `.tmp/discord-transport-*.log` and audit/registry JSON.
No frontend files changed; frontend tests and the combined coverage ratchet are
not rerun, and old client coverage is not presented as fresh whole-repo evidence.

## Recommendations and next item

1. **Keep the tested compatible update.** Benefit: upstream lifecycle fixes;
   cost: maintaining two explicit nested pins. The
   [design document](discord-undici-6-29-design.md) records official sources and
   alternatives. The dependency-update skill drove the exact graph review and
   real-transport checks rather than relying on a successful installation.
2. **Next: review Discord response lifetime and size limits.** In installed REST
   2.6.2, `makeNetworkRequest` clears its timeout after the response arrives;
   body parsing happens afterward, and 5xx handling can retry without consuming
   the body. Add adversarial loopback cases for slow/oversized bodies and explicit
   cleanup before proposing a small shared adapter. This is a source-review
   finding, not a measured live outage or a claim that all requests run unbounded.
   Benefit: predictable resource use; cost: choosing limits compatible with real
   Discord payloads and preserving rate limits and write/retry semantics.
   Apply any reviewed policy consistently to `discordBot.mjs` and the temporary
   clients in `discordConnectionManager.mjs`, not just the settings test button.
3. **Keep intentional major-version boundaries.** The remaining server
   `npm outdated` result is Node 26 types; retain Node 24 types with Node 24.
   Plan a parent-supported Discord transport migration before Undici 6's
   [April 2027 end of support](https://github.com/nodejs/undici), not an override
   beyond the parent's declared range.

GitHub MCP and the saved CLI login returned **zero open Classifarr PRs**. No
random PR was available and none was merged. No branch, tag, version bump,
release, application-image/Compose rebuild or live deployment is part of this change.
