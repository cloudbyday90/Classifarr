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

### Known cause: Ollama 0.40.1 model conversion

Ollama 0.40.1 can list both the original GGML model and its converted llama.cpp
copy under the same name. [Ollama 0.40.2](https://github.com/ollama/ollama/releases/tag/v0.40.2)
includes the [upstream listing fix](https://github.com/ollama/ollama/pull/18874/files):
the API returns the locally selected model instead. This is provider metadata,
not a Classifarr import-ownership or database migration failure.

1. Check the version of the **configured Ollama server**, not just a local CLI.
   Confirm which applications share it and schedule its update/restart accordingly.
2. For a server on 0.40.1, update to 0.40.2 using that server's existing deployment
   method, retaining its model storage and configuration. Rebuilding Classifarr
   does not update Ollama on another host. Do not delete backup models or select
   internal `llamacpp:<digest>` downgrade guard aliases as a workaround.
3. Repeat `--source-pair-ai-provider-status`. It must pass before activation;
   an updated version number alone does not prove the model listing is correct.
4. Verify current inventory, vectors and policy readiness before the bounded
   trial below. Disable the recurring budget afterward and check saved replay.

For other versions or persistent duplicates, inspect the provider/proxy mapping;
do not assume this specific upstream bug. Preserve the sanitized report and
related log IDs for a GitHub issue if the failure remains unexplained.

For the native Windows Ollama app, its
[official upgrade guidance](https://github.com/ollama/ollama/blob/main/docs/faq.mdx)
uses the tray/taskbar menu's **Restart to update** action when an update has
downloaded. Confirm the server version afterward. Coordinate with other clients
first: separate Classifarr databases can still share one inference server.

### Enable a bounded allowance

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

For a supervised trial, record the image revision, UTC start time and starting
reservation counts. Stop after publication, an unavailable outcome or the agreed
observation deadline; disable and verify the limits even if replay is still
waiting. Do not leave a daily allowance enabled overnight by accident. Cleanup
in a terminal script is not a durable expiry if that terminal or host crashes.

Five reserved calls do not promise five compared items. An item can require two
different responses, and responses must still pass replay validation. Record
these checkpoints separately:

1. **Calls reserved:** admission accounting, including uncertain/failed calls.
2. **Responses published:** reusable output for the exact model/configuration and
   evidence, not permission to perform more inference.
3. **Saved pairs:** both comparison sides are usable in a newer saved revision.

After disabling, `captureStatus: disabled` replaces the last capture outcome;
this does not erase published responses or same-day reservations. Keep the
publication timestamp so it can be compared with the next saved revision.

If policy replay reports `memory_pressure`, preserve that timestamp and image
reference and allow the normal cooldown. Do not regenerate already published
responses, reset imports, force garbage collection or relax admission limits.
Host free memory and a later Docker sample do not reconstruct the refused
admission check. Persistent pressure needs per-attempt memory evidence, including
container headroom and concurrent reservations, before selecting a fix.

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
