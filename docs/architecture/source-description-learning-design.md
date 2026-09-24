# Source-anchored movie/TV description learning

## Decision and scope

September 24, 2026: connect the already-observed movie/TV source descriptions to
automatic embedding backfill, ordinary live retrieval, and learned metadata
profiles. Music and unsupported content remain excluded. Library names are not
classification rules. This is retrieval and statistical profile learning, not
training the underlying language model.

The preceding content-admission fix correctly removed music. The remaining gap
is different: `inventoryDescriptionCorpus` requires a positive TMDB ID even when
a valid, current source item already supplies a useful description. Coverage can
see that description, but backfill and learning cannot use it.

## Design

- Keep existing TMDB identities unchanged. For an absent TMDB ID only, use a
  namespaced hash of the exact library/server/media-type/source-item anchor.
  A source anchor identifies membership, not a verified cross-provider work.
  Malformed present IDs must not silently become source-only identities.
- Opt the scheduled refresh and ordinary live consumer into this corpus. Keep
  historical benchmarks and approval/calibration consumers on their established
  TMDB population until they have a matched source-aware evaluation.
- Reuse normalized, bounded description hashes and the existing model-fingerprinted
  vector cache. Duplicate descriptions share one embedding and one profile vote;
  conflicting descriptions for an identity stay excluded.
- Reuse the scheduler, advisory lock, foreground-work yielding, cancellation,
  cache-write checkpoints, persistent retry journal, cooldown, and expiry. Do not
  introduce a second worker or a new dependency. No manual enabling step is added.
- Query holdouts include the current synopsis, stored copies, and directly known
  IMDb/TVDB/source identities. Alternate IDs are exclusion evidence only, never
  permission to merge items or authorize routing.
- Continue filtering active, matching movie/TV libraries and unresolved source
  conflicts in SQL. Read current membership for every request: moved, removed,
  edited, or conflicted items must not remain retrievable just because vectors exist.
- Keep metadata and descriptions private to their existing processing paths.
  No titles, raw source IDs, or descriptions are added to logs or public reports.
  Descriptions remain untrusted data under the existing prompt/evidence boundary.

## Official research and tradeoffs

Sources were discovered and checked with search/browser tools on September 24,
2026; these are current references, not claims that the standards were published
this month.

| Guidance | Application | Tradeoff |
| --- | --- | --- |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends provenance and quality information | Distinguish local source membership from external work identity; retain exclusions and bounded coverage | More identity handling, but avoids inventing authority |
| [PostgreSQL repeatable-read documentation](https://www.postgresql.org/docs/17/transaction-iso.html) describes a stable transaction snapshot | Keep membership and ranking in the existing read-only snapshot | Snapshot consistency is not a guarantee that upstream metadata is correct |
| [pgvector documentation](https://github.com/pgvector/pgvector) distinguishes exact search from approximate recall tradeoffs | Retain bounded exact ranking against current eligible hashes | Work grows with the bounded corpus; do not add approximate indexing without recall measurements |
| [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) treats retrieved content as an injection surface | Preserve data/instruction separation and existing routing validation | Text normalization alone does not make source content trustworthy |

No UI controls or API contract are added. Update the existing status copy to
explain source-only eligibility and label the narrower TMDB cache/retry counts;
do not claim source-only cache readiness from description presence. Retain the
semantic status region and disclosure controls, following
[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).
Source-description counts remain a separate observation, not accuracy.

## Recommendation stack

1. Use source-anchored descriptions through the existing local cache/recovery
   stack now: useful evidence without another service to operate.
2. Preserve explicit constraints, identity-conflict exclusions, and existing
   approval/calibration behavior. Do not raise confidence by increasing counts.
3. Next, run a paired source-aware movie/TV evaluation across all active libraries:
   compare candidate recall, incorrect placements, and review burden, with
   query/duplicate exclusion and separate source-only strata. Existing placements
   are weak observations, not verified ground truth. Extend calibration and its
   coverage contract only after that evaluation.

Requiring TMDB everywhere is simpler but discards usable local knowledge. Merging
by title or guessed provider equivalence creates false identities. Adding a new
vector database or orchestration framework increases operational cost without
fixing this admission gap. The recommended stack is the current ESM services,
PostgreSQL/pgvector cache, and recovery scheduler with narrowly expanded admission.

## Verification plan and rollout

Test source scoping, invalid IDs, music rejection, duplicate/conflict handling,
query alias exclusion, learned-profile isolation, and unchanged calibration.
Exercise backfill, a cache-only restart, live retrieval, edits, removals, and
conflict resolution against an isolated PostgreSQL database with a fake local
embedder. Run backend regression suites and repository quality checks.

No schema migration, release, deployment, or live-provider call is required.
Reverting the opt-in consumers restores TMDB-only behavior; unused cache hashes
expire normally. Results are recorded separately in the outcome document.

## Limits

Source-only examples remain weak inventory observations. Equivalent works on
different servers with different descriptions and no shared known IDs cannot be
fully deduplicated; a local anchor does not solve that identity problem. Do not
promote these examples into independent calibration labels. Conflicting observed
aliases may conservatively remove extra evidence but cannot add authority.

The existing 50,000-row and 10,000-distinct-description corpus ceilings remain.
An over-budget read fails closed rather than silently reporting partial coverage;
the live caller keeps its established fallback. New source descriptions share the
existing eight-call-per-pass refresh budget, not an unbounded embedding burst.
