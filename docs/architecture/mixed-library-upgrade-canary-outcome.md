# Mixed-library upgrade canary — outcome

See the separate [design and research document](mixed-library-upgrade-canary-design.md)
for alternatives, source basis, and the recommendation stack.

## Delivered

- Expanded the existing pinned-release disposable rehearsal to four synthetic
  libraries and 24 inventory items across movie and TV, including an inactive
  TV library that is resumed after retry recovery.
- Added a small ESM fixture module and a separate profile-probe evaluator.
  Eight non-inserted probes check same-media separation; two ambiguous probes
  check that the profile scorer does not invent a winner.
- Added the rehearsal after schema replay in the database CI job. That job is
  required by release acceptance, so a canary failure blocks the release path.
  No release, deployment, routing, policy, or threshold change is part of this
  commit.
- Kept genuine classification quality visibly `not_measured` with zero
  independent operator-corrected cases and no automatic-routing authorization.

## Local result and limits

The disposable release rehearsal passed all 47 post-release migrations,
idempotent enrollment, retries after a synthetic transient failure, fresh
worker recovery, inactive-library resumption, and revision-verified profile
publication for all four libraries. The eight held-out synthetic probes
separated as expected, and both ambiguity probes remained tied. This is a
regression check for the profile/backfill path, **not** a measured error rate
for the full AI/RAG classifier. It does not call media providers or touch the
operator's library.

The focused evaluator/rehearsal tests passed (nine tests), as did the complete
backend unit run (1,398 suites; 40,934 tests), server source/test lint,
typecheck, documentation lint, dependency-use check, and copyright check.

The repository's connected GitHub search returned no open PRs, so there was
no PR to select randomly or implement locally. No PR was merged.

## Next high-value item

Build a private, read-only comparison of the **full** post-upgrade classifier
against a frozen prior baseline using independently operator-corrected movie
and TV cases. Deduplicate by typed identity and description group, exclude
those cases from every learned/retrieval source, and report coverage, errors,
abstentions, and changed destinations separately. This would supply the
missing quality evidence without asking the operator to re-label every case;
the evaluation must remain advisory until enough representative corrections
exist.
