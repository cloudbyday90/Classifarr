# Policy Builder Phase 1R Reference Data Boundary

Status: implemented as the fourth Phase 1R client-boundary contract.

## Scope

Phase 1R.4 separates policy-builder reference data from observed evidence and
future readiness projections.

This slice does not change API calls, UI behavior, policy saves, classification
scoring, database schema, routing, or profile refresh behavior. It adds a
server-owned ESM boundary contract that classifies current reference data and
prevents static options, observed profile suggestions, migration notices, and
future routing status from being treated as the same kind of authority.

## Research Inputs

Official sources reviewed as of June 2026:

- Vue Computed Properties:
  <https://vuejs.org/guide/essentials/computed.html>
  - Derived values should be treated as calculated views of source state, not
    as independent authority.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Composables can encapsulate async state and reusable logic, but their
    returned values still need explicit ownership.
- Vue State Management:
  <https://vuejs.org/guide/scaling-up/state-management.html>
  - Shared client state should have clear mutation and ownership boundaries.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Client-side values need server-side validation and allow-listed semantics.
- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>
  - Data provenance, validity, and trust boundaries should be explicit before
    data influences consequential behavior.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Secure implementation needs documented responsibilities and verification
    before behavior changes.

## Recommendations

1. Split reference data into explicit categories:
   - static options,
   - configured libraries,
   - starter templates,
   - observed profile suggestions,
   - routing/mapping status,
   - migration notices,
   - server projection display.
2. Treat observed profile suggestions as evidence-backed options, not generic
   dropdown values.
3. Keep static starter-template values as option-only values until the operator
   accepts them into draft intent.
4. Do not let the client compute automation readiness from reference data.
5. Reserve routing/mapping status for a future Phase 6R/7R server-owned
   projection instead of inferring it from current reference calls.

## Pros And Cons

### Pros

- Makes available options and observed evidence distinguishable in tests.
- Prevents library profile suggestions from silently becoming learning or hard
  limits.
- Keeps provider-derived or profile-derived details behind server-owned
  projections.
- Identifies missing routing/mapping readiness as a future server projection.
- Gives Phase 3R and 6R a stable category model for display and engine work.

### Cons

- The current reference-data composable still returns mixed data until later
  refactors split it.
- Routing/mapping status is documented as a future server projection but is not
  implemented here.
- Existing profile freshness helpers remain client display adapters and do not
  replace server-owned readiness.
- Future tests still need to assert UI behavior once component refactors begin.

## Final Stack

- Reference-data boundary contract:
  `server/src/services/policyBuilderReferenceDataBoundary.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderReferenceDataBoundary.test.mjs`
- Current reference implementation:
  - `client/src/composables/usePolicyBuilderReferenceData.js`
  - `client/src/utils/policyBuilderLibraryGenreOptions.js`
  - `client/src/utils/policyBuilderProfileFreshness.js`
  - `client/src/utils/policyBuilderProfileRefreshResult.js`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-1r-reference-data-boundary.md`

## Implemented Outcome

Phase 1R.4 defines reference data categories:

| Category | Meaning |
| --- | --- |
| Static option | Available value from static or starter-template reference data. |
| Configured library | Destination context from connected media-server configuration. |
| Starter template | Draft seed or suggestion, not durable policy authority. |
| Observed profile suggestion | Evidence-backed suggestion from current library contents. |
| Routing/mapping status | Future server-owned readiness context. |
| Migration notice | Compatibility or migration context only. |
| Server projection display | Read-only state from server or bounded display helpers. |

Current boundary decisions:

| Data | Category | Authority |
| --- | --- | --- |
| `availableRatings` | Static option | Option only |
| `presetGenres` | Static option | Option only |
| `libraries` | Configured library | Configuration context |
| `allPresets` | Starter template | Draft seed |
| `suggestedPresets` | Starter template | Draft seed |
| `libraryProfile` | Observed profile suggestion | Observed evidence |
| `availableGenreOptions` from profile | Observed profile suggestion | Observed evidence |
| `libraryProfileFreshness` | Server projection display | Non-authority display |
| `libraryProfileRefreshResult` | Server projection display | Non-authority display |
| `routing_mapping_status` | Routing/mapping status | Future server readiness context |
| `presetMigrationNotice` | Migration notice | Migration context |

The contract explicitly states that reference data cannot compute readiness or
persist policy. Observed profile suggestions may suggest intent, but they are
not durable authority and cannot create learning by themselves.

## Phase 1R.4 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | Static options, configured libraries, starter templates, observed profile suggestions, migration notices, and future routing status are separate source categories. |
| Authority level identified | Reference data has option, configuration, draft-seed, observed-evidence, readiness-context, migration-context, or display-only authority. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Migration notices are context only; routing readiness is reserved for future server projections. |
| Operator-facing language validated | No product copy changes were introduced; observed profile suggestions are classified as evidence-backed options. |

## Follow-Up

The next Phase 1R task is **1R.5 Legacy Compatibility Boundary**. It should
contain preset attachments, starter-template weights, `customSignals`, removed
markers, strict/advisory metadata, and compatibility fallback projections inside
bridge ownership.
