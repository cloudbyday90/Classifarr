# Policy Evidence Source Authority Admission

Date: 2026-07-12

## Decision

Require every policy-evidence input section to use an authority source that is
explicitly allowlisted by its declared evidence source. A known source ID and a
known authority ID are not sufficient independently: their pairing is part of
the server-owned evidence contract.

For example, `metadata_enrichment` may not claim
`media_server_contents` authority merely because both identifiers are valid.
This preserves provenance before the deterministic evidence projection is built.

## Research Inputs

- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends validating untrusted inputs as early as possible and applying both
  syntactic and semantic validation. The pair is syntactically valid only when
  both IDs exist; it is semantically valid only when the source allows that
  authority.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) recommends
  secure development practices that reduce vulnerabilities and their impact.
  A tested, server-owned provenance rule prevents downstream components from
  reinterpreting caller-controlled metadata.
- The [OWASP Secure by Design Framework](https://owasp.org/www-project-secure-by-design-framework/)
  emphasizes explicit security requirements, secure defaults, and verification
  of architectural controls. The source-authority allowlist is a secure default:
  unknown or incompatible combinations fail before projection.

## Options

### Validate only that source and authority IDs exist

Pros:

- Minimal implementation.

Cons:

- Allows provenance relabeling between known identifiers.
- Requires downstream projection code to discover a contract violation later.

### Allow arbitrary authority overrides per input section

Pros:

- Flexible for experimental collectors.

Cons:

- Makes caller input an authority decision.
- Weakens auditability and can let metadata or outcome evidence appear to be
  observed media-server evidence.

### Allow only source-owned authority IDs

Pros:

- Makes provenance deterministic, reviewable, and testable at the boundary.
- Fails before projection, fingerprints, readiness, and intent inference.
- Supports bounded source-specific authority without adding UI or storage state.

Cons:

- A new valid collector-authority pairing requires a deliberate source-contract
  update.

## Recommendation Stack

1. Keep the evidence-source vocabulary and authority vocabulary immutable and
   server-owned.
2. Validate section ID, source ID, and authority ID existence.
3. Validate the source-to-authority pair against the source allowlist.
4. Return only a stable risk ID, section ID, and path; never copy input values
   into diagnostics.
5. Build a projection only after the input-gate audit passes.

## Implementation Outcome

- Added `section_authority_not_allowed_for_source` to the evidence input-gate
  risk vocabulary.
- `validatePolicyEvidenceInputSection` now verifies that the declared authority
  appears in the declared evidence source's `authoritySourceIds` allowlist.
- Added regression coverage for a metadata source falsely labeled as
  media-server authority.
- No API, database, provider, AI, routing, or storage behavior changed.

## Verification

- Focused evidence input-gate, projection, boundary, fingerprint, quality, and
  handoff suites verify the contract.
- Full client, server, integration, documentation, lint, and naming checks are
  required before release.
