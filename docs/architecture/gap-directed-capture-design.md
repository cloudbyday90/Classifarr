# Gap-directed capture admission: design

## Problem and boundary

September 25, 2026. Commit `afbbf4f5` decoupled diagnostic coverage from capture.
The next inefficiency is inside capture: a flat request list spends the limited
allowance in encounter order, even when a later single missing response could
complete a pair or the opposite arm is blocked by a non-generation prerequisite.

Implement bounded, gap-directed admission **within the current capture window**.
Do not globally reshuffle the frozen cohort or abandon its unfinished checkpoint.
Retain movie/TV window rotation, the independent diagnostic sweep, default-disabled
capture, five-call recurring ticks, daily call/token reservations and shared
admission. No live inference, deployment or routing change is part of this work.

## Design

1. Replay produces a separate private admission description for at most 25 cases:
   hashed case/membership stratum, media type, and two request-key/gap references.
   No labels, names, prompts, destinations or model confidence choose priority.
   This description is validated at the worker boundary, not stored or exposed.
2. Keep the original exact request plan and order for checkpoint identity. Reuse
   saved responses, including rejected responses, and preserve publication order.
   Selecting a generation order must not silently reinitialize an old checkpoint.
3. After checking the current model and opening its checkpoint, replay the retained
   response batch when it differs from the original snapshot. Use the production
   response reducer to distinguish usable cached evidence from invalid output;
   do not introduce a weaker parser or infer success from the existence of a row.
4. Prefer pairs needing one distinct request before pairs needing two. Break ties
   by media and observed-membership stratum service counts, then stable case order.
   Deduplicate shared requests. Within a stable finite window, fulfilled requests
   leave the missing set, allowing remaining repairable pairs to progress.
5. A pair with a known blocked/invalid arm cannot justify new generation on its
   own. Its existing records and diagnostic gaps remain visible. Another repairable
   pair may independently justify a shared request. Budget exhaustion keeps
   actionable missing requests pending; no automatic budget increase is allowed.
6. Completion means all currently admitted requests were accounted for, not all
   pairs passed. Publish the canonical retained records and pin the existing
   completion marker for replay acknowledgement. Unsupported paths remain gaps
   owned by their existing recovery components, not new generation retries.

Priorities are a bounded batch decision. A response newly rejected during a tick
may leave another already admitted request unproductive in that same tick; the
next tick incorporates that failure. Do not claim optimality or independent-label
quality improvements. Changing inputs/model identity can alter admission, but
existing provenance, expiry and publication freshness guards still apply.

## Alternatives and recommendation stack

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Increase allowance | More attempts | Does not fix wasted requests; raises cost | Reject |
| Reorder the checkpoint plan | Simple loop | Can invalidate interrupted progress | Reject |
| Global new priority queue | More scheduling freedom | New ownership and starvation/recovery complexity | Defer |
| Separate bounded admission order | Better pair coverage under the same allowance; existing recovery | Extra cached replay when retained evidence differs; no global optimality | Implement |

Use small ESM admission logic → existing isolated production replay → exact
checkpoint and reserved local capture → transactional PostgreSQL publication →
existing protected aggregate API and pausable Vue SWR. No new queue, schema,
public API, settings, dependency or Command Center panel is required.

## Official sources verified September 25, 2026

URLs were discovered and read through online tools. These are project-specific
applications of guidance, not claims of certification or a new external standard.

- [AWS idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/):
  operation identity must distinguish retries from changed intent. Keep exact
  checkpoint identity separate from an evolving priority order.
- [AWS retry behavior](https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html):
  retry quotas bound repeated work. Preserve durable reservations and charged
  unknown attempts; do not turn unusable evidence into unrestricted retries.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  preserve coherent snapshots and revision-guarded writes; keep model work outside
  database transactions and retain the existing shared admission boundary.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  preserve user control over automatic UI updates. This backend scheduling change
  does not add focus changes, forced announcements or a new live-updating panel.
- [NIST AI RMF Core, Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document test sets, metrics, uncertainty and deployment relevance; independent
  review helps expose biased evaluation. Separate this synthetic scheduling result
  from the next independently labeled quality experiment. The page identifies
  this as published RMF 1.0 guidance, with a revision still in progress.

## Verification and next decision

Compare old encounter order with gap-directed admission on 300 synthetic movie/TV
cases in the same 12 bounded windows and equal call allowances. Check unique
requests, paired coverage, blocked/invalid gaps, names/labels independence and
restart reuse. Exercise real PostgreSQL checkpoint identity, interrupted capture,
quota/retention fences and full regressions. Record results separately.

The next decision is a predeclared, independently labeled paired evaluation of
actual movie/TV outcomes, not automatic routing promotion from synthetic coverage.
