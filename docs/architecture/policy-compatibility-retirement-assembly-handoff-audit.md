# Policy Compatibility Retirement Assembly Handoff Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.12

**Decision date:** 2026-08-01

## Decision

Candidate assembly enters the compatibility-retirement workflow only through a
read-only handoff audit. The audit inspects supplied results from four existing
boundaries, in order:

1. source-backed candidate assembly,
2. compatibility deletion release readiness,
3. a fingerprinted approved execution-plan artifact, and
4. the existing fresh-evidence and operator-approval execution gate.

It creates no manifest, artifact, approval, gate invocation, source change,
storage change, or deletion. A ready candidate assembly has no authority by
itself.

The audit requires every assembled target to be represented exactly once in the
approved artifact. The comparison includes taxonomy category, action, canonical
path, retiring component path, source fragments, and test-name fragments. A
named scope must retain `wholeFileDeletion: false`.

The audit identified two downstream mismatches and leaves both blocked. The
current execution-plan builder starts from broad release-gate categories, so it
cannot derive the exact candidate taxonomy into an approved artifact. A
schema-compliant artifact can retain all ten target identities when they are
supplied, but the existing preflight gate then treats four exact named scopes in
two retained test files as duplicate paths. Its `manifest_duplicate_path`
protection blocks the gate. Both blocks are safer than collapsing scopes or
accepting a broad legacy category, so this task does not work around either.

## Official-Source Research

- OWASP recommends server-side state machines for multi-step workflows and
  rejection of invalid transitions. The audit verifies each existing boundary
  in order rather than inferring permission from candidate readiness.
- OWASP transaction-authorization guidance requires server-side enforcement,
  final checks before execution, and authorization bound to exact transaction
  data. Exact candidate-to-artifact identity and artifact-to-gate fingerprint
  checks apply that principle to compatibility retirement.
- NIST SSDF recommends secure practices through development and delivery. A
  small deterministic audit with adversarial coverage makes the handoff and its
  fail-closed result reviewable.

Sources:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Treat Ready Candidate Assembly As Execution Approval

Pros:

- fewer records to inspect,
- shorter apparent workflow.

Cons:

- bypasses release readiness, artifact approval, fresh evidence, and operator
  approval,
- turns source discovery into execution authority,
- makes artifact substitution undetectable.

### Accept Broad Legacy Categories Or Path-Only Coverage

Pros:

- the existing artifact covers some matching paths,
- no additional identity comparison.

Cons:

- a broad category is not an exact candidate target,
- a path does not identify a named assertion in a retained shared test file,
- permits a whole-file or wrong-action substitution.

### Audit Exact Identity Through Existing Gates

Pros:

- preserves independently owned release, approval, and execution controls,
- rejects missing, duplicate, and substituted manifest entries,
- surfaces the preflight duplicate-path defect without weakening its protection,
- has no mutation or authority capability.

Cons:

- introduces a dedicated audit service and test fixture,
- exposes that exact candidate-to-artifact adaptation must precede the
  preflight observation identity extension.

## Final Recommendation Stack

1. Require a ready, validated, read-only candidate assembly before reading any
   downstream state.
2. Require existing release readiness; never convert assembly readiness into
   release approval.
3. Require a ready, fingerprint-valid, manifest-approved artifact and compare
   every target by full identity, not path or label.
4. Add a read-only candidate-target adapter to the existing execution-plan
   input before artifact construction or approval.
5. Require the existing execution gate to bind the same artifact fingerprint.
6. Preserve the duplicate-path block until preflight observations gain a stable
   named-scope identity.
7. Keep audit, artifact construction, approval, gate evaluation, and controlled
   removal as separate responsibilities.

## Implementation Outcome

Implemented modular ESM services:

- `policyCompatibilityRetirementAssemblyHandoffAudit.mjs` orchestrates the
  read-only boundary order and returns the public audit contract.
- `policyCompatibilityRetirementAssemblyHandoffAuditContracts.mjs` validates
  and summarizes the existing assembly, readiness, artifact, and gate records.
- `policyCompatibilityRetirementAssemblyHandoffAuditCoverage.mjs` matches
  exact candidate identity against approved artifact entries.
- `policyCompatibilityRetirementAssemblyHandoffAuditShared.mjs` owns audit
  statuses, risk IDs, normalization, and side-effect helpers.

Together they expose explicit statuses for assembly, release readiness, approved
artifact, exact artifact coverage, execution gate, and requested side effects.

The audit reports compact summaries for supplied contracts and only reads their
data. It does not call their builders, so it cannot accidentally create another
artifact or re-evaluate a gate while inspecting the handoff. It requires the
execution gate's embedded artifact fingerprint to equal the supplied approved
artifact fingerprint.

Focused source-backed tests prove that:

- a ready ten-target assembly still blocks without release readiness,
- a schema-compliant artifact can represent all ten targets exactly,
- the existing execution gate correctly blocks duplicate shared-test paths,
- broad legacy-category substitution is rejected before the execution gate,
- requested writes or gate invocations and tampered audit fields fail closed.

## Security Outcome

- Candidate discovery cannot become deletion authority.
- An approved artifact cannot silently substitute broad legacy categories for
  exact candidate categories.
- Named scopes retain source and test-name identity and cannot widen to a
  whole-file removal.
- The execution gate cannot be paired with a different artifact.
- The active duplicate-path block remains enforced until a scope-aware preflight
  observation identity is implemented.

## Next Step

Proceed to **Phase 3R, Task 3R.10.13: Compatibility Retirement Execution-Plan
Candidate-Target Adapter**. Add a read-only adapter that derives exact candidate
taxonomy targets as existing execution-plan inputs without creating, approving,
or executing an artifact. The following task must then extend preflight
observation identity so multiple exact named scopes in one retained test file
remain distinct while preserving duplicate exact-entry rejection, artifact
fingerprinting, freshness checks, approval, and the separate controlled-removal
boundary.

## Research Date

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.
