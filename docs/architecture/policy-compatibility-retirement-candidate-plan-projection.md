# Policy Compatibility Retirement Candidate Plan Projection

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.9

**Decision date:** 2026-08-01

## Decision

The retirement execution path now has a pure candidate-plan projection. It
accepts only a ready, read-only, source-backed retirement reconciliation and
derives the exact code, component, dedicated-test, and named shared-test-scope
targets already established by that reconciliation.

Each candidate retains its reconciled dependency IDs and the named native
workflow successor evidence associated with those dependencies. Shared-test
scopes are emitted as exact `remove_named_test_scope` plan inputs with source
and test-name fragments plus `wholeFileDeletion: false`.

The projection is not an execution plan. Its candidate plan input is explicitly
unapproved (`manifestApproved: false`, `approvedBy: null`), contains no
readiness or execution authority, does not persist a manifest, and has no file,
source, storage, or policy mutation capability.

## Official-Source Research

- NIST's Secure Software Development Framework calls for secure development
  practices throughout the lifecycle. Keeping reconciliation, candidate
  derivation, validation, approval, and execution as distinct components keeps
  each control observable and independently verifiable.
- OWASP recommends server-side syntactic and semantic validation, with
  allowlists rather than blocklists for structured values. This projection does
  not receive operator paths, target actions, fragments, or successor claims;
  it derives them from the validated reconciliation and only permits known
  target kinds and action identifiers.
- GitHub's provenance guidance makes clear that provenance establishes where
  and how an artifact was produced, rather than proving it safe. Native
  successor evidence therefore supports a future review gate but does not
  become deletion approval.

Sources:

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [GitHub Docs: Artifact Attestations](https://docs.github.com/en/enterprise-cloud%40latest/actions/concepts/security/artifact-attestations)

## Options Considered

### Manually Assemble Candidate Targets

Pros:

- requires no additional service.

Cons:

- duplicates an already source-backed dependency model,
- allows paths, scope fragments, and successor claims to drift before review,
- gives no deterministic way to prove that all reconciled dependencies remain
  represented.

### Generate An Approved Execution Plan Directly

Pros:

- minimizes the number of intermediate objects.

Cons:

- conflates provenance with approval,
- risks approving incomplete category, readiness, rollback, or support
  evidence,
- creates a path from reconciliation to deletion authority without a dedicated
  correlation gate.

### Derive A Read-Only Unapproved Candidate Plan

Pros:

- preserves exact source-backed target identity and native successor evidence,
- includes the current plan-compatible named-scope input without treating it
  as approval,
- rejects reconciliation drift, invalid successors, invalid scopes, and every
  requested side effect,
- leaves category correlation, readiness, rollback, support, approval, and
  execution to separate components.

Cons:

- adds one small versioned projection contract,
- requires a following adapter to correlate candidates with the existing
  deletion-gate categories.

## Final Recommendation Stack

1. Derive all candidate targets solely from a ready, validated, read-only
   reconciliation.
2. Carry every target's source-backed dependency IDs and exact native workflow
   successor evidence forward.
3. Model shared-test changes as exact named scopes that explicitly prohibit
   whole-file deletion.
4. Keep the candidate input explicitly unapproved and absent from the executor
   boundary.
5. Fail closed on missing or malformed successor evidence, unknown targets, or
   any requested mutation.
6. Add a subsequent validation-only category-correlation gate before a future
   plan artifact can be assembled or approved.

## Implementation Outcome

Implemented `policyCompatibilityRetirementCandidatePlanProjection.mjs` as a
small ESM service that:

- derives the ten exact retirement targets from the eleven reconciliation
  entries;
- produces four exact named-test-scope entries for the existing plan's scoped
  entry parameter;
- retains per-target native workflow successor evidence from the reconciliation
  handoffs;
- ignores caller-supplied targets, plans, and approval values because they are
  not part of the service contract;
- blocks missing reconciliation, malformed target identity, incomplete native
  successor evidence, invalid named scopes, and all side-effect requests; and
- validates that a returned projection remains read-only, unapproved, and
  unable to request execution, while independently revalidating its target
  structure and dependency coverage.

The policy-authoring completion audit now records this service, architecture
decision, and source-backed regression coverage as an active server contract.

## Security Outcome

- No caller can substitute a path, test scope, action, or successor claim into
  candidate construction.
- A retained shared native test file cannot be widened into a whole-file
  deletion while being projected.
- Native successor evidence is provenance only; it is not replacement evidence
  and cannot satisfy an approval gate by itself.
- The returned structure deliberately contains no deletion readiness, rollback
  stance, support stance, approval identity, persisted manifest, or execution
  request.
- The service performs no I/O or mutations, and explicit side-effect reports
  fail closed.

## Next Step

Proceed to **Phase 3R, Task 3R.10.10: Compatibility Retirement Candidate Plan
Assembly Gate**. Correlate each unapproved source-backed candidate target to
the existing deletion-gate category model, reject missing or ambiguous mappings,
and remain read-only. Do not approve, persist, or execute a manifest.

## Research Date

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.
