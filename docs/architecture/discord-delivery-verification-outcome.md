# Administrator Discord delivery verification — outcome

Date: 2026-10-04. Starting revision: `c54003b9`. Branch: `main`.
Toolchain: Node 24.21.0 / npm 12.2.0. See the
[design, alternatives and official sources](discord-delivery-verification-design.md).

## Delivered

Administrators can expand an eligible unconfirmed receipt in Settings → Discord,
enter a Discord message ID and choose **Verify delivery**. Confirmation updates
the row and displayed counts immediately without moving keyboard focus, opening
a modal or fetching another page. The form stays mounted until an explicit
refresh/navigation, so its result remains available to assistive technology.
No request runs merely because the panel or details are opened.

The named client API posts only the message ID. The administrator-only backend
uses the uniquely typed saved Discord configuration, reads the current bot
identity and one message in the original channel, and compares the original
classification, nonce, version, bot, channel and requested message ID. It never
accepts browser-supplied proof or a provider URL. Exact configuration revisions,
including sub-millisecond changes, are rechecked inside local completion.

Separate ESM modules own input/config contracts, bounded provider reads,
persisted admission, orchestration and HTTP handling. The existing receipt
completion transaction preserves newer classification decisions and refuses a
conflicting message ID. Native fetch uses the existing body-bounded transport;
there is no SDK queue, hidden retry or Gateway login in this path.

A singleton PostgreSQL guard retains the latest operation ID, target, fixed
outcome and cooldown. It limits verification across processes and restarts;
stale operations cannot overwrite a newer admission. Rate limits extend the
deadline, never shorten it. Invalid retry limits pause this feature for review.
Sanitized completion logs exclude credentials and provider bodies.

The recovery-change skill shaped the admission-before-I/O rule, evidence-only
completion, configuration checks and isolated fault tests. No receipt is reset,
no legacy proof is invented and no notification is resent.

## Verification

- Focused Windows backend: **4 suites / 62 tests passed**. Tests cover strict
  IDs/body shape, authentication/admin access, no-store responses, cancellation,
  one active operation, fixed error codes and persistence failures.
- Real loopback HTTP: **20 new cases passed**, including exact GET paths, wrong
  bot, 401/403/404/503, 429 header/body delays, malformed/oversized responses,
  rejected redirects, mismatched/forwarded/webhook messages, total deadline and
  actual socket cancellation. All credentials are synthetic; no live bot login.
- Isolated PostgreSQL: **3 suites / 50 tests passed**, covering concurrent admission, restart-safe cooldown,
  indefinite pause, stale-operation fencing, configuration changes, legacy and
  rejected receipts, preserved newer decisions, and HTTP outside transactions.
  Also tested a non-default saved configuration ID; lookup uses its unique type,
  not an assumed primary-key value.
- Isolated PostgreSQL 18.6 / pgvector 0.8.7 schema checks passed: upgrade from
  HEAD, migration replay, fresh snapshot load and zero-drift round trip. Only the
  new guard table, primary key and migration ledger entry were added. Reviewed
  exactly those migration/snapshot ownership fingerprints; the existing
  unresolved ingestion-ownership analysis was not relabelled as safe.
- Isolated Linux: **3 suites / 52 tests passed**, zero skips. Includes the native
  transport fixtures and the real directory-fsync case skipped on Windows.
  Used the existing locked-dependency test image
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`
  with read-only source, no external network/live mounts, dropped capabilities,
  no-new-privileges, two CPUs, 1 GiB memory and 128 PIDs.
- Chromium: **4 scenarios passed in five consecutive repetitions (20 passes)**,
  including 320/1280-pixel layouts, labels,
  keyboard submission, retained focus, immediate count changes, no polling and
  exactly one verification POST. Screenshots were visually inspected. These use
  the production component with synthetic API responses, not a live deployment.
- Focused frontend: **3 files / 50 tests passed**, including strict response
  handling, preserved input/focus, immediate row/count updates and no late result
  after unmount. Frontend lint and both type-check scopes passed.

- Full backend coverage rerun: **1,664 suites / 51,136 tests passed**. One
  Linux-only test was skipped on Windows and passed in the Linux run above.
  Statements/lines **90.08%**, branches **85.52%**, functions **91.55%**.

- Full frontend coverage: **434 files / 6,292 tests passed**, no skips, in
  164.26 seconds. Statements **86.67%**, branches **79.54%**, functions **86.22%**,
  lines **88.55%**. Ran separately from backend coverage to avoid resource
  contention; isolation and test timeouts were not weakened.
- Backend lint/type checks, normal/production dependency-usage checks, migration
  naming/schema integrity, copyright, npm CLI policy, static-import and ESM
  mock-shape checks passed. Frontend lint, both type-check scopes and production
  build passed. The combined coverage ratchet passed without baseline changes.
- Markdown validation checked **1,852 files** with zero errors. Whitespace and
  the staged secret scan passed with no findings.

The full unrelated PostgreSQL and browser suites were not rerun; affected
database and browser contracts were tested above. These are local verification
results, not deployment or release acceptance evidence.

The initial full backend run exposed a pre-existing static-test assumption:
every literal `method` property was treated as a classification method. Scoped
the new read-only HTTP reader out of that check, as other non-classification
modules already are. `GET` was not added to the classification allowlist and no
database constraint was weakened. Real HTTP fixtures independently assert that
the reader performs only the two intended GETs.

A final browser rerun exposed a test race: before asynchronous records loaded,
the first disclosure was the general coverage explanation, not a receipt. The
verification test now waits for loaded status and targets the exact classification
disclosure. No application behavior, timeout or assertion was weakened.

## Limits

Older unmarked alerts cannot be verified retrospectively through this action.
Missing/inaccessible messages, removed markers and ambiguous responses remain
unconfirmed. Bot credentials, database integrity and independent writers sharing
the same bot are trust boundaries; a footer marker is not a signature.

The ten-second budget covers network work; bounded SQL admission/completion adds
time around it. The browser waits up to thirty seconds and does not retry. A
disconnected caller may miss a completed local commit; refresh records to learn
the saved result. A crash before committing a received 429 cannot preserve that
new delay, although the original admission cooldown survives. No automatic
retry is introduced. The guard limits this verification feature, not every
Discord operation in the application.

Database fixture clock changes test expiry logic; they are not elapsed-time
deployment evidence. No application database, live recovery, Docker replacement,
release or version change is part of this round. Compose/Unraid/Synology templates
need no new configuration. A later deployment must apply the migration normally.

## Recommendation stack

1. **Use explicit verification for unresolved marked receipts.** It can recover a
   lost confirmation without duplicating the alert. Cost: administrator input,
   bot read permissions and a deliberately slow installation-wide cooldown.
2. **Keep legacy and negative outcomes unconfirmed.** This preserves honest
   state and avoids duplicate effects. Cost: some old messages require manual
   investigation and cannot be conclusively matched.
3. **Next: durable provider deferral and total deadlines for normal sends.**
   Share provider delay information across send/read callers and define safe
   pre-send deferral separately from uncertain writes. Do not turn a timeout or
   provider 404 into permission to resend.

GitHub MCP and the saved GitHub CLI login both returned **zero open Classifarr
PRs**. There was no eligible random PR to implement; none was merged. Work stays
on `main` for the requested commit and push, without creating a release.
