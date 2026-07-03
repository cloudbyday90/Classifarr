# Policy Runtime Decision Inventory Module Cutover

## Status

Implemented.

This document records the production naming cutover for the runtime decision
inventory. The inventory behavior remains the same: runtime classification,
question, learning, routing, profile-refresh, queue, and retry surfaces are
classified by authority source, runtime stage, rewrite/delete decision, and
known risk. The change removes roadmap-phase naming from the module API.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports traceable design verification and controlled changes. The cutover
  keeps the inventory deterministic and covered by focused tests.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for secure application design. The runtime
  inventory still validates server-side authority sources, required runtime
  surfaces, and legal rewrite/delete combinations.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommends common names that can be standardized across codebases and
  platforms. The runtime inventory now uses durable policy-domain names rather
  than temporary roadmap labels.
- [W3C Cool URIs](https://www.w3.org/Provider/Style/URI) reinforces stable,
  implementation-independent identifiers. The runtime inventory contract avoids
  embedding phase numbers in persistent service and payload names.

## Recommendations

1. Keep the runtime inventory as a server-owned, side-effect-free contract.
2. Use product-domain exports:
   `policyRuntimeDecisionInventory`, `POLICY_RUNTIME_*`, and
   `POLICY_BAD_QUESTION_PATH_IDS`.
3. Use `policy.runtime_decision_inventory.v1` as the durable payload version.
4. Expose the product handoff as `nextStep.stepId =
   runtime_evidence_projection`; keep roadmap phase mapping in the completion
   audit adapter only.
5. Leave actual phase-coded file paths in the inventory until those downstream
   modules are renamed in their own cutover slices.

## Pros And Cons

Pros:

- Removes phase-coded names from the runtime inventory module API.
- Keeps runtime surface validation unchanged.
- Makes the next runtime handoff reusable after roadmap phases stop mattering.
- Reduces the measured production naming backlog.

Cons:

- The inventory still references phase-coded downstream file paths because
  those modules have not been renamed yet.
- The Phase 7 completion audit needs a temporary adapter from product
  `nextStep` to roadmap `expectedNextPhaseId`.

## Final Recommendation Stack

- Durable service:
  `server/src/services/policyRuntimeDecisionInventory.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeDecisionInventory.test.mjs`
- Contract version:
  `policy.runtime_decision_inventory.v1`
- Handoff field:
  `nextStep.stepId = runtime_evidence_projection`
- Compatibility adapter:
  `server/src/services/policyBuilderPhase7CompletionAudit.mjs`
- Original design record:
  `docs/architecture/policy-builder-phase-7r-runtime-decision-inventory.md`

## Outcome

- Renamed the service and focused test from phase-coded file names to durable
  policy-domain names.
- Renamed runtime inventory constants and helpers to `POLICY_RUNTIME_*`,
  `POLICY_BAD_QUESTION_PATH_IDS`, and `buildPolicyRuntimeDecisionInventory`.
- Replaced the local contract version with `policy.runtime_decision_inventory.v1`.
- Replaced local `phaseId` and `nextPhase` with `stepId` and `nextStep`.
- Added the Phase 7 completion-audit adapter that maps
  `runtime_evidence_projection` to the roadmap phase for legacy completion
  checks.
- Lowered the production naming regression baseline after inventory validation:
  `6009` production references, `6031` rename candidates, and `93` obsolete
  migration-tooling references.

## Security Outcome

- Runtime artifacts still require an owner, authority source, replacement
  target, known runtime stage, and risk reason before behavior changes.
- Rewrite, replacement, and deletion targets still cannot keep normal runtime
  authority.
- Broad genre authority, routing-success conflation, and bad question paths
  remain explicit inventory risks.
