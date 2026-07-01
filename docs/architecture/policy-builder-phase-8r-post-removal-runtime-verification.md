# Policy Builder Phase 8R Post-Removal Runtime Verification

## Intent

Phase 8R.19 verifies that a Phase 8R.18 compatibility removal apply did not
leave broken runtime paths, lingering imports, or insufficient validation
evidence. It is a side-effect-free verifier: it does not run Git commands,
execute tests, mutate storage, or remove additional files.

The component consumes bounded evidence:

- Phase 8R.18 apply evidence,
- import/reference scan evidence,
- focused runtime/import check evidence,
- focused and full validation evidence.

Additional compatibility removal batches remain blocked until this verifier
passes.

## Official-Source Research

- Git `grep` documents searching tracked files, the index, or tree objects for
  patterns. Phase 8R.19 consumes import/reference scan evidence that can be
  produced by source-search tools such as `git grep` or `rg`, but it does not
  run those commands itself.
- NIST SP 800-128 frames configuration management as maintaining system
  integrity through controlled change and monitoring. Phase 8R.19 applies that
  by requiring post-change runtime and validation evidence before another
  removal batch can proceed.
- NIST SSDF recommends secure software development practices throughout the
  SDLC. Phase 8R.19 keeps deletion verification explicit and testable after
  code paths are removed.
- OWASP API9:2023 Improper Inventory Management highlights risk from stale or
  deprecated surfaces. Phase 8R.19 ensures removed compatibility paths are not
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

Use this stack for Phase 8R.19:

1. Consume Phase 8R.18 apply evidence and require `statusId=applied`.
2. Verify every applied path appears in completed import scan evidence.
3. Block if any removed path still has references.
4. Require focused runtime/import checks to pass.
5. Require focused and full validation evidence to pass.
6. Reject storage or Git-command side effects inside the verifier.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8PostRemovalRuntimeVerification.mjs`.
- Added status IDs for:
  - verified,
  - blocked by apply evidence,
  - blocked by import references,
  - blocked by runtime checks,
  - blocked by validation.
- Added risk IDs for incomplete apply evidence, failed apply validation, apply
  result count mismatch, missing import scans, removed paths still referenced,
  missing or failed runtime checks, missing or failed focused/full validation,
  unexpected side effects, stale risk counts, and unknown statuses.
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

Proceed with **Phase 8R.20 Next Compatibility Removal Batch Authorization**.
That task should consume a verified Phase 8R.19 result, calculate remaining
manifest paths, and authorize only the next narrow batch without re-opening
already removed compatibility paths.
