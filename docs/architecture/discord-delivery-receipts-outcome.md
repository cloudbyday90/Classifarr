# Discord delivery receipts — outcome

Date: 2026-10-04. Starting revision: `70b68f4e`. Branch: `main`.
Toolchain: Node 24.21.0 / npm 12.2.0.

## Delivered

Initial pending, confidence and standard classification alerts now share durable
delivery admission. A saved nonce and unique classification key prevent cooperating
callers from independently sending the same initial alert. Receipts survive process
restarts; existing message IDs in either legacy storage location suppress resends.

HTTP completion saves the receipt and history projection together. A matching
own-bot Gateway event can repair a lost reply or failed completion save without
another Discord request. A late confirmation preserves newer clarification
decisions and conflicting legacy message references. Completion can retry the
database once, never the message send.

Channel-message POSTs no longer inherit SDK retries for connection resets or 5xx.
This transport safeguard also covers other channel-message sends using the shared
client, including test/system alerts, although those flows do not gain receipts.
Explicit provider rate-limit handling and existing read retries remain intact.

Five small ESM modules separate validation, storage, orchestration and runtime
wiring. New modules participate in checked-JavaScript validation. No dependency,
frontend, public API, Compose, version, tag or release changes are required.

## Verification

- Focused Windows checks: **7 suites / 56 tests passed**. Notification presentation
  tests verify delegation and preserve embeds, actions and explicit mentions.
- Isolated PostgreSQL: **1 suite / 25 tests passed**, covering competing instances/formats, legacy IDs,
  disabled/missing/changed configuration, stale pending decisions, restart,
  lost admission and completion acknowledgements, rollback, Gateway races,
  incorrect proof scope, conflicting IDs, migration replay and deletion cascade.
- Isolated Linux AMD64: **8 suites / 61 tests passed**, no skips, including the
  Linux-only directory-fsync test. Reused the locked-dependency test image
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`
  with current source mounted read-only, no network/live data mounts, dropped
  capabilities, no-new-privileges, 2 CPUs, 1 GiB RAM and 128 PIDs.
- Real loopback HTTP runs through the installed Discord SDK: ambiguous message
  POST failures produce one request, while 429 handling and read retries remain.
  The four subprocess fixtures include **26 native Node tests**, not live Discord.
- Snapshot generation used a disposable, network-isolated PostgreSQL 18.6 /
  pgvector 0.8.7 container. Starting from the committed snapshot, the new migration
  applied twice; the generated snapshot loaded into a second empty database and
  round-tripped without drift. Only disposable fixture data was removed afterward.
- The SQL ownership-review gate initially detected the new migration and changed
  snapshot. Both diffs were reviewed: only the delivery table, its constraints,
  history-delete cascade and migration ledger changed. Their review entries were
  updated explicitly; protected ingestion analysis and unresolved debt are unchanged.
- Full backend coverage: **1,661 suites / 50,916 tests passed** in 671.992 seconds.
  The single Windows skip is the Linux directory-fsync case, passed separately
  above. Statements/lines: **90.09%**; branches: **85.50%**; functions: **91.55%**.
- Server lint/typecheck, normal and production dependency usage, static imports,
  ESM mock-shape checks, copyright, migration/snapshot integrity, npm CLI policy
  and whitespace checks passed. Markdown validation checked **1,846 files** with
  zero errors; the staged secret scan found no leaks.
- Full PostgreSQL integration: **233 suites / 2,742 tests passed** in 888.163
  seconds. The existing opt-in `ai-provider-fault-compose` suite (one test) was
  skipped because its separate Compose harness was not enabled. This is not a
  passing result for that harness; no skip condition was added or changed here.

Evidence logs are local-only under `.tmp/discord-receipts-*.log`. No live Discord
login, notification, application database mutation, app restart or image deployment
was performed. This is not a live upgrade or release rehearsal. No client code
changed; frontend tests and the combined client/server coverage ratchet are not
claimed as fresh evidence.

## Tradeoffs and recommendation stack

1. **Keep durable receipts plus evidence-only confirmation.** This closes the
   duplicate-send gap across caller races/restarts. Cost: a message lost before
   delivery can remain unconfirmed, rather than being guessed safe to repeat.
   Discord's short nonce window alone cannot provide indefinite retry safety;
   see the [official Message API](https://docs.discord.com/developers/resources/message).
2. **Next: an admin delivery-review view and bounded reconciliation.** Show
   delivered, rejected and unconfirmed states, with the classification/channel
   and one clear next action. Start with read-only evidence and scoped message-ID
   verification. Any resend needs a separate reviewed intent; do not clear the
   existing receipt or turn age into proof of non-delivery.
3. **Then: durable deferral and end-to-end queue bounds.** Eight active deliveries
   and eight event confirmations per process limit new work; saturation currently
   skips work and logs a fixed, deduplicated warning. SDK rate-limit waits and work
   before delivery admission are not covered by an overall deadline. A future
   outbox must preserve the same no-uncertain-replay rule.

Receipts expire only with their classification history; no janitor or polling
process was added. Passive events can be missed. Disabled/reconfigured settings
cannot undo a write already admitted. Older noncooperating application versions
are outside the receipt protocol. These limits prevent an exactly-once guarantee.

Until an admin review view exists, maintainers can inspect unresolved receipts
with this bounded, read-only query in their existing database administration tool:

```sql
SELECT classification_id, state, failure_code, created_at, updated_at
FROM discord_notification_deliveries
WHERE state <> 'delivered'
ORDER BY created_at DESC
LIMIT 50;
```

`sending` after a restart and `uncertain` both require evidence, not a row reset.
Do not delete a receipt to force a resend. Confirm what reached the stored Discord
channel first; no manual resend or receipt-edit API is introduced in this slice.

The [design](discord-delivery-receipts-design.md) records official sources,
alternatives and resource bounds. The recovery-change skill shaped the durable
admission, failure contract, real-I/O tests and isolated schema verification.

GitHub MCP and the saved GitHub CLI login returned **zero open Classifarr PRs**.
No eligible random PR could be implemented; none was merged. All work remains
on `main`, with no new branch or release.
