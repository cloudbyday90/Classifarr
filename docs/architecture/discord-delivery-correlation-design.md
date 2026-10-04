# Discord delivery correlation — design

Date: 2026-10-04. Starting revision: `4338beb7`. Scope: future initial
classification, confidence and pending Discord notifications. No deployment,
historical resend, automatic polling or live recovery is part of this change.

## Problem and contract

A message may reach Discord while its response or local completion write is
lost. The existing receipt prevents duplicate sends, but a later message read
cannot reliably recover its transient nonce. This round establishes durable
correlation before adding an operator reconciliation endpoint.

New receipts record correlation version 1 before sending. Their first embed's
last footer line contains `Classifarr receipt v1:<classificationId>:<nonce>`.
The nonce is the existing 128-bit random value. Legacy receipts retain NULL
version: migration does not invent evidence or modify old Discord messages.

Only provider-origin messages from the recorded bot and channel can confirm a
receipt. Marker proof also requires a complete, ordinary bot message, no webhook,
reply/forward reference or snapshot, one strictly formatted marker in the first
footer, matching classification and saved version, and no conflicting nonce.
The marker is public correlation, **not a signature or authorization token**.
Do not expose an API accepting client-supplied message objects as proof. A
compromised bot token/database or another writer using the same bot remains
outside this guarantee. Signing a copyable marker would not solve that threat.

Passive Gateway create/update events may complete a matching receipt without
another send or fetch. Missing/partial event data leaves it unconfirmed. Existing
nonce confirmations remain supported. Receipt completion remains idempotent and
cannot replace a different message ID or overwrite a newer classification
decision. Disabled/config-changed installations may accept late evidence for
their original recorded bot/channel; new sends still require the saved config.

## Bounds and failures

- Fresh/disabled installations do no new work. No new timer, queue or credential.
- Preflight runs before admission: serialize at most ten embeds, reserve footer
  room, and reject invalid/oversized payloads with a fixed local reason. Only
  footer prose may be shortened; classification fields/body are not truncated.
- Preserve the marker in all six classification interaction footer edits.
  Legacy edits never acquire a marker. Preserve mentions/components unchanged.
- Existing per-instance limits remain: eight sends, eight confirmations, two
  database completion attempts; SQL statement/lock limits are five/two seconds.
  Existing transport attempt deadline/body/concurrency limits remain unchanged.
- Local invalid payloads are not admitted. Provider refusals remain rejected;
  transport/commit ambiguity remains unconfirmed. Shutdown/cancellation after
  admission is also unknown, never permission to replay the external write.
- Database admission commits before HTTP. Restart retains the receipt. No
  elapsed-time takeover, reset, negative-read inference or resend is introduced.
- Persist/log only fixed reasons and existing IDs, not provider bodies or secrets.

Completion means positive evidence of the original message plus committed receipt
and conditional history projection, not proof the message still exists forever.

## Alternatives and recommendation stack

1. **Versioned footer correlation now:** durable, no new secret/dependency or
   template change; costs a small visible footer line and strict parsing rules.
2. **Next, bounded administrator verification by message ID:** authenticates a
   fresh provider read and checks the stored scope. Requires separate config-drift,
   authorization, deadline, rate-limit and persisted cooldown design. Not added
   until this proof layer is exercised against the real SDK and PostgreSQL.
3. **Then durable deferral/overall send deadlines:** helps saturated callers and
   long provider waits without replaying uncertain writes.

Title/time matching is not unique evidence. Retrying POST after a long interval
can duplicate notifications. HMAC adds secret rotation without preventing a
compromised bot from copying an existing signed marker. Older unmarked messages
remain explicitly unconfirmed; do not retrofit them based on appearance.

## Research and verification plan

Official sources discovered/opened on 2026-10-04:

- [Discord Message Resource](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx):
  nonce is optional, deduplication is short-lived, and embed footer text persists
  in messages. Respect the 2,048-character footer and 6,000-character aggregate
  embed text limits. Message references/snapshots must not be mistaken for the
  original notification. Message reads require channel/history permissions.
- [Discord maintainer discussion](https://github.com/discord/discord-api-docs/discussions/3396):
  historical explanation that nonce is not stored. This supports treating its
  absence on a later read as normal, not a failed delivery.
- [Node 24 crypto documentation](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html):
  retain cryptographically generated random bytes rather than predictable IDs.
- [Discord Gateway documentation](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx):
  messages sent by the app are an exception to message-content filtering. No new
  privileged intent is needed; incomplete events still fail closed.

Test strict malformed/scope/legacy rejection, conflicting nonce/message IDs,
capacity, preflight before admission, immutable payloads and every footer edit.
Use real Discord SDK loopback POST/GET with the nonce omitted on GET. Use isolated
PostgreSQL for migration replay, old NULL versions, restart and completion races;
generate and round-trip the fresh schema only in an isolated database. Review
ownership fingerprints individually. Record results separately in the outcome.
