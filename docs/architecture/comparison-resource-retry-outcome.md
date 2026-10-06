# Comparison resource retry outcome

Date: 2026-10-06. [Design, tradeoffs and official sources](comparison-resource-retry-design.md).

## Implementation

The comparison refresher now uses a small ESM retry-policy factory. Typed resource
deferrals wait at least 60 seconds without increasing or resetting genuine failure
history. Independent deadlines cannot shorten a pending true-failure delay. The
existing exponential sequence, jitter, cap, successful-refresh schedule, clock and
configuration reset boundaries remain. No timer, persistent record, migration,
memory-limit change, allocator change or forced collection was introduced.
Success resets now wait until admission's final checkpoint returns; a new failing
regression exposed the previous reset-before-checkpoint edge case.

Every attempt still needs real admission, cancellation and fresh source/provider
verification. Pressure clears cached context; contention retains it only within
the existing TTL/revision rules. Ordinary retrieval remains available without
optional comparison context. This fixes retry accounting, not a demonstrated leak.

## Validation in progress

The added mixed-failure regressions failed all three typed-refusal cases against
the original refresher (24 other tests passed). After the fix, 10 focused suites /
153 tests pass, including real admission with a fixture lease, repeated refusals,
retained fourth-failure backoff, jitter bounds, reset boundaries, cancellation,
late ticks and cache expiry. Injected clocks prove logic, not elapsed recovery.
The final-checkpoint regression separately failed before moving the success reset
and passes afterward. Server lint, typecheck, both dependency checks, copyright,
static-import/mock-shape checks and Markdown pass. All eight restored runtime-major
checks pass. The broad backend run passes 1727 suites / 53,686 tests with one
Windows-only Linux-fsync skip. A full rerun on the final checkpoint-adjusted source
is in progress; the Linux image will exercise the skipped filesystem assertion.
The no-cache image, unchanged full
catalog study, local recreation, isolated schema dump/check and health window
remain pending; no successful image-recovery claim is made yet.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact two-file diff locally:
Node declarations 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. The unchanged
runtime-major gate failed on the client Node-26 declarations (seven tests passed).
Reverted only that trial before installation. No retained dependency change or
PR merge; Node 24.21.0/npm 12.2.0 remain pinned. The restored gate passes.

## Next decision

Keep the separate cooldown if the unchanged image study verifies completion and
later revalidation. Its benefit is timely reconsideration after resources recover;
its cost is more bounded admission checks during sustained pressure. Do not reset
true failures, relax admission or lengthen the study to obtain a pass. Next resume
controlled native/anonymous-residency attribution before another memory fix, with
available dependency patches handled as a separate reviewed batch.

No release, tag, new branch or Unraid change.
