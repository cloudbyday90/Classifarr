# Policy Builder Phase 3R Completion Audit

Status: implemented as the Phase 3R completion gate before Phase 6R runtime
handoff.

## Scope

This slice adds a server-owned completion audit for Phase 3R. It does not add
new policy-builder UI and does not change policy storage. Its job is to prove
that the Phase 3R component-by-component rebuild has enough evidence to hand
operator intent into Phase 6R without bringing old replay, provider, TMDB,
scoring, parity, or legacy-template internals back into the normal authoring
workflow.

## Current Best-Practice Inputs

Official sources reviewed as of June 2026:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/Projects/ssdf>
  - SSDF emphasizes documented practices, tasks, evidence, and risk-based
    verification instead of ad hoc completion claims.
- Vue Test Utils, A Crash Course:
  <https://test-utils.vuejs.org/guide/essentials/a-crash-course.html>
  - Component tests should mount components, find elements, trigger events, and
    assert rendered behavior that users can observe.
- Vitest, Writing Tests:
  <https://vitest.dev/guide/learn/writing-tests.html>
  - Tests should have clear names and assertions tied to the behavior under
    test.
- W3C WCAG 2.2, Conformance:
  <https://www.w3.org/WAI/WCAG22/Understanding/conformance>
  - Completion claims should be made against defined requirements rather than
    informal assumptions.

## Recommendations

1. Treat Phase 3R completion as an evidence gate, not a narrative claim.
2. Verify four artifact groups:
   - server contracts for 3R.1 through 3R.9,
   - Vue-facing rewrite slices,
   - normal workflow rules,
   - normal-path exclusions.
3. Require every implementation record to name:
   - stable id,
   - readable label,
   - documentation path,
   - owning service path when server-owned,
   - regression test path when executable,
   - evidence statement.
4. Keep verifier-only and bridge-only surfaces explicit:
   - impact preview,
   - representative replay,
   - provider readiness details,
   - TMDB coverage details,
   - raw starter-template mechanics,
   - legacy policy storage shape.
5. Fail the audit when artifact paths drift. This immediately caught the stale
   routing-readiness test reference and corrected it to
   `client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js`.

## Pros And Cons

### Pros

- Gives Phase 3R one concrete completion gate before Phase 6R consumes its
  output.
- Prevents old internal diagnostics from returning as normal authoring
  requirements.
- Catches stale docs/service/test references.
- Keeps future Phase 3R work accountable to executable evidence.

### Cons

- The audit proves artifact coverage and classification, not visual perfection.
- It does not replace targeted Vue tests for each component.
- It adds one more server contract to maintain when Phase 3R artifacts are
  renamed or deleted.

## Final Recommendation

Use the completion audit as the Phase 3R handoff gate:

```text
server contracts complete
  + Vue rewrite slices documented and tested
  + normal workflow rules tied to tests
  + internal/verifier/bridge surfaces excluded
  = Phase 3R ready for Phase 6R runtime contract work
```

Do not mark Phase 3R complete from roadmap text alone. The completion audit must
pass and all referenced artifacts must exist in the repo.

## Implementation

Added:

- `server/src/services/policyBuilderPhase3CompletionAudit.mjs`
  - lists the required Phase 3R server contracts,
  - lists the Vue-facing rewrite slices,
  - lists normal workflow rules and regression evidence,
  - lists normal-path exclusions,
  - exposes a deterministic completion audit and artifact path inventory.
- `server/src/__tests__/services/policyBuilderPhase3CompletionAudit.test.mjs`
  - verifies the completion audit passes,
  - verifies expected server contract and Vue slice ids,
  - verifies all referenced docs, services, and tests exist,
  - verifies internal/verifier/bridge surfaces are not normal authoring
    surfaces,
  - verifies missing evidence, missing paths, bad scopes, and unknown artifact
    kinds fail.

## Checklist Result

| Check | Result |
| --- | --- |
| Server contracts 3R.1-3R.9 listed | Yes; all nine are recorded with docs, services, and tests. |
| Vue rewrite slices listed | Yes; all nine current Vue-facing slices are recorded with docs and tests. |
| Normal workflow rules listed | Yes; destination context, observed acceptance, hard-limit explicitness, one next action, and verifier exclusion are recorded. |
| Normal-path exclusions listed | Yes; verifier, provider, TMDB, bridge, and legacy-storage surfaces are explicitly excluded or scoped. |
| Artifact drift detected | Yes; the audit caught and corrected the routing-readiness test path. |

## Next Step

The next high-value item is **Phase 6R.1 Runtime Decision Pipeline Contract**.
That task should define how Phase 6R consumes Phase 3R operator intent without
reintroducing policy-builder diagnostics into normal authoring.
