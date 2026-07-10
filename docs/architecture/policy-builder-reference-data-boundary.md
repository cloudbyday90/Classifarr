# Policy Builder Reference Data Boundary

Status: implemented and hardened with record and option provenance audits.

## Scope

This document records the durable policy-builder reference-data boundary.
Reference data can populate controls, provide configuration context, and show
observed library-profile suggestions. It is not policy authority, learning
authority, or automation-readiness authority.

This slice does not change API calls, UI behavior, policy saves, classification
scoring, database schema, routing, or profile refresh behavior. It removes
phase-worded runtime notes from the reference-data boundary and keeps the active
design record aligned with product-domain naming.

## Official Guidance Reviewed

Official sources reviewed as of June 2026:

- Vue Computed Properties:
  <https://vuejs.org/guide/essentials/computed>
  - Derived values should be treated as calculated views over source state, not
    independent authority.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables>
  - Reusable async state belongs behind deliberate composable APIs with clear
    ownership.
- Vue State Management:
  <https://vuejs.org/guide/scaling-up/state-management>
  - Shared client state needs clear mutation and ownership boundaries.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing>
  - Boundary behavior should be verified at the layer that owns it.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Fixed-option inputs need allow-list validation against the offered values,
    and server-side validation remains authoritative.
- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>
  - Data validity, provenance, and trust boundaries should be explicit before
    data influences consequential behavior.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
  - Secure implementation needs documented responsibilities and verification
    before behavior changes.

## Recommendations

1. Split reference data into explicit authority categories:
   - static options,
   - configured libraries,
   - starter templates,
   - observed profile suggestions,
   - routing/mapping status,
   - migration notices,
   - server projection display.
2. Treat observed library-profile values as evidence-backed suggestions, not
   generic dropdown values.
3. Keep static starter-template values option-only until the operator accepts
   them into draft intent.
4. Do not let the client compute automation readiness from reference data.
5. Reserve routing and mapping readiness for a server-owned projection rather
   than inferring it from current reference calls.
6. Audit reference-data provenance:
   - record categories must match their authority,
   - observed evidence must come from library-profile data,
   - reference data must not compute readiness or persist policy,
   - future routing status must not acquire a client path prematurely,
   - migration notices must not suggest intent,
   - option sources must be either `library_profile` or `preset_reference`.

## Pros And Cons

Pros:

- Makes available options and observed evidence distinguishable in tests.
- Prevents library-profile suggestions from silently becoming learning or hard
  limits.
- Keeps provider-derived or profile-derived details behind server-owned
  projections.
- Identifies missing routing/mapping readiness as a future server projection.
- Gives UI and engine work a stable category model for display and authority
  boundaries.
- Makes option provenance testable when profile-derived options and starter
  template options are merged into one UI list.

Cons:

- The current reference-data composable still returns mixed data until later
  refactors split it.
- Routing/mapping status is documented as a future server projection but is not
  implemented here.
- Existing profile freshness helpers remain client display adapters and do not
  replace server-owned readiness.
- The audits verify declared provenance and authority, not the freshness or
  accuracy of the underlying media-server profile data.

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

## Implemented Outcome

The reference-data boundary defines categories:

| Category | Meaning |
| --- | --- |
| Static option | Available value from static or starter-template reference data. |
| Configured library | Destination context from connected media-server configuration. |
| Starter template | Draft seed or suggestion, not durable policy authority. |
| Observed profile suggestion | Evidence-backed suggestion from current library contents. |
| Routing/mapping status | Server-owned readiness context placeholder. |
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
| `routing_mapping_status` | Routing/mapping status | Server readiness context placeholder |
| `presetMigrationNotice` | Migration notice | Migration context |

The contract explicitly states that reference data cannot compute readiness or
persist policy. Observed profile suggestions may suggest intent, but they are
not durable authority and cannot create learning by themselves.

## Hardening Outcome

The boundary exposes:

- `validateReferenceDataRecord(record)`
- `buildReferenceDataBoundaryAudit(records)`
- `validateReferenceDataOption(option)`
- `buildReferenceDataOptionAudit(options)`

The record audit fails on:

- unknown records,
- static options with non-option authority,
- observed evidence from non-profile sources,
- observed evidence not marked as an explicit suggestion,
- client readiness computation,
- direct policy persistence,
- future routing status with a current client path,
- migration notices that suggest policy intent.

The option audit fails on options without a value or with unknown provenance.
Valid option provenance is intentionally narrow:

| Source | Authority |
| --- | --- |
| `library_profile` | Observed evidence suggestion from current library contents. |
| `preset_reference` | Static option only from starter-template reference data. |

This keeps `availableGenreOptions` usable as a single UI list while preserving
the authority difference between "already in this library" and "available from
starter templates."

## Follow-Up

The next high-value task is the legacy compatibility boundary cutover: contain
preset attachments, starter-template weights, `customSignals`, removed markers,
strict/advisory metadata, and compatibility fallback projections inside bridge
ownership without phase-worded production contracts.
