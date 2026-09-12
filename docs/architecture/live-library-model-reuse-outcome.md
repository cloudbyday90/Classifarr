# Live library model reuse: outcome

## Implemented

The [design](live-library-model-reuse-design.md) is implemented as repository-owned
ES-module caches for completed learned profiles and empirical description-match
baselines. Inventory changes refresh the fitting inputs automatically on use;
there is no new user setting, acknowledgement, scheduler or manual refresh step.

The previous commit, `41095b7b`, introduced live learned-evidence qualification.
This component preserves its evidence fingerprints, numeric results and routing
conditions while avoiding repeated fitting for identical training inputs.

- `liveInventoryModelCache.mjs` provides bounded LRU reuse, non-sliding expiry and
  estimated retained-memory accounting. Its clock is monotonic by default.
- `liveInventoryLearnedProfile.mjs` fingerprints fresh, query-excluded training
  data, reuses the fitted profile and scores current query metadata separately.
- `liveLibraryMatchBaseline.mjs` rereads unexpired vectors and hashes their actual
  values before looking up a fit. The empirical rank remains query-specific.
- `libraryMatchBaseline.mjs` accepts a per-assessment work accountant. Reusing a
  model does not reuse another live request's consumed-work counter; the existing
  offline session-wide accounting remains the default.
- `liveInventoryDescriptionRepository.mjs` owns both caches and retains the
  current repeatable-read transactions, vector checks and fresh retrieval output.

Profile and baseline caches each retain at most eight entries. Their accounting
budgets are 4 MiB and 16 MiB per repository respectively, with five-minute expiry
checked on access. These are conservative accounting limits, not measured heap
ceilings or a timed erasure promise. Errors, cancellations, incomplete vectors,
sparse baselines and degenerate baselines do not publish successful baseline fits.
Concurrent cold requests may fit independently; no shared in-flight promise carries
another request's cancellation or transaction into the caller.

No schema, API, dependency, frontend, version or routing-threshold change was made.
No model parameters, private library descriptions, vectors or cache keys were added
to API responses or logs.

## Local Compose validation

Compose was rebuilt and became healthy. SHA-256 hashes of all five affected
production service files matched the workspace files in the running container.

The existing retained-case smoke harness was extended locally to compare three
arms: caching disabled in the qualification repository, a new empty cache, and
that cache reused. Each case generated one local AI proposal and reused the same
proposal in all three arms. Arm order alternated between cases. Each validation
still read fresh evidence and obtained a new preparation context.

Results on 12 September 2026; elapsed validation milliseconds, excluding AI
generation:

| Retained case | Type | Uncached | Cold cache | Warm cache | Outcome in all arms |
| --- | --- | --- | --- | --- | --- |
| 1 | Movie | 1,799 | 1,145 | 1,041 | Review: description neighbors disagree |
| 2 | Movie | 2,944 | 2,946 | 2,771 | Qualified at unchanged policy score 38.72 |
| 3 | TV | 980 | 980 | 918 | Review: learned metadata disagrees |
| 4 | Movie | 1,026 | 1,042 | 979 | Review: learned metadata disagrees |

The qualified case retained both retrieval/revalidation passes. Its warm arm
used two profile hits and two baseline hits with zero new fits. Across the four
warm arms there were five hits and zero fits for each model type. Cold arms fitted
four profiles and four baselines, reusing the selected case's fit on its second
retrieval. All twelve validations preserved qualification/review outcomes.

For the qualified case the observed warm saving was 173 ms, about 5.9% relative to
the uncached arm. Its two retrieval calls still took 929 ms and 975 ms, accounting
for most of its 2,771 ms validation. The larger first-case difference includes
startup/database warming and must not be attributed solely to model caching.

These are four retained integration cases, not a representative accuracy or
throughput benchmark. The uncached arm uses the updated implementation with model
storage disabled, not a separate checkout of the parent commit. One measurement
per arm does not establish a latency distribution. No new 300-item evaluation was
run, and existing library placements were not treated as verified labels.

The local `require_all_confirmations` preference remains **true and unchanged**.
The harness used an in-memory test-only configuration override to exercise the
qualification path. Database connections enforced read-only mode; four local AI
generation calls were made, zero media items were routed, and no settings or
classification history were written by the harness. This does not mean the local
instance is now configured for hands-off automatic routing.

## Automated verification

- Broad policy, routing and code-health run: **586 suites, 28,062 checks passed**.
- Database integration run: **5 suites, 62 tests passed**, including qualified
  warm routing, vector expiry after caching, vector rewrites/deletion, inactive
  libraries and membership changes during revalidation.
- Final focused coverage run: **8 suites, 137 tests passed**; five production
  services at **100% line/statement, 96.51% branch, 95.83% function coverage**.
  The cache and shared baseline kernel each have 100% line/branch/function coverage.
- Typecheck, changed-file ESLint, static-import checks, ESM mock-shape checks,
  Markdown lint and whitespace validation passed.
- The existing production naming gate remains blocked by **26 pre-existing
  references** against a zero-reference baseline. The count was not increased and
  the gate was not relaxed. This is not a claim of fully green CI.

Focused command, from `server/`:

```powershell
$patterns = 'liveInventoryModelCache|liveInventoryLearnedProfile|liveLibraryMatchBaseline|libraryMatchBaseline|liveInventoryDescription|inventoryMatchCalibration'
node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns=$patterns
```

Database integration command, from `server/`:

```powershell
$patterns = 'live-inventory-description|consensus-review-recovery|policy-shortlist-replay|deterministic-policy-route-outcome-acceptance|policyEngine.test'
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --testPathPatterns=$patterns
```

Targeted coverage was written under ignored `.tmp/coverage-live-model-reuse` and
does not replace the project's global coverage reports or establish the global
coverage ratchet. No frontend behavior changed; its build layer was reused by
Compose rather than claiming a new client test run.

## Recommendation and next component

Keep exact-input fitted-model reuse: it removes redundant work without adding
operator involvement. Its advantage is unchanged results with bounded reuse; its
cost is memory and continued fresh-read/hash work. Do not switch to time-only
cached routing evidence or prewarm every possible query exclusion.

The recommended stack remains PostgreSQL/pgvector, local embedding checks,
modular ESM model caches, the existing learned-profile/baseline algorithms and
fresh deterministic routing validation. Official sources, date limitations,
alternatives and W3C considerations are recorded in the design document.

**Next: media-scoped live retrieval and phase-level latency measurement.** The
current live corpus SQL loads both movie and TV inventory before JavaScript
filters to the requested media type. Preserve comparison across every eligible
same-media library and all same-media shared/copy/conflict exclusions while
avoiding unrelated-media reads. Measure corpus reads, preparation, vector queries
and representation checks separately before choosing further optimizations.
Then validate unchanged outcomes across a balanced movie/TV library sample.
The existing background vector refresh already exists; this is not a proposal
to build a second index-refresh system or another settings panel.

## PR and release scope

GitHub MCP returned no open Classifarr PRs on 12 September 2026, so there was no
eligible random PR to implement. No closed or unrelated PR was substituted, and
no PR was merged. Recommendations/design and implementation/outcome are separate
documents. High-level changes are under Unreleased only; no release or tag is
created.
