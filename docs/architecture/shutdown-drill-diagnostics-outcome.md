# Shutdown drill diagnostics — implementation outcome

## Scope

Implemented on `main`, without a release or production deployment. The
[design](shutdown-drill-diagnostics-design.md) records research, alternatives and
the recommendation stack. The release-evidence workflow kept diagnostics separate
from acceptance evidence and required exact-image synthetic rehearsals.

The original run's hidden child errors remain unknown. New diagnostics cannot
prove whether that earlier failure was a Docker timeout, an in-use volume, or an
earlier scenario failure. No timeout, memory safeguard, application recovery
policy or production database was changed.

## Changes

- Modular ESM error projection and atomic diagnostic persistence, wired through
  both existing real-image runners. Original scenario failures and cleanup
  failures are separate; nested details and recent operations are bounded.
- Cleanup verifies each exact generated resource is absent, including after
  ambiguous command errors. Names plus ownership labels still precede removal.
- CI always attempts a bounded upload of two exact safe JSON files, retained for
  seven days. Neither file is consumed as release acceptance or an attestation.
  A missing file warns because an earlier step may have prevented the drill from
  starting; it does not override the required job's failure.
- Workflow mutation tests protect blocking drill commands, exact paths, the
  pinned artifact action, failure upload and retention settings.

The ownership manifest was re-reviewed only for `embeddedQueueRecoveryChecks.mjs`:
its SQL, synthetic data and claim assertions are unchanged. The file now forwards
scenario identity and the diagnostic callback. Existing ownership debt is not waived.

## Validation

Lint, server/client type checks and Markdown validation passed. The first broader
tooling run found one expected action-count assertion (13 uploads became 14);
that assertion was updated without weakening action pinning. The first preflight
also required the specific reviewed-source digest update described above.

Final tooling run: **170 suites / 2,643 tests passed**. Copyright, narrowly
re-reviewed ownership, development/production dependency checks, workflow contract,
lint, server/client type checks, Markdown (2,182 documents) and whitespace checks
passed. No application schema or API changed; the full runtime, database and
frontend suites were not repeated locally for this infrastructure-only patch.

The no-cache image identity, real-image scenarios and local health will be
recorded after the clean-commit build and rehearsals finish.

## Open PR check and next item

The repository had zero open PRs when checked on 13 October 2026, so there was no
eligible random PR to implement. No PR was merged or closed.

Next: first address any reproducible defect exposed by these diagnostics. Then
continue evidence-backed replacement-ID recovery for genuinely removed provider
records. Same-ID recovery already exists; automatically choosing a similar title
would not establish identity and remains unsafe. Leave Unraid and Plex unchanged.
