# Policy Runtime Completion Audit Contract Coverage

## Status

Implemented as a completion-gate hardening for runtime/rebuild test ownership.

## Problem

The runtime completion audit composed the runtime/rebuild test reset only by
its generic `ok` and issue-count fields. A supplied or future reset audit could
therefore report success while omitting focused ownership for a required runtime
contract.

## Official Guidance Reviewed

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  identifies verification as a secure development practice throughout the
  lifecycle.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends review of trust boundaries and business logic, not only generic
  test status.
- [OWASP Web Security Testing Guide: Test Integrity Checks](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/03-Test_Integrity_Checks)
  supports fail-closed validation when a control's required integrity proof is
  absent.

## Recommendation

The completion audit must require the test-reset audit to report a positive
required-contract count and an equal covered-contract count. The check is
limited to the reset component, leaves detailed contract validation owned by
the reset service, and returns a distinct failure reason with sanitized counts.

## Pros And Cons

Pros:

- Prevents a generic success flag from masking incomplete runtime test
  ownership.
- Keeps detailed test mapping validation local to the reset service.
- Adds only count-based completion evidence; no source, provider, or policy
  payload is surfaced by the completion audit.

Cons:

- The reset audit and completion audit must evolve together when required
  runtime contracts change.
- The gate verifies ownership completeness, not the full behavioral quality of
  individual focused tests.

## Final Recommendation Stack

- `policyRuntimeRebuildTestReset.mjs` publishes required and covered contract
  totals from its existing manifest.
- `policyRuntimeCompletionAudit.mjs` requires exact coverage parity for the
  runtime/rebuild reset record.
- Focused tests prove both the healthy path and rejection of a superficially
  passing but incomplete reset audit.

## Outcome

Runtime completion can advance only when every required runtime boundary has
focused test ownership. The audit remains deterministic, side-effect free, and
limited to sanitized count evidence.
