# Operator Review Progressive-Disclosure Outcome

**Date:** 2026-09-01
**Status:** Implemented; no release created

## Delivered

- Added `CandidateReviewEvidenceSummary.vue`, a focused presentation component
  that gives the operator one plain-language conclusion by default and moves
  source checks, exact-item cross-checks, and bounded AI candidate comparison
  into `Review evidence details`.
- Added `policyCandidateReviewEvidenceSummaryPresentation.js`, an ES-module
  adapter that maps the existing fixed, normalized evidence states to concise
  operator copy.
- Rephrased the existing-library evidence state. It now says that library
  contents make a destination plausible but do not prove this item belongs
  there; it no longer exposes the internal “contextual versus semantic proof”
  distinction as an operator task.
- Removed repeated decision/safeguard copy when both sources say the same
  thing. Source evidence remains available through its labelled disclosure.
- Added `AiProviderCapabilityMetricsTelemetryDetails.vue`, grouping the three
  diagnostic telemetry aggregates behind one collapsed native disclosure while
  leaving current health and the protected Error Logs handoff visible.
- Added regression tests for the new candidate evidence summary, the telemetry
  disclosure, state mapping, and the existing pending-review component.

## Operator result

For a result like **Deep Water → Movies**, the visible message now means:

> This library looks like a possible fit, but the system does not have enough
> independent proof to place the item automatically. Confirm Movies only if it
> belongs there; otherwise choose another destination.

The operator can expand details to check why the collection looked compatible,
whether the exact item is already present in an eligible library, and whether a
bounded AI comparison offered advice. Those checks remain advisory and do not
select or route media.

## Verification

Targeted client tests passed:

```text
6 test files passed
15 tests passed
```

Additional local verification completed:

- client lint and Vue type-check;
- client production build;
- documentation lint and static ESM-import check; and
- `docker compose build --no-cache`, followed by a force recreation with
  Compose health waiting. The rebuilt `classifarr` service became healthy.

## Open PR check

The repository currently has no open pull requests, so no random PR could be
implemented locally for this work. The check was performed against the
[Classifarr pull-request list](https://github.com/cloudbyday90/Classifarr/pulls).

## Next item

Evaluate confirmed operator outcomes by candidate-evidence state and policy
scope. If broad compatibility signals repeatedly promote specialized
destinations, revise the deterministic policy/ranking calibration with a
bounded, evaluated correction rather than making AI or RAG authoritative.
