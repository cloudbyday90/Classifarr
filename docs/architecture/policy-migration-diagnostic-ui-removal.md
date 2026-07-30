# Policy Migration Diagnostic UI Removal

## Status

Implemented July 11, 2026 as a Phase 6R.1 evidence-engine cutline component.

Supersession: the server migration-verifier HTTP route and its retired
impact/replay service family were subsequently removed. The retained
`policyMigrationVerifierRollback` module is a server-internal cutover and
rollback safety contract, not an administrator API route. See [Policy
Library-Rebuild Legacy Migration-Verifier Service
Retirement](policy-library-rebuild-legacy-migration-verifier-service-retirement.md).

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
  operations. The retired verifier route no longer provides an alternate
  administrative API surface.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) supports
  traceable design decisions and verification. The browser cutline preserves
  server verifier tests and the migration-deletion inventory while deleting the
  obsolete product surface.

## Options Considered

| Option | Benefits | Risks |
| --- | --- | --- |
| Keep the panel behind a prop | Lowest implementation cost | Retains an undiscoverable product path and browser API access. |
| Keep client utilities without rendering cards | Retains possible future reuse | Preserves unused code and an unneeded public API facade. |
| Delete browser preview code; retain bounded server verification | Removes normal-flow complexity and browser access while preserving controlled migration verification | The former verifier HTTP route required a later controlled retirement. |

## Final Recommendation Stack

1. Delete the impact/replay preview cards, composables, utilities, client API
   methods, and focused browser tests.
2. Remove the modal visibility prop so callers cannot restore the diagnostic UI.
3. Keep bounded server verification outside normal policy writes.
4. Keep server-internal rollback-verifier tests and historical retirement
   records as evidence for later native-storage conversion and removal decisions.
5. Do not allow replay, parity, provider, quota, or TMDB diagnostics into the
   evidence, intent, readiness, or normal authoring contracts.

## Implementation

- Removed the impact and replay preview panels from `PolicyBuilderModal.vue`.
- Removed `showMigrationVerifierPanels`, so an old caller cannot re-enable the
  panels.
- Removed the browser API methods that posted to migration-verifier endpoints.
- Deleted all browser-only preview state, response formatting, and test files.
- Updated current workflow, boundary, compatibility, presentation, draft-state,
  runtime-test inventories, and the migration-deletion ledger so they no longer
  treat deleted browser files as live artifacts. The ledger now retains only
  still-present server verifier candidates; the completion record is [Policy
  Library-Rebuild Browser Impact And Replay Preview
  Retirement](policy-library-rebuild-browser-impact-replay-preview-retirement.md).
- Retired the server migration-verifier HTTP route and superseded service/test
  family after their independent cutline changes. The live ledger now contains
  only current source artifacts.

## Security Outcome

- The standard browser bundle has no migration-verifier client methods or
  diagnostic preview components.
- The ordinary policy setup flow cannot send draft payloads to verifier routes.
- No migration-verifier HTTP route remains in the policy router.
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
