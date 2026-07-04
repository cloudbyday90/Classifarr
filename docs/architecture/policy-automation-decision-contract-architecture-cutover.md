# Policy Automation Decision Contract Architecture Cutover

## Status

Implemented on July 4, 2026 as part of production architecture naming
stabilization. This document records the cutover from a roadmap-phase active
design record to the durable policy automation decision contract.

## Goal

The policy automation decision contract is the server-owned runtime gate that
turns validated runtime evidence into one allow-listed automation state before
classification, routing, review, skip, refresh, or blocked behavior can happen.
The implementation already used durable module names; this cutover removes the
remaining active design-record dependency on phase-coded naming and aligns the
roadmap with the product contract.

## Official Guidance Reviewed

- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure development practices that can be integrated into the SDLC.
  This cutover keeps the decision contract documented, test-backed, and
  validated before runtime side effects change.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  supports incorporating trustworthiness considerations into AI system design,
  development, use, and evaluation. This cutover keeps AI-derived evidence
  governed by explicit decision states rather than implicit action authority.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing technical security controls. This cutover
  preserves server-side validation of automation states and decision evidence.
- [OWASP ASVS Validation And Business Logic](https://cheatsheetseries.owasp.org/IndexASVS.html)
  identifies validation and business-logic security areas including business
  logic and anti-automation. This cutover keeps route-ready, classify-only,
  review, mapping, stale-profile, insufficient-evidence, and hard-limit-blocked
  outcomes explicit.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  define common names for operations and data. This cutover preserves bounded
  `classifarr.runtime.decision.*` trace attributes and durable
  `policy.automation_decision.v1` payload naming.

## Recommendations

1. **Use durable policy-automation naming.** The active design record should be
   `policy-automation-decision-contract.md`; roadmap-phase names should remain
   only as historical sequencing labels.
2. **Keep automation states allow-listed.** Decision output should remain one
   of the explicit states already enforced by
   `POLICY_AUTOMATION_DECISION_STATE_IDS`.
3. **Keep the contract side-effect-free.** The decision contract should not
   route media, write classifications, create questions, write learning records,
   call providers, or persist native intent.
4. **Bind decisions to evidence proof.** Decisions must carry the sanitized
   runtime evidence projection fingerprint and evidence-validation result.
5. **Keep trace data bounded.** Runtime decision traces should carry stable
   scalar attributes and reason counts, not raw provider payloads, prompts, or
   UI labels.

## Pros And Cons

Pros:

- Removes active production architecture dependence on roadmap-phase wording.
- Keeps runtime question reduction and later route execution tied to a stable
  decision contract.
- Preserves the existing deterministic, side-effect-free state machine.
- Keeps missing Arr mapping separate from completed route success.

Cons:

- This cutover does not wire the decision contract into new live runtime side
  effects.
- Historical roadmap and changelog records still contain phase-coded sequence
  labels by design.
- Downstream active architecture records need their own cutover passes before
  the runtime chain is fully product-named.

## Final Recommendation Stack

- Automation decision service:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Focused tests:
  `server/src/__tests__/services/policyAutomationDecisionContract.test.mjs`
- Runtime evidence dependency:
  `server/src/services/policyRuntimeEvidenceProjection.mjs`
- Active design record:
  `docs/architecture/policy-automation-decision-contract.md`
- Historical module cutover record:
  `docs/architecture/policy-automation-decision-contract-module-cutover.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Production naming inventory:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active automation decision design record to
  `policy-automation-decision-contract.md`.
- Updated the active design record to describe the durable policy automation
  decision contract rather than a phase-local implementation slice.
- Updated roadmap implementation status and module-cutover references to point
  at the durable design record.
- Preserved the existing `policyAutomationDecisionContract.mjs` behavior,
  contract version, trace shape, state machine, and validation gates.

## Security Outcome

- Decision construction remains deterministic and side-effect-free.
- No provider lookup, classification write, routing write, question write,
  learning write, or native-intent persistence is performed.
- `auto_route_ready` still requires strong identity, concrete route mapping,
  fresh profile evidence, no hard-limit block, no avoid conflict, and no
  high-risk evidence conflict.
- Decision validation still rejects malformed fingerprints, raw provenance,
  trace/evidence fingerprint drift, missing evidence validation proof, and
  unsafe side-effect claims.

## Next Step

Runtime Question Reduction Architecture Cutover should rename the active
runtime question-reduction design record to durable product-domain wording and
keep question generation constrained to review-worthy automation states.
