# Policy Builder Intent-First UI

Status: implemented for the next release line.

## Problem

Policy authoring was still organized around preset signal internals. Operators could customize content ratings, genres, keywords, and runtime behavior, but the editing model did not make the policy intent explicit:

- identity evidence,
- compatibility evidence,
- strict constraints,
- boosters,
- exclusions.

That made it too easy for broad signals such as `Comedy` or a rating hint to feel equivalent to hard routing constraints. The platform already had backend projection and calibration work; the UI needed to expose the same mental model.

## Official Source Research

Research date: June 12, 2026.

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) emphasize clear labels, predictable interaction, and text assistance for form input. The intent editor presents labeled sections with plain-language help text.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) provides a basis for secure application controls. Policy authoring should keep the server as the validation authority and avoid trusting client-side state as a security boundary.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) recommends allow-list validation and structured input. The UI emits bounded structured operations that still serialize through the existing `customSignals` allow-listed server path.
- [Vue Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq) describes organizing logic through imported Composition APIs. The implementation moves intent projection logic into a reusable ES module instead of embedding all behavior in the modal.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) frames trustworthy AI around transparent, accountable, explainable, and interpretable behavior. Intent-first policy authoring makes the deterministic rules that shape AI-assisted classification more visible before runtime.

## Recommendations

### 1. Build an Intent-First Layer Over Existing Preset Overrides

Add an editor that lets users work in policy-intent sections while continuing to save `customSignals`.

Pros:

- Low-risk API compatibility.
- Operators see the difference between identity, compatibility, constraints, boosters, and exclusions.
- Existing presets and policy storage continue to work.

Cons:

- The older per-preset customization panel still exists during the transition.

### 2. Keep the Server as the Trust Boundary

Do not treat client-side role grouping as authoritative. The server still normalizes and validates custom signal fields.

Pros:

- Avoids client-side authorization or validation assumptions.
- Keeps malformed payload protection centralized.

Cons:

- Some invalid edits are only rejected or normalized after save.

### 3. Use Modular Client Projection Logic

Create a pure `policyIntentModel` utility that the editor and tests can use.

Pros:

- Keeps the large modal smaller.
- Makes intent grouping independently testable.
- Aligns the client mental model with the server `configuration_view`.

Cons:

- The client projection must remain compatible with the server projection.

### 4. Start With High-Value Signal Operations

Focus the first UI slice on genre identity/compatibility, strict rating max constraints, genre boosters, and rating exclusions.

Pros:

- Targets the recent failure modes directly.
- Avoids a broad raw JSON editor rewrite.
- Leaves room for future language, runtime, studio, and keyword controls.

Cons:

- Not every supported policy signal is editable through the new intent sections yet.

## Final Stack

- Added `policyIntentModel.js` as a pure ES module.
- Added `PolicyIntentEditor.vue` as a modular intent-first editor.
- Wired the editor into `PolicyBuilderModal.vue`.
- Mapped intent operations to existing `customSignals` payloads:
  - identity genre requirements,
  - compatibility genre requirements,
  - strict certification max constraints,
  - genre boosters,
  - certification exclusions.
- Kept the existing save API unchanged.
- Added client unit coverage for the projection utility and builder save payload.

## Implemented Outcome

Users can now edit policy behavior by intent section instead of only by raw signal category. For example, they can add a `Family` genre as identity evidence, set `PG-13` as a strict max rating constraint, and keep `Comedy` as a booster rather than treating it as determinative routing evidence.

The saved payload remains compatible with existing policy CRUD and server-side validation.

## Security and Privacy Boundaries

- The UI never stores or displays secrets, provider prompts, embeddings, or media payloads.
- Client-side intent grouping is advisory; server validation remains authoritative.
- Inputs are selected from known preset-derived genres and ratings for this first slice.
- The implementation does not add a new endpoint or database write path.

## Validation

Focused validation:

```bash
npm --prefix client run test -- --run PolicyBuilderModal policyIntentModel
npm --prefix client run lint
git diff --check
```

## Follow-Up Design Items

1. Full signal coverage for intent editor

   Intent: add language, runtime, studios, keywords, vote average, release year, and media type controls to the same intent-first model.

   Platform improvement: removes the need to fall back to the older signal-type customization panel for advanced policies.

2. Policy impact preview

   Intent: show how a policy edit would change recent classification candidates before saving.

   Platform improvement: reduces trial-and-error policy tuning and prevents routing churn.

3. Server-provided editor schema

   Intent: expose allowed signal types, operators, value catalogs, and role constraints from the server instead of deriving all options from presets.

   Platform improvement: keeps client and server policy semantics synchronized as the policy model grows.
