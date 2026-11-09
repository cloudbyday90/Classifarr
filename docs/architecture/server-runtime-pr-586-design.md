# Server runtime PR 586 assessment design

Date: 2026-11-09 Eastern. Status: agreed; candidate controls and strict install
passed. Final verification is recorded in the [outcome](server-runtime-pr-586-outcome.md).
Baseline main 681012143. No release, deployment or PR merge.

## Immutable selection and proposed batch

MCP repository/PR APIs returned four open PRs, 583, 585, 586 and 587. Uniform
node:crypto.randomInt selection at 2026-11-09T13:25:35.335Z chose
[PR 586](https://github.com/cloudbyday90/Classifarr/pull/586), immutable head
4949ea99f7a88e382582ba121a552f211bbe7ee3. Its two-file patch was read through
the repository's advertised compare API against b41b019a9. All four branches
are currently mergeable; UNSTABLE checks alone are not a conflict/rebase reason.

| Direct server package | Installed | Candidate exact pin | Reason to assess |
| --- | --- | --- | --- |
| undici | 8.12.3 | 8.12.4 | Six upstream security fixes and transport fixes |
| express-rate-limit | 8.7.2 | 8.7.3 | Forward asynchronous handler/message errors to Express |
| discord.js | 14.27.0 | 14.28.1 | Minor SDK changes and interaction-scoped permission fix |

Conditionally adopt all three only after meaningful controls and normal gates.
Use an exact discord.js pin rather than copy the PR's caret. Review coupled REST
2.6.3, builders 1.15.0 and API types 0.38.57, plus the actual regenerated graph.
Candidate/coupled registry integrity matches the immutable proposal. Engines fit
the existing pinned Node 24.22.1; no new install lifecycle hooks were declared.
Registry prepare/development scripts are not permission to run install hooks.

The regenerated lock resolved discord-api-types 0.38.58 instead of the PR's
0.38.57. Its [November 7 release](https://github.com/discordjs/discord-api-types/releases/tag/0.38.58)
was retrieved through the MCP release collection and reviewed alongside registry
metadata: type corrections and additive API constants/routes, no dependencies or
install hooks. Its integrity matches the registry; the new routes/features are
not enabled by this batch. There are six changed package entries, no additions
or removals and no changed overrides, scripts or native installers.

## Security and actual transport boundaries

Standalone Undici serves only the buffered HTTP path when verify_ssl is explicitly
false. It must retain package fetch with its matching per-request Agent and
cleanup. Ordinary buffered, binary and streaming requests use Node global fetch.
Do not replace global fetch/dispatcher or change TLS verification defaults.

Node 24.22.1 embeds Undici 7.30.1. Discord and @discordjs/rest separately retain
explicit Undici 6.29.1 overrides. Preserve these boundaries; an 8.12.4 npm update
does not update Node's bundled implementation or the nested 6.x copies.

Read-only loopback probes of installed copies found:

| Copy | Wrong digest | Wrong digest surrounded by tabs | Correct digest |
| --- | --- | --- | --- |
| Standalone 8.12.3 | Rejected | Accepted incorrectly | Accepted |
| Discord 6.29.1 | Rejected | Rejected | Accepted |
| REST 6.29.1 | Rejected | Rejected | Accepted |
| Node bundled 7.30.1 | Rejected | Accepted incorrectly | Accepted |

Two incorrect tokens separated by a tab were rejected on all tested copies.
Do not describe that variant as a reproduced failure. Official advisory ranges
cover 7.x/8.x, not 6.29.1; the SRI regression starts at 7.15.0. Other new cache/
redirect advisories start at 7.0.0, or 7.30.1 for intermediate-hop policy loss.
Published fixed branches are 7.30.2 and 8.12.4. Source-text similarity alone does
not establish that a different copy has the same defect.

No application cache/interceptor composition or Fetch integrity option was found.
The probes establish library behavior, not an exploitable Classifarr path. Node's
bundled residual remains explicit; do not add a test that requires this defect
to persist. Assess a corrected Node/npm toolchain separately before a later
release; no residual exception or deployment is authorized by this batch.

The current audit database still reports only five existing low server entries,
despite the new maintainer advisories. A clean/limited audit does not disprove
upstream findings. Preserve all scanner checks, severities and existing triage
expiry; do not add an exception to make this update pass.

## Real-library controls

First freeze installed old-copy failures with bounded loopback/child-process
fixtures; no Discord/provider calls or credentials. Then verify candidate behavior:

- SRI valid/invalid SHA-256/384/512, supported ASCII whitespace and ordinary
  metadata controls. Preserve the observed tab-surrounded regression precisely.
- Cross-origin tuple/object/flat-array redirect credential stripping, ordinary
  headers and same-origin controls using the real interceptor composition.
- Cache redirect-hop policy and credential alias isolation, cross-origin 304
  revalidation refusal, and cache-replay handler exceptions delivered as request
  errors instead of uncaught process failure. Keep stores isolated and bounded;
  use memory controls, not an application cache or historical cache migration.
- Existing excessive-content-encoding, custom TLS identity and dispatcher cleanup
  controls against direct and both retained nested copies. Exercise actual
  application wrapper deadlines, pre-abort, stalled bodies, uncertain POSTs and
  redirect behavior. Preserve one wrapper dispatch and actual lower-level policy;
  do not claim HTTP/SQL atomicity or grant a new replay capability.
- Real Express HTTP tests for rejecting async limit handlers, throwing/rejecting
  message callbacks and one error-middleware delivery without protected-route
  admission. Old failures need isolated children because unhandled rejection can
  terminate the process. Preserve quotas, proxy/IP behavior, headers and the
  existing late-response/window-reset regression.
- Real Discord SDK interaction permission isolation and message/button payload
  controls, plus existing REST/loopback request-budget, cancellation, permanent
  close, sanitization and uncertain-write controls. Version 14.27.0 lacks the new
  permission fields; do not claim its permission leak was reproduced. Existing
  application authorization uses permissionsFor(botMember), not the new fields.

Do not enable HTTP/2, caches, new SDK features, provider access, automatic retries
or application transport changes to exercise the update. Preserve SDK retry/
rate-limit/deadline settings, charged attempts, owner fencing and write authority.

## Installation, verification and delivery

Generate the server lock with scripts disabled for first review. Inspect every
addition/removal/change, peer/engine/native entry and integrity. Preserve all
overrides, including both 6.29.1 Undici pins, ip-address 10.7.4 and existing strict
script decisions. No root/client manifest, toolchain or application policy change.
Unexpected major/script changes require separate assessment; do not force peers
or weaken scanners. Follow with strict clean install and complete npm ls --all.

Run focused real-library/application controls, fresh full backend coverage, lint,
typecheck, Knip, ownership, ESM, dependency/tooling policy and normal quality gates.
Run complete root/server/client audits including development dependencies. Reuse
client coverage/build/browser evidence only after verified unchanged client source,
configuration, installed tree and report hashes; qualify the unchanged ratchet.
Retain compatible versions if a candidate fails and record the actual outcome.

Use scoped artifact maintenance; preserve every recovery asset, current evidence,
toolchain, worktree, active service and unrelated project. Update separate outcome
and Unreleased, commit/push all agreed changes on main, and inspect exact-source
CI/security receipts. Leave PRs unmerged and rebase only genuinely stale applicable
branches. Add no UI, endpoint, schema, job, operator CLI trigger, live write,
routing/learning permission, release or deployment.

## Official sources and trade-offs

Discovered/retrieved through MCP on November 9, 2026:

- [Undici 8.12.4](https://github.com/nodejs/undici/releases/tag/v8.12.4)
  summarizes the security/transport patch. The
  [maintainer advisory index](https://github.com/nodejs/undici/security/advisories)
  links all six affected-version records. The
  [SRI advisory](https://github.com/nodejs/undici/security/advisories/GHSA-r4pc-4jcp-7pqc)
  establishes 7.15.0/8.x regression boundaries and the separate fixed branches.
- [Rate-limit changelog](https://express-rate-limit.mintlify.app/reference/changelog)
  documents the async error-forwarding correction. Preserve policy while testing
  actual error delivery, not only its version string.
- [Discord 14.28.0](https://github.com/discordjs/discord.js/releases/tag/14.28.0)
  adds permission fields; [14.28.1](https://github.com/discordjs/discord.js/releases/tag/14.28.1)
  and its [scope fix](https://github.com/discordjs/discord.js/commit/cfb23d20980c537c4d018f8e5f5e1829638041bb)
  identify the interaction-isolation boundary.
- [WHATWG Fetch](https://fetch.spec.whatwg.org/) requires a failed integrity
  match to take the request-error path. [W3C SRI](https://www.w3.org/TR/sri/)
  is a March 2026 Working Draft, not a new Recommendation. These inform integrity
  controls; this batch adopts no browser policy or application SRI feature.

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Keep installed versions | No dependency drift | Retains reproduced standalone defect and upstream fixes unapplied | Baseline only if candidate gates fail |
| Assess three exact pins with real controls | Bounded patch/minor improvements in the selected PR | Coupled SDK changes and transport semantics need proof | First batch |
| Blanket override every Undici copy to 8.x | One visible version | Breaks supported major/dispatcher boundaries and cannot replace Node internals | Reject |
| Bundle a Node/global transport migration here | Wider potential remediation | Toolchain/base-image and wrapper changes form a separate contract | Separate high-priority assessment |

Recommendation stack: assess this exact three-package batch; then verify a
corrected Node/npm toolchain for bundled Undici and the existing npm/ip-address
residual before any future release. Keep existing scan-alert triage and the
deferred client compiler/DOM/native-WASM updates separately scoped.
