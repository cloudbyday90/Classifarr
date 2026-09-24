# Source-anchored movie/TV description learning: outcome

Status: Unreleased implementation, September 24, 2026. See the separate
[design, research, and tradeoff decision](source-description-learning-design.md).

## Root cause and delivered behavior

The previous commit correctly excluded music and unknown content at intake.
However, the source evidence counter and the actual learning pipeline had
different admission rules: descriptions without TMDB IDs were visible to coverage
but excluded from the scheduled cache and live corpus by `msi.tmdb_id > 0`.

The existing scheduled refresh now opts into source-anchored movie/TV descriptions.
The normal live comparison and metadata-profile paths use the same admission.
An absent TMDB ID gets a private, scoped source key, not a guessed provider ID.
Malformed present IDs, mismatched library types, inactive libraries, music, and
unresolved source conflicts do not become eligible evidence.

The change reuses content-hashed pgvector storage and the existing local embedding
provider, model fingerprint checks, work admission, per-pass budget, restart-safe
checkpoints, persistent retry isolation, and expiry. There is no new scheduler,
dependency, schema, manual acknowledgement, or provider-identity write.

Exact duplicate descriptions still share embedding and profile evidence. Query
holdouts additionally use directly known IMDb, TVDB, and source anchors only to
exclude possible self-evidence. Live membership remains fresh, so cached vectors
do not resurrect removed, moved, changed, or newly conflicted source items.

Existing TMDB-based calibration and optional multi-scale models retain their
original populations; this increment does not relax routing approval thresholds.
It can change comparison context and shortlist/profile evidence. That distinction
is intentional: more available evidence is not proof of higher placement accuracy.

The library coverage status now explains source-only eligibility without claiming
that those descriptions have been indexed. Cache and retry counts are explicitly
labeled TMDB-linked. Semantic status/disclosure markup is retained; no additional
user action is required.

## Verification

Completed checks:

- Full backend unit suite: 1,410 suites and 41,320 tests passed. Final focused
  identity/mode/context/profile checks: four suites and 102 tests passed.
- Full client suite: 378 files and 5,247 tests passed; production build passed.
- Full isolated PostgreSQL integration suite: 151 suites and 1,727 tests passed;
  one existing suite/test remains skipped. The earlier focused database run also
  passed all three suites and 33 tests.
- Server/client typechecks, code lint, Markdown lint, ESM import/mock checks,
  migration/schema integrity checks, and diff whitespace checks passed. Server
  lint retains one unrelated warning in `captureOperatorCorrectionFrozenPolicy.mjs`
  about a non-literal filesystem filename; there are no lint errors.

The new isolated PostgreSQL/pgvector tests exercise real source admission,
background cache writes, restart reuse, automatic deferred retry recovery, live
retrieval, metadata learning, conflict removal/recovery, membership moves/deletion,
description edits, late TMDB attachment, and provider-alias holdouts. The embedder
is synthetic: no paid inference, live provider, or persistent user library is used.
Approval calibration stays empty when the fixture contains source-only examples.

## PR and deployment boundaries

The repository-scoped GitHub MCP search returned zero open pull requests on
September 24, 2026. None could be randomly selected or implemented; no closed PR
was substituted, and no PR was merged.

No release, version bump, live-container restart, or production backfill was
performed. Once this code is deployed normally, eligible existing source rows
are discovered by the scheduled refresh without a one-time migration. RAG and a
supported local embedding configuration remain required for vector backfill.

## Next high-value item

Run a paired, source-aware placement evaluation across arbitrary movie and TV
libraries, targeting 300 independently held-out cases where available. Stratify
source-only and TMDB-linked evidence, keep entire duplicate/identity groups out
of training, and measure candidate recall, wrong-destination rate, and manual
review rate against the same baseline cases. Use verified corrections for quality
claims; report insufficient labeled cases instead of inventing ground truth.

This produces a decision about whether source-aware calibration is justified,
not another diagnostic card. Keep source-only evidence out of approval
calibration until that comparison establishes a benefit without safety regression.
