# Policy Request-Time Learning Architecture Cutover

## Status

Implemented on July 4, 2026 as part of production architecture naming
stabilization. This document records the cutover from a roadmap-phase active
design record to the durable policy request-time learning contract.

## Goal

Request-time learning normalizes request/import/manual/routing events into a
bounded, side-effect-free server decision before those events can influence
durable policy or profile evidence. The implementation already used durable
module names; this cutover removes the remaining active design-record
dependency on phase-coded naming and aligns the roadmap with the product
contract.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, mapped, measured, and managed AI behavior. This cutover
  keeps request choices, manual changes, routed outcomes, learning eligibility,
  and side effects separated.
- [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  is a companion profile for generative-AI risks and risk-management actions.
  This cutover preserves bounded provenance and prevents raw runtime events from
  becoming durable learning directly.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies excessive agency and overreliance risks. This cutover preserves
  the rule that request-time or AI-adjacent runtime outputs cannot perform
  profile or policy writes directly.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  define common names for operations and data. This cutover keeps request
  learning trace fields bounded and product-named.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, unambiguous, lower-case namespacing. This cutover
  preserves `policy.request_time_learning.v1` and
  `classifarr.runtime.request_learning.*` naming.

## Recommendations

1. **Use durable request-learning naming.** The active design record should be
   `policy-request-time-learning.md`; roadmap-phase names should remain only as
   historical sequencing labels.
2. **Separate event, outcome, and learning.** Request choice, operator change,
   successful route, and failed route should remain distinct facts.
3. **Keep learning guarded.** Request-time events can become learning candidates
   only through the policy learning guard and only when upstream validation
   proof is intact.
4. **Block route-failure learning.** Missing route mapping is operational
   configuration debt, not positive destination evidence.
5. **Preserve bounded provenance.** Decisions should carry upstream evidence
   fingerprints and bounded question-reduction proof without raw labels,
   provider payloads, prompts, question text, or diagnostics.

## Pros And Cons

Pros:

- Removes active production architecture dependence on roadmap-phase wording.
- Keeps request-time learning constrained to a stable product contract.
- Preserves side-effect-free validation before live request/import persistence
  changes.
- Keeps manual destination changes auditable and reversible.

Cons:

- This cutover does not wire request/import flows into the contract.
- Historical roadmap and changelog records still contain phase-coded sequence
  labels by design.
- Downstream active architecture records need their own cutover passes before
  the runtime chain is fully product-named.

## Final Recommendation Stack

- Request-time learning service:
  `server/src/services/policyRequestTimeLearning.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRequestTimeLearning.test.mjs`
- Learning guard dependency:
  `server/src/services/policyLearningGuard.mjs`
- Question vocabulary dependency:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Active design record:
  `docs/architecture/policy-request-time-learning.md`
- Historical module cutover record:
  `docs/architecture/policy-request-time-learning-module-cutover.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Production naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active request-time learning design record to
  `policy-request-time-learning.md`.
- Updated the active design record to describe the durable request-time learning
  contract rather than a phase-local implementation slice.
- Updated roadmap implementation status and module-cutover references to point
  at the durable design record.
- Preserved the existing `policyRequestTimeLearning.mjs` behavior, contract
  version, event semantics, trace shape, and validation gates.

## Security Outcome

- Request-time learning remains deterministic and side-effect-free.
- The contract does not call providers, persist outcomes, write policy/profile
  learning, or queue profile refresh directly.
- Failed routing remains blocked from durable learning and profile-refresh
  claims.
- Manual destination changes still require auditable and reversible metadata.
- Bounded question-reduction proof and upstream evidence fingerprints remain
  required before request-time choices can be treated as learning candidates.

## Next Step

Library-Derived Policy Rebuild Architecture Cutover should rename the active
library-derived rebuild design record to durable product-domain wording and
keep rebuild proposals constrained to guarded outcomes with valid
request-learning proof.
