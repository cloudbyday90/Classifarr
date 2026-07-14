# Policy Next Compatibility Removal Batch Authorization

## Intent

Policy next-batch authorization approves only the next narrow compatibility
removal batch after verified post-removal runtime evidence. It does not delete
files, archive code, mutate storage, write manifests, run tests, or run Git
commands.

The component consumes bounded evidence:

- a fingerprint-valid post-removal runtime evidence artifact,
- the approved compatibility deletion manifest,
- operator-selected remaining manifest paths,
- the authorizing operator and reason, and
- the applied removal-review fingerprint in the authorization context.

The output calculates remaining approved manifest paths, prevents already
removed paths from re-entering a removal batch, and emits a ready batch for the
existing controlled removal flow.

## Official-Source Research

- NIST SP 800-128 frames configuration management as controlled change with
  system integrity monitoring. Next-batch authorization keeps compatibility
  removal iterative: verify the previous change, calculate remaining inventory,
  then authorize the next small change.
- NIST SSDF recommends secure development practices throughout the SDLC. This
  contract makes the deletion pipeline evidence-driven and reviewable before
  any destructive operation can continue.
- OWASP Logging guidance calls for event records with enough context to support
  security and operational review. This contract records authorizer, reason,
  remaining inventory, selected paths, risks, and side-effect status.
- Git `mv` documents explicit file movement in the index and working tree. The
  module cutover uses explicit renames so production filenames and imports
  reflect the durable policy-domain contract.
- OWASP API9:2023 Improper Inventory Management highlights stale, deprecated,
  or undocumented surfaces as a security risk. This contract treats
  compatibility paths as inventory: already removed paths cannot be selected
  again, and unknown paths cannot enter the removal flow.

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

### Require Verified Artifact-Bound Post-Removal Evidence

Do not authorize another batch from a detached verification summary. Validate
the versioned runtime evidence artifact, re-run post-removal verification from
it, and require the authorization context to name the same applied removal
review fingerprint.

Pros:

- prevents compounding broken removals,
- detects altered or cross-batch evidence before it can be reused,
- keeps the batch loop gated by regenerated verification,
- makes incomplete validation visible before the next batch.

Cons:

- requires callers to retain the current runtime evidence artifact.

### Authorize From Remaining Manifest Inventory

Calculate remaining paths from the original approved manifest minus verified
applied paths. First require every applied artifact path to be present in that
manifest. Treat anything outside that remaining set as blocked.

Pros:

- blocks unknown deletion selectors,
- prevents already removed paths from re-entering a batch,
- keeps scope tied to the approved inventory.

Cons:

- requires the original execution manifest to remain available until removal is
  complete.

### Keep Batch Size Small

Authorize only a bounded number of remaining paths at a time.

Pros:

- limits blast radius,
- preserves review clarity,
- makes post-removal verification easier to interpret.

Cons:

- larger removals take multiple controlled removal loops.

### Require Operator Context

When remaining paths exist, require the authorizing operator and reason.

Pros:

- creates accountable removal evidence,
- helps explain why the next batch is safe,
- avoids silent continuation after verification.

Cons:

- adds a small amount of required metadata.

## Final Recommendation Stack

Use this stack for next-batch authorization:

1. Require an intact post-removal runtime evidence artifact and regenerate
   verification from it.
2. Require the authorization context fingerprint to equal the applied removal
   review fingerprint in that artifact.
3. Require a valid compatibility deletion execution plan with approved manifest
   entries.
4. Block runtime-artifact applied paths outside the supplied execution manifest,
   then compute remaining paths from `manifest.entries - appliedPaths`.
5. Block empty requested batches while remaining paths exist.
6. Block requested paths that are unknown, already removed, or outside the
   remaining manifest.
7. Block batches wider than the configured maximum batch size.
8. Require `authorizationReason` and `authorizedBy` while remaining paths exist.
9. Emit a side-effect-free authorization payload for the next controlled batch.

## Implementation Outcome

Implemented:

- Added `policyNextCompatibilityRemovalBatchAuthorization.mjs`.
- Upgraded the contract to
  `policy.next_compatibility_removal_batch_authorization.v2`.
- Replaced detached post-removal verification input with a fingerprint-valid
  runtime evidence artifact and review-fingerprint authorization context.
- Added status IDs for:
  - ready for next batch,
  - complete with no remaining paths,
  - blocked by runtime evidence integrity,
  - blocked by post-removal verification,
  - blocked by execution plan,
  - blocked by selection,
  - blocked by scope,
  - blocked by authorization.
- Added risk IDs for missing or altered artifacts, mismatched review context,
  applied paths outside the execution manifest, invalid execution plans,
  bounded selections, and authorization metadata.
- Added focused tests for artifact integrity, cross-context and cross-manifest
  rejection, regenerated verification, and bounded next-batch behavior.

Not implemented in this component:

- no file deletion,
- no archive creation,
- no manifest writes,
- no storage mutation,
- no Git command execution,
- no test execution.

## Next Step

Proceed with **Completion Checkpoint module naming cutover** after the
compatibility removal completion audit artifact reports no remaining approved
manifest paths. That task should consume semantic completion-audit evidence and
remove the remaining phase-coded checkpoint contract names from production
code.
The payload now emits `version =
policy.next_compatibility_removal_batch_authorization.v2` and
`nextStep.stepId = compatibility_removal_completion_audit`; production output
does not expose `nextPhase.phaseId`.
