# Policy Runtime And Rebuild Test Reset

Status: implemented as a durable runtime/rebuild test reset contract that
originated as the ninth Phase 7R runtime/rebuild checkpoint.

## Problem

The re-imagined policy runtime replaces the old policy-builder preview-heavy
migration path with server-owned runtime authority contracts. The test suite
must stop treating impact/replay preview UI as the behavior contract, while
still preserving useful classification regressions and migration safety checks.

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

1. Treat runtime/rebuild tests as authority-boundary tests, not UI preview
   snapshots.
2. Keep existing classification regressions where they still prove legacy
   compatibility, but move new behavior assertions to server-owned contracts.
3. Classify each old impact/replay preview test as keep, rewrite, or delete
   after its replacement contract exists.
4. Require missing-routing coverage to distinguish classification success from
   routing success.
5. Require rebuild and verifier tests to protect explicit constraints and
   rollback safety before native intent storage migration begins.
6. Verify each declared test artifact still resolves inside the repository and
   exists on disk so the reset cannot pass with stale paths.

## Pros And Cons

Pros:

- Prevents old preview UI from freezing the re-imagined runtime model.
- Gives each test a clear replacement or retention reason.
- Keeps behavior-sensitive checks server-owned and deterministic.
- Preserves security posture by avoiding raw provider, replay, impact, prompt,
  or diagnostic payloads as migration contracts.

Cons:

- Requires follow-up cleanup work to actually remove old preview tests after
  native intent parity proves they are replaced.
- Adds a governance contract that must be kept in sync when runtime contracts
  move or rename.
- Reads repository file metadata during validation, so the reset is tied to the
  current workspace layout.

## Final Recommendation Stack

- Server service: `policyRuntimeRebuildTestReset.mjs`
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
- Artifact availability validation:
  - paths must be repository-relative,
  - paths must resolve inside the repository,
  - declared replacement/retention test files must exist.
- Next step: runtime contract completion audit before native intent storage.

## Implemented Files

- `server/src/services/policyRuntimeRebuildTestReset.mjs`
- `server/src/__tests__/services/policyRuntimeRebuildTestReset.test.mjs`

## Outcome

The reset now produces a side-effect-free manifest of runtime/rebuild test
decisions, replacement contracts, required coverage, authority-boundary
requirements, artifact availability proof, and deletion criteria for abandoned
impact/replay diagnostics.
Validation fails when a runtime rewrite bypasses server authority, when
classification success is not separated from routing success, when required
coverage is missing, when a declared test artifact is missing or escapes the
repository, or when old preview UI is preserved as the migration contract.
