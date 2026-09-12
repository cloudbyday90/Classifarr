# Learned inventory scoring design

## Problem and selected change

The preceding routing component can resolve threshold-qualified ambiguity, but
cannot help a candidate whose score is discounted as weak evidence. Native
purpose specialization currently labels broad matches weak even when current
descriptions and organically learned metadata distinguish the destination.
For example, a raw policy score of 75 becomes 45 under the 0.60 discount.

Make that discount evidence-aware. Compare current descriptions across the full
policy-eligible, same-media library pool before ranking. When one library has
complete, distinct, unshared description support and stronger learned fit than
every alternative, retain its original policy score and remove only the
weak-evidence suppression. Do not add cosine similarity or learned fit to the
score, manufacture a probability, or change administrator thresholds.

Use the existing bounded separation criteria shared with consensus routing:
three neighbors per candidate, at least 20 training descriptions, a positive
winning learned fit, each winning similarity at least 0.75, mean at least 0.80,
and mean margin at least 0.05 over every alternative. These are conservative
engineering heuristics, not measured accuracy guarantees or universal embedding
thresholds. Benchmark their reach without tuning them to the evaluation set.

## Architecture and boundaries

- Share one pure description-separation assessor between scoring and consensus.
- Reuse the read-only live description retriever with a separate internal
  all-candidate limit of 64. Keep its ordinary AI contract limit at three.
- Score after hard eligibility filtering and native specialization, before
  existing calibration/ranking. Refresh uses the same production scoring path.
- Respect RAG enablement and each policy's RAG trust/weight. A malformed,
  incomplete, unavailable or oversized comparison preserves the old result.
- Preserve hard exclusions, native ineligibility and other suppression reasons.
  Only known weak-evidence reasons may be removed. Strong existing candidates
  are not rewritten. No library names or hand-maintained genre rules are added.
- Treat descriptions and learned metadata as one correlated inventory signal,
  not two independent votes. Exclude the query identity and synopsis copies;
  use current memberships, cache hashes, model identity and read snapshots.
- A score newly reaching the automatic band requests candidate comparison,
  not a direct policy auto-route. The existing consensus receipt, local provider
  agreement, post-generation rereads and expiry checks remain required.
- Retain only bounded numeric diagnostics, never descriptions or learned terms.
  No new endpoint, schema, acknowledgement, control panel or release is needed.

## Official research and applicability

Sources were discovered with web search and opened on September 12, 2026.
This uses guidance relevant to the requested August 2026 baseline; mutable live
pages are not represented as independently verified August archive snapshots.

Scikit-learn explains that calibrated probabilities require an independent
calibration set and measured correspondence between predictions and outcomes.
Our library placements are observations, not independent correctness labels.
Retaining an existing policy utility score avoids misrepresenting cosine or fit
as a probability. [Probability calibration, scikit-learn 1.8](https://scikit-learn.org/1.8/modules/calibration.html).

OWASP describes document poisoning, integrity checking, retrieval scoping,
output validation and fail-closed behavior. Reuse current, scoped, bounded
retrieval and the server-owned routing boundary; retrieved text remains data,
not executable instructions or permission to route. [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html).

W3C requires displayed status changes to be programmatically available and
warns about excessively chatty announcements. Keep the existing compact review
and expandable score explanation; do not add another live panel or demand
manual declarations. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep the fixed weak-evidence discount | No behavior change | Ignores newly available evidence and preserves unnecessary reviews |
| Add similarity and model confidence to the score | Easy numerical increase | Double-counts correlated observations; not calibrated |
| Evidence-aware discount, selected | Uses actual library contents without new user setup | Conservative reach; full candidate retrieval adds bounded work |
| Train a calibrated routing classifier | Can eventually measure reliability | Needs trustworthy outcomes and leakage-resistant validation first |

Final stack: current metadata and inventory, shared contrastive description
assessment, evidence-aware policy calibration, then existing local consensus
authorization. Keep independent outcome calibration as a follow-up rather than
making the user configure library-purpose declarations.

## Validation plan

Test malformed/partial evidence, shared and duplicate descriptions, ties,
library renaming, exclusion preservation, RAG opt-out, score non-inflation and
automatic-band handoff. At the user's request, replay 200 additional held-out
synopsis groups across all movie and TV libraries, excluding the earlier 100
from both selection and training. Compare the same
baseline and changed scoring path. Report score/action changes and observed
placement agreement separately from accuracy. Exercise real PostgreSQL and
local Compose without routing media. Record results in a separate outcome
document, including failures and unavailable PR work.
