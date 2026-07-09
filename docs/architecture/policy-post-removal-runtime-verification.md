# Policy Post-Removal Runtime Verification

## Intent

Post-removal runtime verification proves that a controlled-removal apply did
not leave broken runtime paths, lingering imports, or insufficient validation
evidence. It is side-effect-free: it does not run Git commands, execute tests,
mutate storage, or remove additional files.

The component consumes bounded evidence:

- controlled-removal apply evidence,
- import/reference scan evidence,
- focused runtime/import check evidence,
- focused and full validation evidence.

Additional compatibility removal batches remain blocked until this verifier
passes.

## Official-Source Research

- Git `grep` documents searching tracked files, the index, or tree objects for
  patterns. This verifier consumes import/reference scan evidence that can be
  produced by source-search tools such as `git grep` or `rg`, but it does not
  run those commands itself.
- NIST SP 800-128 frames configuration management as maintaining system
  integrity through controlled change and monitoring. This verifier applies
  that guidance by requiring post-change runtime and validation evidence before
  another removal batch can proceed.
- NIST SSDF recommends secure software development practices throughout the
  SDLC. This verifier keeps deletion verification explicit and testable after
  code paths are removed.
- OWASP API9:2023 Improper Inventory Management highlights risk from stale or
  deprecated surfaces. This verifier ensures removed compatibility paths are not
  still referenced after the inventory says they were removed.

Sources:

- Git `grep` documentation:
  <https://git-scm.com/docs/git-grep>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Verify Removal Evidence Before Continuing

Do not authorize a second removal batch immediately after apply. First verify
that the prior batch was applied, validated, and no removed path remains
referenced.

Pros:

- catches broken imports before the next batch,
- limits blast radius,
- keeps the compatibility inventory honest.

Cons:

- adds a required verification step between batches.

### Consume Evidence Instead Of Running Commands

The verifier should not run source searches, tests, Git commands, or runtime
checks directly. It should consume bounded evidence from those commands.

Pros:

- keeps the service deterministic,
- makes tests fast and isolated,
- avoids hidden side effects.

Cons:

- callers must supply current evidence.

### Require Both Focused And Full Validation

Focused checks prove the affected surface. Full validation proves broader
platform safety.

Pros:

- reduces false confidence from narrow checks,
- catches unintended regressions,
- supports incremental removal batches.

Cons:

- full validation is slower than focused checks alone.

## Final Recommendation Stack

Use this stack for post-removal runtime verification:

1. Consume controlled-removal apply evidence and require `statusId=applied`.
2. Verify every applied path appears in completed import scan evidence.
3. Block if any removed path still has references.
4. Require focused runtime/import checks to pass.
5. Require focused and full validation evidence to pass.
6. Reject storage or Git-command side effects inside the verifier.
7. Emit semantic `nextStep` evidence for next-batch authorization.

## Implementation Outcome

Implemented:

- Renamed the verifier to `policyPostRemovalRuntimeVerification.mjs`.
- Updated the contract version to `policy.post_removal_runtime_verification.v1`.
- Renamed exports to:
  - `POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_STATUS_IDS`,
  - `POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_RISK_IDS`,
  - `buildPolicyPostRemovalRuntimeVerification`,
  - `validatePolicyPostRemovalRuntimeVerification`.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Added focused tests for verified output, apply blocker, import/reference
  blocker, runtime blocker, validation blocker, side-effect blocker, and mutated
  output validation.

Not implemented in this component:

- no source-search execution,
- no test execution,
- no Git command execution,
- no storage mutation,
- no additional file removal.

## Next Step

Proceed with **Completion Checkpoint module naming cutover** after semantic
next-batch authorization and completion-audit evidence report no remaining
approved manifest paths.
