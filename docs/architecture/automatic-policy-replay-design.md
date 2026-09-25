# Automatic frozen policy replay: design

Status: Unreleased, September 25, 2026.

## Decision

Extend the automatic cached source-pair worker with deterministic policy replay.
Reuse its snapshot, frozen cohort, held-out folds, deadline, admission lock, retry
checkpoint and private query. Do not create a second evaluation scheduler or UI.
The two arms retain their meaning: TMDB-linked training versus that training plus
source-only movie/TV evidence. Music remains excluded.

Capture resolved policies, policy-source timestamps and allowlisted query metadata
in the same read-only repeatable-read transaction as vectors and corrections.
Reuse the existing frozen-policy preparation, fold-local profiles, inventory
retriever, candidate ranking, decision builder and deterministic AI-mode resolver.
Only in-memory evidence reaches scoring. No generation, provider request, routing,
history learning or domain write is permitted. Private input is never exported.

Report policy actions and paired changes separately from quality. Only consistent
operator corrections after the relevant policy-source edits grade outcomes.
Mutable policy attachments cannot establish that temporal separation. All known
feedback-linked identity groups remain excluded from every training fold, even
when their labels cannot grade a decision. Temporal screening is not independent
blind truth. Missing metadata, policies or cache evidence must be explicit.

The worker uses fixed private logging settings, not inherited credentials or
preloads. Its internal role suppresses local `.env` loading and substitutes a
database pool that rejects queries/connections. Any attempted database access
invalidates publication even when an existing scorer catches the error.
Thread limits and termination protect availability; they are not a
security sandbox. Existing aggregate storage bounds remain unchanged. Policy and
provenance changes invalidate scores but do not silently re-sample the cohort.

The automatic checkpoint emits a v2 report containing a v1 policy-replay section.
Existing v1 retrieval-only reports remain readable until the next due scan; their
absence of replay results is not interpreted as zero deferrals or known quality.
The changed evaluator fingerprint forces a fresh run rather than reusing v1 scores.

## Alternatives and final recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Extend existing cached comparison | Same evidence and recovery path; no duplicate scans | More work within the existing deadline; selected |
| Separate scheduled policy benchmark | Independent cadence | Duplicate cohorts, reads and lifecycle state; reject for now |
| Invoke AI automatically | Tests generative behavior | Provider load and additional authority; defer to a separately bounded design |
| Treat current library placement as truth | Many apparent labels | Circular validation; reject |
| Replay published release automatically | Release regression evidence | Requires pinned code/dependency artifacts at runtime; retain private release-pair tooling |

Recommended stack: coherent cached snapshot → frozen grouped arms → existing
deterministic policy preparation → label-independent outcomes → conservative
correction grading → validated aggregate checkpoint. This tests evidence effects
within the current code, not release equivalence or full classifier accuracy.

## Official research

Discovered through online search and read on September 25, 2026:

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  supports documented test sets, methods, limitations and ongoing evaluation.
- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  supports one consistent read snapshot across policy and inventory queries.
- [Node.js 24 worker threads](https://nodejs.org/download/release/v24.18.0/docs/api/worker_threads.html)
  documents CPU workers, termination and the limits of heap resource controls.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  informs versioned provenance and quality/freshness metadata. This private report
  is not a public dataset or a claim of WCAG conformance; no UI changes are planned.

No new dependency, release, routing setting or live-container deployment.
