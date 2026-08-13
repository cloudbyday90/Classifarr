# Candidate-Bound Verification Aggregate Outcome Metrics And Drift Guard

## Status

11R.4 is complete on 2026-08-12. It adds read-only aggregate monitoring for
candidate-bound verification outcomes. It does not grant AI, metrics, or the
browser route, retry, policy, learning, provider, notification, or domain-write
authority.

## Problem

11R.2 retained only a privacy-bounded verification status and 11R.3 made that
status explainable for one pending decision. Operators still had no safe way to
see whether abstentions, rejected strict responses, unavailable capabilities,
or candidate-bound preconditions were changing over time. Reading item history
directly would expose more classification data than an operational trend needs.

## Official Research Basis

This implementation was reviewed against official guidance available in August
2026:

- NIST's AI RMF Measure guidance calls for documented, fit-for-purpose metrics,
  acceptable performance limits, and regular assessment of deployed controls.
  [NIST AI RMF Measure Playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
- NIST identifies drift detection, monitoring cadence, and fragmented logging
  as material challenges for deployed AI-system monitoring. [NIST: Challenges
  to the Monitoring of Deployed AI Systems](https://www.nist.gov/news-events/news/2026/03/new-report-challenges-monitoring-deployed-ai-systems)
- OWASP recommends excluding or masking sensitive data from logs and applying
  consistent, purpose-limited logging. [OWASP Logging Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Decision

The aggregate read model derives its data from the status-only projection that
already exists in `classification_history`:

```json
{
  "version": "classification.candidate_bound_verification_metrics.v1",
  "current": {
    "totalOutcomes": 20,
    "statusCounts": [
      { "statusId": "confirmed", "label": "Confirmed", "count": 17, "ratePercent": 85 },
      { "statusId": "abstained", "label": "Abstained", "count": 3, "ratePercent": 15 }
    ]
  },
  "driftGuard": {
    "statusId": "elevated"
  }
}
```

The query selects only UTC day, allow-listed `status_id`, and a count for the
known v1 projection. It never selects or returns item identity, title,
destination, library, provider, model, prompt, response, reason, or candidate
identity. A partial `created_at` index scoped to that exact projection supports
the fixed 1-30 day query without creating another telemetry/event table or a
new data-retention path.

The drift guard compares a current completed UTC-day window with the preceding
adjacent completed UTC-day window. It requires at least 20 outcomes in both windows before it can report
an elevated signal. A monitored status is elevated only when it has at least
three current outcomes, represents at least 15% of current outcomes, and rises
by at least 10 percentage points. The monitored statuses are `abstained`,
`contract_violation`, `candidate_unavailable`, `candidate_mismatch`, and
`provider_capability_unavailable`.

The report is authenticated and read-only. It is advisory: it does not create
an alert command, mutate a policy, queue a retry, invoke a provider, or change
route eligibility. The Statistics view renders only server-authored status
labels, counts, rates, and the fixed drift message.

## Alternatives

### Write A New Per-Classification Metrics Event

Pros: allows immediate counter updates without querying history.

Cons: creates a new retention path, needs duplicate/transaction semantics, and
adds a monitoring write failure to an otherwise independent classification
operation.

Decision: rejected.

### Store Provider-Or Model-Dimensioned Verification Metrics

Pros: offers a more detailed capability breakdown.

Cons: couples the report to provider identity, encourages operator inference
from small samples, and duplicates the separate provider-capability telemetry
boundary.

Decision: rejected.

### Automatically Tighten Routing After A Drift Signal

Pros: can react without an operator.

Cons: makes a coarse aggregate observation a new authority source and risks
disrupting deterministic policy outcomes.

Decision: rejected.

## Final Recommendation Stack

1. Reuse only the pre-existing, status-only candidate-bound verification
   projection as the aggregate source.
2. Bound the query to adjacent 1-30 day UTC windows and support it with a
   projection-specific partial index.
3. Report all known status counts but monitor only safety-relevant status-rate
   changes after minimum sample thresholds are met.
4. Render fixed server-owned labels and advisory messages in the operator UI.
5. Keep metrics observational; use deterministic policy evidence and current
   provider configuration for any separate remediation decision.

## Implementation Evidence

- Aggregate window and status normalization:
  `server/src/services/classificationCandidateBoundVerificationMetrics.mjs`.
- Privacy-bounded aggregation query:
  `server/src/services/classificationCandidateBoundVerificationMetricsRepository.mjs`.
- Pure drift comparison:
  `server/src/services/classificationCandidateBoundVerificationDriftGuard.mjs`.
- Read-only route and client tab:
  `server/src/routes/statsRouteCandidateBoundVerification.mjs` and
  `client/src/views/statistics/CandidateBoundVerificationStats.vue`.
- Supporting index:
  `database/migrations/20260812_100000_add_candidate_bound_verification_metrics_index.sql`.
- Focused server and client tests prove status-only output, bounded windows,
  elevated and insufficient-data behavior, route bounds, and safe UI failure.

## Next Task

Proceed with **11R.5 Candidate-Bound Verification Remediation Readiness**:
define a separate, operator-authorized troubleshooting read model that can
correlate a flagged aggregate state with current provider admission and current
deterministic-policy readiness, without exposing historic provider output or
allowing aggregate metrics to alter routing.
