# Policy Builder Production Name Inventory

Status: implemented as the Phase 9R.1 inventory gate before durable module
renames.

## Problem

The policy-builder rebuild used roadmap phase labels to make migration slices
explicit. That helped while the system was moving quickly, but it is not a
durable production vocabulary. Before renaming files or payloads, Classifarr
needs a repeatable inventory that identifies every phase-coded reference and
classifies whether it should be renamed, kept as history, kept as migration
evidence, deleted with obsolete tooling, or temporarily adapter-gated.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  emphasizes traceable, risk-based secure software practices. The naming
  cutover starts with an inventory so large refactors are reviewable and
  reversible through source control.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a verification basis for application security controls. The
  inventory separates production code from docs/tests so renames do not weaken
  validation, authorization, auditability, or business-logic boundaries.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  promote stable semantic names. Runtime traces and diagnostics should move
  toward product-domain terms rather than roadmap phase labels.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces that durable identifiers should not encode temporary project
  history. The same principle applies to long-lived package commands, payload
  fields, trace names, and operator-facing artifacts.

## Recommendations

1. **Inventory before renaming.**
   Keep Phase 9R.1 side-effect-free. The service may read files, but it must
   not move files, mutate storage, run Git, or rewrite package commands.

2. **Classify every reference.**
   Each phase-coded reference receives one of the allowed decisions:
   rename in production code, keep docs/history, keep test/migration evidence,
   temporary adapter with deletion gate, or delete obsolete migration tooling.

3. **Use durable product-domain targets.**
   Rename candidates must include a product-domain target such as
   `policyIntentInference`, `runtimeAutomationDecision`,
   `nativePolicyIntentStorage`, or `classificationProgressStageService`.

4. **Avoid false positives from numbered runtime passes.**
   Numeric markers such as `2R` are detected only with identifier boundaries so
   ordinary runtime names like `pass2Result` are not treated as roadmap phase
   debt.

5. **Treat scripts/package commands explicitly.**
   Current phase-coded migration artifact exporters and package commands are
   deletion or rename candidates, not production module names.

## Pros And Cons

Pros:

- Gives the rename work a concrete map before files move.
- Separates production rename candidates from docs, tests, migrations, and
  changelog history.
- Prevents generic “remove phases” work from turning into an uncontrolled
  refactor.
- Surfaces broader stale language such as classification `Phase` terminology,
  not only policy-builder `6R/7R/8R` files.

Cons:

- The first inventory is intentionally noisy because it captures all current
  phase-coded references.
- It does not rename production code yet.
- Durable targets are a planning aid; later mechanical rename work still needs
  focused import rewrites and runtime tests.

## Final Recommendation Stack

- Inventory service:
  `server/src/services/policyBuilderProductionNameInventory.mjs`
- Repository scan adapter:
  `scripts/generate-policy-builder-production-name-inventory.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderProductionNameInventory.test.mjs`
- Design record:
  `docs/architecture/policy-builder-production-naming-cutover.md`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Current Repository Outcome

The current repository inventory validates with no unclassified references.
After the policy intent engine module cutover,
`node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid`
reported:

- total phase-coded references: 15,155,
- production references: 6,857,
- rename candidates: 6,879,
- docs/history references: 3,464,
- test or migration evidence references: 4,719,
- obsolete migration tooling references: 93.

The counts are expected to fall as Phase 9R.2 through Phase 9R.5 replace
production names, remove obsolete migration tooling, and enforce the final
scanner boundary.

## Security Outcome

- The inventory is side-effect-free except for repository file reads.
- It distinguishes production code from docs/history/tests before any rename.
- It rejects unclassified references, production references kept without an
  adapter gate, missing durable rename targets, and disallowed side effects.
- It keeps historical evidence searchable while preventing it from being used
  as current production vocabulary.

## Next Step

Use the Phase 9R.4
[Policy Production Naming Regression Audit](policy-production-naming-regression-audit.md)
as the guardrail while proceeding with **Phase 9R.2 Durable Domain Module
Cutover**. Start with a narrow mechanical rename batch for the highest-value
production domain, preserving behavior and adding focused import/contract
regression tests.
