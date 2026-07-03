# Policy Production Naming Regression Audit

## Status

Implemented as the Phase 9R.4 regression gate for production naming debt.

The service uses durable product-domain naming:
`server/src/services/policyProductionNamingRegressionAudit.mjs`.

## Problem

The production naming inventory already classifies phase-coded references, but
classification alone does not stop new roadmap-phase names from being added
while the remaining durable-module cutovers are still in progress.

The platform needs a regression gate that allows the existing rename backlog to
shrink over time while preventing it from growing.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports risk-based, traceable, and continuously improved secure development
  practices. The audit makes naming debt measurable before each rename batch.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification baseline for application security controls. The audit
  protects server-side validation and business-logic boundaries during
  mechanical renames.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  promote stable semantic names. The gate prevents new temporary roadmap labels
  from entering long-lived production naming surfaces.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces durable external identifiers. The same principle applies to
  persistent commands, payloads, traces, and operator-facing names.

## Recommendation

Add a regression audit that consumes the production naming inventory and fails
when:

- the inventory is missing or invalid;
- phase-coded production references increase above the approved baseline;
- rename candidates increase above the approved baseline;
- obsolete migration tooling references increase above the approved baseline;
- temporary adapter references lack deletion gates;
- the audit input reports side effects other than repository reads.

The audit should not claim final completion while rename candidates remain. It
should instead protect the baseline and allow future cutover slices to reduce
the counts.

## Pros And Cons

Pros:

- Prevents new phase-coded production naming debt while cutovers continue.
- Keeps the final naming goal measurable instead of relying on manual review.
- Uses a durable service name, avoiding more phase-coded production modules.
- Supports incremental mechanical renames without forcing one giant refactor.

Cons:

- Adds another audit contract.
- Uses a baseline that must be intentionally lowered as cutovers remove debt.
- Does not rename files by itself.
- Does not remove historical docs/tests/migration evidence, which remain
  allowed categories.

## Final Recommendation Stack

- Inventory source:
  `server/src/services/policyBuilderProductionNameInventory.mjs`
- Regression audit:
  `server/src/services/policyProductionNamingRegressionAudit.mjs`
- Focused tests:
  `server/src/__tests__/services/policyProductionNamingRegressionAudit.test.mjs`
- Roadmap owner:
  Phase 9R.4 Naming Regression And Completion Audit in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Baseline

The regression baseline reflects the current repository inventory after the
policy evidence boundary module cutover on July 3, 2026:

- production references: `7446`
- rename candidates: `7468`
- obsolete migration tooling references: `93`

The baseline is intentionally a maximum, not a target. Future durable rename
batches should reduce these values and then lower the baseline.

## Security Outcome

- Naming regression checks are side-effect-free.
- Production references must remain classified by the inventory service.
- New temporary adapters require explicit deletion gates.
- Existing phase-coded debt can only shrink or stay flat unless a maintainer
  deliberately updates the baseline with evidence.

## Next Step

Continue Phase 9R.2 durable-domain module cutover with a narrow mechanical
rename batch, then lower the regression baseline after the inventory proves the
rename reduced phase-coded production debt.
