# Discord REST response bounds — outcome

Date: 2026-10-04. Starting revision: `5df7bd7f`. Branch: `main`.
Toolchain: Node 24.21.0 / npm 12.2.0.

## Delivered

Three small ESM modules share bounded REST behavior across the persistent bot,
connection tests and temporary discovery clients:

- `discordClientFactory.mjs` owns the client/transport lifecycle.
- `discordRestTransport.mjs` bounds each attempt to 15 seconds through the body,
  4 MiB and 16 concurrent attempts per client, with no extra queue or retry loop.
- `discordRestResponse.mjs` adapts the SDK's Node stream to the existing bounded
  reader with byte-based backpressure, preserves response status/headers, and
  prevents malformed JSON errors from exposing provider content.

Client destruction aborts active requests and permanently closes admission.
Already queued SDK requests cannot dispatch through a closed adapter. Bodies are
fully settled before normal 5xx retries. Deadline, cancellation, size and malformed
JSON failures do not gain automatic retries. In particular, moving body reads into
the SDK's request callback must not make a mid-body `ECONNRESET` retryable: the
adapter preserves that existing retry classification only before response headers.

No schema, frontend, dependency, Compose, global dispatcher or credential changes.
Fresh/disabled configurations still stop before creating a client. All new modules
are included in the server's checked-JavaScript typecheck.

## Verification

- Baseline reproduction: the previous adapter accepted a response after **363 ms**
  despite a **75 ms** SDK timeout. The fixture sent headers immediately and delayed
  the body by 350 ms. This is local evidence, not a claimed live Discord outage.
- Targeted Discord/HTTP checks: **19 suites / 198 Jest tests passed**, no skips.
  Four subprocess cases also run **24 native Node contracts**, including eleven
  new bounded-adapter scenarios using the installed SDK and real loopback HTTP.
- The new contracts exercise slow headers, stalled/dripping bodies, declared and
  streamed overflow, malformed JSON, early/mid-body cancellation, destruction
  with queued work, broken POST responses, unchanged payloads, 403, 429 and 5xx.
  Failed requests are followed by healthy calls through a single-connection agent.
- Unit tests additionally prove capacity admission, exact byte limits, null bodies,
  timer/listener cleanup, static errors and no client creation for disabled setups.
- Isolated Linux AMD64: **5 suites / 37 Jest tests passed**, zero skips, including
  the real HTTP contracts and the existing Linux-only directory-fsync test.
  Used the previously built test image
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`
  because dependency locks are unchanged. Current source was mounted read-only;
  Linux-installed dependencies, no network, dropped capabilities, no-new-privileges,
  2 CPUs, 1 GiB RAM, 128 PIDs and a bounded temporary filesystem. No live data mounts.
- Server lint, scoped typecheck, normal/production dependency usage checks,
  static-import, copyright, npm CLI policy and whitespace checks passed.
- Full backend coverage: **1,659 suites / 50,851 tests passed** in 603.094 seconds.
  The one Windows skip is the existing Linux directory-fsync case, which passed
  in the separate Linux run above. No coverage threshold or platform guard changed.
  Statements/lines: **90.06%**; branches: **85.52%**; functions: **91.58%**.
- Repository Markdown validation: **1,844 files checked, zero errors**. The staged
  secret scan passed with no leaks. Evidence logs are ignored under
  `.tmp/discord-bounds-*.log`; the baseline reproduction is also local-only.

No frontend files changed; frontend tests, the combined client/server coverage
ratchet and database integration tests were not rerun for this transport-only
change. Prior reports are not presented as fresh evidence for those checks.

The test harness uses synthetic authorization, never logs in to the Discord
Gateway, and does not inherit bot credentials or proxy settings. Child execution
and captured output are bounded. No live database, external notification or
application container was changed. This is not a deployment or image rehearsal.

## Recommendation stack

1. **Keep this shared bounded adapter.** Benefit: limits resource retention while
   preserving the supported Discord stack. Cost: bounded response buffering and
   explicit rejection of exceptionally large replies or excess simultaneous work.
2. **Next: persistent notification delivery receipts and duplicate prevention.**
   Classification, confidence and pending-decision senders persist the message ID
   only after `channel.send` succeeds. Design the uncertain-result and restart
   contract around that gap. Discord's
   [nonce enforcement](https://docs.discord.com/developers/resources/message)
   can help within its short recent window; it is not indefinite retry safety.
   Benefit: fewer missing/duplicate notifications; cost: durable state and explicit
   reconciliation. SDK rate-limit queue waits and ephemeral-client fan-out also
   remain outside this patch's per-attempt/per-client bounds.
3. **Retain compatible dependencies until the parent supports migration.** An
   unrelated transport replacement or cross-major override would expand risk.

The [design document](discord-rest-bounds-design.md) contains alternatives and the
official sources retrieved through web research. The recovery-change skill shaped
the failure contract, uncertain-write handling, real-I/O tests and scoped handoff.

GitHub MCP and the saved GitHub CLI login both returned **zero open Classifarr
PRs**. There was no eligible random PR to implement; none was merged. No branch,
version bump, tag, release, application rebuild or deployment is included.
