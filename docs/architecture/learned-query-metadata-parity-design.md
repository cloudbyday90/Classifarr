# Learned query metadata parity: design

Date: 2026-09-22. Continues the
[worker-started recovery outcome](worker-started-recovery-trial-outcome.md)
and returns to the existing live content-review path.

## Root cause and bounded repair

Classification enrichment and existing-inventory classification both name the
age-rating field `certification`. Inventory training rows name it `content_rating`.
The live learned-profile adapter normalized genres but only read the inventory
rating name. Thus the same item could have a rating during evaluation/training
and lose it during live comparison. The older tests supplied the inventory shape,
so they did not detect the mismatch. `rating` is a numeric audience score in TMDB
classification metadata; it must never be substituted for an age certification.

Extract a small pure ESM metadata projection shared by the inventory collector and
the live-query adapter. Keep inventory training normalization unchanged. Adapt
`certification` and the legacy `content_rating` alias at the query boundary:

- A single bounded string, or two normalized equal strings, supplies the feature.
- Missing/null/blank aliases are absent, not contradictory evidence.
- Conflicting nonempty aliases or a malformed supplied alias yield no rating.
- Numeric audience scores, library names, memberships and instructions are not
  feature inputs. Genre/object handling and existing size limits remain bounded.

This repairs feature availability, not scoring weights or confidence calibration.
Ratings remain one existing contextual feature, not semantic proof of genre.
Description support, policy eligibility, identity, familiarity, evidence freshness,
provider authority and the administrator's confirmation gate remain mandatory.

## Architecture and recovery

Existing inventory reader → shared bounded projection → self-excluding learned
profiles → existing candidate comparison → unchanged live routing guards.

There is no new database column, model framework, endpoint, background job or UI.
The stored data already contains the feature; no external metadata backfill is
needed for this defect. The next evaluation automatically rebuilds its query
projection. Existing snapshot hashes include query features, preventing reuse of
old query evidence as current. Fitted training models remain reusable because
their training inputs have not changed. Do not rewrite historical decisions or
automatically resubmit reviewed items to make the results look better.

## Official research and tradeoffs

Sources below were discovered with search/GitHub MCP and read on 2026-09-22.

[Google's production ML monitoring guidance](https://developers.google.com/machine-learning/crash-course/production-ml-systems/monitoring)
distinguishes schema skew from feature skew and recommends consistent validation
and feature computation. It also recommends metrics by data slice. Our application
is the shared projection and separate movie/TV/library reporting, not a claim
that corrected input automatically improves accuracy.

[TensorFlow Data Validation](https://www.tensorflow.org/tfx/data_validation/get_started)
describes schema checks and training/serving comparisons. It is a useful pattern,
but adding a Python/TFX service to fix this small JavaScript contract mismatch
would create unnecessary operational cost.

[scikit-learn's leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
supports keeping evaluation data separate from fitting/tuning. The investigation
uses the existing deterministic cohort selector, excludes the prior two cohorts,
and retains query-identity/description exclusions. Live current-inventory replay
is not an independent accuracy benchmark; existing placement is not ground truth.

[OWASP's RAG guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
supports input validation and downstream policy enforcement. Preserve bounded
allowlisted features, private local inference, content-free reports and read-only
database access; do not log private media or bypass route authorization.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
supports quiet, programmatically identifiable updates without moving focus. No
frontend change is needed here; retain the existing SWR-backed status/disclosure
instead of adding more user acknowledgements or dense diagnostic panels.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Shared projection with explicit aliases | Repairs silent feature loss; parity is testable | Changes relative fit where ratings were missing | Implement with live review-only comparison |
| Lower review thresholds | More apparent automation | Conceals bad input; no accuracy evidence | Reject |
| New feature-store/TFX service | Broad validation infrastructure | Extra runtime and maintenance for a small defect | Not needed |
| Choose an alias despite conflict | More populated features | Invents authority from contradictory data | Reject; remain neutral |

## Acceptance and recommendation stack

First reproduce the canonical-field loss. Verify synthetic movie/TV feature and
score parity, conflict/malformed handling, cached fitting and SQL-backed retrieval.
Repeat the same disjoint live cohort in review-only mode; retain confirmation and
report actual first-stopping reasons, shortfalls and data drift. Do not select a
threshold or claim accuracy from placement agreement.

Final stack: existing PostgreSQL inventory and provenance → shared ESM feature
projection → self-excluding local retrieval and learned profiles → bounded local
proposal → existing live guards and durable recovery → held-out outcome measures.
Record actual execution and limitations separately in the outcome document.
