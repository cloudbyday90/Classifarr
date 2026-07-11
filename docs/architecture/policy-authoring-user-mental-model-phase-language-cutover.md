# Policy Authoring User Mental Model Phase-Language Cutover

Date: 2026-07-10

## Purpose

The policy authoring user mental model already had a stable module name, but
its public term metadata and validation diagnostics still exposed historical
phase labels. This cutover replaces those labels with durable policy-engine and
policy-authoring setup language without changing the authority, accessibility,
or copy-validation rules.

## Official Research Inputs

- W3C, [Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
- W3C, [Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- OWASP, [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- OWASP, [Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- NIST, [Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)

## Recommendations

1. Keep user-facing labels and helper text descriptive, consistent, and tied to
   the decision an operator must make.
2. Store a durable `policyEngineConcept` for each approved UX term rather than
   an implementation-phase label.
3. Validate that every approved term maps to an engine concept, known authority
   sources, and a permitted interaction pattern.
4. Keep client setup choices separate from policy persistence, learning, and
   routing execution; those remain server-controlled workflows.

## Tradeoffs

Pros:

- Product metadata no longer exposes obsolete roadmap language.
- Existing consumers retain the same term and audit behavior.
- Consistent terminology improves operator comprehension and accessibility.

Cons:

- The durable names clarify intent but do not by themselves wire the model into
  every existing UI surface.
- The related setup-checklist service still needs a separate module cutover.

## Implemented Outcome

- Replaced `phase6Concept` with `policyEngineConcept`.
- Replaced `MISSING_PHASE6_CONCEPT` with `MISSING_POLICY_ENGINE_CONCEPT`.
- Reworded setup validation diagnostics from historical phase labels to
  policy-authoring setup language.
- Renamed the active design record to
  `docs/architecture/policy-authoring-user-mental-model.md`.
- Updated roadmap links and the setup checklist's design-record path.

## Verification

Focused verification:

- `server/src/__tests__/services/policyUserMentalModel.test.mjs`

Supporting verification:

- consumers of `policyUserMentalModel.mjs`;
- policy-builder production-name inventory;
- documentation lint; and
- Git whitespace check.

## Next Component

Cut over `policyPhase0RChecklist.mjs` and its focused test to a durable
policy-authoring setup-checklist name. It is the remaining active phase-coded
service now directly associated with this model.
