# Restricted-runtime interrupted manual routing

Reviewed 2026-10-04. Extend the existing disposable embedded isolation drill.
Do not change production permissions, saved templates, or live recovery state.

## Contract

Exercise the real authenticated queue manual-classification endpoint for one
movie and one series. The synthetic provider accepts and retains the add but
withholds its response. Only after observing that accepted POST, kill the actual
restricted application process. Keep PostgreSQL and the provider alive. Require
the committed selection, task completion, attempt ID and routing intent to survive.

Restart through the normal application entry point. Repeating the original queue
command must be rejected without another provider request. Explicitly check the
saved routing through the normal read-only check endpoint; require verified
presence, an unchanged original decision, and persisted cooldown. Restart again
and prove an immediate second check is withheld without network I/O. Count every
attempted provider POST, including rejected duplicates: exactly one per provider.

No fake completion records or fabricated intents: only the real service creates
them. Fixture setup creates synthetic configuration, pending review tasks and a
temporary administrator; SQL runs as the restricted role. Provider/session state
stays in process memory. Fixed loopback targets, network-none, read-only image,
two CPUs, 2 GiB and 128 PIDs bound the existing container. HTTP payloads and
timeouts remain bounded. Stop/join all application processes before maintenance.

Normal startup also probes configured providers. Model only their authenticated
status, quality-profile and root-folder GET endpoints, counting these separately:
32 health reads across four application starts. Do not suppress startup checks
or allow arbitrary provider requests to make the fixture pass. Give copied
fixture libraries distinct names to honor the real name/type uniqueness constraint.

No work runs on ordinary fresh installations. No automatic background opt-in,
deadline advancement, retry-budget reset or provider-write retry is introduced.
Permanent refusal, unexpected traffic, admission timeout or unknown results fail
the rehearsal. Cancellation still joins processes and closes provider sockets.
Configuration revisions and lock admission use the existing production checks.

## Options and recommendation

| Option | Benefit | Cost or limit |
| --- | --- | --- |
| Mock a lost response | Fast regression feedback | Cannot prove process-crash durability |
| Extend real restricted drill (chosen) | Tests transport, auth, persistence and restart together | Synthetic provider; slower |
| Exercise live providers | Real deployment evidence | Requires separately authorized test targets |

Stack: interrupted manual routing now; automatic-policy/queue crash semantics next;
then remaining privileged adapters before any production identity migration.
Manual and automatic policy routing have different persistence contracts. Passing
this drill must not be described as proof for all routing or a published upgrade.
No UI changes or new accessibility-conformance claim.

## Official research

Sources discovered through web search and opened on 2026-10-04:

- [HTTP semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html):
  an uncertain non-idempotent request must not be blindly retried. This motivates
  counting attempted adds and using observation rather than replay.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  session advisory locks differ from transaction locks. Process loss must release
  runtime admission while committed intent remains; HTTP stays outside transactions.

Keep verification and exact image identities in the separate outcome document.
