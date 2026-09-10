# Semantic Evaluation Results Summary — Design

## Decision

Add an ESM-only, offline-only semantic-evaluation results summary. It accepts
only an already validated, fingerprint-bound semantic snapshot evaluation and a
complete independently double-blind human reference set. It returns aggregate
coverage, semantic/reference disagreement, review-proposal precision and
recall, abstention coverage, reviewer disagreement, and fixed 95% Wilson
intervals by documented fixture tag (stratum).

It never invokes a model or RAG, reads a database, retains source material,
learns, changes policy, schedules work, recommends an operator action, or
routes media.

## Context

The current platform could safely create a private-capture readiness handoff
and separately validate a fixed snapshot evaluation. It could not yet answer
the practical question: *what did the independent review actually show, how
much data supports it, and how uncertain is the observation?*

The existing semantic proposal is categorical (`admit`, `review`, or
`abstain`), not a probability. Reporting probability calibration from it would
be scientifically misleading. The summary therefore reports calibration as
unavailable with the fixed reason `scoreless_categorical_signal`.

## Architecture

### Shared evaluation source

`policyCandidateSemanticEvaluationSource.mjs` centralizes the strict source
checks previously embedded in the counter-evidence readiness service:

1. fixture document validity and its pinned SHA-256 fingerprint;
2. fixed offline-evaluation report version and no-action authority;
3. complete validated snapshot binding; and
4. a bound reference-set artifact.

It converts matching fixtures into internal aggregate-ready rows containing
only a reference decision, categorical semantic decision, and documented tag
IDs. Fixture IDs, titles, raw labels, candidate data, retrieval text, snapshots,
embeddings, prompts, model output, and library context do not cross the
boundary.

The existing counter-evidence readiness service now consumes this same helper,
so both readiness and reporting enforce the identical source boundary.

### Aggregate results report

`policyCandidateSemanticEvaluationResultsSummary.mjs` accepts the shared
source and emits one of three closed states:

| State | Meaning | Report |
| --- | --- | --- |
| `evaluation_source_invalid` | Fixture, snapshot, reference artifact, or binding is invalid | `null` |
| `independent_reference_set_required` | Source is valid but independent human labels are absent | `null` |
| `summary_available` | Fixed source and independent labels are valid | Aggregate-only report |

The available report contains:

- aggregate semantic/reference agreement and disagreement;
- non-abstention coverage;
- review-proposal precision and recall with false-positive/negative counts;
- the same measures for every declared fixture tag;
- independent reviewer unanimous/adjudicated totals and disagreement rate; and
- Wilson 95% intervals for every defined binomial rate.

One fixture can belong to more than one tag. Per-stratum totals therefore are
descriptive views and need not sum to the overall fixture count.

### Uncertainty and calibration

The report uses the existing count-only Wilson helper. Wilson intervals make
sampling uncertainty visible for the fixed bounded cohort; they are not
significance tests, guarantees, or authorization thresholds.

Calibration remains explicitly unavailable because there is no predicted
probability to compare with outcomes. A future score-bearing output contract
would require a separate design, privacy, reproducibility, and governance
review before it could add reliability/calibration metrics.

### UI and accessibility boundary

This increment deliberately adds no results panel. There is no persisted
independently labelled local corpus for the browser to read, and presenting an
empty evaluation as a dashboard task would add noise. The existing Command
Center readiness status remains the single compact, automatically refreshed
entry point. When a controlled workflow can provide an aggregate result to the
UI, it must use a concise `role="status"` update and progressively disclose
these detailed metrics rather than announce a large changing table.

## Alternatives

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Aggregate-only result summary | Honest metrics, uncertainty, and no source exposure | Requires independent labels first | Selected |
| Per-fixture dashboard | More diagnosable | Exposes sensitive study/library context and creates dense UI | Rejected |
| Claim calibration from categorical decisions | Simple label | Scientifically false without probabilities | Rejected |
| Auto-tune or route from measured rates | Hands-off | Turns a bounded offline study into uncontrolled policy authority | Rejected |
| Persist raw reports for later browsing | Convenient | Adds retention and access-control obligations | Rejected |

## Security properties

- Invalid, malformed, unbound, or incomplete sources fail closed with no report.
- The summary does not return fixture fingerprints, fixture IDs, names, labels,
  snapshots, embeddings, retrieval text, model/provider details, or media/library
  data.
- Every authority field remains false for AI/RAG invocation, learning, policy
  changes, retries, and routing.
- Inputs are fixed, local, and in-memory. The service has no database, network,
  filesystem, or background-worker dependency.

## Research basis

Research was reviewed on 2026-09-10 against guidance applicable to the
requested August 2026 baseline.

- The [NIST AI RMF Measure function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, metrics, uncertainty, comparisons, and formal
  results reporting. The summary documents what is measured and deliberately
  marks calibration as not measurable.
- NIST’s [Experimental Statistics handbook](https://nvlpubs.nist.gov/nistpubs/Legacy/hb/nbshandbook91.pdf)
  describes confidence intervals for binomial proportions. Wilson intervals are
  used here only for aggregate rate uncertainty.
- [WCAG 2.2 SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires programmatically determinable status changes without stealing focus;
  [ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22) identifies
  `role="status"` as a sufficient technique. Detailed future results remain
  progressively disclosed to avoid repetitive announcements.

## Recommendation stack

1. Keep this aggregate-only report as the first semantic-quality measurement.
2. Require a controlled capture and independently adjudicated labels before
   allowing a report to exist.
3. Keep report findings advisory; treat uncertainty and coverage as context for
   human review, never routing authority.
4. Introduce score-bearing calibration only after a separate, governed output
   contract and reproducible held-out evaluation are available.
