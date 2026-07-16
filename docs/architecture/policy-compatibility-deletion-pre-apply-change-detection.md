# Policy Compatibility Deletion Pre-Apply Change Detection

## Intent

Preflight attestation proves that a reviewed checkout and manifest were safe at
collection time. A controlled removal can happen later, so the apply boundary
must verify the live state again immediately before an adapter receives each
approved entry.

This component is deliberately narrow. It does not recollect evidence, write
an artifact, change Git state, or remove a file. It proves that the exact
approved path is still a regular non-symlink file, still a regular `HEAD` blob,
still unchanged from `HEAD`, and still belongs to the same approved checkout
revision. The adapter is not called when any check fails.

## Official-Source Research

- Git documents that `git diff --quiet` suppresses output and returns a
  nonzero status when differences exist. `--no-ext-diff` keeps the verifier
  from invoking an external diff helper.
- Git documents that `git ls-tree -z` provides machine-readable tree entries,
  including the object mode, type, object ID, and path. The verifier requires
  one exact `100644` or `100755` `blob` entry.
- Node.js documents `lstatSync()` as the correct metadata operation when the
  link itself must be inspected and exposes `isSymbolicLink()` and `isFile()`
  for fail-closed path-type checks.
- NIST SSDF recommends protecting software integrity and verifying that
  changes are authorized. The final verifier treats preflight evidence as an
  authorization input, never as permission to skip a current-state check.

Sources:

- Git diff options: <https://git-scm.com/docs/diff-options>
- Git ls-tree: <https://git-scm.com/docs/git-ls-tree>
- Node.js file system API: <https://nodejs.org/api/fs.html>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Options Considered

### Trust The Earlier Preflight Artifact

Pros:

- no additional work before apply.

Cons:

- an approved path can be replaced, deleted, or changed after collection,
- a new checkout revision can receive an approval intended for an older one,
- the adapter would be the first component to discover a dangerous change.

### Re-run The Broad Preflight Collector

Pros:

- reuses an existing collector.

Cons:

- turns a bounded collector into an apply-time orchestration dependency,
- repeats unrelated collection instead of checking the one entry about to be
  passed to the adapter,
- blurs read-only evidence collection with destructive execution.

### Recommended: Final Per-Entry Read-Only Recheck

Pros:

- checks the exact entry at the point where it becomes actionable,
- preserves the collector as a separate non-destructive evidence producer,
- prevents an adapter call for revision, path-type, symlink, tree, or content
  drift,
- records bounded verification status and risk IDs without raw command output.

Cons:

- a controlled apply requires a real Git checkout,
- a batch can stop after an earlier entry was already applied when a later
  entry changes; the result explicitly reports that partial outcome for the
  post-removal verifier.

## Final Recommendation Stack

1. Revalidate the fingerprinted review and execution gate.
2. Read the source revision and exact manifest observation from the embedded,
   revalidated preflight artifact.
3. Immediately before each adapter call, resolve the configured repository
   root and require it to equal Git's checkout root.
4. Require `HEAD` to equal the approved revision.
5. Require the live path to be a regular, non-symlink file whose real path has
   not changed or escaped the checkout.
6. Require `git ls-tree -z --full-tree HEAD -- <path>` to return one matching
   regular blob.
7. Require `git diff --quiet --no-ext-diff HEAD -- <path>` to return success.
8. Stop before the changed entry reaches the adapter; do not attempt later
   entries.
9. Keep Git commands read-only and fixed-argument, with shell execution and
   optional Git locks disabled.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionPreApplyChangeDetector.mjs` as the
  read-only, versioned final verifier.
- Rechecks the configured root against Git, compares `HEAD` to the approved
  preflight revision, validates approved manifest membership, rejects unsafe
  paths, and verifies live file, realpath, tree-entry, and content state.
- Uses only fixed `git rev-parse`, `git ls-tree`, and `git diff --quiet
  --no-ext-diff` argument forms with `shell: false`, disabled optional Git
  locks, and no external diff helper.
- Updated controlled apply to run the detector before every adapter call,
  report per-entry verification summaries, stop at the first blocked entry,
  and emit `blocked_by_pre_apply_recheck` rather than falsely claiming a full
  batch applied.
- Updated the public controlled-removal apply command to pass its checkout root
  to the verifier. Its isolated command tests now create and commit a real
  temporary Git repository before exercising the removal adapter.
- Added focused adversarial coverage for revision drift, changed files,
  symlinks, non-regular tree entries, malformed verification output, and a path
  beginning with `--` to prove the fixed Git argument separator is retained.

Boundary:

- JavaScript pathname APIs cannot make the interval between a read-only check
  and a later filesystem mutation mathematically race-free against a hostile
  local writer. This task minimizes that interval, rejects observed drift, and
  keeps adapter mutation separate. A future destructive adapter must retain its
  own immediate `lstat` containment check and run in an appropriately trusted
  checkout.

## Next Step

Proceed with **8R.16.5 Embedded-Runtime Evidence Escalation Rules**. Define
only the conditions where retained execution-plan runtime evidence is
insufficient and an embedded, provenance-bound read-only runtime probe is
required.
