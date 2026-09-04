# Held-out semantic study outcome

Date: 4 September 2026. See the separate
[design and research document](held-out-semantic-study-design.md) for source
links, alternatives, and the recommendation stack.

## Implemented behavior

The new `runHeldOutSemanticStudyCapture.mjs` command accepts a bounded JSON
request on stdin. Run it directly with Node, or through
`npm --prefix server run study:capture:held-out --silent`. Its private runtime
suppresses normal runtime/file logging and sets database read-only defaults before
loading runtime dependencies. Do not import the capture service into a running
application to collect a private study; use the dedicated process so existing
application logging cannot expose study metadata.

Requests contain `snapshotSetId` and 24–32 `cases`. Each case contains only
opaque `fixtureId`/`snapshotId` identifiers and `metadata`. Metadata requires a
positive integer `tmdb_id`, canonical `movie` or `tv` `media_type`, and a bounded
title. The remaining allowed fields are year, genres, overview, keywords,
certification, original language, production companies, and rating. Identifiers
use the existing hexadecimal study-ID patterns. Candidate contracts, assignment
metadata, duplicate identities, unknown fields, and unsupported identities are
rejected before policy/provider calls.

One immutable exclusion set covers every case before candidate preparation
starts. Both semantic queries exclude all matching media-type/TMDb pairs,
including duplicate history embeddings and copies in other libraries, inside
the nearest-neighbor query before its ordering and limit. Unverifiable history
identities are excluded too. Exact text-only study queries use transaction-local
settings and deterministic tie ordering. Ordinary retrieval retains its prior
behavior. Embedding fallback output cannot become held-out evidence.

Candidate preparation reuses policy evaluation and pure decision projection.
It explicitly supplies the filtered RAG cache, bypasses source assignment,
direct history, learned profile/pattern scores, and inferred/profile-sourced
native rules, and does not persist decision telemetry. No pending action is
forced: an ineligible case invalidates the cohort before comparison capture.
Cases are never replaced in response to observed relevance.

The v2 snapshot document commits to the cohort exclusion set, case count,
protocol, and retrieval/policy configuration. Configuration is checked before
each preparation/comparison and after capture; detected drift invalidates the
entire result even if the configuration later recovers. Existing manifest and
frozen-proposal snapshot fingerprints bind these fields without another
proposal format. Invalid/missing v2 provenance fails validation. Valid legacy
v1 inventory evidence remains readable but gets the readiness blocker
`held_out_provenance_unavailable`, even when independently labelled.

## Local validation

The final targeted run passed 177 tests across 13 suites. Backend lint and
both server/client type checks passed. The new integration test passed against
the repository's real pgvector test database. The same SQL fixture also passed
inside the existing local Compose container: exclusions precede limits,
duplicate embeddings and other cohort cases disappear, a TV item sharing a
movie's numeric TMDb ID remains eligible, and legitimate neighbors survive.
All fixture tables are connection-local temporary tables rolled back after the
test; no inventory rows are changed.

The complete backend unit suite passed: 1,040 suites and 28,732 tests. Static
ESM import checks, ESM test mock-shape checks, Markdown lint, and
`git diff --check` passed. Subsequent focused checks cover the final validation
hardening and query-builder changes.

Both existing readiness and frozen-preflight CLIs were rerun against the
previous real 28-case v1 bundle. Both remained `not_ready`; the bundle still
matched its frozen proposal, and readiness now additionally reported
`held_out_provenance_unavailable`. Missing human labels and the previous
coverage/metric blockers remain in force.

A separate real-inventory check froze 28 cases, seven each from documentary,
reality, genre-overlap, and ordinary metadata strata, before any preparation.
It ran with PostgreSQL read-only mode and the configured local Ollama provider.
The first prepared case had no eligible pending candidate comparison. The run
correctly returned `invalid_request` and emitted no partial snapshot document.
It did not replace that case or claim a completed held-out cohort. This is an
execution check, not a measured error profile. Independent human labels remain
absent. Private aggregate receipts are ignored under `.tmp/`.

## PR request

GitHub's connected pull-request API returned an empty array for this repository
with `state=open&per_page=100` on 4 September 2026. The eligible population was
zero, so no random open PR could be selected or implemented locally. No PR was
merged. No release or version bump is included in this work.

## Limits and recommendations

The protocol freezes operator policy intent as prior configuration, while
omitting learned runtime evidence that cannot be separated safely. It does
not establish generalization of the complete production classifier. Exact
search costs more than indexed search, acceptable for a bounded offline study.
The corpus itself is live: these are frozen observations, not a rebuilt,
transactionally frozen training corpus. Configuration checks detect observed
drift, not a change-and-revert entirely between checks. A content fingerprint
is a binding, not authentication or proof that independent human review occurred.

Keep the modular ESM services, parameterized exact study queries, private
stdin runner, versioned commitments, and unchanged human-reference thresholds.
This provides an auditable evaluation path without enabling product behavior
before evidence exists. A rebuilt isolated corpus would improve full-system
evaluation but adds sensitive storage and rebuild complexity.

The next study item is a prospectively selected eligible pending cohort with
blinded human labels and validated broad-policy strata, followed by the existing
readiness and frozen-study preflight. Independent humans must provide those
labels; local Docker and assistant-generated labels cannot satisfy that contract.
Only a qualifying measured profile justifies a separate change that sends
ambiguous cases to operator review.

A separate source-scoring bug also surfaced: `scoreHistory` filtered by
`tmdb_id` without `media_type`. The paired-identity fix and its collision
regressions are now documented in the separate
[history-scoring outcome](history-scoring-media-identity-outcome.md). The
held-out study bypasses this scorer, and its independent-label and
cohort-eligibility requirements remain.
