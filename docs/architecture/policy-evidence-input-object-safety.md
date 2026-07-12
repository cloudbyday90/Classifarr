# Policy Evidence Input Object Safety

## Intent

Harden the server-owned policy evidence input boundary so an evidence envelope
cannot hide data in inherited properties, execute accessor code during
inspection, or introduce prototype-pollution keys before the deterministic
projection is built.

This is a narrow Phase 6R.1 completion hardening. It does not add a new policy
surface, provider integration, live metadata lookup, or storage write.

## Official-Source Research

- OWASP recommends validating all untrusted input at the earliest practical
  point, applying both syntactic and semantic validation, and favoring
  allowlists over denylists. The evidence input gate therefore accepts only
  known top-level sections and plain JSON-like data records.
- OWASP identifies server-side re-derivation and explicit workflow state as
  business-logic protections. The boundary derives the projection from
  inspected own data properties rather than trusting inherited or computed
  values supplied by an object.
- NIST SSDF calls for secure development practices that reduce vulnerabilities
  before release. Focused regression tests cover the boundary behavior rather
  than relying on code review alone.
- OpenTelemetry context guidance favors bounded, explicit propagation. The
  change preserves only existing sanitized evidence provenance; it never
  evaluates or emits unsafe input values.

Sources:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OpenTelemetry Context Specification](https://opentelemetry.io/docs/specs/otel/context/)

## Options Considered

### Preserve the Existing Generic Object Scan

Pros:

- no compatibility impact for unusual JavaScript objects.

Cons:

- `Object.entries()` ignores inherited properties while the projection adapter
  can read them directly;
- property access can invoke getters during validation;
- special own keys can reach later object handling.

Rejected because it permits an inspected-versus-consumed input mismatch.

### Deep-Clone Input Before Inspection

Pros:

- can reduce later mutation concerns.

Cons:

- clone behavior can invoke getters or change non-JSON values;
- adds allocation before the cardinality and safety boundary;
- does not define which object shapes are valid input.

Rejected because the gate needs an explicit safe input contract first.

### Require Plain Data Records and Own Data Properties

Pros:

- aligns the inspection and consumption model;
- rejects inherited, accessor-backed, and prototype-special input without
  evaluating unsafe values;
- accepts ordinary parsed JSON and null-prototype records;
- keeps diagnostics limited to stable risk IDs and field paths.

Cons:

- callers must convert class instances and accessor-backed objects to ordinary
  data before calling the evidence boundary;
- malformed envelopes fail closed instead of being partially projected.

Selected.

## Final Recommendation Stack

1. `policyEvidenceInputGate.mjs` accepts only plain object records and standard
   arrays with own data entries, scans descriptors, and blocks
   inherited/accessor-backed values and `__proto__`, `constructor`, or
   `prototype` keys.
2. `policyEvidenceBoundary.mjs` adapts only own data properties, so a direct
   adapter call cannot consume a property the gate would not inspect.
3. `policyEvidenceEngine.mjs` continues to normalize and audit the resulting
   bounded projection before intent inference consumes it.

## Implementation Outcome

Implemented:

- Added stable `unsafe_object_shape` and `prototype_pollution_key` input-gate
  risk IDs.
- Rejected non-plain records, non-standard arrays, array gaps, and accessors
  at the envelope and nested-object boundaries.
- Inspected property descriptors without invoking accessor getters.
- Rejected prototype-special own keys without recording their values.
- Restricted public-input adaptation to own data properties only.
- Added regression coverage for inherited sections, accessor-backed values,
  prototype-pollution keys, direct adaptation, and blocked boundary results.

Validation:

- `node ./scripts/run-jest.mjs --runInBand --testPathPatterns="(policyEvidenceInputGate|policyEvidenceBoundary|policyEvidenceEngine|policyEvidenceHandoffVerifier)" --no-coverage`

## Non-Goals

- no live provider calls;
- no TMDB quota or provider-router changes;
- no policy intent storage changes;
- no browser-facing policy-builder changes;
- no automatic learning or routing behavior.
