# Classification Routing Metadata Preservation Outcome

Status: Implemented (unreleased)

Date: 2026-08-31

## Delivered Outcome

Routing no longer replaces a just-persisted classification record's complete
metadata object. It now patches only its routing state, preserving the
bounded evidence required to explain a pending policy decision:

- deterministic policy score and diagnostics;
- RAG and current-library retrieval projections;
- exact cross-library identity evidence;
- candidate-bound AI/adjudication state; and
- route-safety evidence.

This corrects the local Compose symptom where a freshly retried pending item
showed contextual policy support but reported no retained retrieval or
cross-check evidence despite the application containing those capabilities.
It does not make semantic retrieval or AI mandatory, raise the policy score,
or auto-route an item. A `no_candidate_identity_match`, unavailable retrieval,
or no RAG match remains an honest, reviewable outcome.

## Implementation

- Added the modular ESM
  `server/src/services/classificationRoutingMetadataPersistence.mjs` service.
- Replaced three stale full-metadata writes in
  `classificationServiceCore.mjs` with parameterized partial JSONB updates for
  skipped, successful, and failed routing outcomes.
- Kept the existing routing error behavior but clears a stale error on a later
  non-error update.
- Added focused unit coverage for parameterization, preservation intent,
  invalid-input rejection, and all existing routing persistence paths.

## Local Compose Evaluation

The local Compose stack was healthy and its PostgreSQL instance contained
6,764 classification-history rows. The current retry cohort had zero retained
contrastive-evidence, current-library-retrieval telemetry, or RAG trace
projections. Inspection showed the post-persistence routing write replaced
`classification_details` with a stale caller object containing only
`routing`.

The new JSONB expression was evaluated with a synthetic local value containing
a RAG trace, exact contrastive evidence, a prior routing state, and a prior
error. It retained both evidence values, replaced routing with `not_final`,
and removed the stale error. No user record was altered during that check.

## Research, Pros, and Cons

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Atomic, narrow JSONB routing patch | Preserves evidence, avoids a stale-object overwrite, keeps authority small | PostgreSQL-specific query needs regression coverage |
| Client-side reconstruction | No database change | Cannot recover missing run-specific evidence and risks misleading operators |
| Recompute RAG/AI after routing | May produce additional data | Adds cost and non-determinism; does not correct the write defect |

The final recommendation is the first option: persist the decision once, then
make later phases modify only their owned fields. This aligns with OWASP's
object/property authorization guidance, W3C's non-disruptive status-message
practice, and NIST's emphasis on traceable human-governed AI use.

## Open Pull Request Check

The GitHub Pull Requests MCP query returned no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-31. Therefore no unrelated or closed pull
request was implemented locally.

## Validation

- Focused server regression tests: 2 suites / 12 tests passed.
- Full workspace tests: 984 backend unit suites / 27,565 tests; 75 backend
  integration suites / 868 tests, with one existing integration test skipped;
  and 293 client files / 4,026 tests passed.
- Full lint, server and client type checks, documentation lint, static ESM
  import and ESM mock-shape checks, coverage ratchet, copyright validation,
  migration/schema validation, and `git diff --check` passed.
- The local Compose JSONB verification used a synthetic value only. It
  preserved the expected RAG and contrastive keys without writing to a user
  record.
- A no-cache Docker Compose build and forced recreate completed successfully.
  The replacement container is healthy, connected to PostgreSQL, serves the
  exact new persistence-service source hash, and retains the expected `401`
  protection for the existing administrator evidence-digest endpoint.

## Next Item

After this persistence fix is deployed and representative retries have created
retained evidence, add an aggregate-only **evidence-retention health signal**
to Candidate Retrieval Statistics. It should report the fixed proportion of
current policy-review records carrying each existing projection, with no media,
library, candidate, provider, prompt, response, or destination identity. That
will make a future regression visible before it makes AI/RAG look inactive.
