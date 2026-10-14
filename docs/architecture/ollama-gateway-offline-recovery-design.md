# Offline administrator-reviewed gateway recovery

Date: 2026-10-14. Scope: optional standalone gateway only. No Unraid or shared
Ollama changes, automatic retries, release, or new application database tables.

## Decision and prerequisites

Implement an offline administrator-reviewed procedure before a lifecycle
supervisor. A lost response remains an unknown outcome, not a failed inference.
Age, an empty model listing, a disconnected client, or an absent gateway process
cannot prove all provider work stopped. Fresh/disabled installations do nothing.

The administrator must isolate every provider ingress, disable automatic restart,
stop **all** provider processes/runners, and independently verify that state.
Stopping one container or the Docker daemon is insufficient. If any consumer or
runner cannot be accounted for, do not recover. This is especially important for
a provider shared by local Classifarr and Unraid.

## State and authority

1. Stop the gateway and use a dedicated offline database session. Acquire the same
   database-local advisory lock as the gateway; reject a reused lock-owning
   session. This proves gateway exclusion, not provider termination.
2. Inspect the exact ledger, provider, owner, request, attempt count and held
   recovery receipt. Prepare a private, strict JSON review document.
3. `acknowledge-stop` locks the singleton row, compares the entire expected
   snapshot, and records `administrator_attested` evidence with a bounded operator
   alias, evidence reference and recent stop observation. It clears the uncertain
   marker **into a durable maintenance hold**, not into ready state.
4. A separately reviewed `resume` document must match the held receipt and current
   snapshot. Append a second receipt and remove the hold. Restarting the gateway
   alone never removes it. The operator controls provider/network restoration.

Both mutations are atomic PostgreSQL transactions. Bind the last receipt directly
rather than inferring order from wall clocks. Preserve the original request,
installation, owner, start time, attempts and cooldown in the stop receipt.
Never mark the abandoned request successful, refund attempts or application
budgets, or replay it. Resume only permits future independently admitted work.
Existing single-flight admission, foreground queue bounds, cancellation, timeout,
response limits, caller retry limits and cooldowns remain unchanged.

Native PostgreSQL UUIDv7 identifies every new receipt. The timestamped migration
lives beside the existing standalone gateway migration, intentionally outside
application migrations. A fresh standalone schema is maintained alongside it.
Version 2 rejects old runtime binaries rather than silently ignoring the hold.

## Security and failure behavior

There is no HTTP recovery endpoint, Docker socket, shell execution, provider HTTP
call, automatic initialization or retry. Use separate runtime and recovery roles;
neither owns the schema. Recovery can append receipts and update only recovery
columns. Runtime cannot change the hold or receipts. Receipts reject modification
and deletion by ordinary roles; a privileged DBA remains trusted, so this is not
a tamper-proof external audit.

Private input is capped at 64 KiB. Do not store raw logs, hostnames, URLs,
credentials, prompts or provider responses. References identify separately kept
administrator evidence. PostgreSQL connections/queries are bounded; transactions
have statement, lock and idle deadlines. The CLI has a 20-second hard deadline.
Cancellation before commit rolls back. An interrupted/failed COMMIT is reported
as unknown: inspect persisted state, never blindly repeat the write.

Invalid review, stale ownership/configuration/request, missing work, competing
gateway, unsupported schema and incomplete assertions fail closed. Transient
database failure is not automatically retried. Inspection changes no durable
state and performs no provider request. Stop evidence is explicitly human
attestation, never machine-verified termination.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Age-based clearing | Simple unattended recovery | Can overlap still-running work | Reject |
| Offline reviewed stop + durable hold | Small auditable scope; no daemon privileges | Requires a competent administrator and service downtime | Implement first |
| Trusted lifecycle supervisor | Can support independently verified automatic recovery | New privileged lifecycle authority and cross-host failure modes | Next, separate design |

Recommended stack: existing bounded ESM gateway; PostgreSQL 18 transactions and
UUIDv7 receipts; least-privilege offline CLI; explicit resume; then a trusted
supervisor if unattended recovery is needed. Do not expand automatic replay as
part of this work.

## Verification and completion

Prove fresh and version-1 upgrade paths, real PostgreSQL locking, same-session
lock rejection, stale review/replay refusal, transactional rollback, cancellation,
unknown commit, preserved attempts/cooldown, restart hold, role boundaries and
UUIDv7. Exercise packaged code with synthetic HTTP and an isolated database;
no live recovery or inference. A passing rehearsal is not evidence of a shared
provider being stopped. Record results separately in the outcome document.

## Official research

Retrieved through MCP search/open on 2026-10-14; recommendations are our design
inferences, not vendor endorsements.

- [Docker live restore](https://docs.docker.com/engine/daemon/live-restore/):
  containers may remain running when the daemon is unavailable.
- [Docker restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/):
  restart behavior must be included in the operator's isolation review.
- [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html):
  bind receipt creation and admission state changes atomically.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html):
  session locks persist until release/session end and repeated acquisitions stack.
- [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html):
  native UUIDv7 provides time-ordered identifiers.
