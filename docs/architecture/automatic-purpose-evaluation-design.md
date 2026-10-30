# Automatic destination review summary design

Date: 2026-10-30. Status: complete first batch agreed; implementation in progress.
Follows the [frozen context foundation](prospective-purpose-case-context-outcome.md).
The separate outcome document records verification and delivery.

## Agreed operator process

Automatic evaluation → saved aggregate → one quiet row in the existing
administrator Evaluation progress area. Counts and reasons expand on demand.
Routine use requires no CLI command, extra page, configuration wizard or run
button. Developer tools remain optional. Keep the process precise and reuse the
existing scheduler, ownership, resource admission and saved-status patterns.

The user confirmed the complete first batch: an independent provider-free job,
aggregate-only checkpoint and protected saved-status presentation. Keep purpose
evaluation separate from the existing inventory audit's population, denominator,
failure state and freshness. No item-level API/UI or saved private case report is
included. No routing, learning, capture, import, historical inference, release or
deployment authority is added.

## Evidence and measurements

Use the existing coherent thirty-day purpose snapshot and shared complete-window
eligibility, alias conflict validation and chronological holdouts. Bound input to
5,000 events / 64 MiB. Compare the frozen policy leader with explicit choice,
independently proven original automated destination with choice, and policy
leader with original. Preserve recorded confirmation/change and source/reference
meanings; missing original proof remains unavailable.

Save only closed counts: overall comparisons, confirmation/change and source
groups, original-proof availability, canonical/alias/holdout coverage and fixed
gap reasons. All sums and denominators must validate. Keep the report at 16 KiB
and omit IDs, titles, hashes, names, actors, raw snapshots and full alternatives.
Full policy context is unnecessary for these counts. An empty source read means
no retained canonical explicit choices in that window, not zero classifications,
successful capture readiness or zero gaps. Producer readiness stays unassessed.

Missing required source tables are explicitly unavailable. A fresh/empty setup
performs no provider, capture or recovery work and reports no retained choices.
Unknown/invalid evidence cannot become a favorable result or a historical label.

## Scheduling, admission and completion

Reuse the automatic evaluation worker and maintenance-idle resource admission,
with independent session ownership and checkpoint. Allow one active job per
installation. Start after four minutes; scheduler ticks every minute, while the
saved checkpoint permits refresh after five minutes. Persist five-to-sixty-minute
failure backoff and retain the existing local fallback when persistence fails.
Heavy ingestion or insufficient/unknown memory defers evaluation.

Read evidence in a read-only repeatable-read UTC transaction with existing
12-second statement, one-second lock and fifteen-second transaction bounds.
Evaluate in a bounded worker with 512-MiB old-generation heap, sixty-second
deadline, bounded transport, suppressed worker output and termination/join before
releasing ownership or admission. Cancellation/shutdown cannot publish a later
result. No transaction spans a provider call; this job makes no provider calls.

One replaceable checkpoint stores validated counts and normal scheduler metadata.
Accept only coherent source/report clocks; an older completion cannot overwrite
a newer snapshot. Failures clear report data and persist fixed reasons, never
untrusted exception text. Exclude the checkpoint from portable configuration
exports and clear it within the existing restore transaction/admission. Restart
respects persisted cooldown. No source evidence is rewritten or pruned here.

## Saved status and minimal UI

An authenticated administrator-only, rate-limited, no-store GET reads only the
checkpoint. It never starts evaluation or reads source item payloads. Distinguish
never-run, missing sources, no retained choices, no eligible choices, stale,
deferred, failed and complete diagnostic results. Withhold counts for invalid,
failed, unavailable or fifteen-minute-stale state; missing data is not a zero.

Add one compact summary in Evaluation progress and native expandable details.
Use plain operator language and explicit unknown states, not accuracy/error
claims or implementation jargon. Reuse the existing pause behavior, five-minute
nonpersistent polling, authorization-loss clearing and monotonic client staleness.
No repeated notifications, additional dashboard or new trigger controls.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Independent automatic aggregate | Clear denominator and failure isolation; no manual trigger | Small checkpoint and status contract | Agreed |
| Fold purpose counts into inventory audit | Fewer visible concepts | Couples different evidence and freshness | Reject |
| Persist private CLI case output | Immediate item detail | New disclosure/expiry boundary; up to 1 MiB | Defer |
| Run evaluation from status GET | Simple trigger | Polling becomes expensive work and loses scheduler ownership | Reject |
| New dashboard/settings/run controls | More controls | Adds clutter and manual steps | Reject |

Recommendation stack: existing frozen evidence → shared eligibility → bounded
automatic counts → independent replaceable checkpoint → protected saved-status
GET → one quiet expandable summary. Agreement is not accuracy, and policy
context cannot establish later AI/router causation.

## Official guidance and verification

The [W3C PROV-DM, PostgreSQL, OWASP and NIST research](prospective-purpose-case-context-design.md)
was discovered/read through MCP on October 30. This design applies its provenance,
coherent snapshot, resource-limit and contextual-measurement principles.
Additional [W3C disclosure guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
and [WCAG status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
was discovered/read through MCP for the UI: native expansion, keyboard access, visible focus and polite
status announcements without moving focus. These are engineering applications,
not a full accessibility-conformance claim.

Test complete/empty/gapped/conflicting evidence, closed aggregate sums and privacy;
worker bounds, ownership, cancellation, restart, stale completion and backoff;
real PostgreSQL writes/restore lifecycle and coherent reads; authenticated saved
status with no heavy reads; strict client contracts, pause, staleness and denied
access. Run API leaf tests, focused component checks, applicable schema and
repository gates, fresh backend/client coverage and the unchanged ratchet.
Update Unreleased, commit and push directly on main. Create no release.
