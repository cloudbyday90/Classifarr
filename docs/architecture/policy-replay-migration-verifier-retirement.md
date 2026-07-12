# Policy Replay Migration Verifier Retirement

## Status

Implemented July 11, 2026 as a Phase 6R.1 migration-verifier cutline component.

## Intent

After replay scoring and provider/TMDB enrichment were removed, the remaining
replay endpoint read a small classification-history sample, calculated local
completeness, and returned sample-selection counters. It did not compare old
and new behavior beyond the separate impact verifier, produce source-authorized
policy evidence, make a state transition, or have a normal product caller.

Keeping that endpoint would leave an exposed administrative diagnostic with no
independent migration purpose. The impact verifier remains the sole temporary
migration route until its own retention gate is evaluated.

## Official Guidance Reviewed

- [OWASP API9:2023, Improper Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  warns that unclear or unretired endpoints expand attack surface. The replay
  endpoint had no current consumer or distinct retention purpose.
- [OWASP Secure by Design Framework](https://owasp.org/www-project-secure-by-design-framework/)
  recommends minimizing attack surface and centralizing shared business logic.
  The evidence and impact contracts already own the relevant behavior.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side enforcement of explicit workflows. A request that
  cannot produce an authorized state transition or required verification should
  not remain as an alternate workflow.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports explicit design, verification, and risk reduction through removal of
  unnecessary implementation paths.

## Options Considered

1. **Retain the provider-free replay endpoint.**
   Its reads were bounded and safe, but its output was diagnostic-only and
   duplicated evidence-quality and impact-verifier information.
2. **Rewrite its counters into a new migration contract.**
   That adds another contract without a distinct decision, rollback, or storage
   requirement.
3. **Delete the endpoint and remaining replay reducer chain.**
   Keep migration comparison in the impact verifier and policy meaning in the
   evidence/readiness contracts.

## Final Recommendation Stack

1. Delete `/api/policies/migration-verifier/replay-preview`.
2. Delete replay verifier composition, sample diagnostics, completeness, and
   item-adapter modules with focused tests.
3. Retain the impact migration verifier only while its independent migration
   retention and rollback gate remains active.
4. Keep historical deletion records in the migration-deletion inventory, not
   active endpoint or engine contracts.

## Implementation Outcome

- Removed the replay migration route from `policiesRouteMigrationVerifier.mjs`.
- Removed the replay verifier composition and all remaining replay-specific ESM
  reducers and tests.
- Simplified the migration route to invoke the impact verifier directly.
- Updated storage-closure validation and native-storage test inventories to
  remove the retired replay verifier test.
- Reclassified the legacy replay verifier entries as `delete_after_migration`.

## Security Outcome

- The replay migration endpoint now returns `404` and performs no database work.
- No replay-specific history metadata, sample counter, or diagnostic output is
  available through the API.
- The impact verifier remains administrator-protected and is the only retained
  migration diagnostic path.
- No policy, routing, provider, AI, or storage side effects were introduced.

## Verification

- Route coverage proves the retired replay endpoint returns `404` without any
  database or transaction operation.
- Evidence, migration-deletion, native-storage, and storage-closure inventories
  no longer require deleted replay modules or tests.
- Full client/server, documentation, security, naming, and integration checks
  are required before release.

## Next Step

Evaluate the remaining impact migration verifier. Retain it only if it provides
an explicit, bounded old-to-new comparison required by a future native-storage
migration; otherwise remove the final migration diagnostic route and depend on
the durable evidence, intent, readiness, and rollback contracts.
