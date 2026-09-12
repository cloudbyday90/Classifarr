# Learned-evidence review resolution: design

## Purpose and finding

Classifarr should learn library contents and ask about exceptions, not require
users to describe every library. This component evaluates whether learned
metadata, description retrieval and an agreeing AI proposal can resolve a soft
evidence review. Library names and existing placement labels are not rules.

The preceding fresh-policy benchmark admitted 248 AI comparisons: all responses
were valid, but only two qualified for existing consensus. A September 12
read-only preflight on the same 300-item cohort found that only two comparisons
passed the existing absolute-similarity separation test. Removing the early
manual-review check alone would therefore not improve coverage.

## Alternatives and recommendation

| Approach | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Remove review gates or lower policy thresholds globally | Immediate automation | Confuses weak evidence with hard constraints; no measured error bound | Reject |
| Keep absolute cosine thresholds as the sole evidence gate | Preserves current selective behavior | Model-specific score scale; only two eligible comparisons here | Retain as baseline |
| Full-pool neighbor agreement plus learned metadata and AI agreement | Uses library contents without library-name rules or generated confidence | Can reproduce misplaced items and accept out-of-distribution queries | Implement paired evaluation before live promotion |
| Train/calibrate a decision model on independently checked outcomes | Can estimate selective error versus review reduction | Needs a separate calibration set and representation-aware lifecycle | Follow-up promotion requirement |

Recommended stack: grouped, identity-excluded library observations and cached
description vectors → policy-eligible full-pool evidence comparison → existing
bounded AI proposal → learned-evidence review assessment → measured promotion
decision → existing fresh server-side routing revalidation when promoted.

## Assessment contract

The new pure ESM resolver does not issue routing receipts or change scores,
policies, media placement, user prompts or learning records. Its result is an
evaluation hypothesis, not a calibrated probability or an authorization.

1. Admit only reviewable policy outcomes with known soft evidence reasons.
   Unknown/manual veto reasons, invalid identity, disabled RAG, ineligible
   destinations and incomplete policy diagnostics remain blockers.
2. Require an active same-media destination in the server-owned shortlist and
   a valid local proposal. The provider cannot expand the shortlist.
3. Validate the selected policy's hard constraints, including unknown values,
   native eligibility, explicit conflicts and profile exclusions. No policy
   threshold is rewritten or treated as an evidence probability.
4. Compare all policy-eligible libraries, not just the three shown to AI. Reuse
   the same frozen retrieval already used to build the shortlist. Require
   complete indexing, three distinct descriptions per library and sufficient
   learned-profile support. The existing profile count is at least 20 training
   descriptions across the same-media model, not 20 independent examples for
   each library; it is not per-library calibration. Reject duplicate/shared
   winner examples.
5. Require the proposed library's three neighbors to outrank every competing
   neighbor, without ties, and its positive contrastive metadata fit to exceed
   every competitor. Do not combine these correlated observations as independent
   votes. This rank-based rule is a testable project hypothesis, not a standard
   or a claim that arbitrary low-similarity matches are safe to route.
6. Compare old consensus and the new resolver on each identical AI response.
   Report added/lost eligibility, placement agreement/disagreement, review
   reasons, movie/TV and anonymous per-library totals. Incomplete runs must not
   look like validated promotion evidence.

## Security and operational boundaries

Reuse the read-only, deadline-bounded benchmark runtime and grouped folds. The
held-out item and synopsis copies stay out of training and retrieval. Raw
descriptions, metadata, identifiers and model output remain private in memory;
only aggregate counts leave the evaluator. No additional generation or provider
repair is introduced. The model has no database or routing tool capabilities.

Live automatic routing stays on existing consensus and its fresh, nonserializable
receipt. Promotion requires separate out-of-distribution/error calibration and
fresh configuration, policy, evidence, active-library and destination checks.
Observed placement agreement alone cannot establish safe automatic routing.

## Official research and August 2026 applicability

URLs were discovered with web search and opened on September 12, 2026. These are
official sources, not assumed links. The guidance below predates or is applicable
to the requested August 2026 baseline; mutable pages are not represented as
archived August snapshots.

- [scikit-learn 1.5 threshold tuning](https://scikit-learn.org/1.5/modules/classification_threshold.html)
  separates prediction scores from action selection and warns against tuning
  thresholds on training data. Application: keep policy scores unchanged and
  separate evaluation from promotion; reserve independent calibration data.
- [Microsoft vector relevance and ranking](https://learn.microsoft.com/en-us/azure/search/vector-search-ranking)
  (page dated January 21, 2026) describes same-model embedding spaces, exact
  nearest-neighbor comparison and score transformations. Application: reuse
  pinned vectors and compare ranks; do not assume a universal confidence meaning
  for similarity. This does not validate our proposed neighbor-unanimity rule.
- [scikit-learn 1.3 novelty and outlier detection](https://scikit-learn.org/1.3/modules/outlier_detection.html)
  distinguishes unusual incoming items from contaminated training data and
  cautions against testing novelty detection on its training samples.
  Application: agreement among nearby inventory items is not an
  out-of-distribution check; novelty calibration must exclude the query and
  tolerate existing misplaced items before any live promotion.
- [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  recommends separating untrusted data from instructions, validating outputs and
  limiting privileges. Application: retain strict proposal parsing and read-only
  evidence; do not let model agreement bypass server authorization.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  calls for accessible status changes without moving focus. No new UI panel,
  acknowledgement or polling loop is needed for this component. A future live
  outcome should reuse the existing concise status surface rather than exposing
  these evaluation internals to users.

## Verification and outcome

Test boundary failures, permutation/name invariance, shared examples, ties,
omitted candidates, metadata conflicts, invalid provider responses, privacy and
unchanged live routing. Run the existing 300-item grouped cohort with one
generation per admitted case; both decision paths consume the same response.
Record measured results and the promotion decision separately in
[the outcome document](learned-evidence-review-resolution-outcome.md).
