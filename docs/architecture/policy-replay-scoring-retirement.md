# Policy Replay Scoring Retirement

## Status

Implemented July 11, 2026 as a Phase 6R.1 evidence-engine cutline component.

## Intent

`policyIntentReplayScoring.mjs` evaluated a policy-builder draft against a
bounded sample of classification history and returned draft-fit scores,
recommendations, and parity deltas. It had one production caller: the
administrator-only migration verifier. It was not part of normal policy setup
after the browser diagnostics were removed.

The scorer did not meet the durable evidence contract. It combined untrusted
draft input with representative item data, had no source-authority envelope,
and emitted recommendations instead of bounded evidence entries. The evidence
engine already owns the safe replacement: deterministic, offline, server-owned
projections for profile, final-outcome, manual-correction, routing, metadata,
and freshness evidence.

## Official Guidance Reviewed

- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports managing security risk through explicit design, implementation,
  testing, and remediation. Removing duplicate decision paths reduces the code
  that must be secured and verified.
- [OWASP API9:2023, Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that stale endpoints and undocumented behavior expand attack surface.
  The migration endpoint no longer exposes an obsolete scoring response.
- [OWASP ASVS access-control design](https://cornucopia.owasp.org/taxonomy/asvs-4.0.3/04-access-control/01-general-access-control-design)
  requires server-side access control and least privilege. The remaining
  migration verifier stays administrator-protected, while unnecessary decision
  output is removed rather than merely hidden.
- [OpenTelemetry naming guidance](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports stable, meaningful names. Product decision contracts use evidence
  and readiness terminology rather than obsolete replay-scoring concepts.

## Options Considered

1. **Rewrite replay scoring as an evidence reducer.**
   This would retain deterministic matching code, but its inputs and output
   semantics are draft-specific and do not preserve source authority.
2. **Keep it as a migration-only feature.**
   This retains an extra decision model and an API response that no operator
   workflow consumes.
3. **Delete scoring and score/parity-only dependencies.**
   Use the existing evidence and readiness contracts for policy meaning; retain
   only the separately gated verifier behavior that has a documented migration
   role.

## Final Recommendation Stack

1. Delete the replay scorer, policy-engine comparison, execution context, and
   parity delta with their focused tests.
2. Remove `dry_run_scoring` and `parity_delta` from the migration verifier
   response and its execution composition.
3. Retain the migration verifier shell only while its independent retention and
   deletion gates remain active.
4. Keep deletion records as historical migration evidence, not active product
   contracts.
5. Keep bounded policy evidence and automation readiness as the only policy
   decision primitives.

## Implementation Outcome

- Deleted the scorer and its score/parity-only ESM dependencies.
- Removed score construction from the migration-verifier execution service.
- Removed obsolete score and parity response fields from the replay migration
  verifier and route coverage.
- Changed the migration inventory decision for those server artifacts to
  `delete_after_migration`.
- Removed the scorer from the active evidence-reducer cutline inventory.

## Security Outcome

- No browser or normal policy workflow can invoke or consume replay scoring.
- The remaining migration route retains existing authenticated administrator
  protection.
- The retained verifier continues to use bounded, parameterized sample reads
  and does not gain classification, Arr-write, persistence, or direct learning
  side effects from this change.
- Evidence and readiness stay offline, deterministic, source-authorized, and
  free of raw provider payloads and transient quota state.

## Verification

- Focused verifier and route coverage proves score and parity fields are absent.
- Evidence and migration-deletion inventories retain explicit ownership of the
  retired artifacts.
- Full client/server, documentation, security, naming, and integration checks
  are required before release.

## Next Step

Evaluate the remaining replay migration-verifier enrichment stack as a separate
component. Retain only fields that provide bounded, non-live migration support;
delete any provider-readiness, quota, or TMDB-preview behavior that duplicates
the web-search and metadata-provider contracts.
