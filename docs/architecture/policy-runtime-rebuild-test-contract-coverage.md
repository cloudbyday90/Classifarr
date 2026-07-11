# Policy Runtime Rebuild Test Contract Coverage

## Status

Implemented for the Phase 6R evidence-engine test-reset boundary.

## Problem

The runtime/rebuild reset manifest previously proved only that a declared test
file existed under the repository. A stale, renamed, or unrelated test could
therefore appear to protect a critical runtime service without exercising that
service's contract. That weakens the test boundary during the policy-engine
refactor.

## Official Guidance Reviewed

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for verification of software security requirements throughout the
  lifecycle.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  emphasizes explicit trust-boundary review and regression checks.
- [OWASP Web Security Testing Guide: Test Integrity Checks](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/03-Test_Integrity_Checks)
  recommends verifying that test controls cannot be bypassed or made
  ineffective by configuration drift.

## Recommendation

Keep the existing side-effect-free reset manifest, but add a bounded
contract-to-test ownership layer:

1. Define a fixed allowlist of required runtime contract IDs and their ESM
   service import paths.
2. Require every mapped contract to have a focused artifact in the manifest.
3. Read only repository-contained artifact source and verify a static ESM
   import of the declared service.
4. Fail closed for an unknown contract, a missing required mapping, or a test
   that does not import its claimed service.
5. Keep content inspection local, read-only, and limited to the declared test
   files. Do not execute tests, load modules, make provider calls, or read
   runtime secrets during the audit.

## Pros And Cons

Pros:

- Prevents file-existence-only checks from satisfying an unrelated contract.
- Gives the completion audit a deterministic, inspectable ownership record.
- Keeps the contract portable and independent of live databases, providers,
  or media-server state.
- Keeps guarded outcome and telemetry normalization boundaries separately
  visible during the refactor.

Cons:

- Static import proof does not replace behavioral tests; both remain required.
- Moving a service requires updating its allowlisted import marker and focused
  test together.
- The check intentionally assumes the project's ESM test convention and is
  not a general-purpose dependency analyzer.

## Final Recommendation Stack

- `policyRuntimeRebuildTestReset.mjs` owns the fixed contract vocabulary,
  artifact manifest, source containment check, and static-import validation.
- Focused Jest tests prove clean mapping and fail-closed behavior for a
  mismatched artifact/contract pair.
- The runtime/rebuild completion audit consumes the reset result before later
  native-intent storage work.

## Outcome

The reset now requires nine required runtime contracts to be mapped to focused
test artifacts, including guarded outcome projection and runtime-metrics input.
The audit remains deterministic and side-effect free while rejecting artifacts
that are missing, outside the repository, unknown, unmapped, or unrelated to
their declared service contract.
