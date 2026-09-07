# Suggestion cohort validation outcome

## Delivered behavior

Implemented the follow-up from the [atomic review work](suggestion-lifecycle-outcome.md).
Analysis now captures a consistent, bounded, versioned cohort before calculating
suggestions. Threshold and weight support includes the feedback used in their
rates. All suggestions from a stored batch share an immutable PostgreSQL cohort;
each configuration and supporting-ID list is bound to its fingerprint.

Application validates root-policy configuration, active destination identity,
every original feedback member, the rolling lookback, and the stored binding
before changing policies or patterns. Dependency share locks protect the interval
through commit. Missing/stale evidence returns 409, while contention returns a
separate busy conflict. Existing native-intent restrictions remain in effect.

With enough eligible feedback, normal analysis supersedes obsolete pending
suggestions and creates fresh suggestions without a manual cleanup step. History
retains the original evidence and does not invent a human review. Legacy pending
suggestions can still be rejected. The dashboard labels superseded history,
names its filters for assistive technology, and refreshes after a conflict without
resubmitting approval. Reserved metadata names cannot alter inherited grouping
properties. The threshold-analysis response retains its original public shape.

## Validation

Local validation on 6 September 2026:

| Check | Result |
| --- | --- |
| Focused backend units | 116 tests passed across 8 suites |
| Suggestion/eligibility PostgreSQL integration | 69 tests passed across 4 suites |
| Provenance-module PostgreSQL coverage | 96.07% statements/lines, 92.64% branches, 100% functions |
| Inventory cleanup and learning integration | 74 tests passed across 4 suites |
| Full frontend suite with coverage | 4,508 tests passed across 327 files |
| Final affected frontend checks | 28 tests passed across 3 files, including the subsequently added history-card cases |
| Type checking, lint, ESM checks | Passed |
| Migration | Naming/integrity passed; repeated twice against populated fixtures without rewriting evidence |
| Container build and schema | Local image built; snapshot generated from a disposable PostgreSQL 18 container and matched a fresh install |

The PostgreSQL cases cover changed policy destinations and configuration, inactive
or changed library identities, deleted/detached/modified feedback, expired input,
changed suggestion support/configuration, missing legacy provenance, busy rows,
automatic supersession, duplicate preservation, immutable storage, the 5,000-row
bound, and lock protection until commit. Unit checks cover the byte bound,
malformed input, canonical hashing, reserved keys, and public response shape.

Frontend coverage was 85.65% statements, 77.31% branches, 84.48% functions and
87.60% lines. The repository coverage ratchet passed using that fresh frontend
report and the existing backend full-suite report from the preceding lifecycle
change; the entire backend coverage suite was not rerun. Fresh backend validation
here is the focused unit and real PostgreSQL work listed above.

## Local data and PR availability

A read-only Compose inspection at 2026-09-06 23:39:59 UTC found PostgreSQL 18.6,
zero feedback rows, zero tuning suggestions, and zero eligible cohorts. It took
86.379 ms and performed no production writes, provider requests, or individual
record export. Runtime helpers were streamed through `docker exec -i` because the
container filesystem is read-only; no application files were replaced.

Consequently this change has real database validation with controlled fixtures,
but no measured production suggestion error profile. It does not complete the
independently labeled semantic study or enable semantic counter-evidence/routing.
Existing inventory observation and readiness workflows remain separate.

GitHub MCP returned an empty open-PR list twice during this work. No random open
PR was available for local implementation, and no external PR was merged. This
change has no version bump, release tag, or release publication.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Shared immutable manifests | Full analysis attribution with automatic collection | Additional bounded database storage |
| Validate under dependency locks | Prevents stale application and validation/write races | Contention can require another attempt |
| Supersede during normal analysis | Low manual effort; preserves original history | Requires enough current feedback for a usable analysis |
| Keep explicit approval | Maintains the existing authority boundary | Provenance alone does not establish classification accuracy |

Recommended stack: consistent capture → pure analysis → locked revalidation and
deduplicated storage → explicit review → locked evidence checks and atomic effects.
Use the [design document](suggestion-cohort-design.md) for official W3C,
PostgreSQL and HTTP sources, the August-baseline research qualification, and
alternatives. Root-policy and destination identity checks do not claim coverage
of linked presets, overrides, provider configuration, or a whole-model revision.

## Next item

Completed by the [metadata-vote follow-up](feedback-metadata-votes-outcome.md).
The original recommendation below records the handoff from this provenance work.

**Count each feedback item once per normalized metadata value.** A local
reproduction using one feedback row with three identical `Action` genres produced
`count: 3` and `feedbackIds: [1, 1, 1]`. Stored supporting IDs are now unique, but
the existing pattern confidence formula still uses the inflated count. Fixing
that evidence-counting bug is a small, deterministic next step that requires no
additional operational labeling. Then assess repeated feedback for the same media
identity separately, with an explicit policy for corrections over time.
