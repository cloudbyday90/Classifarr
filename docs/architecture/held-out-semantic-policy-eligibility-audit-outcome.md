# Held-out semantic policy eligibility audit outcome

Status: Implemented, unreleased. See the separate
[design](held-out-semantic-policy-eligibility-audit-design.md) for the
architecture, research, alternatives, and recommendation stack.

## Delivered

- Added `heldOutSemanticStudyEligibilityDiagnostics.mjs`, which reduces a
  broad-policy decision to a fixed action and ranked-candidate-count category.
  The cohort receipt now reports those aggregate diagnostic counts alongside
  contract states.
- Refactored shared in-memory inventory metadata construction into
  `heldOutSemanticStudyInventoryCandidate.mjs` so prospective capture and the
  audit use the same canonical identity, normalization, stratum, and
  source-conflict rules.
- Added a capped, parameterized canonical-population audit source that detects
  truncation with one additional row.
- Added a configuration-bound ESM audit service and private no-argument
  command: `npm --prefix server run study:audit:held-out-policy-eligibility`.
- Added focused unit coverage for diagnostics, audit source bounds, aggregate
  reporting, configuration drift, and private command lifecycle.

## Real local audit

The read-only command completed against the local Compose inventory on 7
September 2026 with status `complete`. It inspected **6,639** canonical
identities, below the 8,000-case cap, after current source-conflict exclusion.
The aggregate stratum population was 331 documentary, 5,232 genre-overlap,
833 ordinary, and 243 reality records.

All 6,639 results were `not_pending_policy_decision` with the fixed diagnostic
`manual:none`. There were zero `ready` contracts and zero eligible cases in
every stratum. The aggregate active configuration contained ten native policies
(five movie and five TV) with declared-purpose rules, so this is not caused by
the absence of an active policy for a media type.

The audit performed no semantic retrieval, provider call, database write,
policy change, routing, fixture creation, label collection, readiness check,
or frozen-study preflight. Its redacted output is retained only beneath ignored
`.tmp/`.

## Conclusion

The prior 384-case result was representative of the complete canonical
population under the held-out boundary. Current native policy purpose signals
produce no ranked candidate for any audited record once assignment authority,
history, profiles, patterns, and RAG are removed. This is a policy-intent
coverage and signal/metadata-semantics question, not evidence that semantic
retrieval should be used to select the study or that thresholds should be
lowered.

GitHub's public pull-request page showed zero open pull requests on 7
September 2026. No random PR was available to reproduce locally, and no closed
or merged PR was substituted.

## Next item

Conduct a separately reviewed **native policy-intent coverage design**. It
should identify why every declared-purpose evaluation yields `manual:none`
against canonical metadata, verify the intended metadata/signal semantics and
policy overlap, and use existing policy-change governance for any approved
revision. It must not add semantic selection, automatic routing, or synthetic
study labels. Rerun this audit after any approved policy change; only then can
the prospective cohort capture be retried.
