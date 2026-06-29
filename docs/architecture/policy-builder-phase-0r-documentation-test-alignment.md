# Policy Builder Phase 0R Documentation And Test Alignment

Status: implemented as the fifth Phase 0R source-of-truth contract.

## Scope

Phase 0R.5 turns the Phase 0R vocabulary reset into implementation guardrails.

This slice does not change policy runtime behavior, classification scoring,
routing, Discord behavior, database schema, AI prompts, or client UI behavior.
It adds a server-owned ESM checklist contract and test coverage that future
Phase 1R through Phase 8R work can use before changing UI, runtime, learning,
or migration behavior.

## Research Inputs

Official sources reviewed as of June 2026:

- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Secure development should define roles, practices, verification criteria,
    and traceable outcomes before implementation proceeds.
- CISA Secure by Design:
  <https://www.cisa.gov/securebydesign>
  - Security and safety should be designed into defaults rather than deferred to
    operators or later hardening.
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>
  - Security-sensitive behavior should be backed by verification requirements,
    clear trust boundaries, and repeatable tests.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - UI labels and instructions should make the required operator action clear.
- W3C WCAG 2.2, Error Identification:
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
  - When a flow needs attention, the product should identify what is missing and
    what can be corrected.

## Recommendations

1. Require a Phase 0R checklist before future UI, runtime, learning, or
   migration changes:
   - source of truth identified,
   - authority level identified,
   - learning side effect identified or explicitly absent,
   - rollback or migration impact identified,
   - operator-facing language validated.
2. Treat old terminology as one of three categories:
   - replace in product language,
   - legacy/internal only,
   - maintainer diagnostic only.
3. Keep tests aligned to authority boundaries, not current UI layout:
   - client tests should reject old product assumptions and product-facing
     diagnostic wording,
   - server tests should assert authority separation, learning side effects,
     migration impact, and fail-closed validation.
4. Do not allow Phase 1R or later work to introduce new controls or runtime
   behavior unless the checklist passes.
5. Keep diagnostic tooling out of the normal operator workflow unless a later
   phase explicitly classifies it as a maintainer-only migration verifier.

## Pros And Cons

### Pros

- Gives future PRs a small, deterministic checklist instead of re-opening the
  product model debate.
- Makes stale terms visible before they leak into new UI or runtime contracts.
- Keeps old presets, `customSignals`, replay, provider, and impact-preview
  language bounded to legacy/internal or maintainer contexts.
- Supports secure-by-design work by requiring trust boundary and migration
  impact statements before behavior changes.
- Gives Phase 1R a concrete entry condition.

### Cons

- The checklist does not automatically scan the whole repository.
- Existing stale product copy may remain until the relevant phase rewrites that
  component.
- The contract records current Phase 0R artifacts but does not replace future
  phase-specific implementation docs.
- Future phases still need their own tests for actual runtime and UI behavior.

## Final Stack

- Checklist contract:
  `server/src/services/policyPhase0RChecklist.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyPhase0RChecklist.test.mjs`
- Prior Phase 0R dependencies:
  - `server/src/services/policyAuthorityVocabulary.mjs`
  - `server/src/services/policyUserMentalModel.mjs`
  - `server/src/services/policyLegacyCompatibilityVocabulary.mjs`
  - `server/src/services/policyQuestionLearningVocabulary.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-0r-documentation-test-alignment.md`

## Implemented Outcome

Phase 0R.5 defines the required future-implementation checklist:

| Checklist Item | Purpose |
| --- | --- |
| Source of truth identified | State which source owns meaning for the change. |
| Authority level identified | State what may decide, suggest, or persist behavior. |
| Learning side effect identified | State whether learning exists or is explicitly absent. |
| Rollback or migration impact identified | State whether legacy, rollback, or native migration is affected. |
| Operator-facing language validated | Confirm visible language uses Phase 0R vocabulary. |

It also defines terminology alignment categories:

| Category | Use |
| --- | --- |
| Replace product language | Old product wording such as genre-priority or scoring-weight framing. |
| Legacy/internal only | Storage, API, bridge, rollback, and migration terms such as `customSignals`. |
| Maintainer diagnostic only | Replay, provider, TMDB, and impact-preview terms used for verification. |

Future work can validate checklist completion with:

```js
validatePhase0RChecklistResponse({
  source_of_truth_identified: true,
  authority_level_identified: true,
  learning_side_effect_identified: true,
  rollback_migration_impact_identified: true,
  operator_language_validated: true,
});
```

The helper fails closed: missing required items return `valid: false` with the
missing checklist item IDs.

## Phase 1R Entry Gate

Phase 1R can begin when an implementation slice can answer:

1. Which policy-builder state is presentation only?
2. Which state is draft intent?
3. Which state is observed evidence?
4. Which state is legacy compatibility?
5. Which state must move behind a server boundary?

The next task should therefore be **Phase 1R, Task 1R.1: Existing Boundary
Inventory**.
