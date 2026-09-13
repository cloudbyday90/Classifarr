# Cached representative comparison: design

Date: 2026-09-13. Scope: automatic, observational comparison only.

## Objective

Use the automatically maintained library profiles from `3b760c4d` to compare
genuinely unseen queries with Classifarr's existing candidate decision. Reuse
vectors already obtained by classification; do not create another inference path,
request-time fit, manual checklist or routing authority.

## Research and decisions

Official sources discovered and read with online tools on 2026-09-13:

- [scikit-learn data-leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html):
  evaluation inputs must not participate in fitting or model selection. Reject
  known item identities and exact description copies, even in another library.
  This applies to unsupervised grouping as well as supervised learning; it does
  not require adopting a Python dependency.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  scope cached evidence, bound retention, and invalidate changed sources. Keep
  vectors, media identifiers, provider configuration and individual disagreements
  private; expose only allowlisted aggregate counters.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  understandable status should not steal focus or become excessively chatty.
  Extend the existing automatically refreshed Command Center summary, retaining
  its pause behavior and quiet live-region announcement. Add no new controls.

The summary uses the existing Vue `useSWR` live-stats subscription: adaptive
visible-tab polling, no persistent browser cache, and no additional request loop.

| Approach | Advantage | Disadvantage | Decision |
| --- | --- | --- | --- |
| Fit/compare synchronously per request | Immediate result | Extra work on the routing path | Reject |
| Generate new query vectors for evaluation | More observations | Additional latency/cost and competing inference | Reject |
| Reuse verified vectors, compare in bounded background batches | No extra inference; no request-time fitting | Some queries are unavailable or expire before comparison | Implement |
| Treat decision agreement as accuracy | Simple headline metric | Repeats existing mistakes as labels | Reject |

## Data flow and boundaries

1. After an existing local description retrieval verifies its representation and
   configuration, retain only a bounded private query-vector capsule. A weak
   object binding associates it with the same metadata object; the bounded store
   never holds that object or its title/description.
2. After the existing candidate finalizers choose a destination, consume that
   capsule and enqueue an immutable observation of the decision-time candidate
   pool and baseline destination. No destination, score, prompt or receipt changes.
3. The existing profile scheduler drains at most eight observations per refresh.
   Pending work bypasses its quiet interval, not configuration/busy/backoff guards.
   Source/model validation and any needed fit are shared across the batch.
4. Compare normalized query vectors against the nearest centroid in each admitted
   candidate library. Require three converged, supported starts and agreement
   across the three coherent starts plus the selected per-library view. Ties,
   nonpositive matches, sparse profiles or disagreement produce an explicit skip.
5. Commit aggregate results only after the existing second source/model/config
   validation. Also revalidate novelty inventory: identities without descriptions
   or with source conflicts must not accidentally count as unseen.

This is a **description-profile-only diagnostic**, not the earlier benchmark's
metadata-fused reranker. It compares with the final candidate destination, which
may still require review; it does not assert that media was routed there. The
candidate pool is fixed at decision time and is not expanded to other libraries.

## Bounds and privacy

- Capture and pending stores: at most 32 entries each and 262,144 vector components
  each. Five-minute expiry and removal on shutdown/disablement. No disk queue.
- Deduplicate identity/description pairs for 30 minutes, capped at 1,024 keys.
  Restarts or expiry can allow repeat observations; these are not lifetime-unique
  item counts. Counters saturate at one million and reset on restart.
- Scoring cannot call a provider, database, fitter, route or policy mutation.
  No stored individual result contains a title, synopsis, URL or credential.
- The optional observation hook fails independently of classification. Background
  failures use existing retry behavior; no side-effecting recovery is added.
- The current-inventory novelty query is read-only, bounded and includes current
  conflicted identities. Its digest is checked between snapshots but is separate
  from the training digest, avoiding refits for non-training novelty changes.
- Same-snapshot validation is point-in-time, not a serializable guarantee across
  every subsequent database writer. Shadow counters are never authorization.

## Recommendation stack

1. Ship automatic comparison and honest denominators, including skips.
2. Address remaining profile nonconvergence with bounded work and held-out checks.
   Collect naturally arriving novel movie/TV queries across libraries; investigate
   disagreements independently and measure coverage before changing routing.
3. Consider metadata fusion or routing promotion only after verified outcomes show
   fewer mistakes. Do not increase confidence merely because two heuristics agree.

See the separate outcome document for tests, local observations and limitations.
