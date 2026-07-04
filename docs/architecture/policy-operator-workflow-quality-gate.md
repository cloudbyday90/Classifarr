# Policy Operator Workflow Quality Gate

## Status

Implemented as the durable quality-gate hardening record for the policy
operator workflow.

The bounded operator workflow entry point requires sanitized evidence-quality
snapshots before returning a normal workflow projection. It blocks workflow
projection when bounded intent, bounded readiness, or embedded readiness context
is missing quality, carries insufficient quality, or no longer matches.

## Problem

The policy operator workflow already requires successful bounded intent and
bounded readiness contracts with matching evidence projection fingerprints.
That protects provenance, but it still leaves a smaller gap: a caller could
pass a readiness result that is successful yet stripped or drifted the quality
snapshots that upstream evidence, intent, learning, and readiness depend on.

That matters because the operator workflow is the first product-facing surface
after the engine chain. If it renders without quality continuity, the UI could
show a simple destination workflow while the underlying evidence state is stale,
insufficient, or no longer the same evidence used by intent/readiness.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames AI risk management around governed and measured system behavior. The
  workflow quality gate treats evidence quality as measured context that must
  remain intact before operator-facing AI-assisted workflow is returned.
- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  emphasizes verified secure design and lifecycle traceability. The quality
  check remains server-side and testable at the workflow boundary.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  provides actionable guidance for validating inputs before application
  functions process data. The bounded workflow validates legal combinations of
  intent, readiness, and embedded readiness quality before returning a workflow.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends validating legal combinations and testing invalid combinations.
  The focused workflow tests cover missing, insufficient, and mismatched
  quality.
- [OWASP Web Security Testing Guide: Business Logic Data Validation](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
  emphasizes that logically valid data must be enforced at the server boundary,
  not only at the frontend.
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

6. **Keep the UI subordinate to the server gate.**
   Vue can render the workflow result, but it should not rebuild quality
   continuity from raw diagnostics or treat client-side checks as the security
   boundary.

## Pros And Cons

Pros:

- Prevents the simplified UI from masking missing or stale evidence quality.
- Keeps quality enforcement server-side instead of relying on Vue checks.
- Extends the same bounded handoff pattern already used by intent, learning,
  readiness, and migration.
- Gives migration/deletion work a stronger workflow handoff.
- Preserves label-free quality metadata for future trace and audit use.

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
  `server/src/services/policyOperatorWorkflow.mjs`
- Test module:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`
- Existing operator workflow record:
  `docs/architecture/policy-operator-workflow.md`
- Quality-gate owner:
  `docs/architecture/policy-operator-workflow-quality-gate.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The bounded workflow context includes sanitized quality:

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

Continue with **Policy Migration Deletion Path Architecture Cutover**. The
migration/deletion handoff should consume only quality-gated bounded workflow
results before classifying old diagnostic surfaces as verifier machinery or
deletion targets.
