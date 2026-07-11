# Policy Authoring Draft Contract

Status: implemented authority contract.

## Scope

This contract defines what an intent draft is allowed to represent before it
reaches validation, compatibility serialization, or native storage.

This slice does not change UI behavior, save payloads, database schema,
classification scoring, routing, learning, provider calls, or native intent
storage. It adds a server-owned ESM contract that names draft fields in product
language, classifies each field by authority, and marks which fields can
eventually map to native intent storage versus compatibility-only, UI-only, or
read-only projection state.

## Research Inputs

Official sources reviewed as of June 2026:

- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Stateful editing logic should be encapsulated and separable from
    presentation.
- Vue Component Events:
  <https://vuejs.org/guide/components/events.html>
  - Component edits should flow through explicit events instead of hidden
    mutation.
- Vue Component `v-model`:
  <https://vuejs.org/guide/components/v-model.html>
  - Parent-owned state should have explicit update semantics.
- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Persisted payloads should be allow-listed and avoid raw assignment.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Server validation must define accepted structure and fail closed.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Secure implementation needs documented responsibilities and verification.

## Recommendations

1. Define the draft with product-language fields:
   - `belongs_here`,
   - `helpful_matches`,
   - `hard_limits`,
   - `avoid`,
   - `ask_when`,
   - `routing_target`,
   - `assumptions`,
   - `warnings`,
   - `source_metadata`.
2. Keep declared-intent fields separate from inferred compatibility projections,
   UI-only state, server read-only projections, and legacy bridge metadata.
3. Mark native intent candidates explicitly and keep compatibility-only fields
   out of native storage by default.
4. Forbid draft ownership of evidence generation, learning decisions,
   provider-readiness decisions, routing side effects, and migration acceptance.
5. Keep the draft readable without understanding `customSignals`; bridge
   terminology belongs in compatibility metadata only.
6. Keep an executable contract audit:
   every field must have a known authority, native mapping, persistence flags,
   and product-facing fields must not leak raw legacy terminology.

## Pros And Cons

### Pros

- Gives policy authoring a concrete product-language draft model.
- Prevents compatibility metadata from becoming native intent accidentally.
- Gives policy authoring components stable field names that do not expose raw legacy
  storage.
- Gives native policy storage clear intent candidate fields.
- Keeps server validation and future engine contracts authoritative.

### Cons

- Current client draft code still uses legacy bucket names until the bridge is
  replaced by native storage.
- Native intent storage is not implemented here.
- Assumptions and warnings remain compatibility-only until future server
  contracts decide whether any of them become durable.
- Read-only evidence and readiness projections are placeholders for later
  server-owned contracts.
- The audit validates field semantics and persistence flags; it does not
  replace request-payload validation or native storage migration.

## Final Stack

- Draft contract:
  `server/src/services/policyAuthoringDraftContract.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyAuthoringDraftContract.test.mjs`
- Existing draft and bridge implementation:
  - `client/src/utils/policyIntentDraftBridge.js`
  - `client/src/composables/usePolicyIntentDraft.js`
  - `client/src/composables/usePolicyBuilderState.js`
  - `server/src/services/policyIntentRequestValidator.mjs`
- Policy-authoring vocabulary inputs:
  - `server/src/services/policyAuthorityVocabulary.mjs`
  - `server/src/services/policyUserMentalModel.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-authoring-draft-contract.md`

## Implemented Outcome

The contract classifies draft fields:

| Field | Authority | Native Mapping |
| --- | --- | --- |
| `belongs_here` | Operator-declared intent | Native intent candidate |
| `helpful_matches` | Operator-declared intent | Native intent candidate |
| `hard_limits` | Operator-declared intent | Native intent candidate |
| `avoid` | Operator-declared intent | Native intent candidate |
| `ask_when` | Operator-declared intent | Native review candidate |
| `routing_target` | Operator-declared intent | Native routing candidate |
| `assumptions` | Inferred compatibility projection | Compatibility only |
| `warnings` | Inferred compatibility projection | Compatibility only |
| `source_metadata` | Legacy bridge metadata | Compatibility only |
| `ui_state` | UI-only transient state | UI only |
| `evidence_projection` | Server read-only projection | Read-only projection only |
| `readiness_projection` | Server read-only projection | Read-only projection only |
| `legacy_bridge_metadata` | Legacy bridge metadata | Compatibility only |

The draft contract explicitly states:

- the draft is not durable authority by itself,
- server validation is required,
- raw legacy storage terms are not required to understand the draft,
- native intent candidates are declared-intent fields only,
- compatibility-only fields cannot become native storage by accident,
- UI-only and read-only projection fields do not serialize.

The executable hardening pass adds:

- `validatePolicyAuthoringDraftFieldContract(record)` for single-field checks,
- `buildPolicyAuthoringDraftContractAudit(options)` for whole-contract checks,
- risk detection for unknown fields, missing authority or native mapping,
  native persistence outside declared intent, compatibility-only native writes,
  UI/read-only projection serialization, observed evidence inside declared
  intent, and raw legacy terms in product-facing draft fields.

## Contract Checklist Result

| Check | Result |
| --- | --- |
| Source of truth identified | Operator-declared intent, inferred compatibility projection, UI-only state, server read-only projection, and legacy bridge metadata are separate draft authorities. |
| Authority level identified | Every draft field has an authority classification and native mapping. |
| Learning side effect identified | Draft state is explicitly prohibited from making learning decisions. |
| Rollback or migration impact identified | Compatibility-only fields and bridge metadata remain transitional until native storage conversion passes its safety gates. |
| Operator-facing language validated | Draft fields use the shared policy-authoring vocabulary instead of `customSignals` or raw preset terminology, and the audit fails product-facing fields that leak raw legacy terms. |

## Next Component

Cut over the policy-authoring vocabulary service and focused test. The draft
contract depends on it for durable authority semantics, but that supporting
family still contains phase-coded identifiers.
