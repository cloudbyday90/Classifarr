# Policy Runtime Question Reduction Architecture Cutover

## Status

Implemented on July 4, 2026 as part of production architecture naming
stabilization. This document records the cutover from a roadmap-phase active
design record to the durable policy runtime question reduction contract.

## Goal

Runtime question reduction is the server-owned gate that decides whether an
automation decision should produce an operator question, an operational next
action, a stale-question cleanup action, or no prompt at all. The implementation
already used durable module names; this cutover removes the remaining active
design-record dependency on phase-coded naming and aligns the roadmap with the
product contract.

## Official Guidance Reviewed

- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies prompt injection, insecure output handling, excessive agency, and
  overreliance risks. This cutover preserves the reducer's rule that model,
  provider, and replay wording cannot become persisted question frames.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allow-list validation for structured inputs. Runtime question
  dispositions, reason ids, acceptable frames, rejected legacy frames, and
  learning flags remain allow-listed.
- [Microsoft Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  provide evidence-based guidance for user-facing AI experiences. This cutover
  keeps questions focused on destination fit or concrete next action instead of
  internal model diagnostics.
- [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  helps identify generative-AI risks and risk-management actions. This cutover
  keeps automation state, question shape, final outcome, and learning
  eligibility separate.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports consistent semantic names. This cutover preserves bounded
  `classifarr.runtime.question.*` trace attributes and durable
  `policy.runtime_question_reduction.v1` payload naming.

## Recommendations

1. **Use durable runtime-question naming.** The active design record should be
   `policy-runtime-question-reduction.md`; roadmap-phase names should remain
   only as historical sequencing labels.
2. **Keep question frames allow-listed.** Created questions should use only
   approved product-owned frames such as destination fit, missing evidence,
   hard-limit conflict, routing gap, stale profile, and outlier review.
3. **Reject internal diagnostics as questions.** Broad genre priority, AI
   authored policy edits, provider diagnostics, and replay parity interpretation
   should be rewritten or cleaned before persistence.
4. **Keep question planning side-effect-free.** The reducer should not persist
   questions, write learning, route media, call providers, or mutate policy.
5. **Bind questions to decision proof.** Question plans should carry the
   automation decision evidence fingerprint and decision-validation result.

## Pros And Cons

Pros:

- Removes active production architecture dependence on roadmap-phase wording.
- Keeps operator questions constrained to useful, destination-centered prompts.
- Preserves stale-question cleanup and learning-ineligible defaults.
- Keeps runtime question plans traceable to the automation decision that caused
  them.

Cons:

- This cutover does not wire the reducer into the live pending-question path.
- Historical roadmap and changelog records still contain phase-coded sequence
  labels by design.
- Downstream active architecture records need their own cutover passes before
  the runtime chain is fully product-named.

## Final Recommendation Stack

- Runtime question reducer:
  `server/src/services/policyRuntimeQuestionReduction.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeQuestionReduction.test.mjs`
- Automation decision dependency:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Question vocabulary dependency:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Active design record:
  `docs/architecture/policy-runtime-question-reduction.md`
- Historical module cutover record:
  `docs/architecture/policy-runtime-question-reduction-module-cutover.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Production naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active runtime question reduction design record to
  `policy-runtime-question-reduction.md`.
- Updated the active design record to describe the durable runtime question
  reduction contract rather than a phase-local implementation slice.
- Updated roadmap implementation status and module-cutover references to point
  at the durable design record.
- Preserved the existing `policyRuntimeQuestionReduction.mjs` behavior,
  contract version, dispositions, trace shape, and validation gates.

## Security Outcome

- Question planning remains deterministic and side-effect-free.
- The reducer does not call providers, persist questions, write learning, route
  media, or mutate policy.
- Unknown or rejected frames remain invalid for created questions.
- Stale or legacy pending questions still require cleanup before answer or
  learning.
- Trace output remains bounded to reason codes, frame ids, fingerprints, and
  validation state rather than raw provider payloads, prompts, AI text, replay
  diagnostics, or evidence labels.

## Next Step

Request-Time Learning Architecture Cutover should rename the active
request-time learning and destination-selection design record to durable
product-domain wording and keep durable learning constrained by the policy
learning guard.
