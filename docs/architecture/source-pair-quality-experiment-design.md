# Frozen movie/TV quality experiment: design

## Decision and existing gaps

September 25, 2026. Follow `f8d02ad0` with a cache-only, predeclared destination
quality experiment. The last commit improved capture scheduling, not correctness.
Keep its admission, checkpoint identity, allowances and routing boundaries intact.

Existing reviewer reference sets grade admit/review/abstain, not destination IDs.
Existing aggregate history intentionally discards destinations and cannot be
regraded against new labels. The diagnostic sampler also favors corrections.
Do not silently reinterpret those artifacts as independent destination accuracy.

## Design and security boundaries

1. Prepare a bounded private protocol before supplying reference labels. Freeze
   up to 300 movie/TV cases with existing seeded membership strata and known-
   identity grouping, but remove feedback only during sample selection. Retain
   actual feedback for the existing grouped training exclusions and separately
   graded, temporally screened correction slice. Music is unsupported.
2. Bind the protocol to source/policy/representation evidence, cohort, and retained
   model provenance. Use opaque item and destination hashes, not names or genres.
   An edited, expired or mismatched protocol fails closed. Hashes provide binding,
   not authentication, anonymization or proof of a reviewer's independence.
3. Accept only bounded protocol-bound destination references with declared human
   review provenance, consensus and reviewer counts. Keep synthetic references
   explicitly synthetic. Reject unsupported shapes/media/targets. Conflicting
   labels are ungradable, not silently overwritten. Missing labels stay missing.
4. Execute the existing production preparation and cached response reducer in a
   fixed, credential-free worker. Labels are supplied only to final grading, never
   to prompts, retrieval, profile fitting or admission. Include unchanged automatic
   pairs and unavailable cases in the denominator, not just disagreement cases.
5. Compare identical paired labeled cases in each arm. Report correct/wrong
   destinations, abstentions, gains/regressions, unpaired labels and per-media
   coverage. Report corrections separately. Wilson 95% intervals describe the
   labeled slice under binomial assumptions; they are not population guarantees,
   paired-difference confidence intervals or routing promotion thresholds.
6. Account for unique retained request usage without double-counting shared
   responses; distinguish historical usage from new calls (always zero). Missing
   caches cannot invoke a provider. Read one coherent database snapshot using
   existing read-only snapshot/admission controls; never call the state-pruning
   reader. No state, cursor, checkpoint, history or retention writes.
7. Reuse the existing bounded private `.tmp` JSON file boundary and exclusive
   output creation. Print aggregate receipts only; errors contain no private
   filenames, labels, source content or provider responses. No HTTP endpoint,
   migration, dashboard panel, dependency or release is needed.

Human independence is declared provenance, not something software can establish
from JSON. No independent reference set is supplied with this task. Test with
synthetic fixtures and report that limitation; never manufacture human labels or
claim a live quality gain from those fixtures. Cached responses are historical,
not live verification of the currently running model.

The current cache holds at most 50 responses, not all responses for a 300-case
cohort. Only unchanged evidence and model identity permit repeated grading under
one protocol; the report also records a separate cache revision. New retained
responses can change coverage without changing the protocol. Source/policy/model
drift requires a new protocol. Reports from different cache revisions must not be
summed: their cases can overlap, and aggregates lack deduplication identities.

## Alternatives, pros and cons

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Regrade aggregate history | Cheap, convenient | Original destinations intentionally absent | Reject |
| Use placement or AI agreement as truth | No human labeling | Circular and potentially misleading | Reject |
| Expand existing action-label semantics | Reuses format | Confuses review safety with destination correctness | Reject |
| Frozen cache-only destination experiment | Reproducible, no inference cost or routing authority | Needs genuine reference labels and exact retained evidence | Implement |
| New evaluation SaaS/queue/UI | More orchestration | Data export, dependencies and duplicate infrastructure | Defer |

Recommended stack: ESM protocol/reference contract → existing grouped production
replay → pure paired metrics → fixed isolated worker → read-only PostgreSQL
snapshot → private local artifact. Preserve existing pausable Vue SWR unchanged.

## Official sources discovered and read online

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/):
  document test sets, metrics, limits and uncertainty; use independent review.
  Published RMF 1.0 remains the cited guidance; its revision is in progress.
- [NIST proportion intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm):
  use bounded Wilson intervals rather than a normal interval that can leave the
  probability range. Preserve denominators and state the sampling assumptions.
- [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html):
  repeatable-read statements use one snapshot; read-only transactions reject
  ordinary persistent data writes. Retain existing snapshot transaction controls.
- [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  retain user control over automatically updating information. Do not add a new
  live panel, forced focus changes or accessibility certification claims.

## Acceptance and next decision

Exercise a 300-case synthetic cohort, production worker/reducer, known expected
quality counts, missing/conflicting labels, both media, automatic agreements,
shared-cache accounting, source/model/cohort drift, output privacy, cancellation,
read-only database use and exclusive private artifact writes. Test no-label runs
without treating them as success. Record verification and limitations separately.

Next component: a bounded, protocol-bound quality evidence collector. Retain
per-case paired outcomes across existing capture windows before the 50-response
cache rotates, deduplicate shared requests, and fence source/policy/model drift.
Include a private blinded review packet so genuine independent destination labels
can be collected without showing predictions or current placement. Keep labels
out of prediction and keep retention/call limits explicit. Reuse this evaluator's
contracts and metrics rather than another dashboard or self-judging model.

Until that collector exists, run against retained evidence and report incomplete
coverage honestly. Existing opted-in capture may fill current gaps, but capture
alone does not make a single retained window a complete 300-case AI study. Do not
raise budgets or invent labels. The eventual decision is measured quality versus
cost, not automatic routing promotion.
