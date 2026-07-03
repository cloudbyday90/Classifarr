# Policy Builder Phase 6R Readiness Quality Gate

## Status

Implemented as a Phase 6R.4 hardening slice.

This document covers the bounded handoff from Phase 6R.1 evidence, Phase 6R.2
intent, and Phase 6R.3 learning into Phase 6R.4 automation readiness.
Readiness can only evaluate automation when all bounded upstream contracts carry
matching, usable, label-free evidence quality.

## Problem

Automation readiness is the operator-facing answer to whether Classifarr can
continue. If readiness accepts mismatched or insufficient upstream quality, the
UI can show a confident action even though evidence or learning was produced
from a weaker state.

Phase 6R.4 therefore needs to validate:

- bounded evidence quality,
- bounded intent quality,
- bounded learning quality,
- quality status usability,
- quality snapshot continuity across contracts, and
- sanitized context with no raw labels or provider payloads.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  emphasizes outcome-based secure design and verification. The readiness gate
  makes automation readiness a verified output of bounded upstream contracts.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  supports incorporating trustworthiness considerations into AI system design
  and evaluation. Readiness uses explicit quality and reason IDs instead of
  hidden confidence.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. Phase 6R.4
  validates business workflow state before declaring automation ready.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend stable names for operations and data. The readiness boundary keeps
  stable quality and fingerprint fields that can later be traced without raw
  evidence labels.

## Recommendations

1. **Require quality continuity across bounded contracts.**
   Evidence, intent, and learning must carry the same quality status, action,
   and reason IDs before readiness can be evaluated.

2. **Block insufficient quality before readiness.**
   `insufficient` quality returns `blocked_by_bounded_input`, not a readiness
   state such as `needs_review` or `ready`.

3. **Carry label-free quality context.**
   The readiness boundary context should include quality status, score, action,
   reason IDs, counts, and booleans only.

4. **Audit tampered readiness output.**
   If a readiness result loses bounded quality after creation, the readiness
   audit rejects it.

5. **Keep readiness action-oriented.**
   Quality gates should block invalid upstream state before readiness. Once the
   gate passes, readiness still returns one small operator action.

## Pros And Cons

Pros:

- Prevents automation from appearing ready from insufficient upstream quality.
- Detects stale or tampered quality handoffs across evidence, intent, and
  learning.
- Keeps the operator-facing readiness answer simple while strengthening the
  server boundary.
- Preserves traceability without evidence labels or provider payloads.

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
  `server/src/services/policyBuilderPhase6LearningGuard.mjs`
- Readiness quality consumer:
  `server/src/services/policyBuilderPhase6ReadinessEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderPhase6ReadinessEngine.test.mjs`
- Design owner:
  `docs/architecture/policy-builder-phase-6r-readiness-engine.md`
- Roadmap owner:
  Phase 6R.4 in
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

- Readiness remains side-effect-free.
- Automation readiness cannot be evaluated from missing, insufficient, or
  mismatched upstream quality.
- Quality metadata remains label-free and provider-payload-free.
- Readiness validates workflow state before returning an operator-facing action.

## Next Step

Proceed to **Phase 6R.5 Operator Workflow Rebuild** and ensure the UI consumes
the quality-gated readiness state directly instead of rebuilding readiness from
diagnostic panels.
