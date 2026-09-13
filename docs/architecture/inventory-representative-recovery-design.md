# Bounded representative-fit recovery design

Date: 2026-09-13. Status: implemented; see the
[outcome](inventory-representative-recovery-outcome.md). No release or routing change.

## Evidence and scope

The previous commit (`0e3e3ce0`) added automatic shadow comparisons against cached
library profiles. A read-only local Compose diagnosis found that 29 of 30 starts
converged, while one stopped at the fixed 64-pass limit. Replaying that same
initialization with a diagnostic limit of 512 converged at pass 66. Its training
objective changed from 0.705123267890159 to 0.7051240680821743. This identifies
budget exhaustion for this case, not a general proof that every fit will converge.

Implement the first slice of the self-healing library-learning controller:
continue unfinished geometry fits automatically. Do not add media categories,
library-name rules, generated training labels, new inference, settings or routing
authority. The geometry consumes normalized vectors and opaque description hashes;
existing movie/TV adapters retain their current contracts.

## Recommendations and tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Raise every historical fit limit | Small change | Changes benchmark controls and replays completed work | Reject |
| Ignore the unfinished start | More comparisons | Hides uncertainty in a candidate library | Reject |
| Continue only unfinished starts, bounded at 128 total passes | Reuses progress and preserves strict convergence | Additional bounded CPU and private in-worker state | Implement |
| Persist intermediate vector checkpoints | Resume mid-fit across restarts | New storage, lifecycle and sensitive-data obligations | Defer until justified |

Final stack: private ESM fit session, opt-in stability recovery, versioned runtime
profile, existing bounded worker and source-checked publication, existing quiet
SWR status presentation. No new package, database table or client API is needed.

## Contracts

- Preserve seeding, tie-breaking, mean updates, objective and strict unchanged-label
  convergence. Continue from the actual centers and assignments, not a fresh fit.
- Keep the public legacy geometry limit at 64 and historical benchmark recovery
  disabled by default. Runtime profiles opt in to at most 64 additional passes.
- Keep all three starts. Completed starts receive no further iterations. Exhausted
  starts remain explicitly unconverged; the existing all-candidate guard still
  prevents an incomplete shadow comparison.
- Account for the expanded worst-case work before fitting. Keep the existing
  8-million-component runtime input cap, 120-second deadline and worker limits.
- Bind continuation to one private session. Reject concurrent use and discard
  state after completion, cancellation or failure. No serialized checkpoint is
  accepted from a client or persisted to disk.
- Keep source/configuration/model revalidation before publication. Bump only the
  private profile protocol version so old cache entries cannot satisfy the new fit.
- A restart automatically rebuilds from current cached evidence; it does not resume
  an interrupted iteration from disk. At exhaustion, stop within the existing
  cache/revalidation lifecycle rather than loop until success.
- Report aggregate recovered/exhausted counts and additional iterations without
  titles, IDs, descriptions, vectors or endpoints. No per-pass warning stream.

## Official-source research

Sources discovered and read online on 2026-09-13:

- [scikit-learn's maintained K-means implementation](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/cluster/_kmeans.py)
  separates initialization count, iteration limits and convergence. Our inference:
  preserve those distinctions and measure exhaustion rather than treat hitting a
  limit as convergence. This does not import Python or change our spherical geometry.
- [Node.js worker documentation](https://nodejs.org/api/worker_threads.html) explains
  termination and the limits of JS-engine resource constraints. Retain explicit
  input/work caps, cancellation and termination; worker heap limits alone are not
  a complete resource boundary. The current documentation is newer than the local
  Node 24 runtime; no newer API is introduced.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports provenance and integrity checks. Retain source/model binding and keep
  retrieved content separate from operational authority.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  warns about excessive announcements and does not require inventing new messages.
  Reuse the existing accessible, pausable SWR view; no additional recovery panel.

## Verification plan

Compare uninterrupted and continued fits exactly; test exhaustion, concurrent
use, cancellation, stale-source rejection, worker restart and work-budget limits.
Run backend/client regression and coverage checks, real PostgreSQL integration,
and the local Compose profile refresh with embedding generation disabled in the
probe. Compare all 30 starts, not just the newly recovered one. Record results and
limitations separately in the outcome document.
