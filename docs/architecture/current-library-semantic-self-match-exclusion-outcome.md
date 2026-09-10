# Current-Library Semantic Self-Match Exclusion Outcome

Status: implemented and locally verified on 2026-09-10. No release or tag was
created.

## Delivered

- Updated the modular ESM semantic-retrieval contract to v3.
- Excluded a stable incoming TMDb identity from the same-media candidate
  embedding query before similarity ranking.
- Preserved the established behavior for items without a stable identity.
- Projected only a content-free `queryIdentityExcluded` Boolean and clarified
  the trusted-local provider prompt when a comparison is independent.
- Updated held-out and snapshot fixtures so a retrieval-protocol change starts
  a new study cohort instead of blending v2 and v3 observations.

## Verification

- Focused semantic retrieval, policy-adjudication, prompt, held-out-study,
  snapshot, capture, and frozen-study tests: 34 suites / 153 tests passed.
- `npm run typecheck` and `npm run lint:security` passed in `server/`.
- `docker compose up -d --build` rebuilt the local application, and its
  `/health` endpoint returned HTTP 200 with a connected database.
- A complete security diff review covered the 17 changed executable files and
  found no reportable issues. It specifically checked parameter order, `NULL`
  identity behavior, candidate scope, cross-media preservation, evidence
  projection, and routing authority.
- `git diff --check` passed.

## Scope and Trade-offs

The comparison is more trustworthy for retries and previously misrouted items,
but may return fewer neighbours. That is the correct abstention: the system
must not make a prior placement look like semantic proof. The feature remains
read-only and advisory; it cannot repair a route by itself.

GitHub's official open-pull-request API returned no open PRs for
`cloudbyday90/Classifarr` on 2026-09-10. No unrelated pull-request change was
copied locally.

## Next Item

Collect an independently labelled, held-out v3 corpus that includes the
documentary, reality, broad-policy, and genre-overlap strata. Only a passing
study can justify a separate semantic counter-evidence review experiment; it
must not authorize automatic routing.
