# Automatic cached source-pair evaluation: design

Status: Unreleased, September 24, 2026. This follows automatic saved-outcome
evaluation; results and verification belong in the separate outcome document.

## Decision and boundaries

Schedule the existing source-description paired evaluator without invoking its
private CLI runtime. Compare TMDB-linked training with TMDB-linked plus source-only
training on identical movie/TV cases and identity-grouped folds. This is a retrieval
ablation, not a comparison of generative models or full-pipeline accuracy. Existing
feedback exclusions remain authoritative; library placement is not a quality label.
Music is excluded by the existing corpus reader.

Use the recently verified representation checkpoint from the cache refresher, not
a provider request or a guessed model digest. Read configuration, corpus, vectors
and feedback in one bounded repeatable-read transaction. Reuse existing limits
(50,000 membership rows, 10,000 descriptions, 64 libraries, 20 million vector
components) and add a serialized snapshot budget before crossing the worker boundary.
No partial result is published when a budget is exceeded.

Run CPU work in a fixed ESM worker with a deadline, bounded heap, empty environment
and discarded output streams. Share the existing discovery admission lock and
memory monitor. Terminate and await the worker before releasing ownership. Threads
are an availability tool, not a security sandbox or an absolute process-memory cap.
No provider, cache, policy, classification or routing writes are introduced.

## Cohort and lifecycle

Persist up to 300 opaque identity-plus-description hashes for a frozen cohort.
Reuse it across model/cache/metadata/feedback changes while its members remain
eligible and independently grouped. Automatically replace it after 30 days, or
when a member disappears/changes or formerly distinct identities become linked.
An empty cohort is reconsidered on the next due scan. New items do not silently
replace existing cases during that window. Report the cohort reason and aggregate
sample fingerprint; never expose the per-case hashes through status output.

Both arms always use the same snapshot and cohort. Cohort replacement is not an
improvement/regression across time. Gains and losses refer only to the paired arms
within a run; correction labels remain observational, not independent blind truth.

Reuse the previous commit's durable worker lifecycle through a small shared
coordinator. Keep domain readers, grading, validation and checkpoint SQL separate.
Check every minute with a five-minute minimum between successful scans; the next
eligible cron tick may add up to one minute. Persist bounded
backoff (5 to 60 minutes), clear failed results, withhold reports older than fifteen
minutes and recover from restarts. A failed database write uses local cooldown only.
Expected cache/configuration/resource deferrals must not produce an error flood.
The private CLI gains a status flag; no new public API, dashboard or approval gate.

## Alternatives and final recommendation stack

| Option | Advantage | Cost / decision |
| --- | --- | --- |
| Existing evaluator, scheduler and PostgreSQL checkpoint | Reuses tested ranking and recovery contracts | Polling and explicit resource limits; selected |
| Run synchronous scoring in scheduler | Minimal adapter | Blocks HTTP/event-loop work; reject |
| Generate new embeddings or invoke model on each check | Fresh model evidence | Added provider load, cost and authority; not this increment |
| Add a workflow engine | Durable distributed workflows | Additional infrastructure for one bounded observer; defer |
| Re-sample every change | Quickly includes new inventory | Cohort drift confounds comparisons; freeze with explicit rotation |

Stack: cache refresher and verified representation → coherent snapshot → frozen
cohort → isolated paired evaluation → validated aggregate checkpoint → private
query. Next, adapt the existing frozen-policy replay to measure whether retrieval
changes actually improve policy decisions or reduce deferrals. Keep model inference
separately budgeted and routing promotion disabled.

## Official research

Discovered and read with search/navigation tools on September 24, 2026:

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains why successive read-committed queries may see different states. A
  repeatable-read snapshot keeps both arms' evidence coherent.
- [Node.js 24 worker threads](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html)
  recommends workers for CPU-heavy JavaScript and documents termination and heap
  limits. Its limits do not cover all external memory; admission and input budgets
  are also required. Only APIs available in the repository's Node 24 runtime are used.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
  supports representative evaluation, documented limitations and ongoing testing.
  This implementation separates coverage, label availability and paired results.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  informs versioned provenance, quality metadata and freshness. These principles
  apply to private reports here; no public publication or WCAG conformance is claimed.

No new dependency, release or live-container deployment is planned.
