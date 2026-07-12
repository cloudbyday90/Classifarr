# Policy Migration Diagnostic UI Removal

## Status

Implemented July 11, 2026 as a Phase 6R.1 evidence-engine cutline component.

## Intent

Impact and representative replay previews compared legacy policy behavior. They
did not establish destination meaning, automation readiness, or safe policy
intent. Leaving an opt-in browser panel in the normal policy modal made that
diagnostic workflow a hidden product path and allowed the browser to invoke
migration-only APIs.

## Official Guidance Reviewed

- [OWASP API9:2023](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
  calls for accurate endpoint inventory and retirement plans so obsolete or
  unnecessary API exposure does not become an unmanaged attack surface.
- [OWASP API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  recommends deny-by-default, explicit function authorization for sensitive
  operations. The retained verifier is mounted beneath Classifarr's authenticated
  administrator policy route.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) supports
  traceable design decisions and verification. The browser cutline preserves
  server verifier tests and the migration-deletion inventory while deleting the
  obsolete product surface.

## Options Considered

| Option | Benefits | Risks |
| --- | --- | --- |
| Keep the panel behind a prop | Lowest implementation cost | Retains an undiscoverable product path and browser API access. |
| Keep client utilities without rendering cards | Retains possible future reuse | Preserves unused code and an unneeded public API facade. |
| Delete browser preview code; retain server verifier only | Removes normal-flow complexity and browser access while preserving controlled migration verification | Maintainers must use the server verifier's dedicated, admin-protected route until its deletion gate completes. |

## Final Recommendation Stack

1. Delete the impact/replay preview cards, composables, utilities, client API
   methods, and focused browser tests.
2. Remove the modal visibility prop so callers cannot restore the diagnostic UI.
3. Keep the server verifier outside normal policy writes and behind the existing
   authenticated administrator policy router.
4. Keep server verifier tests and migration-deletion inventory as evidence for
   later native-storage conversion and removal decisions.
5. Do not allow replay, parity, provider, quota, or TMDB diagnostics into the
   evidence, intent, readiness, or normal authoring contracts.

## Implementation

- Removed the impact and replay preview panels from `PolicyBuilderModal.vue`.
- Removed `showMigrationVerifierPanels`, so an old caller cannot re-enable the
  panels.
- Removed the browser API methods that posted to migration-verifier endpoints.
- Deleted all browser-only preview state, response formatting, and test files.
- Updated current workflow, boundary, compatibility, presentation, draft-state,
  and runtime-test inventories so they no longer treat deleted browser files as
  live artifacts. The migration-deletion ledger remains the sole retained
  removal record.
- Retained the server migration verifier and its focused server coverage as
  controlled migration infrastructure.

## Security Outcome

- The standard browser bundle has no migration-verifier client methods or
  diagnostic preview components.
- The ordinary policy setup flow cannot send draft payloads to verifier routes.
- The remaining verifier is still covered by the policy router's
  `authenticateToken` and `requireAdmin` middleware at `/api/policies`.
- No raw provider data, live lookup, or policy persistence behavior was added.

## Verification

- Modal coverage proves the removed visibility prop cannot render diagnostic
  panels.
- Client API coverage verifies the standard policy API has no browser preview
  methods.
- Policy-engine and migration-deletion audit tests preserve the server-only
  verifier classification.

## Next Step

Assess `policyIntentReplayScoring.mjs` as the next Phase 6R.1 component. Keep
only deterministic, source-authorized transformations that can emit bounded
compatibility or outlier evidence; otherwise delete it with its verifier-only
dependents.
