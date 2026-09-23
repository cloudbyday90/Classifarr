# Prospective evidence state: design

Date: 2026-09-23. Follows [company observation readiness](company-observation-readiness-outcome.md)
and the [prospective ranking design](prospective-inventory-ranking-design.md).

## Problem and scope

The approved local deployment is automatically backfilling movie and TV production
companies. The fixed-window prospective report has zero captures and zero exact-event
outcomes because no eligible classification has occurred since deployment. Its
existing `awaiting_eligible_outcomes` status is accurate but does not distinguish
missing live comparisons from comparisons that are waiting for later feedback or
ones whose labels were excluded. Those conditions need different follow-ups; none
justifies another benchmark, synthetic labels, or changing the routing score.

Add an **explanatory evidence state** to the existing read-only CLI report. Preserve
the current status, counts, query bounds, and `promotionAllowed: false` contract.
The state is computed from already-reduced aggregate counts in a small pure ESM
service. It contains no titles, item identifiers, provider text, or library names.
It makes no provider request and writes nothing.

| Phase | Trigger | Interpretation |
| --- | --- | --- |
| `awaiting_live_comparisons` | No frozen captures in the window | Wait for ordinary eligible classifications; company backfill alone cannot create these events. |
| `awaiting_operator_outcomes` | Captures exist, no eligible labels, at least one pending label | Later exact-event feedback is needed; do not use current placement as truth. |
| `no_eligible_outcomes` | Captures exist, but none has an admissible outcome and none is pending | Inspect the aggregate exclusion counters; do not silently score conflicts or out-of-scope destinations. |
| `diagnostic_only` | At least one admissible paired outcome | Report missing movie, TV, correction, or company-observed correction coverage; even an empty missing list is **not** promotion approval. |

The `missing` codes are descriptive, not arbitrary sample-size thresholds. A
company-observed correction means a correction to a frozen comparison in which
all compared libraries had usable company evidence. It does not establish causal
benefit or end-to-end classifier accuracy. Each future promotion proposal still
needs a disjoint later cohort, per-library regression/abstention review, and a
reversible rollout; this report cannot grant it.

## Options and recommendation stack

| Option | Advantage | Cost/risk | Decision |
| --- | --- | --- | --- |
| Add an aggregate state to the existing CLI | Clarifies the real automatic lifecycle without extra traffic or personal data | Still requires an operator to consult the report when making a promotion decision | Implement now |
| Add another Command Center card or live announcement | Continuously visible | Repeats existing dense evaluation UI and may interrupt users before data exists | Defer; use a concise existing status if a product need emerges |
| Infer labels from current destinations or force 100 more samples | Immediate numbers | Selection bias and possible temporal leakage; no independent outcome | Reject |
| Promote company weights based on backfill coverage alone | Immediate routing effect | Coverage measures feature availability, not accuracy or safety | Reject |

Recommended stack: existing bounded PostgreSQL exact-event read, frozen ESM
comparison receipt, pure aggregate evidence-state reducer, unchanged authenticated
operations and route guards. Let normal backfill and traffic supply observations.
Only compare paired outcomes from fixed capture windows; reserve a later disjoint
window before considering a reversible change. No new service dependency,
database migration, UI surface, acknowledgement, or release is warranted here.

## Official guidance checked September 2026

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented metrics, representative deployment-like evaluation,
  uncertainty and monitoring. An empty cohort cannot demonstrate performance.
- [NIST AI RMF Measure Playbook](https://airc.nist.gov/airmf-resources/playbook/measure/)
  warns that non-representative data can lead to inaccurate assessments and
  recommends comparing production feedback with internal measures.
- [scikit-learn common pitfalls](https://scikit-learn.org/1.8/common_pitfalls.html)
  describes temporal/data leakage when information unavailable at prediction
  time influences evaluation. Frozen pre-outcome captures remain the boundary.
- [W3C WCAG status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  explains how important dynamic status can be announced without taking focus.
  This change does not add a browser status message; a future UI should avoid
  repeated, noisy per-item announcements.

## External PR boundary

The GitHub open-PR endpoint returned no open PRs on this date, on two checks.
There is therefore no eligible random PR to select or apply locally. Previously
applied PRs are not substituted and no PR is merged.
