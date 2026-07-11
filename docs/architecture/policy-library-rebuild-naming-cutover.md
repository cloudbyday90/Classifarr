# Policy Library Rebuild Naming Cutover

## Status

Implemented as a mechanical durable-language cutover for library rebuild
validation diagnostics.

## Scope

`policyLibraryPolicyRebuild.mjs` had three validation messages that referred to
a temporary roadmap label. They now refer to the actual contract requirements:
a bounded policy intent draft and valid policy automation readiness.

No status ID, risk ID, data shape, trace attribute, export, persistence rule,
or rebuild behavior changed. The existing explicit acceptance, rollback, and
no-side-effect gates remain intact.

## Official Guidance Reviewed

- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
  recommends descriptive identifiers that are understandable without local
  project context. Validation text should describe the missing contract, not a
  completed roadmap step.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports stable and meaningful semantic terms. Current diagnostics should use
  the same durable vocabulary as the underlying policy intent and readiness
  contracts.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit, testable workflow invariants. This change keeps the
  rebuild validation order and all safety gates unchanged.

## Recommendations

1. Make current diagnostics describe durable domain requirements.
2. Keep roadmap labels in planning/history documents only.
3. Add focused tests for renamed user-facing validation language.
4. Do not alter risk IDs or behavior in a terminology-only cutover.

## Pros And Cons

Pros:

- Operators and maintainers see the real missing contract requirement.
- The rebuild service no longer exposes obsolete implementation terminology.
- Focused coverage prevents a phase-coded diagnostic regression.

Cons:

- Other inventory entries still require separate cohesive cutovers.
- Historical docs and compatibility evidence retain phase terms by design.

## Final Recommendation Stack

1. Use the production-name inventory to find phase-coded production text.
2. Replace it with the precise product-domain term.
3. Verify the unchanged contract and naming inventory.
4. Continue with the next isolated batch before functional expansion.

## Next Step

Continue the next cohesive naming cutover, then begin the declared-intent
command contract that validates authorized changes against a proposal
fingerprint before persistence.
