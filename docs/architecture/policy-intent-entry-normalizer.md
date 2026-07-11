# Policy Intent Entry Normalizer

## Status

Implemented as the primitive-field boundary for policy intent entries.

## Recommendation

Normalize intent-entry key, label, value, and reason code before either direct
or bounded intent drafting. Keep only bounded primitive text, canonicalize
control whitespace, and audit generated or tampered entries before downstream
learning or readiness consumes them.

This follows OWASP's guidance to validate and bound input at server boundaries
and to sanitize log-bound data, while preserving Unicode media terminology.
[OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
and [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
support the approach.

## Pros And Cons

Pros:

- Direct and bounded drafting share one safe primitive-field contract.
- Object-valued evidence cannot leak into intent, audit, or later workflow data.
- The audit reports stable risk IDs without copying unsafe values.

Cons:

- Source adapters must keep detailed payloads outside the intent contract.

## Final Recommendation Stack

- `server/src/services/policyIntentEntryNormalizer.mjs`
- `server/src/services/policyIntentEngine.mjs`
- Focused tests in `server/src/__tests__/services/`

## Outcome

Intent entries now contain canonical `key`, `label`, `value`, and `reasonCode`
fields only. Raw object values normalize to `null`; tampered entry fields fail
the intent audit through `intent_entry_field_contract`.
