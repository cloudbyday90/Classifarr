# Policy Automation Readiness Quality Gate

## Status

Implemented as the durable quality-gate hardening record for policy automation
readiness.

This document covers the bounded handoff from policy evidence, policy intent,
and policy learning into automation readiness. Readiness can evaluate
automation only when all bounded upstream contracts carry matching, usable,
label-free evidence quality.

## Problem

Automation readiness is the operator-facing answer to whether Classifarr can
continue. If readiness accepts mismatched or insufficient upstream quality, the
UI can show a confident action even though evidence, intent, or learning was
produced from a weaker state.

The readiness quality gate therefore validates:

- bounded evidence quality,
- bounded intent quality,
- bounded learning quality,
- quality status usability,
- quality snapshot continuity across contracts, and
- sanitized context with no raw labels or provider payloads.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  emphasizes verified secure design and lifecycle traceability. The readiness
  quality gate makes automation readiness a verified output of bounded upstream
  contracts.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  supports trustworthy AI characteristics such as validity, reliability,
  security, resilience, accountability, and transparency. Readiness uses
  explicit quality and reason IDs instead of hidden confidence.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls and validating
  business workflow state. The quality gate validates server-side workflow
  state before declaring automation ready.
- [OWASP Web Security Testing Guide: Business Logic Data Validation](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
  emphasizes that logically valid data must be enforced server-side, not only
  in the frontend. Readiness quality is therefore checked in the server-owned
  bounded wrapper.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend stable names for operations and data. The readiness boundary keeps
  stable quality and fingerprint fields that can later be traced without raw
  evidence labels.

## Recommendations

1. **Require quality continuity across bounded contracts.**
   Evidence, intent, and learning must carry matching quality status, action,
   reason IDs, and sanitized counts before readiness can be evaluated.

2. **Block insufficient quality before readiness.**
   `insufficient` quality returns `blocked_by_bounded_input`, not a readiness
   state such as `needs_operator_review` or `ready`.

3. **Carry label-free quality context.**
   The readiness boundary context should include quality status, score, action,
   reason IDs, counts, and booleans only.

4. **Audit tampered readiness output.**
   If a readiness result loses bounded quality after creation, the readiness
   audit rejects it.

5. **Keep readiness action-oriented.**
   Quality gates should block invalid upstream state before readiness. Once the
   gate passes, readiness still returns one small operator action.

6. **Keep quality validation server-owned.**
   The UI can display readiness results, but it should not rebuild quality
   continuity from raw diagnostics or hidden client-side assumptions.

## Pros And Cons

Pros:

- Prevents automation from appearing ready from insufficient upstream quality.
- Detects stale or tampered quality handoffs across evidence, intent, and
  learning.
- Keeps the operator-facing readiness answer simple while strengthening the
  server boundary.
- Preserves traceability without evidence labels or provider payloads.
- Keeps future telemetry stable through durable readiness quality names.

Cons:

- More upstream mismatches fail before readiness is computed.
- The quality comparison intentionally checks stable quality fields, not every
  diagnostic count.
- Existing pure readiness reducer still exists for compatibility and focused
  tests.

## Final Recommendation Stack

- Evidence quality:
  `server/src/services/policyEvidenceQuality.mjs`
- Bounded intent:
  `server/src/services/policyIntentEngine.mjs`
- Bounded learning:
  `server/src/services/policyLearningGuard.mjs`
- Readiness quality consumer:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs`
- Design owner:
  `docs/architecture/policy-automation-readiness-engine.md`
- Quality-gate owner:
  `docs/architecture/policy-automation-readiness-quality-gate.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

- Added `missing_bounded_quality`, `bounded_quality_insufficient`, and
  `bounded_quality_mismatch` readiness audit risks.
- Added sanitized quality snapshots to the bounded readiness context for
  evidence, intent, and learning.
- Blocked bounded readiness when any upstream quality snapshot is missing.
- Blocked bounded readiness when quality is insufficient.
- Blocked bounded readiness when evidence, intent, and learning quality do not
  match.
- Extended readiness audit validation so tampered boundary contexts without
  quality fail.

## Security Outcome

- Readiness remains side-effect free.
- Automation readiness cannot be evaluated from missing, insufficient, or
  mismatched upstream quality.
- Quality metadata remains label-free and provider-payload-free.
- Readiness validates workflow state before returning an operator-facing action.

## Next Step

Continue with **Policy Operator Workflow Architecture Cutover**. That component
should move the active operator workflow design record to durable naming and
preserve consumption of the quality-gated readiness state.
