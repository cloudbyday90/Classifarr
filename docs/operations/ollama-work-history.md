# Ollama gateway work history

Unreleased, 2026-10-15. Optional gateway only; not enabled on Unraid/shared Ollama.

## View your installation's requests

Administrators can open **Settings → AI → Ollama gateway history**, optionally
enter a queue task ID, then select **Load latest**. **Older requests** loads the
next page using the same filter. There is no automatic polling or AI call.
The view distinguishes a gateway that is not configured from configured history
with no matching requests. Direct Ollama traffic is not recorded here.

Each row contains the gateway request reference, admission time, model/operation,
and originating task ID/type/attempt when recorded. Queue and gateway attempts
are separate counters. Source references are diagnostic claims, not authorization.
Unrelated Ollama clients and other gateway installations are excluded.
Only admitted compute requests have durable bindings. Pre-admission refusals,
read-only inspection calls and direct-provider traffic are not listed.

| Display | Meaning |
| --- | --- |
| Provider response completed | A complete, validated provider reply was recorded; the queue task may still fail later. |
| Provider rejected request | A complete allowed provider error response was recorded, including its HTTP status. |
| Cancelled before dispatch | This invocation knew transport had not been called. |
| Completion recorded; detail unavailable | The internal completion caller supplied no more specific outcome. |
| Active or outcome uncertain | Work is running, or its final provider outcome cannot be established. |
| Abandoned after administrator review | The separate offline procedure recorded human attestation, not successful completion. |
| Outcome not recorded | A historical inactive binding has no completion receipt; success is unknown. |

The view cannot retry, cancel, clear, resume or stop anything. A request disappearing
from the active slot, an old timestamp, or a completed queue task is not proof that
uncertain provider work stopped. No prompts, responses, fingerprints, credentials,
provider URLs or recovery evidence appear in the response.

## Upgrade the separate gateway database

Follow the [offline schema/role sequence](ollama-gateway-offline-recovery.md),
including backup and stopping the gateway. Version 7 adds an append-only
`completion_receipt` table with native time-based UUIDv7 primary keys and indexed
history queries. Existing requests, attempts, cooldowns and unknown outcomes stay
intact. Older writers are refused. No historical outcome is fabricated.

The restricted gateway runtime needs SELECT/INSERT on the new completion table
and SELECT only on the five recovery-receipt columns listed in that procedure.
Do not grant receipt mutation, recovery evidence reads or schema ownership.
Classifarr startup does not install or upgrade this separate schema. Updating the
application alone does not enable the gateway or reroute any provider traffic.

## API and limits

- Application: admin-authenticated `GET /api/settings/ollama/gateway-history`.
- Gateway: credential-authenticated `GET /gateway/history`.
- Optional `taskId` and `before` must be canonical positive decimal bigint strings.
  Unknown/duplicate parameters and caller-selected installations are rejected.
- The credential determines installation scope. Each page contains at most 25
  rows, ordered by descending gateway attempt, with `nextBefore` for older pages.
- One read-only SQL statement uses the current owner/provider/schema fence.
  Application requests have a five-second deadline and 64 KiB response limit;
  the gateway database has a four-second statement timeout. Existing global
  connection/handler/rate limits still apply.
- Refreshing starts at the newest page. Outcomes may change between page reads;
  pagination is not a frozen historical snapshot.

Database failure remains fail-closed under the existing gateway ledger policy;
history is not an alternative path around an unavailable control database.
For architecture, alternatives and official references, see the
[design](../architecture/ollama-work-history-design.md). Verification and remaining
limits are recorded separately in the [outcome](../architecture/ollama-work-history-outcome.md).

For an offline copy and advisory retention assessment, use the
[history archive runbook](ollama-history-archive.md). Archiving does not purge
history, reclaim admission capacity or authorize recovery.
