# Policy Compatibility Removal Completion Audit Artifact Exporter

## Intent

The compatibility removal completion audit artifact exporter generates a
machine-readable compatibility removal completion audit artifact from:

- a fingerprint-valid next-batch authorization artifact JSON,
- compatibility deletion execution-plan JSON with approved manifest entries,
- final import/reference scan evidence,
- focused and full validation evidence.

The exporter no longer accepts detached completion-authorization or
post-removal-verification summaries. Its input JSON must include the applied
removal-review fingerprint so the nested runtime evidence can be bound to the
completion context.

This component does not delete files, archive files, write manifests, mutate
storage, run tests, run source scans, or run Git commands. It produces an audit
artifact that either proves compatibility removal is complete, reports bounded
remaining inventory, or blocks completion with explicit risks.

## Official-Source Research

- NIST SP 800-128 frames configuration management as controlled change with
  integrity monitoring. The artifact verifies the final compatibility-removal
  state before cleanup exits compatibility mode.
- NIST SSDF recommends secure development practices across the SDLC. The
  artifact preserves evidence that legacy compatibility code was removed only
  after validation and scan evidence passed.
- OWASP Logging guidance recommends event records with enough context for
  review. The artifact records inventory counts, verification counts, final
  scan results, validation state, risks, and side-effect status.
- Git `mv` documents explicit tracked renames. The exporter cutover keeps the
  CLI, module names, and docs aligned with durable policy-domain behavior.
- OWASP API9:2023 Improper Inventory Management treats stale or unmanaged
  surfaces as a risk. The artifact treats compatibility paths as inventory that
  must be proven removed or explicitly reported as remaining.

Sources:

- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Consume One Authorization Artifact

The artifact exporter should consume a fingerprint-valid authorization artifact
instead of a detached authorization summary and a separately supplied runtime
verification list.

Pros:

- preserves the reviewed removal-loop evidence chain,
- distinguishes completion from remaining inventory,
- keeps the audit tied to the current execution manifest.

Cons:

- operators must retain the runtime evidence embedded in the authorization
  artifact.

### Require Removal, Scan, And Validation Evidence

Completion should require verified removal evidence, final scan evidence for
all approved paths, and focused/full validation evidence.

Pros:

- prevents false completion claims,
- catches lingering references after the last batch,
- keeps closure evidence release-ready.

Cons:

- the audit cannot complete until current validation output exists.

### Report Remaining Inventory Separately

Remaining approved paths should produce `remaining_inventory` rather than a
generic blocked state.

Pros:

- tells operators to continue the bounded removal loop,
- avoids treating expected incremental cleanup as corruption,
- makes final checkpoint inputs precise.

Cons:

- downstream consumers need to handle a non-complete but valid state.

## Final Recommendation Stack

Use this stack for compatibility removal completion audit artifact export:

1. Require a fingerprint-valid next-batch authorization artifact JSON.
2. Require compatibility deletion execution-plan JSON with approved manifest
   entries.
3. Require the input review fingerprint to match the nested applied review.
4. Replay authorization against the current manifest before deriving completion.
5. Require final import/reference scan evidence covering every manifest path.
6. Block completion if references remain.
7. Require focused and full validation evidence to pass.
8. Emit `complete`, `remaining_inventory`, or `blocked` artifact status.
9. Reject file deletion, archive, route/test removal, storage mutation,
   manifest writes, and Git side effects.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityRemovalCompletionAuditArtifact.mjs`.
- Added `generate-policy-compatibility-removal-completion-audit.mjs`.
- Added root npm script `policy:compatibility-removal-completion-audit`.
- Added focused tests for:
  - complete audit artifact generation,
  - remaining-inventory artifact generation,
  - altered authorization-artifact rejection,
  - blocked final reference scan evidence,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added the completion-audit artifact suite and this design doc to the fixed
  policy storage closure validation evidence command set.
- The artifact now emits `version =
  policy.compatibility_removal_completion_audit_artifact.v2` and
  `nextStep.stepId = policy_storage_completion_checkpoint`; production output
  does not expose `nextPhase.phaseId`.

Example:

```bash
npm run --silent policy:compatibility-removal-completion-audit -- \
  --next-batch-authorization-artifact .tmp/phase8r/next-batch-authorization-artifact.json \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --input .tmp/phase8r/completion-audit-input.json \
  --output .tmp/phase8r/completion-audit.json \
  --artifact-output .tmp/phase8r/completion-audit-artifact.json
```

## Next Step

Use the generated audit JSON as input for the policy storage completion
checkpoint artifact export. After that artifact is complete, proceed with
**Policy Storage Current Closure Audit module naming cutover**.
