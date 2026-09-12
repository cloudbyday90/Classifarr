# Description-preserving shortlist outcome

## Delivered behavior

Implemented the [separate design](description-preserving-shortlist-design.md) in
both the live shortlist and the existing local benchmark. A tiny positive learned
metadata fit previously supplied an extra reciprocal-rank contribution regardless
of magnitude. The resulting three-candidate cutoff could remove a much stronger
description match before AI compared the destinations.

The live path now preserves the first two choices, including the policy leader,
and admits the strongest usable description candidate in the third slot if it was
missing. It uses library contents, not fixed library names or genre rules. Complete
retrieval supplies learned profiles from the same snapshot instead of requiring a
separate profile read. Invalid, incomplete or unavailable evidence cannot expand
eligibility or authorize routing. Existing cancellation and local-only retrieval
boundaries remain in force.

This changes the live AI shortlist, not policy scores, routing thresholds or
authorization. It adds no settings, acknowledgements or manual refresh steps. It
does not by itself establish fewer reviews or fix every low-score classification.
All new code is modular ESM; no client/API/schema change was required.

## Local Compose candidate-recall results

Measured September 12, 2026 after rebuilding the local service. These checks used
cached description vectors and grouped metadata profiles, with **zero generation
calls** and no media routing, model-weight training or verified-label creation.
The selection rule was fixed before inspecting either result.

| Measurement | Previous 300 replay | Fresh 300 |
| --- | ---: | ---: |
| Movie / TV items | 171 / 129 | 172 / 128 |
| Prior items excluded from test selection | 600 | 900 |
| Overlap with excluded cohorts | 0 | 0 |
| Changed learned shortlists | 8 | 10 |
| Observed destinations in unprotected learned shortlist | 296/300 | 297/300 |
| Observed destinations in protected shortlist | 296/300 | 299/300 |
| Recovered destinations / new misses | 0 / 0 | 2 / 0 |
| Description-only shortlist coverage | 298/300 | 300/300 |

The fresh improvements comprise one movie and one TV item. Movie coverage changed
from 170/172 to 171/172; TV from 127/128 to 128/128. No thresholds or ranking rules
were tuned on the fresh results. The earlier four learned-shortlist misses remain
unresolved: preserving only the description leader is deliberately narrower than
preserving every member of the description-only shortlist.

| Anonymous library stratum | Media | Fresh samples | Changed shortlists | Recovered | New misses | Remaining misses |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Movie | 0 | 0 | 0 | 0 | 0 |
| 2 | Movie | 43 | 3 | 1 | 0 | 1 |
| 3 | Movie | 43 | 0 | 0 | 0 | 0 |
| 4 | Movie | 43 | 6 | 0 | 0 | 0 |
| 5 | Movie | 43 | 0 | 0 | 0 | 0 |
| 6 | TV | 0 | 0 | 0 | 0 | 0 |
| 7 | TV | 0 | 0 | 0 | 0 | 0 |
| 8 | TV | 42 | 0 | 0 | 0 | 0 |
| 9 | TV | 43 | 0 | 0 | 0 | 0 |
| 10 | TV | 43 | 1 | 1 | 0 | 0 |

All ten libraries participate in profile training. Three small libraries have no
unused description groups after the preceding cohorts, so the fresh test does
not establish performance for those libraries. Each of five folds holds out 60
descriptions; profiles use 6,582 metadata-bearing training descriptions per fold.

Existing placements are weak labels, not ground truth; `accuracy` remains null.
Candidate inclusion is not the AI's final choice. Moreover, the benchmark begins
with description ranking while the live service retains a policy leader. Do not
present 299/300 as production classification accuracy or guaranteed routing recall.
The PostgreSQL integration test separately exercises the live policy-owned path.

## Recommendations and next item

Keep this bounded description-preservation rule: it removes one avoidable source
of lost semantic evidence without adding a generation call. Its cost is reserving
one of three slots and a bounded local retrieval where only metadata was read
before. The complete path reuses same-snapshot profiles, but does not yet reuse
retrieval across separate scoring, shortlisting and adjudication stages.

Do not discard organic metadata learning, increase confidence values, or loosen
routing thresholds based on candidate recall. Description-only selection covered
more observed placements here, but earlier cohorts also showed metadata recoveries.
The [design tradeoffs and official sources](description-preserving-shortlist-design.md#research-recommendations-and-tradeoffs)
explain why source preservation is preferable to a global replacement in this step.

**Next high-value item: evaluate the preserved choices through the actual AI
comparison and routing-decision path, without routing media.** Use paired baseline
and protected shortlists to measure changed destinations, review outcomes and
latency. Separate observed-placement agreement from independently verified errors.
This establishes whether better candidate recall becomes better automatic
classification, rather than just another improved internal metric. Reuse one
classification-scoped, identity/configuration-validated evidence snapshot where
practical; do not introduce a stale global cache or another user-facing control.

Follow-up implementation: the [production-contract replay outcome](policy-shortlist-replay-outcome.md)
now records this comparison over retained policy cases. Only four distinct local
identities were available, so it does not establish 300-item end-to-end accuracy.
It exposed response-contract failures and identifies prompt/schema alignment as
the next direct AI-reliability fix before wider fresh-policy evaluation.

Final stack: policy eligibility → organic metadata learning + description retrieval
→ description-preserving shortlist → existing AI comparison → existing routing
authorization. The prior selective anonymous recheck remains benchmark-only.

## Reproduction and provenance

```powershell
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false `
  -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000' `
  classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs `
  --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200,300,300 `
  --folds 5 --context 32768 --max-minutes 20 --learned-profiles `
  --content-first-comparison --preserve-description-candidate
```

For the previous cohort use `--exclude-prior-sizes 100,200,300`. Omit
`--generate-cases` as shown for candidate-recall measurement without generation.
The new option requires grouped folds and learned profiles. It changes the
selection fingerprint, but does not change cohort or fold assignment fingerprints.

- Selection version: `contrastive_profile_v1:description_candidate_anchor_v1`.
- Embedding: `mxbai-embed-large:latest`, 1,024 dimensions, digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Previous sample: `decfd452e67f2c42cacbdbab072d7aeb2bb8b32415b7789c16c078f7e0f99422`.
- Previous folds: `3cd473d8fed9f9dab1aab00e07020dbeab6cc0b43798e389840d3e1abe9f91c0`.
- Previous protected snapshot: `5a16d47c0315b0ad03c7662f999e6fa39a39641d8f89d8e61eccb91ba0d65cce`.
- Fresh sample: `ca0cb510c117061372a669e58a69fca6975f1f4a50c2b5da6ff26cf9742784ba`.
- Fresh folds: `77cb7990b67c02ab7db01bb764334910af9e744d4df04ad8979aa78f98bbe7f3`.
- Fresh protected snapshot: `c3b133e4c48d54bfd26e942c14c41ddf0a1b2d92df93145b0bc20bd64911faa6`.

Both runs match all canonical component digests in the
[previous outcome](selective-inventory-recheck-outcome.md#reproduction-and-provenance):
6,647 documents, 10 libraries, 6,644 vectors and 6,649 metadata entries. Only
selection/cohort-related snapshot inputs differ. No private item-level evidence is
included in this document.

## Validation and PR availability

- Focused regressions: 10 suites, 183 tests passed.
- PostgreSQL integration: 1 suite, 8 tests passed. The new live-path test retains a
  description-supported candidate despite adverse metadata fit, excludes inactive
  libraries, and verifies unchanged policy scores and embedding cache counts.
- Backend/client lint and types, ESM import and mock-shape checks passed. Client
  implementation is unchanged; its unit tests were not rerun in this component.
- Local Compose rebuilt and healthy. Workspace/container SHA-256 values match for
  the anchor, metrics, ranker, shortlist service and benchmark sampler.
- Full backend coverage run: 1,234 suites and 35,286 tests passed in 960.288 seconds.
  Statements/lines 90.04% (264,809/294,090), branches 81.56% (47,496/58,229),
  functions 92.14% (10,291/11,168).
- Coverage ratchet passed with the new backend report and unchanged client report.
- Documentation lint, whitespace, npm CLI flags, product-language, delivery-term
  and runtime-release-maintenance checks passed.
- The production naming gate still reports 26 pre-existing references against its
  zero-debt baseline; this change neither adds references nor relaxes that gate.
  Do not describe the entire CI pipeline as green.
- GitHub MCP found no open repository PRs on both checks. No PR could be randomly
  selected; none was applied or merged.
- CHANGELOG updated under Unreleased. No release, tag or version bump.
