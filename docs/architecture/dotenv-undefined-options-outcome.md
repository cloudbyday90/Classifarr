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
- Full server unit run: 1,763 suites passed, 54,891 tests passed, one existing
  platform-specific test skipped (54,892 total), in 408 seconds. The Linux
  image probe below exercises the directory-fsync behavior unavailable on Windows.

No database driver, SQL or API contract changed, so a new full database
integration or frontend coverage run was not required. No coverage ratchet is
claimed from old reports.

## Exact local image

The no-cache Compose build used clean source
`b65a94d3ea44835b9ad472ca9127f263cca63a4c`. Docker identified the result as
`sha256:d4ec658346e18fba4705bee5bca00cae22a881d417dd673bca196d87de533efe`.
The revision label matched. This is local image evidence, not a published
multi-platform release or signed-provenance claim.

Fourteen synthetic dotenv/Node contracts passed against that image, including
the new undefined-option and CLI quiet cases. The probe had no network, a
read-only root, UID/GID 1000, dropped capabilities, bounded CPU/memory/PIDs and
only disposable tmpfs writes. A separate Linux directory-fsync/exclusive-copy
probe also passed against the image's migration-tree module without app-data.

Before replacement, a 76,670,986-byte local database archive was checksum-verified
and its archive index read successfully. The prior image is retained as
`classifarr:pre-memory-b8351fb8-5232-4083-b9f0-3625570dec41`. The private backup
remains in ignored `.tmp/`, not in the repository.

The post-build schema dump ran against a new disposable database using this
exact image. It passed through migration
`20261009_230000_comparison_incident_ledger.sql`, included all 22 seed migrations,
and left `database/schema/current.sql` unchanged. The owned container and its
temporary directory were cleaned up.

Only the local Compose service was recreated, with `--no-build --pull never
--no-deps --force-recreate --wait`. Container
`b0033c2742a75e40f91d90ec4c3d2dc9dc5495f1c94bf72adbe21e419fe984d4`
started at `2026-10-10T03:09:44.023150653Z` using the exact image above.
Docker reported healthy and `/health` returned 200. Read-only database checks
confirmed the latest migration, no WARN/ERROR rows since startup and the same
twelve unresolved identity conflicts. There were zero restarts and no OOM.
The read-only root, UID/GID 1000, no-new-privileges and 2 GiB memory limit stayed
intact. An early sample was 368.2 MiB; this is not a sustained-memory or leak
test. Unraid and shared Ollama were not redeployed or reconfigured.

The release-evidence skill kept these local checks tied to the tested image.
The final follow-up commit updates this outcome document only; it does not
change runtime bytes or claim remote CI has already completed.

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
