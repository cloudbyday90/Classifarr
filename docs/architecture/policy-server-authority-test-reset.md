# Policy Server Authority Test Reset

## Status

Implemented as Phase 5R Task 5R.9 on August 6, 2026.

## Decision

Phase 5R tests are inventoried, categorized, and audited by a side-effect-free
server-owned contract that proves every retained test protects a server trust
boundary rather than freezing old diagnostic behavior. The contract follows
the proven pattern of `policyRuntimeRebuildTestReset` (7R.9) and
`policyNativeStorageTestReset` (8R.9): it defines decision IDs, coverage IDs,
and contract IDs; inventories each Phase 5R test file; verifies that each
artifact exists, resolves inside the repository, and statically imports the
service contract it claims to protect; and fails closed when required coverage
or server-authority protection is missing.

The contract does not delete, rewrite, or mutate test files. It is a read-only
planning and regression gate.

## Test Categorization

Each Phase 5R test is assigned one decision:

| Decision | Purpose |
| --- | --- |
| `keep_server_contract_regression` | Protects a server-owned contract boundary as-is |
| `rewrite_question_answer_contract` | Rewritten around the 5R.5 question/answer contract |
| `rewrite_learning_guard` | Rewritten around the 5R.6 learning guard tiers |
| `rewrite_provider_authority_modes` | Rewritten around the 5R.3 AI provider authority |
| `rewrite_migration_verifier_role` | Rewritten around the 5R.8 verifier cutline |
| `delete_with_diagnostic_surfaces` | Marked for deletion when diagnostic surfaces are removed |

No current Phase 5R test is classified as `delete_with_diagnostic_surfaces`.
The retired impact/replay browser cards, composables, and utilities were
already deleted with their tests in earlier phases. The category is retained
structurally so a future diagnostic test cannot silently avoid a deletion
decision.

## Required Coverage

The contract enforces six required coverage areas from the roadmap:

| Coverage ID | What it protects |
| --- | --- |
| `client_drafts_cannot_bypass_server_validation` | Client-provided drafts, presets, or compatibility payloads cannot bypass server intent validation |
| `ai_output_cannot_become_question_text` | AI output cannot become final question text without deterministic normalization |
| `stale_questions_cannot_learn` | Stale or legacy questions cannot create durable learning |
| `answers_are_idempotent` | Runtime answers are idempotent and cannot authorize duplicate writes |
| `learning_side_effects_are_allow_listed` | Every learning side effect is explicitly allow-listed through the guard |
| `retained_preview_replay_side_effect_free` | Retained preview/replay verifier routes remain side-effect-free |

## Contract Ownership

Each test artifact maps to the server service contract it must statically
import. The contract verifies this by scanning the test file source for the
import marker of the declared service. This ensures a test cannot claim to
protect a contract it does not actually exercise.

| Contract ID | Service | Test domain |
| --- | --- | --- |
| `intent_contract_authority` | `policyIntentContract` | Server intent projection |
| `intent_write_admission` | `policyIntentWriteAdmission` | Native create preflight |
| `proposal_lifecycle` | `policyAuthoringProposalLifecycleService` | Proposal admission |
| `ai_provider_authority` | `aiProviderAuthority` | Provider capability modes |
| `runtime_question_normalizer` | `policyRuntimeQuestionNormalizer` | Clarification normalization |
| `question_answer_contract` | `policyRuntimeQuestionAnswerContract` | Shared UI/Discord answer |
| `learning_guard` | `policyLearningGuard` | Learning tier decisions |
| `learning_intake_contract` | `policyLearningIntakeContract` | Canonical intake envelope |
| `learning_writer_inventory` | `policyLearningWriterInventory` | Direct-writer cutover |
| `learning_boundary_regression` | `policyLearningBoundaryRegression` | Removed-writer regression |
| `pending_question_cleanup_plan` | `policyRuntimePendingQuestionCleanupPlan` | Stale question classification |
| `pending_question_cleanup_apply` | `policyRuntimePendingQuestionCleanupApplyService` | Transactional cleanup |
| `preview_replay_verifier_cutline` | `policyPreviewReplayVerifierCutline` | Verifier inventory |
| `verifier_deletion_gate` | `policyPreviewReplayVerifierDeletionGate` | Deletion gate evaluation |
| `generated_intent_outcome_resolution` | `policyMigrationGeneratedIntentOutcomeResolution` | Reducer resolution |
| `verification_boundary_audit` | `policyMigrationVerificationBoundaryAudit` | Boundary topology |

## Official Guidance Reviewed

- [NIST Secure Software Development Framework (SSDF)](https://csrc.nist.gov/projects/ssdf)
  (SP 800-218) requires testing practices that produce audit-ready evidence of
  active controls. The test reset contract produces a machine-checkable
  inventory of what each test protects and whether it exists.
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
  recommends building security test cases as part of the existing unit testing
  framework. The contract maps each required security behavior to a specific
  test file in the existing Jest suite.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization and automated tests of access-
  control logic. The contract enforces that server-authority tests exist and
  import their declared service boundary.

## Options Considered

### 1. Manual test audit without a contract

Pros:

- No new service or test file.

Cons:

- No regression protection: a future PR can remove a server-authority test
  without failing any gate.
- No machine-checkable evidence of what each test protects.
- Does not satisfy the roadmap's explicit task definition.

### 2. Reuse the existing `policyRuntimeRebuildTestReset` (7R.9)

Pros:

- No new contract service.

Cons:

- The 7R.9 reset evaluates runtime/rebuild contracts (evidence, automation,
  question reduction, rebuild), not Phase 5R server-authority contracts
  (intent authority, write admission, proposal lifecycle, AI provider modes,
  clarification normalization, question/answer, learning guard, stale cleanup,
  verifier cutline).
- The decision IDs, coverage IDs, and contract IDs are different.
- Conflating the two resets would blur the boundary between runtime/rebuild
  test ownership and Phase 5R server-authority test ownership.

### 3. Build a dedicated Phase 5R server-authority test reset contract

Pros:

- Evaluates exactly the six required coverage areas and the Phase 5R contract
  surface.
- Follows the proven 7R.9/8R.9 pattern with decision IDs, coverage IDs,
  contract IDs, file-existence checks, and import-marker verification.
- Produces audit-ready evidence of what each test protects.
- Fails closed when a server-authority test is missing, does not import its
  declared service, or freezes old diagnostic behavior.

Cons:

- Adds one more test-reset contract to the server.
- Requires maintaining the inventory as tests are added or reorganized.

## Final Recommendation Stack

1. Build a dedicated, side-effect-free test reset contract for Phase 5R.
2. Inventory every Phase 5R test file with its decision, coverage, and
   contract ownership.
3. Verify each artifact exists, resolves inside the repository, and statically
   imports its declared service.
4. Enforce all six required coverage areas; fail closed when any is missing.
5. Reject tests that freeze old diagnostic response shapes unless those shapes
   remain migration verifier contracts.
6. Reject any side effect (tests deleted, rewritten, or workflow modified).
7. Run the contract in regression coverage so a removed or weakened test
   fails the gate before release.

## Implementation Outcome

`server/src/services/policyServerAuthorityTestReset.mjs` owns the contract.
It defines six decision IDs, six coverage IDs, sixteen contract IDs, and
inventories thirty test artifacts across the Phase 5R domains.

Each artifact is verified for:
- repository-relative path resolution,
- file existence on disk,
- static import of its declared service contract,
- required coverage contribution,
- no frozen diagnostic behavior.

The audit fails closed for unknown decisions, missing artifacts, missing
coverage, missing contract markers, unscoped diagnostic tests, and any side
effect.

Focused regression tests cover the clean current-state audit, each missing
coverage case, a missing artifact path, a broken contract import marker, an
unknown decision, and side-effect rejection.

## Security Outcome

- Every Phase 5R server-authority boundary has a named test that statically
  imports the service it protects.
- Removing or weakening a server-authority test fails the gate before release.
- No test freezes old diagnostic response shapes unless the shape is a
  retained migration verifier contract.
- Phase 6R can consume server contracts knowing the test boundary is enforced.

## Next Task

The next task is **5R.10 Native Intent Change Admission**, which provides the
only persisted native maintenance command after runtime and learning authority
are bounded.
