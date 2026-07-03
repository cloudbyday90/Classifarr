# Policy Builder Production Naming Cutover

## Status

Planned as Phase 9R after the re-imagined policy engine, runtime automation,
native storage, and legacy-removal paths are stable enough to preserve.

This record exists because phase-coded production names are useful while
building the replacement system, but they should not become permanent product
architecture.

## Problem

The current rebuild work intentionally uses roadmap phase labels such as
`Phase6R`, `Phase7R`, and `Phase8R` to keep migration slices explicit. That is
useful during implementation, but it becomes misleading once the platform is
complete:

- future roadmap work will use different phase labels,
- production modules named after old phases hide the durable domain,
- telemetry names containing phase labels become hard to query over time,
- API and payload fields can accidentally preserve temporary project language,
- new contributors must learn the roadmap before understanding the product.

The final platform should describe product concepts directly:

```text
policy evidence
intent inference
learning eligibility
automation readiness
operator workflow
runtime evidence
automation decision
library rebuild
migration verification
native policy storage
```

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software development as traceable practices integrated into the
  lifecycle. The naming cutover should therefore be inventory-driven,
  reviewable, tested, and reversible through normal source control.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for verifying application security controls. Renames must
  preserve server-side validation, authorization, auditability, and
  business-logic boundaries.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend common, meaningful names for operations and data. Runtime telemetry
  should use stable product-domain terms, not roadmap phase identifiers.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces that externally visible identifiers should be chosen for
  persistence. Public API fields, persisted payload names, and operator-facing
  links should avoid temporary implementation labels.

## Recommendations

1. **Treat phase-coded production names as temporary scaffolding.**
   Phase labels can remain in roadmap docs, changelog history, migration
   evidence, and compatibility tests. They should not be the final names of
   runtime services, payload contracts, trace attributes, or operator-facing
   product concepts.

2. **Inventory before renaming.**
   Build a checked-in rename map before moving files. Classify references as
   production rename, docs/history keep, test/migration keep, temporary adapter,
   or delete.

3. **Rename by domain, not by shorter phase aliases.**
   `policyBuilderPhase6IntentEngine` should become a name like
   `policyIntentInference`, not `policyBuilderR6Intent`.

4. **Separate mechanical renames from behavior changes.**
   The cutover should be import/path/contract naming work with focused
   regression tests. Behavior changes belong in the engine/runtime/storage
   phases before this phase.

5. **Use adapters only as bounded release tools.**
   Temporary compatibility exports can protect one release boundary or persisted
   payload migration, but each adapter needs an owner, reason, and deletion gate.

6. **Make naming testable.**
   Add a scanner that fails when new phase-coded production references appear
   outside an allow-list. Docs and historical evidence should be allowed; runtime
   modules should not.

## Pros And Cons

Pros:

- Leaves production code understandable after the roadmap phases are obsolete.
- Makes telemetry and diagnostics easier to query over multiple releases.
- Reduces future confusion when new roadmap phases are introduced.
- Forces an explicit compatibility decision for persisted payload fields.
- Creates a measurable completion gate instead of relying on manual review.

Cons:

- Adds a deliberate rename pass after the functional rebuild.
- Large file moves can make blame/history harder to follow for one release.
- Temporary adapters may be needed where persisted data or public contracts
  cannot safely change in one step.
- Strict scanner rules require allow-list maintenance for docs and migration
  evidence.

## Final Recommendation Stack

- Roadmap owner:
  Phase 9R Production Naming And Contract Stabilization in
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Design record:
  `docs/architecture/policy-builder-production-naming-cutover.md`
- Required artifacts before renaming:
  - production name inventory,
  - rename map,
  - allow-list categories,
  - adapter deletion gates.
- Required code outcomes:
  - production modules use durable product-domain names,
  - runtime imports avoid phase-coded service names,
  - telemetry and current diagnostics use product-domain attributes,
  - phase-coded references remain only in docs/history/tests/migration evidence
    or explicitly bounded adapters.
- Required validation:
  - focused server/client regression tests,
  - scanner for phase-coded production references,
  - `git diff --check`,
  - changelog entry under `Unreleased`.

## Initial Durable Name Targets

| Current phase-coded domain | Durable target domain |
| --- | --- |
| Phase 6R evidence engine/boundary | policy evidence boundary |
| Phase 6R intent engine | policy intent inference |
| Phase 6R learning guard | policy learning eligibility |
| Phase 6R readiness engine | policy automation readiness |
| Phase 6R operator workflow | policy operator workflow |
| Phase 7R runtime evidence projection | runtime evidence projection |
| Phase 7R automation decision contract | runtime automation decision |
| Phase 7R question reduction | runtime clarification planner |
| Phase 7R request-time learning | request learning guard |
| Phase 7R library rebuild | library-derived policy rebuild |
| Phase 7R migration verifier | policy migration verifier |
| Phase 7R metrics/trace | policy runtime observability |
| Phase 8R native schema/storage | native policy intent storage |
| Phase 8R conversion workflow | policy conversion workflow |
| Phase 8R legacy deletion gates | legacy policy compatibility removal |

## Completion Rule

Phase 9R is not optional polish. The policy-builder re-imagination is not
complete until production code, runtime telemetry, current diagnostics, package
commands, and durable API/storage contracts no longer depend on roadmap phase
labels, except where an allow-listed migration or history reason is documented.
