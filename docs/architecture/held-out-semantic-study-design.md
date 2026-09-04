# Held-out semantic study design

Status: implementation design, 4 September 2026. Research baseline: August
2026 practices, checked against official sources on 4 September. Living
documentation is not evidence of its exact contents on 31 August.

## Problem and decision

The first real 28-case inventory replay returned leader relevance of 99–100
for every case. Every selected identity was already indexed. These results
establish plumbing, not generalization or accuracy; independent labels are
still absent. Candidate preparation also reads history and RAG, so excluding
the query item only from the last lookup would leave another leakage path.

Introduce a separate offline held-out protocol. Freeze 24–32 unique
`(media_type, tmdb_id)` identities before preparing any candidates. Exclude
the entire cohort, across every library and duplicate embedding, in SQL
before nearest-neighbor ordering and limits. Use exact vector scans for this
small study to avoid filtered approximate-search starvation. Production
retrieval keeps its existing defaults.

Prepare candidates inside the study service using the existing policy
evaluation and decision projections. Supply filtered RAG matches explicitly;
omit assignment authority, learned profiles, patterns, and direct history.
Freeze existing operator policy configuration as the study's prior intent.
This is a distinct evaluation protocol, not a claim that the complete
production classifier has been evaluated without training-data leakage.

Reject malformed identities and externally supplied candidate contracts.
Reject a cohort if any case lacks an eligible pending comparison; never
silently replace cases after seeing semantic results. Provider failure must
not fall back to an unfiltered query. Capture only bounded redacted evidence
and commitments to the exclusion set and retrieval/policy configuration.
Bind these commitments through the existing snapshot manifest and frozen
proposal fingerprint. Legacy inventory snapshots remain readable but cannot
pass readiness as held-out evidence.

## Research and alternatives

| Option | Advantages | Costs and limits | Decision |
| --- | --- | --- | --- |
| Filter results after retrieval | Small change | Self matches consume the limit; other cohort cases remain visible | Reject |
| Freeze cohort, filter before limits, exact study queries | Auditable, bounded, no database mutation | More query work; excludes evidence available in production | Implement |
| Clone and rebuild all learned state without the cohort | Closest to full-system generalization testing | Sensitive duplicate dataset; expensive rebuild and operational complexity | Consider for a later full-classifier study |
| Enable semantic review routing immediately | Earlier product feedback | No independently measured error profile | Defer until the existing gates pass |

The [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
supports splitting before data-dependent processing. The
[NIST AI RMF measurement guidance](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
supports documented test sets, independent assessment, and evaluation limits.
Those principles motivate cohort isolation and preservation of the human
label requirement; they do not establish this small cohort's statistical
power.

[PostgreSQL SELECT semantics](https://www.postgresql.org/docs/18/sql-select.html)
place filtering before ordering and limits. The
[pgvector documentation](https://github.com/pgvector/pgvector) describes
approximate-index filtering and exact-search alternatives. Parameterized
exclusions belong inside both nearest-neighbor queries, with deterministic
tie ordering and transaction-local exact-scan settings for held-out runs.

[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
provenance, quality information, and version indicators/history. Apply those
principles to versioned private study artifacts and explicit limitations;
there is no new user interface in this change.
[OWASP RAG guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
supports filtering retrieval at the data boundary, limiting retained data,
and preserving provenance. Raw metadata, identities, vectors, credentials,
and provider errors must stay out of study output and committed documents.

## Recommended stack and validation

1. Small ESM contracts, query builders, preparation, and capture modules.
2. Parameterized PostgreSQL/pgvector exclusion with exact offline scans.
3. Stdin-only bounded private input and redacted versioned snapshots.
4. Existing independent-label readiness and frozen-study preflight, with an
   additional held-out provenance requirement for inventory evidence.
5. Human review only if the measured profile passes; no automatic routing,
   learning, policy edits, or release from this work.

Test malformed and duplicate identities, all-cohort exclusion before limits,
duplicate embeddings, movie/TV numeric-ID collisions, retained legitimate
neighbors, preparation isolation, configuration drift, redaction, and frozen
binding tampering. Exercise actual pgvector SQL in local Docker Compose.
Record executed checks and remaining limitations in a separate outcome MD.
