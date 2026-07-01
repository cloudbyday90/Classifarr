# Policy Builder Phase 7R Runtime And Rebuild Test Reset

Status: implemented as the ninth Phase 7R runtime/rebuild component.

## Problem

Phase 7R replaces the old policy-builder preview-heavy migration path with
server-owned runtime authority contracts. The test suite must stop treating
impact/replay preview UI as the behavior contract, while still preserving useful
classification regressions and migration safety checks.

The reset must prove these behaviors:

- broad genre overlap does not auto-route specialized libraries,
- missing Arr routing remains `classified_not_routed`, not a successful route,
- stale questions cannot create durable learning,
- request-time choices pass through the learning guard,
- rebuild proposals preserve explicit operator constraints,
- replacement requires rollback snapshot coverage.

## Official Guidance Reviewed

- NIST Secure Software Development Framework (SSDF), SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST SSDF project:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>
- OpenTelemetry Semantic Conventions:
  <https://opentelemetry.io/docs/concepts/semantic-conventions/>
- NIST AI Risk Management Framework:
  <https://www.nist.gov/itl/ai-risk-management-framework>

## Recommendations

1. Treat Phase 7R tests as authority-boundary tests, not UI preview snapshots.
2. Keep existing classification regressions where they still prove legacy
   compatibility, but move new behavior assertions to server-owned contracts.
3. Classify each old impact/replay preview test as keep, rewrite, or delete
   after its replacement contract exists.
4. Require missing-routing coverage to distinguish classification success from
   routing success.
5. Require rebuild and verifier tests to protect explicit constraints and
   rollback safety before Phase 8R storage migration begins.

## Pros And Cons

Pros:

- Prevents old preview UI from freezing the re-imagined runtime model.
- Gives each test a clear replacement or retention reason.
- Keeps behavior-sensitive checks server-owned and deterministic.
- Preserves security posture by avoiding raw provider, replay, impact, prompt,
  or diagnostic payloads as migration contracts.

Cons:

- Requires follow-up cleanup work to actually remove old preview tests after
  Phase 8R parity proves they are replaced.
- Adds a governance contract that must be kept in sync when Phase 7R contracts
  move or rename.

## Final Recommendation Stack

- Server service: `policyBuilderPhase7RuntimeRebuildTestReset.mjs`
- Test reset decisions:
  - keep classification regression,
  - rewrite evidence projection,
  - rewrite automation decisions,
  - rewrite question contracts,
  - rewrite learning guard,
  - rewrite rebuild/verifier,
  - rewrite runtime metrics,
  - delete abandoned diagnostics after migration.
- Required coverage:
  - broad genre no specialized auto-route,
  - missing routing becomes `classified_not_routed`,
  - stale questions cannot learn,
  - request choices require guarded learning,
  - rebuild preserves explicit constraints,
  - rollback required before replacement.
- Next step: Phase 7R completion audit before Phase 8R native intent storage.

## Implemented Files

- `server/src/services/policyBuilderPhase7RuntimeRebuildTestReset.mjs`
- `server/src/__tests__/services/policyBuilderPhase7RuntimeRebuildTestReset.test.mjs`

## Outcome

The reset now produces a side-effect-free manifest of runtime/rebuild test
decisions, replacement contracts, required coverage, authority-boundary
requirements, and deletion criteria for abandoned impact/replay diagnostics.
Validation fails when a runtime rewrite bypasses server authority, when
classification success is not separated from routing success, when required
coverage is missing, or when old preview UI is preserved as the migration
contract.
