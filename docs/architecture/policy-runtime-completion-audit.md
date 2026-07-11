# Policy Runtime Completion Audit

## Status

Implemented as the durable runtime/rebuild completion gate.

## Problem

The runtime automation and rebuild chain now has individual product-domain
contracts for runtime inventory, runtime evidence, automation decisions,
runtime questions, request-time learning, library-derived rebuild proposals,
migration verification, runtime metrics, and test reset. A roadmap checkbox is
not enough to prove the chain is complete.

The completion audit must prove:

- every runtime component has a design record, service, and focused test file,
- every component's own audit or validation passes,
- each component points to the expected next runtime handoff,
- the runtime/rebuild test reset proves complete focused ownership for every
  required runtime contract,
- request-time learning is checked with a valid bounded question-proof sample,
- the final handoff moves to native intent storage and legacy removal.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software development as lifecycle-integrated practices. The
  audit keeps completion proof deterministic and current-state based.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  includes verification and testing as secure development practices. The audit
  verifies component records, artifact existence, local component audits, and
  handoff sequencing before storage migration work proceeds.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. The audit treats
  server-owned runtime contracts as the verification boundary.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  describe common names for operations and data. The audit uses durable
  product-domain component ids instead of temporary roadmap ids.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends printable, lowercase, namespaced names. The audit contract now
  uses `policy.runtime_completion_audit.v1`.

## Recommendations

1. Treat completion as a server-owned audit, not a documentation assertion.
2. Compose existing component audits instead of duplicating each component's
   validation rules.
3. Verify docs, services, and focused tests exist for every runtime component.
4. Reject next-step drift so the runtime/rebuild sequence cannot silently skip
   a gate.
5. Require the test-reset audit to report complete contract-to-test coverage;
   a generic passing status alone is not enough.
6. Keep the audit side-effect-free and focused on current repository evidence.

## Pros And Cons

Pros:

- Provides a single gate before native intent storage begins.
- Catches missing services, tests, docs, and stale runtime handoffs.
- Reuses existing component audits, keeping validation ownership local.
- Removes phase-coded production module names, exports, component ids, and
  contract versions.
- Prevents a failed request-time learning default from hiding behind a generic
  completion check by using a valid bounded question-proof sample.
- Prevents a stale or unrelated test artifact from satisfying a runtime
  completion gate without owning its declared service contract.

Cons:

- The audit must be updated when component contracts move or rename.
- The audit proves current repository artifacts and component audits; it does
  not run the full test suite by itself.

## Final Recommendation Stack

- Server service: `policyRuntimeCompletionAudit.mjs`
- Focused test: `policyRuntimeCompletionAudit.test.mjs`
- Contract version: `policy.runtime_completion_audit.v1`
- Required components:
  - runtime decision inventory,
  - runtime evidence projection,
  - automation decision contract,
  - runtime question reduction,
  - request-time learning,
  - library-derived policy rebuild,
  - migration verifier and rollback path,
  - runtime metrics and decision trace,
  - runtime and rebuild test reset.
- Required proof:
  - component records include doc, service, test, label, and evidence,
  - artifacts exist in the current checkout,
  - component audits pass,
  - every required runtime contract has focused reset-test ownership,
  - component handoffs match the expected `nextStep.stepId` sequence.

## Outcome

Runtime completion now has a deterministic completion gate:

```text
runtime component docs/services/tests
  -> component audit composition
  -> nextStep handoff verification
  -> native intent storage readiness
```

This audit is side-effect-free. It does not modify policies, run migrations,
delete tests, or rewrite workflow state.
