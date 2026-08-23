# AI Classification Evaluation Trend Baseline

Status: Implemented on 2026-08-22. This document records the local,
human-reviewed comparison layer for versioned AI classification evaluation
sweep reports.

## Objective

Local sweeps establish whether a reviewed fixture passes at a point in time.
They do not, by themselves, make a policy/model/witness change comparable to a
previous run. The trend baseline converts two local report files into a small,
bounded comparison artifact that answers three distinct questions:

1. Did an exact matching cohort's aggregate pass rate decrease?
2. Did the observed evaluation outcome distribution change even when the pass
   rate stayed the same?
3. Has policy, runtime, witness, evaluation-source, model, fixture, or coverage
   context changed enough that a score must not be called a regression?

The answer is advisory. The component cannot call an API, start a model,
change settings, route media, alter policy, publish an image, approve a release,
or make a release decision.

## Official-Source Research

Research was performed on 2026-08-22 using current primary sources.

- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommends scoped, task-specific evaluations run early and often, with
  structured tests and human judgement alongside automated scores. Matching
  fingerprint cohorts provide the scope; the output preserves human review.
- [NIST AI Risk Management Framework 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  calls for repeatable testing, evaluation, verification and validation, plus
  documented outcomes and comparison against benchmarks. The comparator emits a
  versioned artifact bound to content fingerprints rather than an informal
  console comparison.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimization, protection of sensitive log data, and
  sanitization of untrusted event values. The comparator rejects malformed
  evaluated evidence and projects only an allowlisted, bounded subset of the
  source reports.

## Options Considered

### Diff complete raw sweep reports

Pros:

- simple to implement;
- can expose ad-hoc diagnostics.

Cons:

- retains request metadata, queue identifiers, and any legacy report fields;
- confuses changed policy/runtime context with model drift;
- makes report sharing and release documentation unsafe.

Decision: rejected. The comparison service never exports complete row objects.

### Treat every report pair as directly comparable

Pros:

- gives a single score for any two runs;
- accommodates quick manual testing.

Cons:

- a changed policy, model/runtime setting, fixture, source type, or queued
  witness changes the meaning of the result;
- can incorrectly label an expected contextual change as an AI regression;
- encourages unreviewed automated release gating.

Decision: rejected. Only exact cohorts are matched.

### Selected: bounded exact-cohort comparison with human review

Pros:

- aggregates repeated runs and preserves matching-cohort pass-rate deltas;
- detects changed outcome distributions that a headline pass rate can hide;
- marks context changes and one-sided coverage as incomparable rather than
  making a misleading quality claim;
- writes an ignored, local artifact with no raw provider output, prompt,
  policy content, token, webhook payload, request title, or history data;
- contains explicit negative authority for deployment, policy, release, and
  routing actions.

Cons:

- a new model or changed witness/policy must establish a reviewed baseline
  before it can have a meaningful trend;
- operators must inspect context changes and decide whether a new baseline is
  appropriate;
- this compares reviewed fixtures, not production-wide model quality.

Decision: selected.

## Design

```text
reviewed baseline report                 candidate local sweep report
          |                                          |
          v                                          v
  allowlisted evaluated rows                 allowlisted evaluated rows
          |                                          |
          +----- exact cohort identity -------------+
                       fixture + model + source
                       fixture + policy + runtime fingerprints
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
                matching cohort delta       changed/new/removed context
                         |                         |
                         +------------+------------+
                                      v
                       local trend JSON artifact
                       (required human review only)
```

`runtime` already binds the local model configuration and, for queued paths,
the versioned decision-witness fingerprint. The comparator also retains the
model identifier and evaluation source in the exact cohort identity to make
the review boundary visible. A policy or runtime/witness change cannot match a
baseline cohort; it produces `context_changed` records on both sides.

For exact cohorts, repeated fixture runs are aggregated into evaluated, passed,
and failed counts plus an outcome-fingerprint distribution. The service marks
these states for review:

- `pass_rate_regressed` or `pass_rate_improved`;
- `outcome_distribution_changed` with the same pass rate;
- `sample_size_changed`;
- `context_changed`, `candidate_only`, or `baseline_only`;
- any ungraded report row, which indicates coverage degradation.

Legacy rows explicitly marked `not_requested` are excluded from trend coverage.
They are not a reviewed fixture cohort and therefore do not create a false
coverage-degradation finding.

Only identical aggregates are `stable`. Even a stable result says
`no_delta_detected_human_release_decision_still_required`; it is not an
approval.

## Security Boundary

`scripts/lib/aiClassificationEvaluationTrendBaseline.mjs` is a pure ESM
service. It accepts a parsed report and exposes only:

- bounded fixture IDs and model identifiers;
- fixed evaluation-source values;
- SHA-256 fixture, policy, runtime, and outcome fingerprints;
- aggregate counts and pass rates;
- SHA-256 content fingerprints of the input files.

It rejects evaluated rows with unsupported source values, malformed IDs/model
identifiers, missing boolean results, or invalid SHA-256 fingerprint evidence.
This fail-closed validation ensures untrusted or partially corrupt evidence is
not silently described as a valid cohort.

`scripts/compare-ai-policy-sweep-trend.mjs` is a thin file adapter. It reads
only the two named local report files and writes a separate artifact with mode
`0600` under the direct `.tmp/reports/` directory. It rejects output paths
outside that directory, nested paths, duplicate CLI options, malformed JSON,
and pre-existing output files. The ignored `.tmp/` directory remains the
retention boundary; no database, server route, or CI credential is added.

## Operator Procedure

1. Keep a reviewed baseline report locally. Do not commit it or publish it in a
   release attachment.
2. Run a new local sweep using the intentional Docker/Ollama environment and
   the existing no-route guardrail.
3. Compare the reports:

   ```powershell
   node scripts/compare-ai-policy-sweep-trend.mjs `
     --baseline ".tmp/reports/ai-policy-sweep-reviewed-baseline.json" `
     --candidate ".tmp/reports/ai-policy-sweep-candidate.json"
   ```

   The package alias works in shells that forward script arguments normally.
   With Windows PowerShell and npm 12, use the direct ESM invocation because npm
   can intercept the comparator's long options.

4. Review every non-stable finding. When policy/runtime/witness context changed,
   inspect the intended change and establish a separately reviewed baseline;
   do not call it a model regression. When an exact cohort regressed, review
   the fixture outcomes and local environment before a release decision.
5. Clean up local artifacts under the established local report-retention
   process. Do not attach them to public release evidence.

## Implementation Outcome

- `scripts/lib/aiClassificationEvaluationTrendBaseline.mjs` owns validation,
  cohort indexing, aggregate comparison, and advisory-only artifact creation.
- `scripts/compare-ai-policy-sweep-trend.mjs` owns strict CLI parsing, input
  content fingerprints, direct `.tmp/reports/` output enforcement, and
  credential-free local file I/O.
- `server/src/__tests__/scripts/aiClassificationEvaluationTrendBaseline.test.mjs`
  covers stable cohorts, repeated-run regression aggregation, context changes,
  malformed evidence, coverage degradation, non-disclosure, and negative
  authority.
- `docs/local-ai-policy-sweep.md` and `.agent/workflows/release.md` describe
  the operator/release-review procedure without elevating it to an automated
  gate.

## Final Recommendation Stack

1. Run only reviewed, local versioned fixture cohorts with the existing
   no-route guardrail and retain baseline/candidate reports locally.
2. Compare only exact fixture/model/evaluation-source/policy/runtime cohorts;
   treat policy, runtime, witness, model, fixture, and source changes as new
   review contexts.
3. Require a human review for every non-stable delta, ungraded row, or
   one-sided cohort. Verify the underlying local execution before accepting a
   new baseline.
4. Keep artifacts access-controlled under ignored `.tmp/reports/` and retain
   only bounded identifiers, fingerprints, and aggregates in the comparator.
5. Keep release, deployment, policy, and routing authority outside the
   comparator. A stable report contributes evidence but never approves a tag.

## Next Recommended Item

The local [policy-pinned fixture profile](ai-classification-evaluation-policy-profile.md)
is now available for policy-owner-approved final destination and controlled
retry cases. The next item is a separately controlled retry/contamination
exercise that proves those negative safety paths without normalizing fallback
into a passing quality outcome.
