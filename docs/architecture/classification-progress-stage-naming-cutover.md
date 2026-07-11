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

This initial module-surface cutover was completed before the durable storage
cutover. The later [Classification Progress Stage Storage
Cutover](classification-progress-stage-storage-cutover.md) renamed persisted
task queue fields, JSON history entries, API responses, and progress events to
stage terminology without retaining compatibility aliases.

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
  progress tracking, including the completed persisted-storage cutover.
- [W3C Cool URIs Don't Change](https://www.w3.org/Provider/Style/URI)
  reinforces preserving externally visible identifiers carefully. The later
  storage cutover used a deliberate atomic migration rather than a permanent
  compatibility alias.

## Recommendations

1. Rename production modules to the durable product term:
   `classificationProgressStageService`,
   `classificationProgressStageUtils`, and
   `classificationProgressStageQueries`.
2. Use `STAGES` and `STAGE_METADATA` internally so new production code does not
   depend on phase-coded constants.
3. Keep the initial module change narrow, then make the later storage/API
   rename as one atomic cutover rather than adding permanent aliases.

## Pros And Cons

Pros:

- Reduces production phase-coded module debt without altering behavior.
- Makes new classification progress code read as product language.
- Kept the initial module rename independently testable.
- Creates a small, testable first Phase 9R.2 batch before larger policy-builder
  service renames.

Cons:

- The initial split deferred the complete storage and API change until it could
  be delivered atomically.
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
- Completed follow-up:
  - The stage-storage cutover renamed persisted task progress and public
    progress contracts without retaining aliases.

## Outcome

The service, utility, query module, imports, and focused tests now use
classification progress stage naming. Runtime behavior and public response
shape remain unchanged. After the follow-up contract cutover, the production
naming inventory validates and reports:

- total phase-coded references: 15,892,
- production references: 7,467,
- rename candidates: 7,489,
- docs/history references: 3,260,
- test or migration evidence references: 5,050,
- obsolete migration tooling references: 93.
