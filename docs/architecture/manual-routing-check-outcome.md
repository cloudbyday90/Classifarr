# Manual Routing Check Outcome

Implemented: 2026-10-03. No release, deployment or ingestion recovery.

## What changed

New manual queue attempts capture their resolved verification intent before
provider reconciliation. A capture failure prevents provider reconciliation.
Caller-supplied intent and previous observations are removed from the new history
record. The snapshot contains no API key or raw provider endpoint.

History now offers **Check routing** for saved manual classifications. This is an
explicit administrator action: `POST /queue/manual-routing/:id/check`. It accepts
only the record ID, uses current credentials for the captured endpoint, performs
one existing-item GET and returns a fixed reason/message plus `recorded` and, when
saved, `checkedAt`. The named ESM client method returns the raw response and turns
off automatic transport retries. Responses are not cacheable.

The original status and routing result are unchanged. A separate timestamped
observation records presence, absence, mismatch or provider unavailability. It
does not claim this request created the item, downloaded media, or matched every
monitor/quality setting. Old records without intent are never silently adopted.

The provider and destination contract is described in the separate
[design/research document](manual-routing-check-design.md).

## Boundaries

- Small ESM modules separate the intent contract, capture, guarded repository,
  service and route. A standalone Vue component keeps new logic out of History.
- The service admits at most two checks per process and one per record, with no
  waiting queue. The route allows five requests per minute per client IP. These
  are not distributed limits across multiple application processes.
- Initial reads use a short read-only transaction. Provider HTTP runs after its
  connection is released. Persistence locks/rechecks history, library, mapping
  and provider locally with two-second statement and 250-ms lock timeouts.
- Changed decisions, intent, attempts, routing state or newer observations refuse
  a late save. Unrelated history evidence is preserved.
- The frozen root includes any default resolved during the original attempt.
  A check does not look up today's defaults or infer what a new add would do.
  Endpoint fingerprints cannot distinguish replacement servers at the same URL.
- Errors and logs exclude provider payloads/credentials. UI messages use escaped
  text and a polite status region. No polling, focus moves or success-by-color.
- The ownership manifest adds one explicitly reviewed indirect-query source and
  rationale, retaining unresolved classification. The module does not write any
  ingestion relation; the gate is not proof of production writer ownership.

## Validation

- Focused backend: 149 tests passed, including both adapters refusing provider
  reconciliation when intent capture fails. Additional Sonarr read-only dispatch
  and manual capture-hook tests passed in the later focused rerun.
- Isolated real PostgreSQL: 23 tests passed across the new checks and existing
  manual writer suite. Cases cover fresh service instances, direct and mapping-only
  libraries, current credentials, concurrent configuration/decision changes,
  intent overwrite refusal, metadata preservation and lock timeouts.
- Full backend coverage run: 50,211 passed, one Linux-only case skipped on Windows,
  and one ownership-review assertion failed because the run began before the new
  manifest review was saved. The complete ownership suite and updated manual
  check/capture suites subsequently passed together: 74 tests. No gate was relaxed.
- The skipped Linux case was executed in an isolated, network-disabled Linux test
  container: five passed, zero skipped, using synthetic data and read-only source
  mounts. No production container was restarted.
- Full frontend coverage: 417 files and 5,929 tests passed. Focused UI tests cover
  explicit clicks, disabled/busy state, polite status feedback, persisted results,
  missing intent and sanitized permission/rate-limit/provider failures.
  A final focused rerun passed 24 tests, including the mounted History action
  using the named API method without a request when the record is opened.
- Lint, both type checks, copyright, both dependency checks, ESM import/mock-shape
  checks, the reviewed ownership gate, Markdown lint and production build passed.
  Coverage ratchet passed: server lines/branches 90.05%/85.49%, client 88.13%/78.97%.
  Initial Vue formatting warnings were corrected without suppressions.

No production provider was contacted, no live recovery records were changed,
and no container was rebuilt or deployed. GitHub MCP and the saved GitHub CLI
login reported no open PRs to randomly select; no PR was merged.

## Recommendation and next item

Use saved intent → bounded admin GET → current-state guard → separate observation.
This supports restart-safe diagnosis with no provider-write risk. The trade-off
is explicit operator action and no automatic recovery for older missing intent.

Next: a bounded background observation worker with durable cooldowns, a shared
concurrency budget, explicit enablement/current authorization and restart/upgrade
tests. Reuse this reader; do not introduce blind add replay. Keep legacy ingestion
ownership recovery separate and require stopped-writer confirmation.
