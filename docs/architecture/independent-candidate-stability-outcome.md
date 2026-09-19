# Independent-start candidate stability: outcome

Date: 2026-09-19. Implements the next item from
[outlier-aware recovery](outlier-aware-recovery-outcome.md), following the
[separate design, official research and tradeoffs](independent-candidate-stability-design.md).

## Root cause and implementation

The existing description comparator paired equally numbered starts across
independently fitted libraries. Winning those three views and a selected-start
view did not imply winning every possible combination. A regression demonstrates
a previously accepted destination losing under an unchecked combination.

The new small ESM agreement service requires the winner's minimum similarity to
exceed every rival's maximum by the existing tie tolerance. It does not enumerate
exponentially many combinations, add scoring weights or choose a replacement
destination. Existing malformed-input, nonconvergence, sparse-profile, full-scope,
no-positive and tie safeguards remain in force. A private paired inspection
retains the historical check only for evaluation; runtime uses the stronger result.

The shadow contract advances to `inventory_representative_shadow_v4`; the client
accepts v2/v3/v4 with unchanged bounded/redacted validation. The existing coverage
benchmark advances to `inventory_coverage_robustness_v2` because it shares the
comparator. Historical hybrid-reranker experiments retain their separate contracts:
their old aligned checks are not an independent-start guarantee.

No live routing authority, confidence threshold, learned label, migration or user
acknowledgement was added. Existing compact disclosures, accessible status behavior
and SWR refresh remain unchanged. No extra provider calls are needed.

## Read-only local Compose evaluation

Ran `inventory_candidate_stability_v1` with five grouped folds, cached 1,024-dimension
embeddings, 6,652 distinct descriptions and all ten candidate libraries (five movie,
five TV). Every held description copy is excluded from fitting across libraries,
identities and media types. Both arms reuse exactly the same fits and query vectors.
Placement labels are used only after selection to summarize agreement.

| Cohort / check | Compared | Placement agreements | Placement disagreements | Abstained |
| --- | ---: | ---: | ---: | ---: |
| Original 300 / aligned control | 236 | 204 | 32 | 64 |
| Original 300 / independent starts | 222 | 196 | 26 | 78 |
| Additional 300 / aligned control | 233 | 207 | 26 | 67 |
| Additional 300 / independent starts | 218 | 197 | 21 | 82 |

The fix identifies **29 previously accepted but initialization-sensitive comparisons**.
It changes no retained destination: 440 still compare, 160 abstain. Of the 29 new
abstentions, 18 previously agreed with an existing placement and 11 disagreed.
These are not 29 proven misclassifications, and the resulting agreement ratio is
not accuracy. There are zero independent correctness labels.

The original cohort covers every library with 150 movie and 150 TV queries. The
additional cohort replays and excludes successive sizes `300,300,100,100`, leaving
zero overlap with those 800 descriptions. It contains 172 movie and 128 TV queries
from seven libraries; the three smallest libraries have no remaining eligible
queries in that exclusion sequence. All ten remain training/candidate destinations.
Do not claim the additional cohort independently tests all ten or is unseen by
every historical experiment with a different sampling protocol.

Selected groups' minimum training-member similarities define an additional
diagnostic slice. Across the two cohorts, three queries lie outside every current
same-media group's observed range: two are compared and one abstains under both
checks. The other 597 are within at least one range, including all 29 newly exposed
ambiguities. The range is not a confidence interval, an outlier classifier or a
new routing gate; three cases are insufficient evidence about unusual content.

Both accepted reports passed fresh source/model verification with no sample
shortfall. The first additional-cohort attempt detected source drift and was
invalidated; its output was excluded, and a fresh rerun passed without weakening
the check. The assessment used database-enforced read-only sessions, zero embedding
generation and zero LLM generation. It did not alter media or runtime profiles.
Normal application background workers remained enabled throughout.

## Reproduction and operational bounds

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --candidate-stability --max-minutes 15
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 300,300,100,100 --folds 5 --candidate-stability --max-minutes 15
```

This exclusive mode rejects generation, incompatible flags, incomplete/corrupt
caches and changed candidate scope. It inherits source/component limits and the
isolated production fitter, limits planned fitting work to 400 billion component steps,
and honors cancellation/deadlines. Reports contain aggregate counts and anonymous
strata, never raw descriptions, item identities, vectors or per-item decisions.
Private run artifacts remain ignored in `.tmp/`.

## Verification

- Final clean backend rerun: all 1,299 suites / 37,758 tests passed with coverage
  after reconciling the diagnostic-version assertion and PR provenance validator.
  Coverage: 90.17% statements/lines, 82.70% branches and 92.25% functions.
- Focused server regression: nine suites / 135 tests passed. This includes mixed-start
  reversals and ties, unchanged stable winners, malformed inputs, full candidate
  scope and 500 reproducible cases checked against an exhaustive Cartesian oracle.
- Additional route-contract and candidate regression: three suites / 63 tests
  passed after updating a stale v3 assertion to the intentionally versioned v4.
- Client: all 368 suites / 5,121 tests passed with coverage. Status announcements,
  closed details, pause/resume and older contract compatibility remain tested.
  Coverage: 85.61% statements, 77.56% branches, 85.08% functions, 87.66% lines.
  The repository coverage ratchet passed with both fresh reports; no threshold
  was lowered. New benchmark/range/agreement modules and the refactored comparator
  reached 100% lines/functions/branches in the final report.
- PostgreSQL integration: two suites / 13 tests passed, retaining recovery,
  backfill, checkpoint and retry behavior.
- Dependency/copyright preflight, server/client type checks, test/security/client
  lint, ESM import/mock contracts and Markdown checks passed.
- Local Compose rebuilt and started healthy with its read-only root retained.
- [Randomly selected PR #537](pr-537-local-actions-validation.md) applied locally;
  immutable upstream pins and workflow permission/publication contracts verified.

The previous commit's CI/CD, CodeQL, OSV, Trivy, Gitleaks and copyright workflows
passed. Those results are not a claim that this commit's hosted checks passed;
the new push receives its own CI. No release workflow was dispatched.

## Recommendation stack and next component

Keep cached source-verified descriptions → grouped hold-out learning → validated
full candidate scope → independent-start comparison → existing live authorization.
Benefit: a reproducible stability guarantee across retained fits with little scalar
overhead and no extra model calls. Cost: more diagnostic abstentions, without yet
improving semantic discrimination or reducing user review. Enumerating every start
combination is unnecessary; accepting apparent agreement to raise confidence would
hide ambiguity. Recommend this fix without promoting shadow results into routing.

**Next: resolve overlapping library evidence using candidate-local examples.**
Use the actual nearest supported items and their metadata from competing learned
groups to distinguish ambiguous destinations, instead of relying only on each
library's best centroid. Reuse existing cached retrieval and metadata services;
do not repeat a broad prompt-only reranker or add declaration forms. Evaluate the
160 ambiguous cases plus frozen stable controls, excluding query copies and
correlated duplicates. Include a separately reported minority/unassigned-content
slice: the present three outside-range cases cannot support broad conclusions.
Demonstrate which ambiguities are resolved without new contradictions before any
live routing change. This is a recommendation, not an implemented reranker or a
claim that existing placements are ground truth.

## Rollback and delivery boundary

Use a new commit to revert the comparator/helper and shadow-contract changes;
the benchmark and PR update can be reverted independently. Existing vector caches,
profile memberships, checkpoints and recovery journals remain compatible.
No product-version bump, release or tag is included; changes are Unreleased only.
