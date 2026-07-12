# Policy Runtime Evidence Entry Contract

Date: 2026-07-12

## Decision

Runtime evidence adapters must use `normalizePolicyEvidenceEntry` before adding
an entry to a runtime projection. Runtime validation must also reject an
authority source that is not allowlisted by the entry's policy evidence source.

The runtime projection retains its own source adapters and demotion logic. This
change does not force runtime RAG, routing, or profile inputs through the
library-rebuild envelope. It aligns their primitive entry fields and provenance
checks with the core evidence contract.

## Research Inputs

- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early syntactic and semantic validation, with allowlists as the
  primary control. Runtime entries now share bounded primitive validation and
  enforce a source-specific authority allowlist.
- The [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege and deny-by-default decisions. Evidence authority
  is a data-authority decision: an unapproved source-authority pairing is
  rejected rather than treated as equivalent evidence.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) supports
  secure development practices that reduce root causes of recurring defects.
  Reusing the core normalizer removes a duplicate field-normalization path.

## Options

### Keep runtime-specific field handling

Pros:

- No shared dependency.

Cons:

- Runtime fields can drift from core evidence semantics.
- Missing numeric values can be accidentally represented as zero-valued
  evidence, and timestamps can remain noncanonical.

### Force runtime inputs through the library-rebuild envelope

Pros:

- One envelope shape.

Cons:

- RAG, routing, and runtime-only demotion inputs do not share the rebuild
  envelope's domain shape.
- Couples two bounded adapters for no additional authorization benefit.

### Share the entry normalizer and source-authority audit

Pros:

- Preserves runtime-specific adapters while making primitive fields canonical.
- Prevents incompatible authority relabeling.
- Treats absent numeric fields as absent, not as zero evidence.

Cons:

- Runtime adapters must use the shared normalizer whenever fields are added.

## Recommendation Stack

1. Keep specialized runtime input adapters and their demotion rules.
2. Use the shared evidence-entry normalizer at every runtime entry creation.
3. Enforce source-to-authority compatibility at creation and audit time.
4. Reject tampered unbounded or noncanonical entry fields before automation.
5. Retain sanitized fingerprints and no-side-effect guarantees.

## Implementation Outcome

- `policyRuntimeEvidenceProjection.mjs` now creates entries with
  `normalizePolicyEvidenceEntry`.
- Canonical timestamps and bounded key/label/value/count/confidence/reason
  fields are no longer overridden by local runtime assignments.
- Missing count and confidence values remain `null`; they no longer normalize
  to invented zero-valued evidence.
- Runtime audits now emit stable risks for field-contract violations and
  source-authority incompatibility.
- No classification, routing, provider call, learning write, or storage change
  occurs in this component.

## Verification

- Focused runtime projection and entry-normalizer tests cover canonicalization,
  absent numeric values, source-authority mismatch, and tampered fields.
- Full client, server, integration, documentation, lint, and naming checks are
  required before release.
