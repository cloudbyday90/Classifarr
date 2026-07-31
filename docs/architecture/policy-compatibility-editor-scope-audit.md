# Policy Compatibility Editor Scope Audit

## Status

Implemented as the Phase 6R.5 compatibility-editor scope cutline.

## Outcome

The compatibility-maintenance surface now asks operators to maintain existing
destination rules only. It no longer renders raw scoring weights, combination
modes, or classification-threshold controls.

The deletion does not alter the compatibility write contract. Existing decision
values remain in the loaded form and continue to be serialized unchanged with
the legacy policy payload. The update route remains responsible for validating
thresholds, weight ranges, weight totals, and supported combination modes.

## Control Inventory

| Surface or control | Classification | Outcome |
| --- | --- | --- |
| Existing policy-context selector | Retained maintenance | Selects the persisted compatibility attachment whose declared rules are being maintained. It remains unavailable to native creation. |
| Belongs Here, Helpful Matches, Hard Limits, Avoid, and Boosts | Retained maintenance | Emit typed draft commands for existing compatibility signals. They do not calculate scoring, route media, or promote native authority. |
| Ask When Unsure review triggers | Retained maintenance | Keeps an explicit legacy policy rule for uncertainty handling; server readiness remains the automation authority. |
| Readiness summary links | Server-owned automatic behavior | The editor only renders bounded readiness feedback and focuses an existing rule. It cannot change automation state. |
| Weight sliders | Deletion target, removed | Browser-side weighting is an implementation mechanism, not destination meaning. |
| Combination-mode radio group | Deletion target, removed | Browser-side scoring composition is an implementation mechanism, not destination meaning. |
| Auto-classify and prompt threshold sliders | Deletion target, removed | The browser no longer presents automation thresholds as an operator setup decision. |
| Client form-field normalization and total-weight save gate | Deletion target, removed | The client no longer owns bounds or blocks a save on a value it cannot repair. The server remains authoritative. |
| Existing serialized compatibility decision values | Server-owned automatic behavior | Values are preserved for compatibility writes and accepted or rejected by the existing server validation and authorization path. |

## Design

`PolicyCompatibilityMaintenanceSurface.vue` is now a small composition
boundary for:

1. the compatibility migration acknowledgement;
2. the read-only policy behavior summary; and
3. typed destination-rule draft commands from `PolicyIntentEditor.vue`.

It no longer receives a policy form, weight total, or generic `update-field`
event. `PolicyBuilderModal.vue` likewise no longer exposes a raw scoring update
path to that surface.

`usePolicyBuilderState.js` retains compatibility decision fields solely so a
persisted policy can round-trip through the existing save serializer. It no
longer exports a raw form-field mutation API or treats client-calculated weight
totals as save authority. Nullish fallbacks preserve valid stored zero values,
including zero thresholds, rather than replacing them with browser defaults.

## Official Guidance Reviewed

Research was reviewed on 2026-07-30 against official guidance current through
June 2026:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side validation before processing because browser validation
  can be bypassed. The existing policy write route remains the authority for
  threshold, weight, and mode validation.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing legal state combinations on the server. The browser
  no longer decides whether legacy decision settings are acceptable for a save.
- [W3C WAI Forms: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends grouping only related, actionable controls. Removing unrelated
  scoring controls leaves the retained destination-rule groups focused and
  easier to understand.
- [W3C WCAG 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions)
  cautions that unnecessary instructions can create confusion. The remaining
  controls retain explicit labels and helpers; implementation details are not
  presented as required setup.

## Options Considered

| Option | Advantages | Costs |
| --- | --- | --- |
| Retain the full advanced editor | No immediate UI change | Keeps eleven implementation-level decisions in the operator path and duplicates server validation. |
| Replace raw controls with a read-only scoring summary | Preserves visibility of legacy values | Still exposes implementation mechanics, adds another panel, and does not help an operator maintain destination meaning. |
| Remove raw controls and preserve values through the established serializer | Reduces decision load, preserves legacy writes, keeps validation server-owned | A malformed stored legacy configuration is rejected by the server instead of being manually repaired in this UI. |

## Security And Accessibility Outcome

- No compatibility-editor control now lets the browser adjust scoring weights,
  threshold bands, or a combination strategy.
- The existing server write path still authenticates, locks the policy,
  authorizes legacy writes, validates the complete effective configuration, and
  rejects invalid values.
- Native creation and native recovery retain their existing no-compatibility
  control boundaries.
- The removal adds no custom interaction pattern. Remaining multi-option
  signal controls stay grouped, labeled, and backed by typed command events.

## Verification

- `client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js` verifies
  raw advanced controls are absent and typed maintenance events remain.
- `client/src/__tests__/PolicyBuilderModal.test.js` verifies compatibility
  payloads retain stored decision fields without rendering an advanced section.
- `client/src/__tests__/composables/usePolicyBuilderState.test.js` verifies
  hidden compatibility values, including valid zeros, round-trip unchanged.
- `client/src/__tests__/utils/policyCompatibilitySaveActionBoundary.test.js`
  verifies browser-owned weight totals no longer gate compatibility saves.
- The existing server policy-write tests retain validation coverage for the
  effective persisted threshold, weight, and combination-mode configuration.

## Final Recommendation Stack

1. Keep the compatibility editor limited to typed destination-rule maintenance.
2. Preserve existing compatibility decision fields only for write parity; do
   not present them as browser configuration controls.
3. Keep all decision-value validation, authorization, and concurrent policy
   checks on the server.
4. Do not add a browser repair, conversion, or hidden fallback workflow for
   invalid persisted compatibility configuration.
5. Remove client-derived compatibility readiness diagnostics; native readiness
   remains the bounded server-owned automation projection after cutover.

## Next Item

The compatibility routing-readiness card retirement audit is implemented in
[Policy Compatibility Routing-Readiness Card Retirement Audit](policy-compatibility-routing-readiness-card-retirement-audit.md).
Next, perform a **compatibility setup-card grid retirement audit** for
`PolicyBuilderSetupCards.vue` and `policyBuilderSetupCards.js`. Confirm the
grid remains unmounted, then remove it rather than preserve stale anchors or
browser-derived readiness state.
