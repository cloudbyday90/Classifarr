# Check and configure evaluation AI-response capture

Reviewed 2026-10-09. This applies to the current development image; an older image
may not include these commands. It does not require a new Compose service, Unraid
template variable or data mount. Run commands against the installation you mean
to change: local testing and Unraid can have independent databases.

## What is missing?

Policy replay evaluates existing rules without calling AI. Some saved comparisons
also need AI responses cached for the current model, configuration and evidence.
`cache_missing` means those responses were not available for that saved window;
it does not by itself mean ingestion, embeddings or the provider failed.

Recurring capture is disabled by default. A ready inventory and completed policy
replay do not authorize it. Unsupported comparison paths cannot be repaired by
enabling capture or raising limits. Saved coverage is not an accuracy score, and
evaluation does not move media or promote policy changes.

## Inspect first — no AI generation

In Unraid, open **Docker → Classifarr icon → Console**, using the
[container context menu](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).
In Compose, open the service's
console with `docker compose exec classifarr sh` from your Compose project. If
you renamed the service, use that service name. The following commands run
**inside** the container; do not install Node on the NAS or use privileged exec.

```sh
node /app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --source-pair-ai-budget-status
```

This reads the budget without enabling capture, reserving tokens or resetting
quota counters. Inspect `dailyCalls`, `dailyTokens`, `captureStatus`, `quotaDay`,
`callsReserved`, `tokensReserved` and `nextCheckAt`. The report's top-level
`status: complete` means the status query completed, not that capture finished.

Both daily limits at zero mean disabled. If the command is missing or fails,
verify the running image/version and inspect sanitized logs; do not edit budget
rows or migration records manually. Unknown status must not be treated as ready.

## Optional activation — administrator decision

Only continue if you deliberately want this installation to perform additional
local AI generation. Check the configured Ollama provider and model, inventory
readiness, policy replay and current-model description-vector coverage first.
This worker does not fall back to a cloud provider or download a missing model.

Inspect the configured model without generating, downloading or loading it:

```sh
node /app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --source-pair-ai-provider-status
```

This explicit diagnostic reads saved configuration and requests only provider
metadata (`/api/tags` and, for a unique local identity, `/api/show`). It does not
change the budget or contact a cloud fallback. `providerStatus: ready` confirms
metadata only, not inventory readiness or permission to run. A blocked check exits
nonzero and includes a fixed explanation and action, never a raw provider error.

If it reports `model_ambiguous`, the endpoint lists the configured model more than
once. Check the Ollama server/proxy model listing. Have the provider expose one
unambiguous local identity for that model, or deliberately configure a unique local
model/endpoint. Do not remove digest validation or arbitrarily use the first entry.
Two entries can share a name while referring to different model bytes. Repeat this
check after correcting the provider configuration, before enabling capture.

Missing/remote models, invalid identity metadata and unsupported capabilities have
separate actions. Unknown inspection failures request a sanitized GitHub issue.
Do not post provider URLs, secrets, raw responses or database dumps. For a one-time
trial, explicitly disable the recurring budget afterward; daily limits are not an
automatic expiry.

For a small starting allowance of five calls per UTC day:

```sh
node /app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --configure-source-pair-ai-budget --daily-calls 5 --daily-tokens 42240
```

This changes durable configuration and allows later scheduled capture; it is
not a one-off run. It uses the existing database configuration in the container.
No credentials belong in the command or a shared screenshot.

- Allowed daily limits: 1–200 calls and 8,448–1,689,600 reserved tokens, or zero
  for **both** limits to disable. The tighter remaining limit controls admission.
- Each attempted call reserves 8,448 tokens before generation. Reservations are
  conservative admission accounting, not measured token usage or billing.
- The worker admits at most five calls per tick. Quota rolls over by UTC day.
  Reconfiguration and container restart do not erase same-day reservations;
  disabling and re-enabling is not a quota reset.
- Resource admission, cooldowns, provider/configuration checks and cancellation
  still apply. Do not bypass memory safeguards or use one-off capture commands
  to work around recurring limits.

## Verify and disable

Repeat the status command, then check Command Center's latest capture outcome
and saved comparison timestamp. Capture publication and replay are separate
steps: a cached batch is not immediately a new saved comparison or an accuracy
measurement. Counts can change as different windows are surveyed.

| Capture outcome | What to do |
| --- | --- |
| `disabled` | No recurring calls are scheduled; opt in only if wanted. |
| `ready` | Budget configured; wait for normal worker admission. |
| `captured` | Responses were published; allow normal replay to consume them. |
| `waiting_for_replay` | Wait for replay of the published window; inspect policy status if it persists. |
| `budget_exhausted` | Wait for the next UTC day or deliberately revise limits; do not clear reservations. |
| `deferred` | Check inventory/backfill, competing work, current provider/model and resource diagnostics. |
| `unavailable` or an unknown result | Preserve timestamp, image version, sanitized status and relevant log IDs; investigate before retrying. |

`nextCheckAt` is an earliest retry time, not a promised start time. If an unknown
failure persists, open a GitHub issue from the project's issue page with this
sanitized context; exclude prompts, raw responses, secrets and database dumps.

To stop admitting new recurring calls:

```sh
node /app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --configure-source-pair-ai-budget --daily-calls 0 --daily-tokens 0
```

An already admitted provider call may still finish; disabling is not rollback of
a remote request. Existing reservations remain accounted for. Run the read-only
status command again to verify both limits are zero. Import/metadata recovery
and ordinary classification remain independent of this optional evaluation work.

## Sources and scope

Commands and limits were checked against the repository's budget CLI, contract
and worker. Official sources were discovered and opened through MCP search on
2026-10-09: [Docker exec](https://docs.docker.com/reference/cli/docker/container/exec)
for execution inside a running container, and
[Ollama usage metrics](https://github.com/ollama/ollama/blob/main/docs/api/usage.mdx)
for the distinction between actual token counts and our reservation accounting.
See the separate [design](../architecture/evaluation-capture-guidance-design.md)
and [verification outcome](../architecture/evaluation-capture-guidance-outcome.md).
