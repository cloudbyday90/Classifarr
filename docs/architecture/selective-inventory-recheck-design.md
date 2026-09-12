# Selective inventory conflict recheck

## Intent and previous work

The full-cohort comparison in commit `851d7ec7` retained all 300 cases instead of
selecting disagreements after seeing their outcomes. Named prompts agreed with
243 existing placements; anonymous prompts agreed with 233 (21 gains, 31 losses).
Removing names globally is therefore not justified by that experiment.

The next component is an automatic, content-triggered recheck, evaluated before
connecting it to live decisions. Existing live retrieval already supplies learned
metadata fit and descriptions; do not add another profile service or UI form.

## Predeclared decision rule

Version `inventory_evidence_conflict_v1` uses only a proposed candidate ID and
same-media, server-scoped inventory evidence. It never reads the item's observed
placement, library names, a correct-answer label, or a previous recheck answer.

- Require complete indexed evidence, three distinct descriptions per candidate,
  and at least 20 training descriptions, using the existing evidence validation.
- One alternative must lead every other candidate by at least 0.02 in mean
  top-three description similarity and 0.25 in learned metadata fit.
- Its mean similarity must be at least 0.65; each example must reach 0.60 and be
  exclusive to that candidate. Its learned fit must be positive, while the named
  proposal's fit must be negative.
- Request at most one anonymous comparison using exactly the same candidates,
  order, query and nine examples. Accept the experimental replacement only if
  that comparison proposes the detector's alternative. Otherwise retain baseline.
- Missing, malformed, neutral, tied or shared supporting evidence does not trigger.
  Failed, limited, cancelled or abstaining rechecks cannot replace baseline.

These are fixed experimental margins, not calibrated probabilities. Descriptions
and metadata are correlated inventory evidence, not independent votes. Do not
adjust thresholds in response to the fresh cohort and report it as a held-out test.

## Architecture and boundaries

Extract the existing description-evidence validation for reuse without changing
the stronger policy-scoring separation rule. Add a pure ESM conflict resolver.
Extend the existing local paired runner with a mutually exclusive selective mode;
keep legacy prompts, candidate selection and snapshot fingerprints unchanged.
Attach fold-fitted numeric evidence only when selective evaluation requests it.

Use the existing local model, read-only snapshot, grouped sampling, strict output
enum, cancellation and byte/context limits. No model downloads, remote fallback,
policy updates, routing, training labels, or raw media text in reports. Record
actual extra calls separately from the effective selected outcomes; failures remain
visible even when baseline is retained. Report gains and losses by media/library.

Fresh validation replays prior cohorts of 100, 200 and 300 descriptions as exclusions
from test selection. Prior items remain eligible for training; each new test fold's
description hashes are excluded before retrieval and profile fitting. Existing
placement remains a weak label, not verified accuracy.

## Official research and tradeoffs

Sources were discovered through search and opened on September 12, 2026. The
versioned scikit-learn reference predates August 2026; current W3C/OWASP guidance
is not claimed to be an archived August snapshot.

| Recommendation | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep names by default; selectively recheck content conflicts | Avoids universal double inference and measured global regression | Threshold sensitivity; may miss other error types |
| Fit and retrieve outside held-out description groups | Prevents synopsis copies leaking answers across folds | Smaller training pools; placement labels can still be wrong |
| Validate candidate IDs and outputs outside the model | Untrusted retrieved text cannot expand destinations or grant authority | A valid enum can still be semantically wrong |
| Add no UI acknowledgement or diagnostic panel | Preserves hands-off operation and reduces clutter | Detailed evidence stays in evaluation reports |

[scikit-learn GroupKFold](https://scikit-learn.org/1.4/modules/generated/sklearn.model_selection.GroupKFold.html)
documents non-overlapping train/test groups. This supports grouping synopsis copies,
not treating duplicated media records as independent tests.

The [original RRF paper](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf) describes
rank fusion and fixes its constant before subsequent validation. Existing Classifarr
rank fusion is reused here, not interpreted as probability. Our inference is that
its three-candidate cutoff needs separate recall evaluation: rechecking cannot
recover a candidate already removed by ranking.

[OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
supports treating retrieved text as untrusted and enforcing tool authorization
independently of model decisions. Recheck output is not routing permission.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
supports non-focus-stealing updates and warns about overly chatty interfaces. No
new UI is needed here; any later status should use the existing accessible surface.

## Recommendation stack and acceptance

Learned library profiles and description retrieval → named comparison → one
selective conflict recheck → unchanged policy/authorization gates. First measure
the frozen rule on fresh samples, including extra calls, gains and regressions.
Do not enable live replacement solely from agreement with existing placement or
from a few favorable cases. The outcome document records whether evidence supports
the next integration step.
