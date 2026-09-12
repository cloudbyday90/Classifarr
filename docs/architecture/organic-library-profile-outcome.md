# Organic library profile learning outcome

## Implemented component

Added local, library-agnostic profile training from current inventory. This
replaces the unfinished declared-intent-first proposal: operators do not need
to define every library before Classifarr can learn its observed character.
No declared-purpose code or policy mutation is included in this commit.

The learner discovers contrasting genre, studio and audience-rating patterns
across active same-media libraries. It weights shared membership fractionally,
excludes held-out copies, treats missing/unseen features neutrally, and relearns
from each snapshot. All library names can change without changing learned ranks.
The downstream AI prompt still includes names; the invariance claim does not
extend to that language-model response.

```powershell
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 100 --generate-cases 100 --learned-profiles --max-minutes 20
```

Omit `--learned-profiles` for description-only comparison. It cannot be combined
with the prior `--metadata-candidates` mode; the two metadata methods are separate
experiments. Rank fusion is now shared by both to avoid divergent implementations.

This trains the statistical retrieval/profile layer, not LLM weights. No manual
labels, acknowledgements, new UI settings, external provider, migration, or model
download is required. It does not yet schedule production profile refresh,
rewrite metadata, or replace live policy routing.

## Evaluation protocol

Two seeded 100-title cohorts were used. The earlier regression cohort uses
`classifarr-budget-20260911`; the second uses `classifarr-profile-20260912`.
They overlap by 10 description groups, so the second supplies 90 additional
titles, not an entirely independent reference set. For each run its entire
100-title cohort and copies were excluded before fitting profiles or retrieving
examples. No per-title tuning was performed after observing the results.

The regression cohort's profiles learned from 6,543 usable distinct training descriptions
across 10 libraries in the inspected snapshot. All this content participates in
learning regardless of the 9/30/100 examples passed to the AI comparison.

## Local results

| Cohort / mode | Shortlist misses | Agreement at 9 examples | At 30 | At 100 |
| --- | --- | --- | --- | --- |
| Regression, description baseline | 3 | 78/100 | 78/100 | 77/100 |
| Regression, learned profiles | 1 | 83/100 | 84/100 | 79/100 |
| Second seed, description baseline | 3 | 76/100 | 79/100 | 75/100 |
| Second seed, learned profiles | 0 | 79/100 | 78/100 | 80/100 |

The three new runs completed 900 valid model proposals without abstentions,
malformed outputs, context rejections, or provider failures. The earlier
regression baseline is retained from the prior benchmark, not rerun here.

Regression profiles changed 59 shortlist sets, recovered all three original
omissions, and introduced one new omission. The second seed changed 64 shortlist
sets, recovered all three omissions, and introduced none. Its profiles used
6,542 descriptions, two shared groups, and excluded two groups with missing or
conflicting metadata. Both runs trained all 10 libraries with usable query
metadata. Inventory agreement is observational, not accuracy.

Results are not uniformly better: the second cohort's 30-example agreement fell
by one. Larger prompts were not consistently better either. Do not tune example
budgets or confidence thresholds to these two runs alone. No model parameters
were changed in response to individual outcomes.

### Reproducibility

- Regression sample:
  `1a8055ceab40e37f170c901c16d36729913be94bcaa74f31620e099e2d8a44d4`.
- Regression learned snapshot:
  `77d5ee4c86cce568327ee2803c0379bfe439a467b146bc21846aeef907f9c591`.
- Second sample:
  `8917b00674e5ec5116e628c42c3a02191c22aad983b0611c0ba516849f9d89d9`.
- Second description-only snapshot:
  `fb53a0e341ac6cd630c23b93b3370e09d51f23b01f60eb24d2f0773eeff21d11`.
- Second learned snapshot:
  `9a2ef8d7b4aab2bf2f0942c4ecb92c16fcdb14238bee6bf79d09d79971718040`.

Description-only fingerprints omit metadata because that mode does not use it.
Learned fingerprints include it. Each run freezes its own snapshot; differing
learned fingerprints mean the input snapshots should not be treated as identical.

Final rebuilt-Compose preflight reproduced the second cohort's training and
shortlist counts, but its snapshot fingerprint was
`77d5ee4c86cce568327ee2803c0379bfe439a467b146bc21846aeef907f9c591`.
Do not claim bit-for-bit replay of the earlier input snapshot from those equal
counts. A live consumer needs version-bound refresh and invalidation.

## Validation

- Full backend coverage run: 1,223 suites and 34,629 tests passed.
- Final focused tests after feature-budget refinements: 55 tests passed.
- Relevant real-database integration: 3 suites and 10 tests passed.
- Backend lint/typecheck, ESM import/mock-shape checks and Markdown lint passed.
- Coverage ratchet passed using fresh backend coverage and the existing unchanged
  client report; no client files changed.
- Tests cover arbitrary library names, universal traits, uneven library sizes,
  missing/unseen metadata, duplicate/shared observations, held-out copies,
  conflicting metadata, removals, media separation, and feature-memory limits.
- Rebuilt Compose is healthy and the final preflight passed without inference.

## Research and recommendations

The [design](organic-library-profile-design.md) records the algorithm, official
sources, security boundaries, pros/cons, and recommendation stack. Research was
checked September 12, 2026; living sources are not certified August snapshots.

Organic profiles are preferable to requiring manual library declarations for
discovery. Their tradeoff is learning from imperfect existing placements. Keep
observational profiles distinct from explicit user constraints and verified
corrections. Do not equate a better match to inventory with proven accuracy.

Next: a live library-knowledge service that refreshes these learned profiles
automatically and supplies bounded profile/metadata evidence to AI comparison.
Start with advisory integration and regression monitoring; keep explicit hard
constraints intact. This is a path toward hands-off classification, not another
manual library-purpose form. The current commit supplies training and evaluation,
not production automatic routing or metadata correction.

Follow-up: [live learned profile integration](live-learned-library-profile-outcome.md)
now supplies this evidence to AI comparison from fresh retrieval snapshots. It
does not yet replace the earlier policy-eligible candidate shortlist or calibrate
automatic-routing confidence.

## PR and CI scope

GitHub MCP returned no open Classifarr PRs, so none was available for random
selection or local implementation. No PR was merged and no release was created.
The existing production naming gate still reports 26 references against its
zero-reference baseline; no claim that every CI gate is green is made.
