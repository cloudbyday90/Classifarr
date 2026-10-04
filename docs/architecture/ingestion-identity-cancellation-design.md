# Cancel identity recovery when import ownership is lost

## Evidence and scope — 2026-10-04

Read-only inspection after the previous rebuild found eight legacy running sync
markers across two enabled libraries, with no matching ownership ledger. Another
library completed import but retained one TV identity conflict with the recorded
outcome `insufficient_evidence`. These explain the warnings; neither record age
nor one visible application container proves historical writers have stopped.
The existing reviewed recovery action and independent-ID requirements remain.

Tracing that path exposed a separate code defect: the import lease abort signal
reaches page enumeration but not identity recovery. Recovery can continue TMDb
and source reads after its owning connection fails, then classify cancellation
as a provider failure. Database fencing still rejects stale writes; unnecessary
network activity and misleading recovery outcomes are the gap addressed here.

## Contract

- Pass the existing owner signal through recovery planning, cached-receipt
  verification, external-ID resolution, detail lookup and source revalidation.
  Check cancellation before and after awaits, before reporting or persistence.
- Cancel an in-flight native HTTP read and a pending rate-limit wait. Remove its
  timer/listener; do not consume a token after cancellation. Existing callers
  without a signal retain their API and behavior.
- Cancellation propagates to the import runner; it is not missing metadata,
  insufficient evidence or provider downtime. Do not record a new item outcome
  or manufacture a successful receipt after cancellation.
- Keep eight new identity attempts per library run, serial recovery, existing
  two-import capacity, ten-second HTTP deadlines and durable one-day attempt
  cooldowns. Bound source identity responses to 1 MiB, matching TMDb identity
  reads. This is not a new process-wide queue or hard deadline for database work.
- Fresh/disabled/unconfigured libraries add no new work. Retry only existing
  read-only verification after normal admission; never replay provider writes.
  Connection loss after an attempt claim preserves that claim/cooldown. A later
  owner performs normal full replay; no budget reset or fabricated ownership.
- Existing capture generations, live owner scope and source-configuration checks
  remain the write authority. HTTP stays outside transactions. Optional AI does
  not hold import-and-metadata completion open. Inventory pruning still requires
  the verified complete capture and live owner.
- No schema, client API, UI, deployment-template or dependency changes. This
  does not add global shutdown/config-change signals where none existed; it
  carries the actual lease signal and allows callers to supply cancellation.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Rely only on stale-write rejection | Already protects persistence | Leaves obsolete requests and waits running | Insufficient |
| Race promises without canceling transport | Caller appears responsive | Network/timers can continue after return | Reject |
| Carry the owner signal through existing ESM services | Stops obsolete reads and waits; no dependency | Every boundary must preserve cancellation | Implement |
| Infer legacy owner death from age/rebuild | Removes warnings automatically | Cannot exclude an older writer | Reject |

Recommended stack: existing lease signal → recovery boundary checks → cancellable
token wait → bounded native HTTP → unchanged generation-fenced persistence.
Completion means either unchanged independently proven identity recovery, or
prompt cancellation with no follow-on requests/writes and preserved retry state.

## Official research

Discovered with web search and read on 2026-10-04:

- [Node 24 AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)
  documents cancellation, `throwIfAborted`, and one-shot listeners. The existing
  native HTTP client already composes caller cancellation with its deadline.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes application-defined advisory locks; their availability is not proof
  that a noncooperating historical writer is absent.
- [PostgreSQL application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html)
  supports retaining transaction/locking checks rather than treating cancellation
  alone as write authorization.

These support the design; they do not establish the cause of historical warnings
or certify automatic takeover. Axios documentation was checked during research,
but this server uses native fetch, so no Axios migration is appropriate.

## Verification and next work

First reproduce cancellation at receipt, admission, provider and source boundaries.
Use real loopback HTTP to verify transport closure, and isolated PostgreSQL to
terminate the actual owning backend during identity recovery, preserve inventory
and the claimed retry deadline, and reject completion. Retain normal recovery,
legacy-review, fairness and no-signal compatibility tests. Review ownership drift
instead of blindly regenerating its manifest.

Next: expand cancellation from connection loss to deliberate import stop and
source-configuration changes, with a separately designed lifecycle contract.
Legacy live recovery still needs truthful stopped-writer confirmation; this patch
does not make that attestation or change the unresolved source identity.
