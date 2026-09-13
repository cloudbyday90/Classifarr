# Live calibrated-neighbor shadow: design

## Decision

Commit `c82409c4` found 11 familiarity-qualified potential gains in a frozen
300-item experiment. It did not test current operator preferences, live identity
conflicts or fresh routing receipts. Add a shadow branch to the existing live
learned-evidence service; do not enable calibrated routing or inflate confidence.

The strict path remains authoritative. Only a strict `neighbors_disagree` result
that passes the existing identity, familiarity and prompt-evidence checks, with
the AI destination uniquely leading description means and learned metadata, may
spend extra work on cross-fitted calibration. Reuse the existing admitted AI
response, policy revalidation and current library checks. A shadow success returns
the original result before the receipt issuer, even when every check passes.

## Architecture and boundaries

- Fit current same-media candidate libraries using the existing cross-fit kernel
  and deterministic exclusive-group split. Exclude every current and stored
  synopsis for the query identity, including shared copies outside the pool.
- Read selected vectors in the same read-only snapshot as live neighbors and
  learned metadata. Revalidate actual vector contents and representation before
  every cache hit. Cache completed fits, never eligibility decisions or authority.
- Reuse the bounded LRU/TTL model-cache factory: eight entries, 16 MiB accounting
  limit and five-minute expiry. Bound a fit/query to 100 million scalar components
  and the existing vector-memory ceiling. Interrupted work is not cached.
- Shadow retrieval requires a cached query embedding. It must never generate a
  new query embedding or another language-model response. Missing or expired
  cache entries retain review.
- Only one shadow attempt per routing-service instance may be in flight. Use a
  shared timeout signal across its extra reads. The original strict success path
  does not request neighbor calibration.
- Revalidate policy, libraries, evidence, configuration, original result and
  one-use request context before recording a qualified shadow outcome. Preserve
  administrative confirmation, explicit restrictions and unknown-state vetoes.
- Keep fixed-category, bounded process-local counters, with no titles, IDs,
  synopses, vectors, endpoint details, model text or durable learning records.
  Counters reset on restart; they are diagnostics, not verified outcomes.

Calibration is an empirical contrastive signal, not a probability. The shadow
branch cannot invoke the receipt issuer. Retrieved content remains untrusted
evidence; no public input can turn a shadow measurement into routing authority.

## Official sources verified 13 September 2026

URLs were discovered through search and their contents read:

- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports scoped cache invalidation, bounded retrieval, output validation, policy
  enforcement and fail-closed behavior. Here, cached computation never replaces
  current-source checks or authorizes a side effect.
- [Node.js global APIs](https://nodejs.org/docs/latest/api/globals.html) documents
  composed cancellation signals and timeouts. Cancellation is cooperative; the
  database retains its own statement/lock timeouts, and numeric work is bounded
  independently rather than relying only on a timer.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  describes accessible updates and the risk of overly chatty feedback. This
  component adds no UI card, polling loop, acknowledgement or live-region noise.

The sources justify implementation controls, not classification accuracy.

## Options and recommendation stack

| Option | Benefit | Cost or risk |
| --- | --- | --- |
| Stay offline | No live overhead | Cannot establish current identity or freshness qualification |
| Enable fallback routing immediately | Potentially fewer reviews | Premature promotion from weak placement labels |
| Live shadow using existing responses | Measures actual safeguards without moving media | Bounded extra reads/fitting; sparse or missing caches remain unresolved |

Recommend PostgreSQL/pgvector, pinned local embeddings, strict learned evidence
first, selective cached cross-fit shadow second, and unchanged fresh authorization.
Reuse ESM service factories and shared validation predicates; avoid duplicate
policy engines, new databases, global singleton models or user-facing controls.

## Validation and handoff

Test unchanged strict receipts, shadow no-receipt behavior, current identity and
administrative restrictions, metadata and AI conflicts, prompt/evidence drift,
final policy/configuration changes, bounded concurrency, cancellation, expiry,
vector mutation and same-media exclusions. Verify local Compose with read-only
current inventory and no provider generation. Do not replay frozen offline
responses as if they were fresh live AI evidence. Record actual validation and
remaining gaps in the separate [outcome](live-neighbor-shadow-outcome.md).
