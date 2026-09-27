# Source enumeration preflight — outcome

## Implemented

Owned imports now check bounded media and collection samples before creating a
capture or writing media. Failures retain an actionable, sanitized sync diagnostic,
preserve existing inventory/capture data and use the existing durable cooldown.
Successful samples are reused by the full scan, which still must validate every
remaining page before pruning or completing. No new background service is started.

Fresh installations stay dormant without configuration or enabled movie/TV libraries.
An unavailable source defers ingestion and dependent readiness; a due retry checks
again and normal backfill/learning eligibility returns only through existing gates.
Changed configuration and disconnected owners cannot use preflight as a bypass.

Library detail shows the last owned preflight cause and next step through existing
SWR status polling. The API never exposes raw stored transport errors. Background
library discovery also no longer logs a deferred import as a completed zero-item
sync; successful logging uses the actual processed count.

See the separate [design, research and tradeoffs](source-enumeration-preflight-design.md).

## Verification

Focused unit and disposable-PostgreSQL integration checks pass. They cover bounded
adapter options, actual Plex/Emby/Jellyfin response normalization, movie/TV and empty
sources, missing totals, repeated/changed pages, source changes, disconnected owners,
preflight-before-write, cooldown, restart recovery and later-page truncation.
API/component tests verify safe cause/action display, unknown-message suppression,
stale-state suppression and no false completion.

- Backend CI suite: 1,499 suites, 44,866 tests passed, including type checking.
- Frontend coverage: 397 files, 5,575 tests passed.
- Targeted real-PostgreSQL integration: four suites, 72 tests passed.
- Focused backend: 21 suites, 403 tests passed; focused frontend: 31 passed.
- Coverage ratchet passed. Server statements/branches/functions/lines:
  90.31/84.66/92.29/90.31%; client: 85.88/78.34/85.34/87.85%.
- Client type checking and production build, both linters, CI preflight,
  ESM import/mock-shape checks, migration/schema integrity, ownership compatibility
  and Markdown lint passed. Server lint retains one pre-existing non-literal
  filename warning in `captureOperatorCorrectionFrozenPolicy.mjs`.

The ownership gate reports 15 owned, three separately coordinated and 474 unresolved
writers. That is reviewed compatibility evidence, not a repository-wide safety
certificate.

Tests use synthetic provider responses and disposable databases, with no real
provider calls or paid AI evaluation. This is not a live version-compatibility
certification. The user subsequently requested the local no-cache Compose rebuild
recorded below. Normal background jobs resumed during that authorized deployment.
No release or version bump was created.

## Local rollout — 2026-09-27

Code and documentation were committed and pushed as
`996c4fe075f6ffb8d15529a085991dcb940092f0`. The repository provenance wrapper built
that clean checkout with `build --no-cache --require-provenance classifarr`, then
recreated only Classifarr with `--no-build --no-deps --pull never --wait`.
The running image revision matches that code commit. This outcome update is a
subsequent documentation-only commit and does not require another image build.

- The previous actual image remains tagged
  `classifarr:rollback-preflight-20260927-1602`. No images or volumes were deleted.
- A full PostgreSQL custom archive is retained privately under the ignored
  `data/backups/` directory as
  `pre-source-preflight-2026-09-27T20-03-07-280Z-8705cc05.dump` (79,859,856 bytes).
  Archive listing succeeded and container/host SHA-256 values matched:
  `bfd7e409f1ab29aa1d15828bd8f032fd566efae1d4fbacd05e9835c2c9413a10`.
  This checks archive readability and transfer integrity, not a restore rehearsal
  or an off-host disaster-recovery backup. Treat the archive as sensitive data.
- All four previously committed migrations applied, increasing the ledger from
  287 to 291. They add credential wakeup, recovery progress, ingestion ownership
  and reconciliation-receipt indexing. This patch adds no migration.
- Compose reports healthy. `/health` and authenticated readiness return 200;
  anonymous library access remains 401. The authenticated list and all ten library
  detail requests return 200 without exposing the internal raw diagnostic field.
- Counts remained ten libraries, 6,696 inventory items and 6,798 classifications.
  The selected library routing/policy configuration fingerprint is unchanged.
  Existing data/media mounts and unrelated containers were retained.
- Startup log inspection found no error/fatal entries; the persisted error-log
  query also returned none during the observation window. This is a startup check,
  not a claim about every future scheduled job or external provider.

Three libraries report `legacy_owner_unknown`; seven have not yet entered the
new ownership ledger. Older markers were deliberately not cleared or declared
complete. For those three libraries, follow the existing
[blocked-import review procedure](legacy-ingestion-reconciliation-outcome.md#operator-procedure):
verify old writers are stopped, disable the affected library, review and reconcile
the exact markers, then re-enable for a controlled replay. The smoke check made
only read requests and did not initiate imports, repair metadata or change settings.

## PR availability

The GitHub MCP open-PR query returned no open pull requests for
`cloudbyday90/Classifarr`. There was no eligible PR to randomly select or implement.
No closed PR was substituted and no PR was merged.

## Recommendation and follow-up

Keep the bounded canary within owned ingestion. Its benefit is earlier, actionable
failure with fewer partial writes; its cost is small initial pages and deliberate
deferral when evidence is insufficient. Do not interpret a passed sample as learning
accuracy, an atomic snapshot or permission to skip full enumeration.

Next implement **library-catalog completeness and safe removal reconciliation**.
That is a concrete remaining data-preservation boundary, not another dashboard or
retry mechanism. Acceptance requires malformed/missing/partial discovery preserving
existing libraries, a genuine empty result being distinguished explicitly, and
confirmed removals remaining controlled and tested.
