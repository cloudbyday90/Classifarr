# Policy Runtime Decision Inventory Architecture Cutover

## Status

Implemented as the architecture naming cutover for the durable policy runtime
decision inventory.

This record covers the documentation-level cutover from checkpoint-specific
runtime inventory language to the durable `policy.runtime_decision_inventory.v1`
contract. Runtime behavior remains in `policyRuntimeDecisionInventory.mjs`; this
component keeps behavior stable while updating the active design surface and
roadmap references that still used temporary sequencing language.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports traceable secure design, verification, and controlled changes. The
  runtime inventory remains deterministic and test-covered before runtime
  wiring changes.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, mapped, measured, and managed AI behavior. The inventory
  keeps AI, RAG, metadata, and provider outputs classified as evidence or
  suggestions instead of final authority.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for secure application design. The runtime
  inventory validates server-side authority sources, required runtime surfaces,
  and legal rewrite/delete combinations.
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  describes structured traces with spans and attributes. Durable stage, risk,
  and decision identifiers can feed future traces without carrying roadmap
  labels.
- [W3C Cool URIs](https://www.w3.org/Provider/Style/URI)
  reinforces stable, implementation-independent identifiers. The active design
  record now uses durable product-domain naming.

## Recommendations

1. **Name the active design after the durable runtime boundary.**
   The active design should be `policy-runtime-decision-inventory.md`, matching
   the service and `policy.runtime_decision_inventory.v1` contract.

2. **Preserve inventory behavior exactly.**
   Durable naming must not weaken authority-source validation, required-surface
   coverage, bad-question detection, broad-genre risk detection, or
   classification/routing conflation detection.

3. **Keep inventory side-effect-free.**
   The inventory classifies runtime surfaces. It must not execute routing,
   provider calls, learning writes, classification writes, migrations, or
   deletions.

4. **Keep checkpoint terms in roadmap sequencing only.**
   The roadmap can still explain implementation order, but active architecture
   records should describe durable policy concepts.

5. **Make the next handoff explicit.**
   The next component is the runtime evidence projection architecture cutover so
   the next runtime boundary also uses durable product-domain language.

## Pros And Cons

Pros:

- Removes the old checkpoint-coded active runtime inventory design file.
- Aligns documentation with `policyRuntimeDecisionInventory.mjs` and the durable
  runtime inventory contract.
- Keeps the server-owned inventory invariant behaviorally stable.
- Makes the handoff into runtime evidence projection easier to reason about.

Cons:

- Historical changelog and roadmap sequencing still mention checkpoints where
  they describe release history or implementation order.
- Downstream runtime/rebuild docs still need their own architecture cutovers.

## Final Recommendation Stack

- Active architecture:
  `docs/architecture/policy-runtime-decision-inventory.md`
- Cutover record:
  `docs/architecture/policy-runtime-decision-inventory-architecture-cutover.md`
- Runtime inventory service:
  `server/src/services/policyRuntimeDecisionInventory.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeDecisionInventory.test.mjs`
- Module cutover:
  `docs/architecture/policy-runtime-decision-inventory-module-cutover.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implementation Outcome

- Renamed the active runtime inventory design record to
  `policy-runtime-decision-inventory.md`.
- Rewrote the active design record around durable runtime surface ownership,
  authority-source decisions, side-effect-free inventory, known bad question
  paths, and classification/routing separation.
- Updated roadmap links and the module-cutover note so active documentation
  points at durable architecture records.
- Preserved the existing `policyRuntimeDecisionInventory.mjs` behavior and
  focused test coverage.

## Security Outcome

- No classification, routing, provider, learning, persistence, authorization,
  deletion, or storage behavior changed.
- Runtime surfaces still require owner, authority source, stage, decision,
  replacement target, and risk-reason coverage before behavior changes.
- AI/RAG/provider output still cannot become final runtime authority through
  this inventory.

## Next Step

Continue with **Runtime Evidence Projection Architecture Cutover**.
