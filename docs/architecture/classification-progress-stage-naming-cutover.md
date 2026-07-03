# Classification Progress Stage Naming Cutover

## Status

Implemented as the first Phase 9R.2 durable-domain module cutover batch.

## Problem

Classification progress was implemented with production module names such as
`classificationPhaseService`, `classificationPhaseUtils`, and
`classificationPhaseProgress`. Those names were understandable during the
initial progress-tracking implementation, but they are not durable product
language. Operators experience classification progress as ordered stages, while
`phase` is now reserved for roadmap/history language.

This cutover intentionally renames the production module surface first and does
not rewrite persisted task queue fields or public response fields in the same
change. The persisted/API fields still use `current_phase`, `phaseIndex`, and
`phases` until Phase 9R.3 can migrate contracts and telemetry with explicit
compatibility rules.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports inventory-driven, traceable secure software changes. This cutover
  was constrained to module names, imports, and internal constants with focused
  regression tests.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  frames verification around preserving security controls. The rename avoids
  changing authorization, validation, queue persistence, or classification
  behavior.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  favor stable semantic names. `stage` is the durable runtime concept for
  progress tracking; persisted `phase` terminology is deferred to the contract
  cutover.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces preserving externally visible identifiers carefully. Public and
  persisted fields were not renamed in this batch because they require a
  compatibility plan.

## Recommendations

1. Rename production modules to the durable product term:
   `classificationProgressStageService`,
   `classificationProgressStageUtils`, and
   `classificationProgressStageQueries`.
2. Use `STAGES` and `STAGE_METADATA` internally so new production code does not
   depend on phase-coded constants.
3. Keep bounded compatibility aliases such as `updatePhase` and `PHASES` only
   for existing callers and tests until the contract cutover decides whether
   they can be deleted.
4. Preserve persisted/API field names in this batch to avoid a mixed behavior
   and storage migration.
5. Track the remaining public-contract rename under Phase 9R.3.

## Pros And Cons

Pros:

- Reduces production phase-coded module debt without altering behavior.
- Makes new classification progress code read as product language.
- Keeps storage and API compatibility stable.
- Creates a small, testable first Phase 9R.2 batch before larger policy-builder
  service renames.

Cons:

- Public payloads still contain phase-shaped fields until Phase 9R.3.
- Compatibility aliases temporarily keep a small amount of old terminology.
- The inventory still reports historical docs and many remaining production
  rename candidates outside this narrow batch.

## Final Recommendation Stack

- Production modules:
  - `server/src/services/classificationProgressStageService.mjs`
  - `server/src/services/classificationProgressStageUtils.mjs`
  - `server/src/services/classificationProgressStageQueries.mjs`
- Focused tests:
  - `server/src/__tests__/classificationProgressStageService.test.mjs`
  - classification route/path/import regression suites
- Scanner:
  - `node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid`
- Deferred contract work:
  - Phase 9R.3 must decide how to migrate `current_phase`, `phase_index`,
    `phase_history`, `currentPhase`, `phaseIndex`, `totalPhases`, and `phases`
    without breaking persisted task progress or clients.

## Outcome

The service, utility, query module, imports, and focused tests now use
classification progress stage naming. Runtime behavior and public response
shape remain unchanged. The production naming inventory validates and now
reports:

- total phase-coded references: 15,951,
- production references: 7,521,
- rename candidates: 7,543,
- docs/history references: 3,229,
- test or migration evidence references: 5,086,
- obsolete migration tooling references: 93.
