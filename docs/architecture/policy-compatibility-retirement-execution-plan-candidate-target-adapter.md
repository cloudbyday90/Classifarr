# Policy Compatibility Retirement Execution-Plan Candidate-Target Adapter

## Intent

Bridge the ready, source-backed compatibility-retirement candidate taxonomy into
the existing deletion execution-plan input without turning discovery or mapping
into approval, artifact generation, execution-gate invocation, or removal
authority.

The adapter makes the current retirement work usable by the existing execution
pipeline while preserving the separation of duties:

1. candidate projection discovers exact targets from source-backed
   reconciliation;
2. candidate assembly assigns each target to one action-owned category;
3. this adapter derives unapproved execution-plan target entries;
4. existing release readiness, replacement evidence, rollback/support stances,
   approval, artifact fingerprinting, preflight, and execution gate remain
   separate controls;
5. controlled removal remains a later mutation boundary.

## Official-Source Research

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.

- The OWASP Business Logic Security Cheat Sheet recommends re-deriving
  security-relevant values on the server and enforcing multi-step workflows as
  explicit server-side state machines. The adapter therefore derives its target
  inputs from validated server contracts instead of accepting caller-declared
  paths, actions, or approval state.
- The OWASP Transaction Authorization Cheat Sheet recommends binding the exact
  transaction data to authorization and performing the final control at the
  execution boundary. The adapter preserves exact target identity for the
  existing artifact fingerprint and does not conflate its read-only result with
  approval or execution.
- NIST SSDF recommends integrating secure development practices through the
  lifecycle. Small deterministic contracts with adversarial tests make this
  handoff reviewable and regressible.

Sources:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Continue Building Plans From Broad Deletion-Gate Categories

Pros:

- no new input contract,
- retains the existing category-based code path.

Cons:

- cannot represent the ten exact candidate targets,
- silently substitutes broad paths for a mapped source target,
- cannot distinguish a named shared-test scope from a whole retained test
  file.

### Pass Caller-Supplied Target Entries Directly To The Plan

Pros:

- small apparent API change,
- easy to use in a test fixture.

Cons:

- permits path, action, dependency, or category substitution before approval,
- bypasses source-backed projection and exact assembly mapping,
- makes the execution-plan input a second, unverified source of truth.

### Derive Inputs Through A Read-Only Candidate-Target Adapter

Pros:

- preserves exact category, action, target kind, canonical path, component,
  dependency, source fragment, test fragment, and named-scope boundary,
- validates both projection and assembly before producing any plan input,
- remains compatible with legacy category-based plan input when the adapter is
  not supplied,
- keeps approval and removal authority outside the adapter.

Cons:

- adds a narrowly scoped contract and focused integration tests,
- requires fresh artifact generation because the strengthened fingerprint
  changes its bound projection.

## Final Recommendation Stack

1. Re-derive candidate targets from ready source-backed reconciliation.
2. Require the validated read-only assembly to map every target exactly once to
   an action-owned category.
3. Derive only unapproved `candidateTargetEntries`; reject caller-supplied
   approval, artifact, and execution fields.
4. Preserve target kind, dependency IDs, component path, source fragments,
   test-name fragments, and the explicit `wholeFileDeletion: false` boundary
   for named scopes.
5. Require existing release readiness, replacement evidence, rollback/support
   stances, and explicit approval before an artifact can become ready.
6. Bind the expanded entry identity in fingerprint v3 and require a fresh
   preflight observation before any controlled removal.
7. Keep the existing duplicate-path block until scope-aware preflight
   observation identity is implemented.

## Contract Design

`policyCompatibilityRetirementExecutionPlanCandidateTargetAdapter.mjs` accepts
only a ready candidate projection and ready candidate-plan assembly. It:

- validates both supplied contracts independently,
- re-matches every candidate target to exactly one mapped assembly record,
- rejects missing, duplicate, unresolved, category-less, and action-mismatched
  mappings,
- produces `executionPlanInput.candidateTargetEntries` with
  `manifestApproved: false` and `approvedBy: null`,
- permits only exact target-identity fields in those entries; replacement
  evidence remains separately supplied to the existing execution-plan boundary,
- records `readOnly: true`, `deletionAuthorized: false`, and false values for
  manifest writing, artifact writing, and execution-gate invocation,
- rejects reported source, storage, artifact, manifest, or execution side
  effects.

The existing execution-plan builder accepts the adapter as an optional input.
When present and valid, it uses only the adapter's exact target entries instead
of broad deletion-gate paths. Legacy category-based input remains unchanged when
no adapter is supplied.

Manifest normalization now preserves `targetKindId` and `dependencyIds` for
candidate-backed entries. File-level entries may retain source fragments as
identity metadata, but test-name fragments and whole-file-deletion flags remain
reserved for named test scopes. The artifact fingerprint v3 binds the added
target kind and dependency fields, and handoff coverage compares them as well.

## Implementation Outcome

Implemented modular ESM services:

- `policyCompatibilityRetirementExecutionPlanCandidateTargetAdapter.mjs`
  orchestrates the read-only adapter and public contract.
- `policyCompatibilityRetirementExecutionPlanCandidateTargetAdapterContracts.mjs`
  validates source contracts, correlates exact mappings, and derives target
  entries.
- `policyCompatibilityRetirementExecutionPlanCandidateTargetAdapterShared.mjs`
  owns versions, statuses, risk identifiers, normalization, and side-effect
  helpers.

The deletion-plan artifact builder now forwards an optional adapter to the plan
validation boundary. It does not build an adapter, create an artifact, approve
a plan, or invoke an execution gate itself.

Focused tests prove that:

- all ten current targets derive as unapproved exact plan input,
- the existing plan accepts the adapter only after independent release
  readiness, replacement evidence, stances, and approval are supplied,
- an invalid or tampered adapter blocks planning,
- source fragments can bind file-level target identity without becoming a named
  test scope,
- artifact fingerprints detect target-kind and dependency substitution.

## Security Outcome

- Broad legacy categories cannot silently replace exact candidate targets when
  the adapter is used.
- Candidate discovery and mapping remain incapable of deletion, approval,
  artifact creation, or gate invocation.
- Artifact fingerprints now bind the full candidate-to-manifest identity needed
  by the handoff audit.
- Existing approved artifacts must be regenerated with fingerprint v3 before a
  later destructive workflow can rely on them; this is intentional fail-closed
  freshness behavior.
- Several named scopes in one retained test file remain blocked by the existing
  path-only preflight observation model until the next task changes that model.

## Next Step

Proceed to **Phase 3R, Task 3R.10.14: Compatibility Deletion Execution-Gate
Named-Scope Observation Identity**. Give every preflight manifest observation a
stable exact-entry identity so distinct named scopes in one retained test file
can coexist, while duplicate exact entries still fail closed and existing
artifact fingerprint, freshness, approval, and controlled-removal boundaries
remain intact.
