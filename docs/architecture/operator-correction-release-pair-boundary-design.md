# Operator-correction release-pair boundary — design

## Purpose

The previous correction replay is read-only but compares only the current
policy leader with current AI proposals. The published `v0.48.4-beta` tag
predates that replay and has no compatible held-out correction runner.
Relabeling the current path as a release baseline would manufacture a gain.
This change establishes the two prerequisites that can be verified now:
temporal correction screening and a strict, private pair-comparison contract.
It does **not** execute the released classifier or claim a full-pipeline win.

## Design and safety boundary

1. In the existing repeatable-read, read-only correction snapshot, capture
   each eligible feedback observation time and the latest edit time of active
   policy, native intent, native rule, template application, and attached
   preset sources. Any mutable legacy/template attachment without complete
   edit provenance makes that media type's policy source unverifiable.
2. Select a corrected identity only when **every** observed label for that
   identity is later than all verifiable current policy sources for its media
   type. Missing time,
   missing or duplicate policy revision rows, and unverifiable attachments
   fail closed. This is a temporal screen, not proof that reviewers were blind
   or that no external process used the correction. Fold-local inventory and
   description holdouts remain in force.
3. The offline pair comparator reads two bounded, project-contained JSON
   artifacts (normally under ignored `.tmp/`). Each artifact has an exact
   allowlisted shape, 1–300 opaque 128-bit case tokens, typed movie/TV labels,
   a bound cohort fingerprint, a declared frozen-input fingerprint, and
   one of four dispositions: destination, abstained, safety-blocked, failed.
   The comparator requires the pinned release commit, the current checkout
   commit, identical case/label sets, and identical claimed frozen inputs.
   It prints only aggregate movie/TV counts; never item tokens or destinations.
4. The CLI verifies that the local release tag still resolves to its pinned
   commit and requires a clean tracked checkout before reading either artifact.
   It does not call providers, inspect
   live databases, or modify routing. Artifact content alone cannot prove
   either classifier executed or that its claimed input fingerprint was
   computed from a frozen source. The report therefore fixes
   `releaseCodeExecutionVerified`, `policyAndTrainingProvenanceVerified`, and
   `promotionAllowed` to `false`, with `fullPipelineAccuracy: null`.

Run the structure check only after independently producing private artifacts:

```text
node scripts/compare-operator-correction-release-pair.mjs \
  --baseline-file=.tmp/private-baseline.json \
  --candidate-file=.tmp/private-candidate.json
```

Do not commit either artifact. Tokens must be random, not raw media IDs or
unsalted hashes. The comparator validates their shape but cannot prove their
randomness or the artifact producer's isolation.

## Alternatives and tradeoffs

| Option | Advantage | Limitation / decision |
| --- | --- | --- |
| Compare current leader to current AI proposal | Immediate and cheap | Not a release comparison; retained only as an explicitly diagnostic report. |
| Call the published application's live classification API on corrections | Uses release code | Could write receipts, trigger learning/provider calls, and consume a changed database; reject. |
| Compare two arbitrary aggregate reports | No private case records | Cannot pair changed decisions or detect missing/mismatched labels; reject. |
| Temporal screen plus exact offline pair contract (selected) | Catches obvious post-label policy edits and mismatched case sets without routing authority | Time order is only a provenance proxy; artifacts do not attest execution. |
| Isolated published-release and current runners | Can produce a genuine paired result on one frozen input | Requires a disposable release-schema environment, non-writing adapters, and provenance attestation; next implementation gate. |

## Final recommendation stack

Pinned release identity → one frozen private input/cohort → correction and
policy-source provenance screen → description-group holdout → two isolated
read-only classifier runners → exact case-level pairing → aggregate error,
abstention and safety-block reporting → independent review. No report becomes
routing authority without separately validated, representative, blind labels.

## Official sources checked in September 2026

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, metrics, limitations, and benchmark
  comparisons under conditions similar to deployment.
- [scikit-learn grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)
  describes keeping related samples on one side of a split; the existing
  description-hash fold holdout follows that principle.
- [PostgreSQL 18 client transaction defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)
  documents read-only transactions; the snapshot additionally uses
  repeatable-read isolation.
- [GitHub `actions/checkout` README](https://github.com/actions/checkout/blob/main/README.md)
  documents full tag history via `fetch-depth: 0`; the comparator separately
  pins the exact release commit rather than trusting a tag name alone.
- [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/) is an accessibility
  evaluation method, not a classifier standard. Its explicit scope,
  representative sampling, evaluation, and reporting sequence informs the
  study protocol. No UI changed; any later Command Center status must also
  follow [WCAG 2.2 status-message guidance](https://www.w3.org/TR/wcag/).
