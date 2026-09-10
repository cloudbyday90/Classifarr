# Semantic Evaluation Results Summary — Outcome

## Implemented outcome

Classifarr now has a content-free, offline semantic-evaluation results summary
for a fixed snapshot and independently double-blind reviewed reference set.
It reports:

- aggregate and per-tag semantic/reference disagreement;
- precision, recall, false-positive/negative, and abstention coverage for the
  categorical semantic review proposal;
- reviewer unanimous/adjudicated totals and review disagreement; and
- fixed 95% Wilson uncertainty intervals for every defined rate.

The report is unavailable until independent labels exist and fails closed if
the fixture, snapshot, authority, binding, or reference-set artifact is not
valid. The public result has no source identifiers or library/AI/RAG contents.

## Important limitation

The current semantic output is categorical, not a probability. The new report
therefore says calibration is unavailable (`scoreless_categorical_signal`). It
does not relabel agreement, precision, or an opaque model confidence as
calibration.

## Refactoring outcome

The validation and redaction boundary moved into
`policyCandidateSemanticEvaluationSource.mjs`. The existing counter-evidence
readiness service now uses that module, preventing readiness and results
reporting from silently applying different fingerprint, authority, reference,
or row-binding checks.

## Verification

Tests prove that the report:

- returns correct aggregate and documented-stratum disagreement counts;
- includes 95% Wilson interval metadata;
- keeps calibration unavailable for a categorical signal;
- requires independently labelled reference decisions;
- fails closed on a fingerprint mismatch; and
- excludes fixture names, IDs, and fingerprints from serialized output.

Existing counter-evidence readiness tests also run against the shared source
module to preserve its previous routing and policy-inert behavior.

## Next high-value item

Implement the **controlled private reviewer-packet workflow** that consumes the
already surfaced `private_cohort_capture_ready` state and produces only a
short-lived, redacted packet for independently collected reviews. It should be
explicitly started by an authorized administrator, have a bounded expiry, keep
packet content outside normal application read APIs, and feed this results
summary only through the existing fingerprint-bound reference-set contract.
