# Fold-local inferred purpose evaluation

Date: 2026-10-09. Scope: automatic offline evaluation, not live classification.

## Finding and decision

Automatic replay strips profile-derived purpose rules to avoid testing an item
against a purpose learned from that same item. For inferred-only native policies,
this leaves no purpose and therefore no candidate adjudication. The existing
evidence adapter already builds profiles from identity-grouped training folds.

Rebuild recognized inferred-only purpose rules from those fold-local profiles,
using the existing production profile-to-intent builder. Never retain the stored
inferred values. Preserve declared constraints and review behavior; leave mixed,
unrecognized and invalid policies on the existing exclusion path. Do not add new
helpful hints or change the separate prospective held-out study.

This tests a retrained policy on unseen fold items, not the exact stored policy.
It is independent of the held-out item, not proof of independent ground truth.
Existing temporally screened correction labels remain observational. Inventory
placement, inferred purposes and additional AI calls never become quality labels.

## Contract and bounds

- Require valid native authority, a nonempty purpose consisting only of the
  recognized generated rule shape, and a same-media training profile with genres.
  Missing/empty profiles leave purpose absent; no catch-all purpose is invented.
  Profile-derived restrictions also block rebuilding; excluding one must not make
  a previously ineligible policy newly eligible.
- Build from the same training identities as profile scoring: exclude held-out
  identity aliases, copied descriptions, feedback groups and baseline source-only
  items. No query membership, label or stored inferred value enters generation.
- Cache projected policies only inside one replay arm, keyed by its fold-profile
  map (at most three folds per media type). No process singleton or durable cache.
- The existing builder requires a freshness timestamp. Use a fixed private epoch
  for both its synthetic fold profile and clock; this denotes deterministic
  computation, not the age of a deployed profile. Never export that timestamp.
- Keep 300 cases, 64 libraries, 25-pair windows, worker deadline/heap, memory
  admission, cooldown, ownership and capture quotas unchanged. No provider calls
  or database writes are added by policy preparation. Disabled AI capture stays
  disabled; missing responses remain missing.
- Bump computation provenance and policy report version. Retain legacy report
  readers, but new history revisions must not combine old and new experiments.
  Crashes/cancellation use existing worker termination and checkpoint rules;
  unknown failures publish no successful partial report. Fresh/empty installs
  continue to do no unnecessary work.
- Completion means the production evaluator can prepare an inferred-only policy
  using fold training alone. It does not guarantee AI availability, completed
  comparisons for every policy, improved accuracy or permission to route.

## Official research and tradeoffs

Sources discovered through web search and opened on 2026-10-09:

- [scikit-learn data leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html?highlight=kfold)
  requires learning transformations only from training data. Applying this to
  inferred purpose generation is a project-specific design decision.
- [Google dataset separation](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)
  explains duplicate exclusion and how repeated use can wear out an evaluation
  set. A rotating held-out cohort is not a blind final quality benchmark.
- [Google training-serving skew](https://developers.google.com/machine-learning/guides/rules-of-ml/)
  supports sharing transformation logic rather than inventing a second formula.
- [W3C data best practices](https://www.w3.org/TR/dwbp/)
  supports explicit provenance and versions. No public-data or accessibility
  compliance certification is claimed for this private computation.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep stripping all inferred purpose | Strong simple exclusion | Inferred-only policies remain untestable | Retain as fallback |
| Reuse stored inferred rules | Minimal code, more candidates | Held-out data may have shaped them | Reject |
| Rebuild from fold training | Reuses production logic without query leakage | Evaluates retraining, not exact stored rules; sparse folds can fail | Adopt |
| Require manual declared purpose everywhere | Explicit intent | Operator work and changed production semantics | Not this task |

Recommended stack: existing grouped folds → existing inventory observations →
small ESM fold-policy adapter → production evaluator → versioned aggregate report
and history. No schema or deployment-template change.

## Verification and follow-up

Test movie/TV, sparse folds, copied descriptions, source-only baseline exclusions,
feedback exclusions, invalid authority, mixed/unrecognized rules, preserved hard
limits, unchanged input objects, real worker privacy, cache invalidation and legacy
readers. Run existing integration and quality gates, then no-cache local image
rebuild and isolated schema dump. Never run the test against Unraid appdata.

Next: measure supported versus unsupported cases on the updated deployed image;
review an explicit AI-capture budget only after readiness is established. Obtain
independent reference labels before interpreting coverage as quality.
