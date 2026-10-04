# Discord delivery correlation — outcome

Date: 2026-10-04. Starting revision: `4338beb7`. Branch: `main`.
Toolchain: Node 24.21.0 / npm 12.2.0. See the
[design and official sources](discord-delivery-correlation-design.md).

## Delivered

Future initial classification alerts carry a versioned receipt reference in the
first embed footer. All six acknowledgement, verification, correction,
clarification and answer-edit paths preserve that reference. Small ESM modules
handle formatting/proof parsing and payload budgeting separately from admission,
transport and database completion. No new dependency or configuration is needed.

The saved receipt version distinguishes new messages from older unmarked ones.
Passive own-bot create/update events can confirm an exact classification, random
nonce, bot and channel even when the event lacks a transient nonce. Reject
partial, webhook, reply/forward, wrong-author, conflicting, duplicated and
malformed evidence. Completion cannot overwrite a different message ID or a
newer classification decision. Events do not trigger HTTP reads or resends.

Footer references are public identifiers, not authorization tokens or signatures.
Provider-origin bot identity and stored receipt scope authenticate the evidence.
No endpoint accepts browser-submitted message objects as proof. Compromised bot
credentials/database and independent writers using the same bot remain outside
this guarantee. Missing events or removed markers leave uncertainty visible.

Payload checks run before database admission and reserve room within Discord's
footer/aggregate embed limits. They may shorten decorative footer prose, never
classification fields. Mentions and components retain their existing policy.
Unrepresentable payloads fail with a fixed reason without sending or creating a
receipt. Existing send/confirmation/SQL/transport limits remain in force.

The nullable migration has no default/backfill. Older writers and existing
receipts keep NULL version; a matching-looking footer cannot upgrade them.
Legacy live nonce evidence still works. No change to Docker Compose, Unraid,
Synology templates, bot permissions or privileged intents is required. The
administrator review panel remains read-only; there is no manual lookup yet.

The recovery-change skill drove the evidence-only completion rule, pre-admission
checks and isolated real-I/O tests. It specifically ruled out backfilling proof
or resending uncertain historical alerts.

## Verification

- Focused Windows backend: **8 suites / 153 tests passed**, including all six
  footer edit paths, malformed/scope checks, preflight rejection, bounded
  confirmations and bot replacement event binding.
- Real SDK loopback: send with the production transport, read through a fresh
  client without a nonce, complete from the marker, edit and read again. Exactly
  one notification POST; no replay. Fixtures use synthetic credentials and do
  not log into Discord. Corrected the fixture to supply the real provider's
  empty-string content field; partial-message rejection was not weakened.
- Isolated PostgreSQL: **2 suites / 33 tests passed**, covering receipt/review
  contracts plus marker-only recovery after restart, disabled/rotated settings,
  stored scope/version checks, legacy NULL migration replay and competing
  completion IDs with preserved decisions.
- Isolated PostgreSQL 18.6 / pgvector 0.8.7 schema rehearsal: upgrade from HEAD,
  idempotent replay, fresh snapshot load and zero-drift round trip passed. No
  application database or live volume was used. Only the reviewed new migration
  and schema fingerprints changed; protected ingestion write analysis did not.
- Isolated Linux: **3 suites / 58 tests passed**, no skips, including real SDK
  transport and the directory-fsync case Windows cannot exercise. Used the
  existing locked-dependency image
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`,
  read-only source, no external network/live mounts, dropped capabilities,
  no-new-privileges, 2 CPUs, 1 GiB RAM and 128 PIDs.
- Backend lint/type checks, normal/production dependency-usage checks, migration
  naming/schema integrity, copyright, npm CLI policy, static imports and ESM
  mock-shape checks passed. Copyright validation caught the new SQL header
  omission; it was corrected and the exact migration fingerprint re-reviewed.
- Full backend coverage run: **1,662 suites / 51,035 tests passed**, one ownership
  gate assertion failed and one Linux-only test was skipped on Windows. That run
  began before the reviewed fingerprint update; the corrected gate passed in the
  subsequent **8-suite / 153-test** focused run above. No runtime test failed.
  The full backend run was not repeated after that manifest/header-only
  correction. Statements/lines **90.10%**, branches **85.52%**, functions
  **91.56%**; the new marker parser has 100% branch coverage, and payload budgeting
  has 100% line / 98.18% branch coverage. The Windows skip passed on Linux above.

- Full frontend coverage rerun: **433 files / 6,253 tests passed**, no skips,
  in 160.69 seconds. Statements 86.64%, branches 79.51%, functions 86.21%, lines
  88.52%. The first overlapping run hit two lint-plugin setup timeouts and did
  not execute their 25 tests. Running the complete suite without the competing
  backend workload passed; no test, assertion or timeout was weakened.
- The combined coverage ratchet passed without baseline changes. Both frontend
  type-check scopes, frontend lint and production build passed. Markdown
  validation checked **1,850 files** with zero errors; whitespace and the staged
  secret scan passed with no findings.

No frontend runtime, API contract or deployment change is part of this slice;
these checks are not release or upgrade acceptance evidence. The full unrelated
PostgreSQL integration suite and browser suite were not rerun; affected database
contracts were tested above and the browser UI is unchanged. Logs are local-only
under `.tmp/`.

## Recommendation stack

1. **Keep the persistent proof layer.** Recovers matching later events without
   duplicate sends and requires no new secret or template. Cost: a visible
   footer reference; old unmarked messages still cannot be proven retrospectively.
2. **Next: bounded administrator verification by message ID.** Fetch once through
   trusted provider credentials, compare the stored bot/channel/marker, and
   conditionally complete the receipt. Design authorization, config drift,
   cooldowns and total read deadlines first. Never interpret a 404 as permission
   to resend or allow a manual “mark delivered” bypass.
3. **Then: durable deferral and total send deadlines.** Improve capacity handling
   while keeping unknown external writes in a held state.

Both GitHub MCP and the saved GitHub CLI login returned **zero open Classifarr
PRs** this round. There was no eligible random PR to implement; none was merged.
No branch, version, tag, release, live Discord message or application rebuild was
created. Changes are intended for the requested commit/push on `main`.
