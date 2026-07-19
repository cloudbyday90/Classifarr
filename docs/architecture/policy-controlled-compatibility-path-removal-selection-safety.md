# Policy Controlled Compatibility Path Removal Selection Safety

## Intent

Controlled compatibility removal review input is security-sensitive even though
the review builder does not delete files. The selected paths and their
replacement evidence become part of an artifact later consumed by an explicit
apply adapter. This boundary must therefore reject malformed evidence before a
path can become reviewable.

This design hardens Phase 8R.17 without expanding its scope. It validates a
fingerprint-bound manifest and selection, but does not read the checkout, run
commands, call Git, write artifacts, mutate storage, or remove a path.

## Official-Source Research

- OWASP's Input Validation Cheat Sheet recommends early server-side validation,
  canonicalization, and allowlists for untrusted values. It specifically notes
  that a client should not define the file path. The approved manifest is the
  server-owned allowlist here; the selection may only choose its exact,
  canonical repository-relative paths.
- OWASP CI/CD risk guidance identifies improper artifact-integrity validation
  as a delivery-chain risk and recommends validating artifacts at each point of
  consumption. The removal review verifies the manifest again even when its
  fingerprint is structurally valid.
- SLSA artifact verification guidance describes comparing artifact provenance
  to expected values before consumption. This boundary compares each selected
  path with the approved manifest and rejects ambiguous manifest entries rather
  than accepting a self-consistent but unsafe selection.
- NIST SSDF recommends integrating security practices throughout the delivery
  lifecycle. Keeping this verification side-effect-free isolates the review
  decision from the later destructive apply operation.

Sources:

- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- OWASP CICD-SEC-9 Improper Artifact Integrity Validation:
  <https://owasp.org/www-project-top-10-ci-cd-security-risks/CICD-SEC-09-Improper-Artifact-Integrity-Validation>
- SLSA Build: Verifying artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Options

### Normalize And Continue

Normalize duplicate, Windows-style, whitespace-padded, or traversal-like input
and continue with the resulting path.

Pros:

- tolerant for ad hoc callers,
- requires less caller cleanup.

Cons:

- hides the exact requested scope from review,
- can collapse duplicate paths silently,
- makes a destructive handoff depend on alias handling,
- conflicts with an exact manifest allowlist.

### Trust `ready` And Truthy Replacement Evidence

Allow an entry whenever it has `ready: true` and any truthy replacement-evidence
value.

Pros:

- minimal validation,
- compatible with loosely shaped historical evidence.

Cons:

- `{}` is truthy but does not explain a replacement,
- a crafted manifest can claim readiness without meaningful evidence,
- reviewers cannot distinguish an empty claim from a verified replacement.

### Strict Canonical Selection And Meaningful Evidence

Reject noncanonical, absolute, traversal, empty, and duplicate manifest or
selected paths. Require every selected entry to be manifest-ready and contain a
nonempty replacement-evidence value.

Pros:

- preserves an exact, reviewable source-of-truth scope,
- prevents path aliases and duplicate input from being silently accepted,
- prevents empty replacement-evidence objects from reaching apply,
- keeps the later adapter isolated from untrusted selection formatting.

Cons:

- callers must submit canonical `/`-separated repository-relative paths,
- legacy or manually assembled artifacts with ambiguous entries now block until
  corrected.

## Final Recommendation Stack

1. Treat the fingerprint-valid execution-plan manifest as the only selection
   allowlist.
2. Require every manifest and selected path to be an exact canonical,
   repository-relative path with no duplicate or traversal form.
3. Require selected entries to be ready and to carry meaningful replacement
   evidence, not merely a truthy object.
4. Keep the output side-effect-free and bind the resulting review artifact to
   the evaluated manifest, gate, batch, reviewer, and reason.
5. Retain the separate Phase 8R.18 apply confirmation and pre-apply file-state
   verification as the only destructive boundary.

## Implementation Outcome

Implemented:

- Added `policyControlledCompatibilityPathRemovalSelection.mjs`, an ESM
  selection-policy service that evaluates the manifest and caller selection
  without filesystem or command access.
- Rejected malformed, absolute, traversal, noncanonical, and duplicate
  manifest paths before they can define the approved path map.
- Rejected noncanonical and duplicate selected paths instead of normalizing
  aliases silently.
- Rejected selected entries whose replacement evidence is empty or contains no
  meaningful nested value, even when a malformed artifact claims `ready: true`.
- Updated the review contract to
  `policy.controlled_compatibility_path_removal.v3` and fingerprints the
  stricter policy fields through the existing review-artifact projection.
- Added focused regression coverage for duplicate and noncanonical selections,
  empty replacement evidence, and duplicate or traversal manifest entries.

The service remains unable to delete files, remove routes or tests, write a
manifest, mutate storage, or run Git commands.

## Next Boundary

The next Phase 8R component is **8R.18 Controlled Compatibility Path Removal
Apply**: validate the reviewed batch at apply time, require explicit execution
confirmation, and use the existing pre-apply path-state recheck before an
injected adapter receives an entry.
