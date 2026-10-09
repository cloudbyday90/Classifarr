# Five-call local evaluation capture trial

Date: 2026-10-09. Scope: local testing only; no Unraid change or release.

## Decision and prerequisites

Exercise the existing recurring worker with five calls and 42,240 reserved tokens
for one supervised observation period, then disable it again. This is not approval
for a recurring daily workload. Require ready inventory, completed policy replay,
an installed local Ollama completion model and an initially disabled budget. Do
not bypass incomplete vectors, resource admission or a cooldown to obtain results.

The preflight found ready inventory but five missing cached descriptions. Allow
normal backfill and replay to advance before activation. If prerequisites remain
blocked, diagnose them and record an incomplete trial rather than increase limits.

## Safety and completion

Preflight update: the endpoint returned two matching `gemma4:e4b` entries with
different digests. The existing client rejected them before generation. Keep that
identity check intact. Add an explicit read-only `--source-pair-ai-provider-status`
command to distinguish ambiguous identity from a missing model, remote model,
invalid identity, unsupported capability or unknown inspection failure. It must
not activate capture, load/generate/pull models, reserve quota or claim that
inventory, memory and policy admission have passed. Read configuration in a
read-only transaction, finish the transaction before HTTP, use the existing
bounded client with a 15-second overall inspection deadline, and return only fixed
codes/actions. An unknown result should direct the operator to a sanitized GitHub
issue. This is a diagnostic fix, not permission to select a different model.

Use the existing container CLI and ordinary scheduler, not the one-shot capture
command. The database-scoped admission lock, short atomic quota reservations,
configuration revision checks, 20-minute capture deadline, three-minute HTTP
deadline and 1 MiB response limit remain unchanged. Only the configured installed
local model may run; no model download, cloud fallback or routing write is allowed.

Observe within the same UTC day for at most 20 minutes after activation. A
supervised process must restore both limits to zero in its cleanup path and verify
the result. This operational cleanup is not a durable expiry guarantee against a
host crash; do not represent the recurring budget as a one-shot permission. A
restart, disable or ambiguous request must not erase charged reservations. An
already dispatched request may finish; cancellation is not remote rollback.

Completion requires separately observing reserved attempts, validated publication
and subsequent saved replay. Record partial coverage, not an accuracy claim. A
transient deferral retains normal retry rules; permanent provider incompatibility,
unknown errors or cancellation end this trial without expanding permission. Keep
only bounded aggregate diagnostics, timestamps and image references in documentation.
Do not publish prompts, raw responses, connection details or database dumps.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Existing worker, five calls, supervised disable | Tests the actual deployed path with durable accounting | Needs explicit cleanup; selected |
| One-shot capture command | Convenient direct execution | Does not prove recurring quota/scheduler behavior; reject for this trial |
| Larger or indefinitely enabled budget | More coverage | Unnecessary inference before the small path is proven; defer |
| Fix a reproduced defect | Improves the actual failure boundary | Requires focused regression evidence; only if the trial exposes one |

Recommended sequence: readiness → local provider inspection → five-call allowance
→ ordinary scheduling → publication/replay evidence → disable and verify → rebuild
without cache → isolated schema dump and health checks. Do not invent a runtime
refactor merely to turn an operational trial into a code change.

Random PR companion: current open candidates 555 and 556 were enumerated with the
saved GitHub login; `Get-Random` selected [555](https://github.com/cloudbyday90/Classifarr/pull/555)
at `5545605b53c854de8847b44e24fa083ff4218080`. Apply its exact MCP-retrieved manifest
and lockfile diff, test the existing Node-major gate and retain it only if compatible.
No merge, closure, comment or silent replacement with another dependency update.

## Official sources

Discovered/retrieved through MCP on 2026-10-09:

- [Ollama usage metrics](https://github.com/ollama/ollama/blob/main/docs/api/usage.mdx):
  measured input/output token counts are distinct from conservative reservations.
- [Node 24 cancellation](https://nodejs.org/docs/latest-v24.x/api/globals.html):
  compose timeout and shutdown signals; cancellation does not promise remote undo.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  use existing advisory admission and atomic row updates, not inference inside an
  open quota transaction.
- [DefinitelyTyped versioning](https://github.com/Definitelytyped/DefinitelyTyped):
  declaration major/minor describes the corresponding library; keep Node 24 types
  with this deployment rather than weaken the compatibility gate.

The selected architecture is our application of these sources. The separate
outcome document will distinguish observations from remaining uncertainty.
