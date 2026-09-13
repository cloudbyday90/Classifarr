# Lazy corpus synopsis projection: outcome

## Change and scope

The shared ESM corpus query now evaluates its historical synopsis lookup only
when inventory overview and summary cannot supply usable text. It projects the
latest history overview instead of joining the full history JSON object into the
sorted inventory rows. Live movie/TV reads, global refresh and evaluation reads
use the same implementation.

This follows `6028bb09` media scoping, not a replacement for it. Exact same-media
membership, source exclusions, synopsis precedence, latest-row ordering, bounds,
model-cache inputs and routing checks remain unchanged. There is no schema,
dependency, API, UI, setting, scheduler or cache addition. The existing small
service was updated without introducing a duplicate SQL implementation in
production; a frozen previous builder exists only as a test fixture.

Official research, August 2026 applicability, alternatives and the recommendation
stack are in the separate [design document](lazy-corpus-synopsis-design.md).

## Prototype comparison

Read-only local comparisons on 12 September 2026 used one repeatable-read snapshot
of 6,651 rows across ten libraries. Every previous, narrow-lateral and lazy-scalar
arm returned exactly equal rows for movie, TV and all-media queries, over three
alternating-order rounds per scope.

| Scope | Rows | Previous median SELECT execution, ms | Narrow lateral, ms | Lazy scalar, ms |
| --- | ---: | ---: | ---: | ---: |
| Movie | 5,008 | 456.240 | 361.797 | 299.005 |
| TV | 1,643 | 151.392 | 55.567 | 46.419 |
| All media | 6,651 | 576.344 | 476.340 | 379.971 |

Measurements used `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON)`, not planner
cost estimates. In this snapshot the outer movie sort's disk usage fell from
7,240 to 3,224 kB; the TV sort moved from 2,680 kB on disk to 1,769 kB in memory.
History scans fell from 5,008 to 2 for movies and 1,643 to 0 for TV. Narrowing the
lateral output helped, but lazy fallback avoided the unused lookups as well.

These findings reconcile the prior plan investigation: history index lookup time
alone was not the main cost. Carrying unused history values through sorting also
had a measurable cost. No index or database memory-setting change was needed.

## Rebuilt Compose query results

The service was rebuilt and recreated; its deployed corpus-service SHA-256
matched the workspace and the container became healthy. A second three-round
comparison verified that the deployed SQL exactly matches the selected prototype
and returns the same rows as the preceding query for every scope and round.

| Scope | Previous median execution, ms | Deployed median execution, ms | Previous median query/transfer, ms | Deployed median query/transfer, ms |
| --- | ---: | ---: | ---: | ---: |
| Movie | 424.563 | 281.201 | 442 | 302 |
| TV | 143.295 | 41.399 | 148 | 50 |
| All media | 564.900 | 337.082 | 569 | 366 |

Query/transfer times include the database client round trip and returned-row
decoding; EXPLAIN execution times exclude that transfer. They are distinct
measurements. The same sort-space and history-loop reductions from the prototype
were observed after deployment. No benchmark/test/build process ran alongside
these measurements; ordinary application/host activity and timing variance remain.
These medians describe this local inventory, not general throughput guarantees.

## Live AI/RAG outcome parity

The retained smoke set contained three movies and one TV case. Each used one
local AI proposal, reused across previous/optimized cold and warm arms. Both
repositories retained media scoping and the default model caches; only the corpus
SQL differed. All **16 arms** passed exact live-evidence and decision comparison,
including learned fingerprints, baselines, scores, qualification and test receipt
status. No model, setting or routing threshold changed.

| Case | Media | Previous warm retrieval, ms | Optimized warm retrieval, ms | Unchanged outcome |
| --- | --- | ---: | ---: | --- |
| 1 | Movie | 843 | 677 | Review: neighbors disagree |
| 2 | Movie | 1,716 | 1,385 | Qualified: two fresh checks and valid test receipt |
| 3 | TV | 420 | 327 | Review: metadata disagrees |
| 4 | Movie | 796 | 705 | Review: metadata disagrees |

Case 2 sums both fresh retrieval calls; full warm validation changed from 2,301
to 1,953 ms. Its corpus-query total fell from 913 to 573 ms, while repository
remainder was essentially unchanged at 380 versus 382 ms. This supports the
query optimization, not a claim that model-fitting or AI inference improved.
The policy score stayed 38.72. Cold-arm timing includes model warm-up and is not
used to claim a steady-state speedup.

The harness enforced database read-only mode, made four local model-generation
calls, and routed **zero items**. The stored require-all-confirmations setting
remains **enabled**. Only the test configuration reader supplied a false value
in memory to exercise automatic-route qualification. No history, training rows,
configuration or media placements were written. This four-case smoke comparison
does not establish classification accuracy across all libraries.

## Verification method

Database tests compare every field/media-scope variant against the frozen query,
including wrong JSON types, SQL/JSON nulls, whitespace, 4,000-character Unicode
boundaries, latest-history ties/null timestamps, no older-row rescue, shared
memberships, source conflicts, inactive or media-incompatible libraries and the
50,001-row overflow sentinel. A plan test verifies zero executed history scans
when inventory supplies the synopsis.

For rebuilt Compose verification, compare the deployed query with that same
previous builder in one read-only snapshot. Then run the existing retained local
AI/RAG smoke cases with equal proposals and identical repository logic, changing
only the corpus SQL between arms. Check complete live-evidence and routing-outcome
parity, cold and warm. Do not route media or change the stored confirmation
preference. This small smoke set is not an accuracy benchmark or new training
sample collection.

Focused command, from `server/`:

```powershell
$patterns = 'liveInventoryDescription|inventoryDescription|inventoryMetadataCandidates|liveInventoryLearned|liveLibraryMatch'
node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns=$patterns
```

PostgreSQL integration command, from `server/`:

```powershell
$patterns = 'inventory-description-corpus-projection|live-inventory-description|inventory-description-refresh|inventory-description-vector-cache|policy-shortlist-replay|consensus-review-recovery'
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --testPathPatterns=$patterns
```

Targeted coverage and local comparison harnesses stay under ignored `.tmp/`.
Public output contains only aggregate counts, timings and outcome categories,
not titles, synopses, identifiers, vectors, prompts or credentials. Targeted
coverage does not replace the project's global coverage reports or ratchet.

## Automated results

- Focused service coverage run: **19 suites, 269 tests passed**.
- Broader policy/routing/code-health selection: **600 suites, 28,273 tests passed**.
- PostgreSQL integration selection: **6 suites, 29 tests passed**.
- Selected three-file coverage: **95.79% lines, 94.59% branches**. SQL execution
  semantics are additionally verified by the real-database tests, not inferred
  from JavaScript coverage percentages.
- Backend typecheck, changed-file ESLint, static-import and ESM mock-shape checks
  passed, as did Markdown lint and whitespace checks. The frontend is unchanged;
  Compose reused its build layer, and no new
  client test run is claimed.
- The production naming gate still reports **26 pre-existing legacy references**
  against a zero-reference baseline. The gate was not weakened. This is not a
  claim that every CI gate is green.

## Recommendation and next high-value component

Keep lazy synopsis fallback in the shared query. It reduces unused database and
sorting work without requiring user involvement. The tradeoff is continued
fallback lookup work where inventory metadata is missing and the need to retain
strict parity tests. Keep PostgreSQL/pgvector, local embeddings, modular ESM,
media-scoped reads, bounded model reuse and fresh routing validation; no new
dependency or user-facing control is warranted.

**Next: calibrated cross-library neighbor comparison.** The current
`assessLearnedEvidenceReview` rule rejects a proposed destination if any rival
neighbor has similarity greater than or equal to its weakest selected example.
One of these retained cases still encountered that veto; two others encountered
metadata disagreement. Faster SQL deliberately did not change those decisions.

Use the existing held-out benchmark and investigation infrastructure to compare
that strict veto with a library-agnostic, distribution-based contrastive margin
across balanced movie/TV strata. Check whether it reduces unjustified reviews
without accepting contradictory evidence. Preserve identity/copy exclusions,
metadata and source checks, fresh receipts and uncertain-case review. Existing
placements alone are not verified correctness labels. This is a hypothesis to
evaluate, not evidence that the current veto is wrong or permission to simply
raise confidence or lower routing thresholds. Work on this component before
adding another settings or diagnostics panel.

Follow-up evaluation is now recorded in
[neighbor-margin comparison outcome](neighbor-margin-comparison-outcome.md).
It measures the proposed alternative without changing this query optimization
or granting new routing authority.

## PR, changelog and release

GitHub MCP returned no open Classifarr PRs during the checks on 12 September 2026
(America/New_York), so there was no eligible random PR to implement. No closed
or unrelated PR was substituted, and no PR was merged. High-level changes are
recorded under Unreleased only; there is no version bump, tag or release.
