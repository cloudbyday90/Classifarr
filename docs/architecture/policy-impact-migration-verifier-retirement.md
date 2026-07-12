# Policy Impact Migration Verifier Retirement

## Status

Implemented July 11, 2026 as a Phase 6R migration-verifier cutline component.

## Intent

The impact migration verifier compared a legacy preset/custom-signal projection
with a submitted draft. Its browser presentation had already been removed, and
no runtime or client caller remained. The comparison did not authorize a write,
drive a rollback, or supply evidence unavailable from the bounded evidence,
intent, readiness, and rollback contracts.

Keeping the route and service would preserve an unowned administrative API with
no current decision role. A future native-storage migration that genuinely
needs an old-to-new comparison must define a new bounded contract with an
explicit owner, consumer, rollback purpose, and expiry gate.

## Official Guidance Reviewed

- [OWASP API9:2023, Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  recommends retiring unneeded endpoints and maintaining an accurate API
  inventory. The impact endpoint had no consumer or approved retention purpose.
- [OWASP Secure by Design Framework](https://owasp.org/www-project-secure-by-design-framework/)
  supports minimal, explicit service boundaries and design-time verification.
  The bounded policy-engine contracts already own the required decisions.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side workflows. A diagnostic that cannot authorize
  a required workflow should not remain as an alternate API path.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports documented, verified removal of unnecessary implementation paths.

## Options Considered

1. **Retain the impact endpoint.** It was deterministic and side-effect free,
   but had no caller and duplicated bounded policy-engine contracts.
2. **Move the comparison into another administrative route.** This changes the
   namespace without creating an independent decision, owner, or rollback use.
3. **Retire the route and service.** Preserve historical deletion evidence and
   require any future migration comparison to have a specific bounded contract.

## Final Recommendation Stack

1. Delete the impact migration route, direct service, and focused service test.
2. Remove the route registration and active verifier-only inventory branches.
3. Keep retirement paths in deletion and completion-audit evidence to prevent
   accidental reintroduction.
4. Keep policy migration safety in bounded evidence, intent, readiness,
   conversion, backup, and rollback contracts.

## Implementation Outcome

- Removed `/api/policies/migration-verifier/impact-preview` and its route
  registration.
- Removed `policyImpactPreviewMigrationVerifier.mjs` and focused test.
- Removed the final active migration-verifier decision category and evidence
  reducer-cutline API.
- Reclassified historic impact paths as deletion records and removed stale
  compatibility-manifest entries for already-deleted diagnostic code.

## Security Outcome

- Both former migration verifier endpoints return `404` without database work.
- No diagnostic comparison API can expose legacy policy configuration or draft
  deltas outside an explicit future migration contract.
- The remaining policy-engine contracts are deterministic, bounded, and do not
  depend on provider, AI, routing, or persistence side effects for their
  decision output.

## Verification

- Route coverage checks both retired endpoints for `404` and no database work.
- Evidence, deletion-path, completion-audit, native-storage, and storage
  closure inventories no longer require active verifier modules or tests.
- Full client/server, documentation, security, naming, and integration checks
  are required before release.

## Next Step

Complete the runtime decision inventory before wiring classification or routing
to the rebuilt policy engine. Each runtime entry point must declare whether it
consumes bounded evidence, proposed intent, readiness, declared constraints,
or an approved conversion/rollback record.
