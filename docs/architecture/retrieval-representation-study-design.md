# Retrieval-Representation Study — Design

Status: implemented, unreleased. Official guidance was reviewed on 10 September
2026 against the requested August 2026 best-practice baseline.

## Decision

Add a protected, aggregate-only evaluation path that compares exactly three
retrieval representations against the same independently adjudicated reference
set:

1. `media_description` — the incoming media metadata representation, including
   its bounded synopsis when one is available.
2. `declared_library_purpose` — the server-retained, operator-declared purpose
   representation for each policy-owned candidate library.
3. `nearest_item_history` — the bounded evidence supplied by nearest eligible,
   current-library historical items.

This change does not make any representation live. It makes the question
answerable before a future implementation changes prompts, embeddings,
retrieval, recommendation, or routing.

## Existing-state assessment

The current candidate-scoped semantic retriever has useful, but incomplete,
context:

- `embeddingServiceFormatters.mjs` can represent title, year, media type,
  genres, rating, language, studios, franchise, cast, keywords, score, an
  existing classification label, and a bounded synopsis.
- `currentLibraryCandidateSemanticRetrieverQuery.mjs` compares that query only
  against embeddings from current eligible library items, excluding the
  incoming item's same-type stable identity. It returns bounded title/year and
  relevance facts, not descriptions or embeddings.
- Declared library purpose exists as provenance-controlled policy evidence, but
  it is not yet a separately measured semantic representation in that
  retrieval path.

Consequently, the product can say that an item has a similar historical item,
but it cannot yet prove whether that signal is better or worse than the media
description or the policy's declared purpose. The screenshots' misleading
specialized-library proposals are exactly the kind of ambiguity that should be
measured, not papered over by increasing a score.

## Architecture

```text
redacted, fingerprint-pinned evaluation bundle
          + independent human reference set
          + status-only three-representation artifact
                         |
                         v
strict binding and complete-fixture checks
                         |
                         v
aggregate agreement / review precision / recall / abstention / Wilson intervals
```

`heldOutSemanticStudyRetrievalRepresentationArtifact.mjs` accepts only opaque
fixture IDs, categorical decisions (`admit`, `review`, `abstain`), two SHA-256
fingerprints, and the three fixed representation IDs. It rejects raw
descriptions, purpose terms, library/item names, retrieved neighbours,
embeddings, prompts, provider output, additional fields, duplicates, missing
variants, and any partial or substituted fixture set.

`heldOutSemanticStudyRetrievalRepresentationResults.mjs` validates the same
redacted bundle used by the baseline semantic study, requires the completed
independent reference set, and converts each representation into
content-free aggregate rows. It shares
`policyCandidateSemanticEvaluationAggregateReport.mjs` with the existing
semantic-results summary, avoiding two subtly different implementations of
precision, recall, abstention coverage, stratum grouping, and Wilson
uncertainty.

`study:retrieval-representation-results` reads the three local inputs and
writes a result only for `summary_available`. It uses the existing protected
`.tmp` JSON boundary: project containment, symlink rejection, realpath checks,
512 KiB input limits, exclusive output creation, and requested `0600`
permissions.

## Authority and safety boundary

The entire path is offline and content-free at its output boundary. Its
authority explicitly sets AI/RAG invocation, learning, policy changes, retry,
routing, and operator-workflow admission to `false`.

It is intentionally not a shortcut to self-learning. A correct future change
must first collect a controlled, pinned, status-only artifact for each
representation, measure it against independent labels, review uncertainty and
failure strata, and then propose a separately governed advisory experiment.
In particular, a current classification label embedded in historical text must
be treated as a leakage hypothesis to test, not as semantic proof.

## UI decision

No new card, dashboard, or settings control is added. The artifact does not
yet exist for a real study, and a dense empty evaluation panel would repeat the
confusing screen state that motivated this work. The existing compact,
auto-refreshing Command Center readiness status remains the single browser
entry point. If a future aggregate result is deliberately surfaced, it should
announce one concise completion or availability message with `role="status"`
and progressively disclose comparisons rather than continuously publishing a
large live table.

## Research basis

- The [NIST AI RMF Measure function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, comparison to benchmarks, uncertainty,
  formal reporting, and independent assessment. This design pins the test
  source, preserves three comparable variants, reports Wilson uncertainty, and
  requires independent labels before a result exists.
- The [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends integrity verification, constrained index writes, staging/review
  between ingestion and use, and fail-closed behavior. Fingerprint binding,
  fixed schemas, full-fixture coverage, no-output failure paths, and the lack
  of an online retrieval path implement those controls.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires important changing status to be programmatically determinable
  without taking focus, and warns that applications can become too chatty.
  Keeping this one-time study out of the busy review screen follows that
  guidance.

## Options and trade-offs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Raise current RAG confidence | Fast and hands-off | Would mask false specialized-library matches and cannot establish why they occur | Rejected |
| Send raw descriptions, purposes, and neighbours to a browser study UI | Easy to inspect | Creates a retention and disclosure surface and adds dense, misleading UI | Rejected |
| Add declared purpose directly to production embeddings | Potentially useful | Unmeasured, can leak candidate identity, and could overfit declared policy | Deferred |
| Fixed, three-way aggregate study | Compares the actual hypotheses fairly; preserves privacy and reversibility | Requires a controlled status-only input artifact and genuine labels | Selected |

## Final recommendation stack

1. Run this three-way study with a fresh, separated reviewer cohort and a
   pinned status-only artifact for all fixtures.
2. Examine representation performance and uncertainty by stratum, especially
   documentary, reality, broad-genre, and specialized-library ambiguities.
3. If one representation wins with sufficient coverage, design a
   candidate-bounded advisory experiment with a rollback switch. Do not alter
   routing thresholds from this study alone.
4. Test the historical `Classified` label as a possible representation leakage
   source in that advisory experiment; do not assume it is semantic evidence.
