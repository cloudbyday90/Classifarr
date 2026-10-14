# Background AI evaluation controls: outcome

Status: Unreleased, 2026-10-14. Verification in progress. See the separate
[design and research](evaluation-workload-controls-design.md).

## Implemented contract

Command Center now provides administrator-only Off / When idle / Scheduled
controls and a daily request safety limit. The existing scheduler resumes work
without an open page. The additive migration preserves zero/positive legacy
allowances; it does not activate inference. Legacy token and request ceilings
remain intact until explicitly edited. The UI displays their tighter effective
request limit instead of implying local-model billing.

GET `/api/stats/evaluation-workload` is read-only, no-store and administrator-only.
PUT accepts exactly `revision`, `mode`, `dailyRequests`, `startMinute`, and
`endMinute`. Revisions reject lost updates with 409; invalid input returns 400,
unknown failures 503 with fixed codes. Mutation limits are ten per minute, reads
thirty. The existing API authentication and application CSRF protection remain.
Only an explicit save changes durable consent. Neither route performs inference.

Both configuration paths preserve same-day counters and cooldown timestamps.
The private legacy CLI keeps a saved window while changing its two ceilings.
UTC windows support midnight, include start, exclude end, and reject equal times.
Reservation SQL checks the window at every request. One existing heavy-work
permit spans capture and cleanup. The new serial monitor checks local readiness,
revision and window during capture, with a separate check before each generation.
Unknown admission cancels the HTTP wait. No remote rollback is promised and no
attempt is refunded. Existing model identity, response size, timeout, retention,
memory admission, checkpoint and replay restrictions remain unchanged.

## Scope

No provider-wide coordinator is added. Independent Classifarr databases can still
call their shared Ollama simultaneously. These settings cannot guarantee GPU-wide
priority. No Unraid setting, shared provider setting, live evaluation opt-in,
release, tag, merge or model download is included.

GitHub MCP returned no open Classifarr pull requests on 2026-10-14. There was no
eligible PR to randomly implement; none was substituted or merged.

## Verification

Pending final gates and local image evaluation. Test data is synthetic and model
requests use loopback HTTP fixtures, not shared Ollama. The schema was generated
in a disposable network-none PostgreSQL container from the preceding local image;
the owned container and temporary data directory were removed.

## Next recommendation

Design provider-wide background admission for installations sharing Ollama,
including authenticated installation identities, bounded leases, failure-closed
behavior and foreground priority. Until then, opt in on one installation or use
deliberately separate windows. Do not raise shared server parallelism as a shortcut.
