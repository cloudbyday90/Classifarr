# Synthetic Policy-Candidate Replay Outcome

## Delivered

Classifarr now has a fixed, offline policy-candidate replay command:

```powershell
npm run test:offline:policy-candidate-synthetic-replay
```

The committed eight-case corpus covers broad contextual evidence, explicit
conflict removal, profile-only and RAG-only evidence, deterministic ties,
strong identity evidence, no viable candidate, and weak-evidence overlap. It
evaluates baseline and proposed synthetic candidate states through the shared
production calibration, ranking, and decision projection.

The command produces a bounded report such as fixture count, expectation-match
count, mismatch count, and the count of changed synthetic leaders. It never
prints titles, candidate IDs, fixture IDs, source text, or raw scenario detail.

## Refactor outcome

Production ranking now uses two pure ES modules:

- `policyCandidateRankingProjection.mjs` owns calibration plus stable numeric
  ordering.
- `policyCandidateDecisionProjection.mjs` owns score-band, weak-evidence, and
  ambiguity action projection.

`PolicyCandidateRanker` retains its existing telemetry and decision-finalizing
boundary. This is a behavior-preserving extraction, covered by the existing
ranker tests as well as dedicated pure-projection tests.

## Validation

The focused server suite passed with 42 tests, covering the existing ranker,
the new projection modules, strict corpus validation, aggregate-only reporting,
and preview/replay boundary inventory. The fixed runner passed all eight
checked-in scenarios.

## Pull request inventory

The repository pull-request list was checked on 2026-09-01 and reported zero
open pull requests. Consequently, no unrelated pull request could be selected
and implemented locally in this pass; no pull request was merged.

## What it does not do

This is not a live-library replay, a policy preview, an AI/RAG evaluation,
automatic tuning, a route-safety check, or a release gate by itself. It is
evidence to help reviewers judge whether a proposed deterministic code change
behaves as intended before that change ships.

## Next high-value item

The dedicated CI contract is now delivered in
[the replay CI outcome document](policy-candidate-synthetic-replay-ci-outcome.md).
The next high-value follow-up is for a repository administrator to make the
new check required for `main` after its first successful pull-request run. That
repository setting is intentionally outside the code change.
