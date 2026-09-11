# Retrieval Evaluation Recovery — Design

Status: implemented, unreleased. Reviewed 11 September 2026.

## Findings and scope

Review of `ab0f23a7` found two defects in the completion command: its path test
assumes Windows separators although CI runs Ubuntu, and a provider failure
after successful consensus prevents a retry because the reference-set file
already exists. String-only path comparisons also miss equivalent paths with
dot segments or different Windows separators.

The local Compose capture returned `not_ready`. A read-only readiness check
found no normal lifecycle receipt or complete policy-purpose evidence. The
eligibility audit found 6,649 items, 10 active policies, and zero qualifying
comparisons: all 10 policies contain only inferred profile-purpose evidence.
These are source prerequisites; command recovery cannot make them valid.

## Decision

Recompute and validate reviewer consensus on every invocation. Keep exclusive
creation for a new reference set. If the file already exists, read it through
the existing bounded private-file reader and compare its complete JSON value
with the newly computed reference set. Continue only when they are identical.
Conflicting, malformed, oversized, or unsafe existing files stop processing.

This permits a repeated completion command to reach the scorer after a provider
failure without deleting a valid reference set or trusting a cached decision.
The scorer still performs a new evaluation. This is not general checkpoint
resumption: if a scorer submission or later output already exists, use a new
results basename for a new attempt. Existing output files are never overwritten.

Normalize paths before comparing identities. Account for case-insensitive
Windows paths; use the native Node path API in tests so Ubuntu and Windows
exercise the same command contract. The private-file reader/writer continues
to enforce containment and filesystem checks.

## Alternatives and recommendation

| Option | Benefit | Cost | Recommendation |
| --- | --- | --- | --- |
| Delete prior outputs before retry | Simple | Loses evidence and creates manual cleanup work | Reject |
| Trust an existing reference set | Fast | Could use different labels or cohort | Reject |
| Recompute and compare the complete reference set | Recovers provider failures without overwrites | Small bounded read and comparison | Implement |
| Reuse model outputs as checkpoints | Avoids repeated inference | Requires a fuller source/model identity contract | Defer |

Use the current command, recover deterministic consensus safely, and resolve
the policy-purpose source problem before claiming a real retrieval evaluation.
After valid study sources and independent labels exist, measure the paired
representations before choosing changes to live retrieval.

## Official research

The requested baseline is August 2026. These official pages were retrieved on
11 September 2026; live pages do not establish their exact August contents.
The Node path/exclusive-create behavior, WCAG 2.2, and NIST AI RMF principles
used here predate that baseline.

- [Node path documentation](https://nodejs.org/api/path.html): native path
  behavior differs between Windows and POSIX. Tests must not hard-code the
  host's separators as a cross-platform expectation.
- [Node filesystem documentation](https://nodejs.org/api/fs.html): `wx` refuses
  existing files. Preserve this property and handle a known deterministic
  duplicate explicitly, rather than using an overwrite flag.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document measurement methods and limitations. Synthetic recovery tests do
  not constitute independent evidence of better media classification.
- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  preserve source provenance and validate inputs across processing stages.
- [WCAG 2.2](https://www.w3.org/TR/wcag/): status must be understandable and
  programmatically available. This CLI fix adds no browser controls; a future
  UI should report the actionable blocker once in the existing status area.

Neither WCAG nor the cited NIST guidance mandates Classifarr's particular
confirmation flag, two-reviewer count, or declaration prerequisite. Those are
current product choices and can be reassessed independently of this fix.
