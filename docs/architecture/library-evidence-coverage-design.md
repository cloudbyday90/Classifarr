# Per-library evidence coverage: design decision

Status: implemented in Unreleased, 2026-09-24. The separate [outcome document](library-evidence-coverage-outcome.md) records verification.

## Problem and boundary

The Command Center now says whether library-profile/recovery work is running, but not whether a particular library's inventory has the identity, descriptions, and retrieval representation needed to understand its content. A green worker indicator is not a placement-quality metric. The next increment is a bounded, administrator-only, read-only explanation on a library page. It must not start a sync, call an AI provider, move media, grant routing authority, or expose titles, descriptions, vectors, provider hosts, or credentials.

This initial contract deliberately covers the existing movie/TV TMDB description pipeline. Other media and identity providers report **unsupported**, not zero coverage. Source-item rows, distinct `(media type, TMDB ID)` identities, usable descriptions, and cache entries have different denominators; none is a classification-accuracy percentage.

## Decision

1. Take the source-item, inventory revision, corpus, configuration, checkpoint, cache, and retry-journal reads in one short, read-only PostgreSQL repeatable-read transaction. PostgreSQL documents that successive selects in this mode see the same snapshot. Cap corpus work at 10,000 source rows plus one sentinel row; over-limit libraries get an explicit `window_truncated` state and no extrapolated result. Apply statement, lock, idle, and transaction timeouts. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html).
2. Reuse the exact existing description projection and source-conflict exclusion. Count source rows excluded for media-type mismatch, missing TMDB identity, and unresolved source-ID conflict; then count distinct identities with usable, missing, or conflicting descriptions. This is a diagnostic view of the current pipeline, not a new definition of training data.
3. During the existing background refresh, persist only the last locally inspected embedding representation: projection version, digest of the resolved configuration, model name/digest, dimension, and verification time. The endpoint never contacts Ollama. It treats a changed configuration or a checkpoint older than ten minutes as `model_unverified`, with cache coverage **unknown**, not zero. When recently verified, it uses the existing cache and retry journal to report indexed, deferred, and due identities. A recent inspection is not proof of current model availability or placement quality.
4. Return a versioned, count-only response. The server constructs an explicit allowlist; the client validates and re-allowlists it. Require administrator access, rate limit, and set `Cache-Control: no-store`. OWASP's API testing guidance warns that hiding sensitive response properties only in the UI does not prevent disclosure. [OWASP excessive data exposure](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Excessive_Data_Exposure/).
5. Put a small card on the relevant library page, with plain-language status, a manual refresh, and a disclosure for gaps and denominators. Use semantic heading, button, details, and status text announced through `role="status"`; do not auto-poll. [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).
6. Keep `classificationQuality: not_measured`. NIST recommends documenting risks or characteristics that are not measured and evaluating model behavior in deployment context; evidence availability alone does not establish classifier validity. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/).

## Options and tradeoffs

| Option | Advantages | Disadvantages | Decision |
| --- | --- | --- | --- |
| Live Ollama inspection and fresh embedding query per page view | Current model answer at request time | Slow, provider-dependent, operational side effect and possible workload amplification | Reject |
| Background persisted aggregate for every library | Cheap reads; eventual support for very large libraries | More invalidation and scheduling machinery; stale aggregate can appear authoritative | Defer |
| Bounded read-only snapshot with a recent worker checkpoint | Reuses existing recovery path; consistent counts; no inference request or routing change | 10,000-row ceiling; recent checkpoint is not real-time provider health | Adopt |

## Recommended stack and safe follow-up

Existing PostgreSQL inventory/revision and cache tables → existing ESM description projection and source-identity guard → short read-only snapshot service → administrator-only REST endpoint → typed/allowlisted Vue presentation. The existing background worker alone verifies the local embedding model and backfills/retries. The status card does not request work. The follow-up is a provider-independent identity/evidence adapter for non-TMDB content, followed by held-out correction evaluation of actual placement quality; neither should turn coverage into automatic routing authority without measured validation.
