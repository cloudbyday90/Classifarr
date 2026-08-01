# Policy Compatibility Retirement Candidate Taxonomy Reconciliation

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.11

**Decision date:** 2026-08-01

## Decision

Compatibility retirement taxonomy is a separate, read-only contract derived
from the ready, source-backed candidate projection. It is not an expansion of
the older, broad compatibility deletion-gate categories.

The taxonomy has four action-owned categories covering the ten exact
candidates:

1. three retiring compatibility component files (`delete_file`),
2. the retained Policy Builder legacy branch (`replace_code_path`),
3. two dedicated compatibility test files (`remove_test`), and
4. four exact scopes in shared native test files (`remove_named_test_scope`).

Every taxonomy target retains its candidate identity: target kind, action,
canonical path, retiring component path, dependency IDs, source fragments, and
test-name fragments. Named scopes add `wholeFileDeletion: false`. The assembly
gate now binds a candidate against this complete identity, rather than using a
test-file path as a substitute for scope evidence.

The existing deletion-gate plan remains release-readiness context only. A ready
taxonomy or a ready assembly neither approves nor writes a manifest, modifies
source, changes storage, or executes deletion.

## Official-Source Research

- OWASP recommends treating workflow state as server-owned, validating every
  transition against current state, and re-deriving security-relevant values
  rather than trusting UI or request state. The taxonomy is built from the
  server candidate projection and is revalidated by the assembly gate.
- OWASP secure-code review guidance calls for server-side validation, workflow
  integrity, authorization at each step, and review of workflow-bypass paths.
  Taxonomy readiness is therefore not treated as deletion authority.
- NIST SSDF recommends incorporating secure development practices throughout
  the lifecycle. Small contracts with exact identities and adversarial tests
  make the later approval boundary reviewable and auditable.

Sources:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Add Candidate Paths To The Existing Broad Gate Categories

Pros:

- minimal surface change,
- preserves the old category list.

Cons:

- mixes current source-backed retirement candidates with broad historical
  compatibility inventory,
- makes an assembly category appear to be a release or execution decision,
- cannot safely represent four distinct scopes in two retained native test
  files.

### Categorize Shared Test Scopes By Test File Alone

Pros:

- fewer fields,
- matches the existing whole-file test category shape.

Cons:

- a shared test-file path does not identify which assertion can retire,
- permits an unsafe whole-file interpretation,
- loses the native-test ownership boundary.

### Use A Source-Backed Exact-Target Taxonomy

Pros:

- one category and centrally owned action for every candidate target,
- full identity matching prevents scope widening or path-only matches,
- preserves the independent release, approval, and execution gates,
- fails closed on altered category actions, duplicate targets, incomplete
  targets, or requested side effects.

Cons:

- introduces a dedicated taxonomy contract and assembly-gate v2,
- requires the candidate projection to retain complete identity data.

## Final Recommendation Stack

1. Derive taxonomy targets only from a ready, validated, read-only candidate
   projection.
2. Own category action and target kind centrally; do not infer either from a
   label, path suffix, or UI state.
3. Match all candidate identity fields at assembly time.
4. Require exact source and test-name fragments plus `wholeFileDeletion: false`
   for every named scope.
5. Keep broad release-readiness categories separate from this candidate
   taxonomy.
6. Leave manifest creation, approval, persistence, and execution to later,
   independently validated workflow boundaries.

## Implementation Outcome

Implemented modular ESM contracts:

- `policyCompatibilityRetirementCandidateTaxonomy.mjs` derives four immutable
  action-owned categories and all ten exact targets from the source-backed
  candidate projection.
- `policyCompatibilityDeletionCategoryAction.mjs` centrally owns the new
  taxonomy category actions alongside the older release-gate category actions.
- `policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs` is now v2. It
  requires the complete taxonomy target set to equal the current candidate
  target set before mapping any candidate.
- `policyCompatibilityRetirementExecutionManifestTargets.mjs` now imports the
  shared action vocabulary directly, preventing a circular dependency while
  preserving ESM module boundaries.
- Candidate projection validation now rejects a mismatched declared target
  count.

Focused tests prove that altered actions, duplicate identities, omitted target
keys, widened named scopes, invalid candidates, invalid gate models, and any
requested side effect fail closed. The resulting assembly is structurally ready
for all ten candidates, while the existing release gate remains `readyToDelete:
false` and grants no authority.

## Security Outcome

- A candidate cannot be mapped by path alone.
- A named scope cannot become a whole-file test removal.
- Candidate and taxonomy identity sets must match exactly before assembly.
- Taxonomy and assembly are read-only, unapproved, and unable to persist an
  execution manifest.
- Existing release readiness remains an independent guard, so a complete
  taxonomy cannot bypass operator approval or execution controls.

## Next Step

**Phase 3R, Task 3R.10.12: Compatibility Retirement Assembly Handoff Audit**
is complete. It proves exact candidate coverage through the existing release,
artifact, and execution boundaries without granting authority, and exposes the
execution gate's duplicate-path block for several named scopes in one retained
test file. See [Policy Compatibility Retirement Assembly Handoff
Audit](policy-compatibility-retirement-assembly-handoff-audit.md).

Proceed to **Phase 3R, Task 3R.10.13: Compatibility Retirement Execution-Plan
Candidate-Target Adapter**.

## Research Date

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.
