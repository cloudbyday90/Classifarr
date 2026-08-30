# Policy Candidate Correction Analytics Design

## Status

Implemented on the unreleased branch. This design adds read-only aggregate
monitoring; it does not create a release, change a policy, tune a threshold,
invoke AI, change RAG behavior, learn, retry work, or route media.

## Problem

The pending-review screen already explains a leading policy candidate with a
score and fixed evidence cards. When an operator confirms that candidate or
chooses another destination, the product needs to learn *where to review its
deterministic evidence*, without treating a correction as proof that one
source caused a mistake or granting that feedback automatic routing authority.

The design therefore records only the association between a compact snapshot
of the original leading candidate and a later server-validated operator
outcome. It answers questions such as: “Are close score margins changed more
often than decisive margins?” and “Which fixed evidence state deserves a
representative policy review?”

## Design

```text
policy-ranked candidates
  -> leading candidate + runner-up score
  -> fixed signal snapshot
       { margin band, five evidence source/state IDs }
  -> classification history metadata
  -> validated operator answer
  -> fixed outcome attribution
       { snapshot, selection status }
  -> parameterized aggregate query over completed UTC days
  -> authenticated Statistics / Correction Analytics view
```

The five retained evidence sources are item identity, declared policy,
observed library profile, similar-item retrieval/RAG, and confirmed outcomes.
Their states, score-margin bands, and selection statuses are fixed allow-lists.
The server independently validates the metadata again at each write boundary;
the client accepts only the versioned aggregate report and recomputes totals
before it renders it.

The resulting report has two views:

- original policy-score margin band versus later validated outcome;
- original evidence-source state versus later validated outcome.

“Changed destination” includes a change to another eligible candidate or an
operator-validated destination outside the original candidate set. It is an
association and review signal, not a correctness rate or a causal finding.

## Privacy and Security Boundary

This component never retains or returns media title, description, item,
library, candidate, destination, actor, policy term, raw score, provider,
model, prompt, response, RAG text, diagnostic object, or route control.

The aggregation query uses a static parameterized statement, bounded completed
UTC-day windows, and fixed dimensions. A partial timestamp index applies only
to history rows that contain the fixed attribution version. The Statistics
route remains behind the existing authenticated stats router and is read-only.

The browser gets no general metadata object. Its normalizer discards unknown
fields, rejects unknown versions and dimensions, validates that summary totals
match the fixed margin buckets, and uses text interpolation rather than HTML
injection.

## Research and Options

W3C’s [status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
and [ARIA22 technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)
support communicating asynchronous monitoring updates through a status region.
The client therefore announces loading, unavailable, and ready states with an
atomic `role="status"`, while error conditions use `role="alert"`.

NIST’s [AI RMF core guidance](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
calls for feedback mechanisms and measurement throughout the AI lifecycle. The
operator action is retained as a bounded measurement signal, while the policy
engine remains deterministic and the operator keeps decision authority.

OpenTelemetry’s [metrics SDK specification](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
emphasizes controlled metric aggregation. This feature uses low-cardinality,
allow-listed dimensions instead of titles, libraries, or free-form evidence.
OWASP’s [excessive-data-exposure testing guidance](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure/)
supports the explicit response projection and rejection of unknown fields.

| Option | Benefits | Costs and risk |
| --- | --- | --- |
| Store an item-level correction audit | Maximum drill-down | Retains sensitive catalog and routing identity; creates a much larger access-control and retention surface. |
| Let AI tune policies from corrections | Potentially fast adaptation | Unreliable authority shift, difficult to explain, and unsafe with small or biased samples. |
| Fixed aggregate-only analytics (selected) | Low-risk, explainable, measurable, and compatible with human review | Cannot identify an individual mistaken item and requires a representative cohort before action. |

## Recommendation Stack

1. Keep policy ranking and routing deterministic; retain AI and RAG as advisory
   evidence only.
2. Use this aggregate view to find a candidate review area, not to alter a
   rule or threshold.
3. Review a representative anonymized cohort outside the aggregate report,
   including declared-purpose scope, library contents, and RAG availability.
4. Only after sufficient observations, surface a read-only uncertainty-aware
   calibration recommendation. Do not auto-edit policies or weights.
