# Dotenv optional-settings update outcome

## Implemented — 9 October 2026

Server dotenv is updated from 18.0.6 to 18.0.7. The lockfile changes only its
root requirement and the dotenv artifact/version/integrity entry. No runtime
loader changes, new service, dependency additions, install-policy changes,
release or version bump were needed. The [design and official research](dotenv-undefined-options-design.md)
record the alternatives and boundaries.

Synthetic ESM subprocess tests isolate environment files and settings from the
developer's real configuration, with five-second timeouts, bounded output and
no shell. They verify undefined options, explicit false precedence, current and
legacy CLI quiet settings, and explicit shell quiet=false with file override.
Existing parser, file URL, side-effect import and missing-file checks remain.

## Local verification

- Before updating, the new contracts reproduced three failures on 18.0.6:
  the environment-selected file/override was masked by undefined options, and
  both CLI file-provided quiet settings emitted startup output.
- After updating, all 18 dotenv tests passed with no skips.
- Reviewed-policy `npm ci`, `npm ls --all` and `npm audit --json` passed;
  the audit included development dependencies and reported zero advisories.
- All 40 toolchain/install-policy tests passed on the retained dependencies.
- Server lint, TypeScript, knip and production dependency analysis passed.
- Documentation, copyright, static ESM checks and `git diff --check` passed.

Full server and exact-image results are recorded below after completion. This
document does not claim a new frontend coverage run or a coverage ratchet from
old reports; no frontend behavior or client API contract changed.

## Open PR trial

Randomly selected [PR #555](https://github.com/cloudbyday90/Classifarr/pull/555)
remained open at head `4cbffcb7dd726af152382a1f92edb9dc326fe349` during review.
Its exact two-file patch was implemented locally and installed with scripts
disabled. Both client TypeScript checks passed and the install audit reported
zero advisories. The existing policy suite passed 39 tests and rejected one:
Node 26 declarations do not match the deployed Node 24 major.

The trial was reversed without weakening that guard. The original Node 24.19.2
declarations and undici-types 7.24.6 lockfile were restored, a normal strict-policy
client clean install passed, and the policy suite returned to 40/40. No PR was
merged, closed or published. The tested PR is not part of the retained code.

## Unresolved IDs

The separate [read-only investigation](unresolved-identity-october-investigation.md)
confirmed that the twelve titles have Plex descriptions/posters but conflicting
provider identities in both installations. This dependency update does not fix
those source conflicts or alter recovery acceptance.

## Recommendation

Retain the upstream patch and existing ESM bootstrap. Its benefit is corrected
option precedence with no graph expansion; its cost is maintaining small
subprocess contracts for environment behavior. The dependency-update skill kept
the PR trial separate and prevented an incompatible type-major update. The
recovery skill kept identity diagnosis read-only and preserved ambiguity.

Next prioritize provider-specific unresolved-ID explanations, then investigate
the title/year rejection with verified catalog evidence. Resume dependency work
with a separate Express 5.3.0 review; do not combine it with identity acceptance
changes or a Node-major migration.
