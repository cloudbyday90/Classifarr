# Policy Builder Phase 6R Workflow Quality Gate

## Status

Implemented as a hardening slice on top of Phase 6R.5 Operator Workflow
Rebuild.

The bounded operator workflow entry point now requires the sanitized evidence
quality snapshots that were introduced earlier in Phase 6R. It blocks workflow
projection when bounded intent, bounded readiness, or embedded readiness context
is missing quality, carries insufficient quality, or no longer matches.

## Problem

Phase 6R.5 already required successful bounded intent and bounded readiness
contracts with matching evidence projection fingerprints. That protected
provenance, but it still left a smaller gap: a caller could pass a readiness
result that was successful yet stripped or drifted the quality snapshots that
Phase 6R.2 through Phase 6R.4 depend on.

That matters because the operator workflow is the first product-facing surface
after the engine chain. If it renders without quality continuity, the UI could
show a simple destination workflow while the underlying evidence state is stale,
insufficient, or no longer the same evidence used by intent/readiness.

## Official Guidance Reviewed

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  frames trustworthy AI work through Govern, Map, Measure, and Manage. The
  workflow gate treats evidence quality as measured context that must remain
  intact before operator-facing AI-assisted workflow is returned.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  emphasizes adding secure software practices into development lifecycles. This
  slice keeps the quality check server-side and testable at the workflow
  boundary.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  states that validation must be implemented server-side before application
  functions process data. The bounded workflow validates legal combinations of
  intent, readiness, and embedded readiness quality before returning a workflow.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends validating legal combinations and unit-testing invalid
  combinations. The tests cover missing, insufficient, and mismatched quality.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) includes error identification,
  labels/instructions, and status-message expectations. The workflow gate
  produces structured risk IDs rather than rendering a partial or misleading
  workflow.

## Recommendations

1. **Quality is part of the workflow boundary.**
   A workflow projection must not render from bounded readiness unless the
   sanitized quality snapshots are present from bounded intent, readiness
   boundary context, and embedded readiness input context.

2. **Insufficient quality blocks the normal workflow.**
   Insufficient evidence quality means the system needs more evidence or
   operator confirmation before the ordinary destination workflow is shown.

3. **Quality continuity must match provenance continuity.**
   Matching projection fingerprints prove the contracts reference the same
   evidence projection. Matching quality snapshots prove they also agree on the
   evidence's usable state.

4. **Expose only sanitized quality metadata.**
   The workflow boundary may carry status IDs, next-action IDs, reason IDs,
   counts, and booleans. It must not carry raw evidence labels.

5. **Audit rendered bounded workflow context.**
   If a workflow has a bounded context, validation rejects missing,
   insufficient, or mismatched quality snapshots even after projection.

## Pros And Cons

Pros:

- Prevents the simplified UI from masking missing or stale evidence quality.
- Keeps quality enforcement server-side instead of relying on Vue checks.
- Extends the same bounded handoff pattern already used by intent, learning,
  and readiness.
- Gives Phase 6R.6 migration/deletion work a stronger workflow handoff.

Cons:

- Adds another boundary check that tests must preserve when mutating fixtures.
- Does not remove old UI panels by itself.
- Still relies on the prior evidence-quality assessment rather than introducing
  a persisted quality table.

## Final Recommendation Stack

- Quality source:
  `server/src/services/policyEvidenceQuality.mjs`
- Readiness source:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Workflow gate:
  `server/src/services/policyBuilderPhase6OperatorWorkflow.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase6OperatorWorkflow.test.mjs`
- Existing operator workflow record:
  `docs/architecture/policy-builder-phase-6r-operator-workflow.md`
- Roadmap owner:
  Phase 6R.5 in `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The bounded workflow context now includes sanitized quality:

```text
intentBoundary.quality
readinessBoundary.evidenceQuality
readinessBoundary.intentQuality
readinessBoundary.learningQuality
qualityMatch
```

The bounded workflow entry point blocks with:

```text
missing_bounded_quality
bounded_quality_insufficient
bounded_quality_mismatch
```

The workflow validator also rejects bounded workflow context that drops or
mutates sanitized quality after projection.

## Security Outcome

- Missing quality cannot render a normal workflow.
- Insufficient quality cannot render a normal workflow.
- Drifted quality between bounded intent, readiness context, and embedded
  readiness context cannot render a normal workflow.
- Workflow quality context remains label-free.
- The UI still receives only a server-owned workflow projection and cannot use
  client-side checks as the security boundary.

## Next Step

Proceed to **Phase 6R.6 Migration And Deletion Path**. The migration/deletion
handoff should consume only quality-gated bounded workflow results before
classifying old diagnostic surfaces as verifier machinery or deletion targets.
