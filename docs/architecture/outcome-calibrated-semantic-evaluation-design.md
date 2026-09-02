# Outcome-Calibrated Semantic Evaluation Design

Status: Implemented (unreleased)

Date: 2026-09-02

## Decision

Classifarr now records one server-derived, content-free outcome-calibration
observation for each new persisted candidate adjudication whose semantic lookup
completed. The existing frozen-proposal workbench then compares later operator
alignment for two comparable groups within the newest unchanged AI/RAG cohort:

| Observation | Meaning | Included in comparison |
| --- | --- | --- |
| `outcome_calibrated` | At least one bounded, current-library semantic match received the existing authenticated-outcome boost. | Yes |
| `not_outcome_calibrated` | At least one bounded semantic match existed, but none received that boost. | Yes |
| `no_semantic_match` | The lookup completed but returned no current-library semantic match. | No |
| not recorded | A historic available lookup did not retain this new state. | No |

Unavailable semantic lookup remains represented only by the existing semantic
retrieval status. It does not enter any calibration group. This avoids treating
retrieval outages, empty retrieval, and uncalibrated semantic evidence as the
same condition.

The workbench stays aggregate-only and selects the latest opaque proposal
fingerprint cohort. Both comparable groups need 12 resolved AI proposals before
the report says they are ready for human evaluation. That is a conservative
Classifarr review floor, not statistical significance, a correctness score, or
permission to tune RAG, alter policy, or route media.

## Data and authority boundary

```text
bounded semantic retrieval result
  -> one server-owned calibration observation
  -> allow-listed candidate-adjudication metadata field
  -> fixed JSON-path, completed-day aggregate query
  -> newest opaque configuration cohort
  -> auto-refreshing nested Statistics disclosure
  -> human evaluation hypothesis only
```

The persisted observation is only one of three fixed identifiers. It contains
no title, description, stable media identifier, library identifier/name, prompt,
response, model/provider value, vector, similarity value, receipt ID, actor, or
outcome payload. The projection accepts it only when the separately persisted
semantic-retrieval status is `available`.

The browser cannot select a cohort, record an observation, request an item, or
change the query. The report continues to expose fixed aggregate counts only.
It cannot invoke AI, learn, change a policy, alter RAG settings, retry work, or
route media.

## Research basis

Research was refreshed on 2026-09-02 using official sources applicable to the
requested August 2026 baseline.

- NIST's AI RMF Measure function calls for documented, context-appropriate
  metrics, production monitoring, comparisons to benchmarks, and documentation
  of limitations. The per-configuration, two-arm outcome report is an
  observational measurement with an explicit sparse-data boundary, not a model
  promotion rule. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP identifies vector/RAG risks including data poisoning, leakage,
  cross-context conflict, and the need for trusted data, access controls, and
  immutable logging. Only an already authenticated outcome receipt can produce
  the boost, and only its derived fixed state crosses into telemetry. [OWASP
  LLM08:2025 Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- W3C requires important background updates to be programmatically
  determinable without taking focus. The existing five-minute, polite status
  announcement remains the only refresh feedback; the comparison is nested in
  the existing disclosure to avoid a busier primary screen. [W3C WCAG 2.2
  Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  and [ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) describe
  the relevant status pattern.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Treat every available semantic lookup as uncalibrated | Smallest change | Mixes no-match cases with comparable semantic evidence and confounds the result | Reject |
| Persist titles, retrieval packets, or receipt details | Richer case analysis | Adds retention, access, privacy, and prompt-injection surface | Reject |
| Use the outcome-calibrated flag to alter routing after a few aligned outcomes | Faster automation | Operator alignment is not ground truth and would create unsafe feedback authority | Reject |
| **Persist a three-state, server-owned observation and compare only matched arms** | Minimal retention, comparable arms, automatic collection, and explicit exclusions | Requires enough later resolved decisions; remains observational | Adopt |

## Accessibility and hands-off behavior

The new information is behind a nested native `details` element inside the
existing frozen-cohort disclosure. It adds no acknowledgement, test, refresh,
model-selection, or routing control. Data loads on entry and follows the
existing five-minute background refresh while the Statistics view is open. The
page-level `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`
region announces the concise evaluation state without moving focus.

## Final recommendation stack

1. Keep deterministic policy and routing authority unchanged.
2. Continue exact-item learning and the small receipt-gated semantic boost.
3. Use this automatic, aggregate two-arm observation to determine whether the
   boost merits a separately reviewed study.
4. Treat an apparent difference as a hypothesis only; investigate cohort size,
   selection bias, provider changes, and outcome mix before any adjustment.
5. Require a separate, independently labelled and retention-governed reference
   study before granting any semantic signal broader authority.
