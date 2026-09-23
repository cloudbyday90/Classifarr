# Production-company learning: design

Date: 2026-09-22. Follows the [organization handoff repair](classification-organization-metadata-outcome.md).

## Decision and scope

Inventory enrichment already requests typed TMDB details but discards production
companies. Capture a bounded company set in the identity-bound inventory
observation, then learn its distribution separately from studio, genre and rating.
Use provider IDs when present and normalized names otherwise. Do not derive a
studio from a company's position, a TV network or a library name.

The existing learned fit participates in routing. Until independent outcome
evaluation establishes the new feature's value, retain a separate diagnostic
company score. Existing routing/prompt projections must omit it. This is automatic
observation and model learning, not automatic promotion of uncalibrated evidence.

## Implementation contract

- Reuse the existing typed detail request, queue, guarded persistence and bounded
  refill scan. No extra provider endpoint, scheduler, schema migration or prompt.
- Optional `production_companies` extends the existing version-1 observation.
  Legacy keyword/language readers remain compatible. Operational refill requires
  the new set and honors the six-hour attempt cooldown. A valid empty set is
  complete; malformed or absent data remains due without creating a tight loop.
- Names and arrays use the shared 160-character / 32-company validator. Keep
  names and positive safe IDs only; invalid/conflicting sets are unavailable.
- Learning requires matching movie/TV identity and a non-future observation less
  than 30 days old. SQL bounds the JSON copied into memory. Cross-library identity
  disagreements exclude company evidence without erasing other feature channels.
- Reuse the existing smoothed contrastive estimator with a separate company-only
  model. Deduplicate sets, fraction shared observations, ignore universal/unseen
  terms, and exclude query identities and synopsis copies before fitting.
- Fresh snapshot digests include company inputs; expiry, edits and removals
  invalidate cached models. Count both models against the existing cache budget.
- Benchmark up to 300 stratified movie/TV items with grouped folds. Print only
  aggregate coverage/agreement. No provider calls, routing, training-data writes
  or claims that existing placement is independently verified ground truth.
  Fit one fold pair at a time instead of keeping all folds' models resident.

## Research and tradeoffs

Official sources were discovered and read through search/GitHub MCP on 2026-09-22.

[TMDB's official OpenAPI schema](https://developer.themoviedb.org/openapi/tmdb-api.json)
defines production companies as a list for movie and TV details, with TV networks
separate. Preserve the set and its provider IDs rather than inventing a singular
studio or treating a network as a company.

[Google's ML engineering rules](https://developers.google.com/machine-learning/guides/rules-of-ml)
favor reliable feature pipelines and shared training/serving transformations.
[scikit-learn's leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html)
requires separating held-out data before learning transformations. Apply those
principles using the existing JavaScript estimator; no Python ML runtime is needed.

[OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
supports validating external observations and separating retrieved data from
authorization. Company metadata is evidence, never instructions or permission.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
supports accessible background status without focus changes. This backend change
adds no acknowledgement, review screen or new live announcement. It does not
establish accessibility conformance for the existing UI.

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Separate bounded company model on existing stack | Learns arbitrary libraries; preserves roles and baseline behavior | Initial backfill requests; needs coverage and independent outcome validation | Implement |
| Add companies directly to the routing score | Immediate ranking influence | Unmeasured calibration and correlated evidence | Defer promotion, not capture/learning |
| Use the first company as studio | Simple | Order-dependent false equivalence | Reject |
| New vector database or model fine-tuning | More modeling choices | Operational cost; does not repair missing observations | Not justified |

Final stack: existing TMDB adapter and recovery queue → validated PostgreSQL JSON
observation → separate bounded ESM contrastive model and cache → read-only grouped
benchmark. Keep current routing gates and the established profile score unchanged.

## Recovery and rollback

Provider outages retain the previous observation and the existing retry schedule;
they do not fabricate company coverage. Invalid or oversized optional company
models cannot replace the established profile. Missing provider configuration or
an unresolved source identity still prevents enrichment.

The added JSON field is optional and existing readers ignore it. Reverting the
application change therefore needs no down-migration or metadata deletion.
In-memory models are rebuilt by the application lifecycle. Neither deployment nor
rollback was performed as part of this local implementation.

Implementation and measured results are recorded in the
[outcome document](production-company-learning-outcome.md).
