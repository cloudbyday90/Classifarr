# Policy Builder Phase 2R Draft View Projection

Date: 2026-06-30

## Purpose

Phase 2R.4 defines the policy-builder draft view as a read model for product
components. It gives UI cards stable fields for configured intent, options,
provenance, summaries, warnings, readiness placeholders, and observed-evidence
placeholders without exposing raw bridge storage or assigning policy authority
to the browser.

This task does not change policy save behavior, native storage, classifier
logic, AI prompts, provider calls, learning, or Arr writes.

## Official Research Inputs

- Vue component events documentation supports explicit emitted-event contracts
  and runtime validation for event payloads:
  https://vuejs.org/guide/components/events.html
- Vue component `v-model` documentation describes explicit component state
  contracts rather than implicit mutation:
  https://vuejs.org/guide/components/v-model.html
- Vue composables documentation recommends extracting reusable stateful logic
  behind clear boundaries:
  https://vuejs.org/guide/reusability/composables.html
- OWASP Input Validation guidance recommends syntactic and semantic validation
  at trust boundaries:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP Mass Assignment guidance recommends allow-listing fields and avoiding
  arbitrary object binding:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- NIST SSDF SP 800-218 recommends secure design review, implementation
  criteria, and verification:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Treat the draft view as read-only.
   Product components should use the draft view for rendering and command hints,
   not as save serialization or evidence authority.

2. Keep raw legacy storage out of browser-facing view fields.
   The view may retain compatibility value keys temporarily for command routing,
   but it must not expose raw `customSignals`, fallback payload blocks, or
   bridge internals as product concepts.

3. Put provenance in the view model.
   Chips should display product-facing provenance labels from the projection
   instead of mapping raw source keys inside leaf components.

4. Add placeholders for future server projections.
   Readiness and observed-evidence slots should exist now as read-only
   placeholders so later Phase 6R work can insert server data without changing
   save semantics.

5. Keep presentation formatting outside bridge modules.
   The bridge deserializes and serializes compatibility state. Section summaries,
   chip labels, warnings, and option diagnostics belong in view/projection
   utilities.
6. Make projection drift executable.
   The boundary should fail when view fields gain mutation or save authority,
   expose raw legacy terms, point at unknown command hints, or let provenance
   aliases collide.

## Pros And Cons

Pros:

- Keeps product components oriented around intent rather than bridge payloads.
- Gives Phase 6R a place to add read-only server readiness and observed
  evidence.
- Reduces raw source-key mapping inside components.
- Preserves current command behavior while making the transitional compatibility
  shape explicit.
- Adds executable server and client tests for the boundary.

Cons:

- Compatibility value keys still exist temporarily for current remove/configure
  commands.
- The client view remains transitional until Phase 8R native storage replaces
  the legacy bridge.
- More contract metadata exists before all UI components fully consume it.
- The audit validates view-projection ownership and browser-facing safety; it
  does not make the browser the authority for evidence, readiness, or save
  serialization.

## Final Recommendation Stack

- Server projection inventory:
  `server/src/services/policyBuilderPhase2DraftViewProjection.mjs`
- Client read-model projection:
  `client/src/utils/policyIntentDraftView.js`
- Presentation consumer:
  `client/src/components/policies/PolicyIntentChip.vue`
- View fields:
  - configured intent chips,
  - candidate options,
  - provenance labels,
  - section summaries,
  - warnings,
  - readiness placeholder,
  - observed-evidence placeholder,
  - compatibility values.
- View provenance:
  - operator edit,
  - starter template,
  - compatibility fallback,
  - observed evidence suggestion,
  - server projection.

## Implemented Outcome

The Phase 2R.4 implementation now provides:

- a server-owned draft-view projection contract,
- server validation that draft-view payloads fail if they expose raw legacy
  storage keys,
- read-only server-placeholder records for readiness and observed evidence,
- client draft-view entries with explicit provenance objects,
- client draft-view summaries with provenance counts and read-only placeholders,
- chip rendering that prefers draft-view provenance labels before raw source
  fallback labels,
- tests proving the projection hides raw legacy storage terms from the
  browser-facing view.
- an executable draft-view projection audit:
  - `validatePhase2RDraftViewFieldRecord(record)` checks individual view
    fields,
  - `validatePhase2RDraftViewProvenanceRecord(record)` checks provenance
    records,
  - `buildPhase2RDraftViewProjectionAudit(options)` checks the complete
    projection contract,
  - the audit fails unknown fields, categories, authorities, source draft
    fields, and command hints; raw legacy storage exposure; view mutation or
    save serialization; read-only placeholders without server-projection
    authority; compatibility-adapter views with product command hints;
    non-product-facing provenance; duplicate provenance aliases; and raw legacy
    terms in view labels.

## Verification

Focused tests:

- `server/src/__tests__/services/policyBuilderPhase2DraftViewProjection.test.mjs`
- `client/src/__tests__/utils/policyIntentDraftView.test.js`
- `client/src/__tests__/PolicyIntentChip.test.js`
- `client/src/__tests__/utils/policyIntentEditorSections.test.js`

The tests assert:

- draft-view fields are read-only and non-serializing,
- raw legacy storage keys fail validation,
- provenance labels resolve to product-facing labels,
- readiness and observed evidence are read-only placeholders,
- chip provenance comes from the view model when available,
- current section projection behavior remains compatible.
- projection inventory drift fails before product components depend on it.

## Next Phase

Continue with Phase 2R.5 Server Authority Preparation. That task should define
where client draft validation remains UX-only and where Phase 5R server
validation becomes authoritative for native intent, warnings, and save payloads.
