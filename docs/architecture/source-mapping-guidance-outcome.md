# Source mapping review guidance — outcome

## Diagnosis and implemented scope

Implemented on `main` on 2026-10-10, without a release or version bump. See the
[design, official research and tradeoffs](source-mapping-guidance-design.md).

At 22:10:25 UTC the local read-only database probe found eleven unresolved items:
nine source-review and two retry-wait, with ten current library captures. A bounded
read of their Plex metadata confirmed all eleven have descriptions and artwork.
Nine declare two TVDB IDs; two grouped shows declare multiple TMDb series IDs.
Metadata presence does not establish agreement between those identifiers.

The evidence review now displays the exact typed TMDb titles and dates already
read for the proposal. It does not introduce searches, rank candidates or select a
match. Missing, conflicting, reused and differently numbered episode IDs have
specific next-step guidance. Every season still needs verification before approval.

Approved recovery retains fixed diagnostic codes for changed source/configuration,
missing seasons, incomplete membership, provider-read failure and timeout. Status
reads make no provider calls. Legacy generic failures remain unknown, with GitHub
report guidance; interrupted checks are unconfirmed rather than completed.
Unknown provider messages and credentials are neither persisted nor displayed.

A discovered cached-source retry gap is fixed: a failed fresh-layout read now
retains its reason and one-day cooldown. Repeated admission within the same scan
also checks the database's current cooldown. Restarting or re-reading a status
does not reset attempts. No ownership, memory, timeout or completeness guard was
relaxed. No schema migration or automatic approval/backfill is added.

## PR trial

Fresh enumeration returned two open PRs, #555 and #556. Random selection chose
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555) again at immutable
head `4cbffcb7dd726af152382a1f92edb9dc326fe349`. Its exact manifest/lockfile changes
were applied locally: `@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
Registry metadata disclosed no lifecycle scripts for either candidate.

Script-disabled installation, normal policy-controlled installation, dependency
tree validation, client typecheck and audit completed. Audit reported zero findings.
Tooling tests passed 39/40: the deployed Node-major alignment test rejected Node 26
declarations on Node 24. The original manifests/lockfile were restored, installed
and checked again: 40/40 tooling tests and zero audit findings. No PR dependency
change is retained and neither PR was merged.

## Verification

Focused backend checks passed four suites / 65 tests. Focused client checks passed
four files / 76 tests after correcting an empty-array parameterized test fixture.
Isolated PostgreSQL mapping tests passed 29 tests, including specific reasons,
legacy/interrupted state, repeated same-scan admission and restart-safe cooldown.
The Chromium mapping flow passed with intercepted fixture APIs, typed catalog
display, lost-response protection and narrow 390/320-pixel bounds.

The two changed ownership-manifest entries were individually reviewed: recovery
state remains inside `withCurrentCapture`; management changes only its read
projection, leaving revocation locking unchanged. Their analysis digests remain
unchanged. No blanket baseline refresh was performed.

Lint, both typechecks, preflight dependency checks, the reviewed ownership gate,
four policy gates, ESM gates and Markdown validation passed. The initial full
client run passed 6,672 tests and timed out in its repository-wide CSRF usage scan.
The second full run had the same result, even without a concurrent backend run.
That scan passed separately without changing its five-second limit. The full
backend run finished with 1,782 passing suites, 55,804 passing tests, one skipped
test and one failing Knip subprocess timeout. All three tests in that fixture
passed separately with unchanged limits. These timeouts occurred during overlapping
heavy local checks; resource contention remains a hypothesis, not a proven cause.
The broad backend run itself was not green.

The final complete client run passed all 453 files / 6,673 tests with a local
`--maxWorkers=2` override in 590.06 seconds. The CSRF scan passed with its original
five-second deadline; no assertions or checked files were removed. Coverage was
generated from that full run, not a targeted substitute. The coverage ratchet
passed using fresh client and backend reports: client line coverage 88.93%,
backend line coverage 89.69%. No coverage baseline was changed. Remote CI for
these commits remains separate evidence, not implied by these local checks.

## Exact-image and local evaluation

The no-cache, provenance-required build used clean runtime revision
`acebdbdd777442c45bff740967bd45532c4645e4`. Its local Docker image ID is
`sha256:4a2de5a9c8a46eb2fcc7dc806bfa9046c431b292aaec359d96145fd814c60829`.
This is a local image identity, not a published registry manifest digest.
Only this outcome document changed after the image's source commit; it is excluded
from the Docker build context. No untested runtime changes followed the build.

A private 76,873,663-byte database archive was checksum-verified and readable
before replacement. The previous image was retained for rollback. The new image's
network-isolated fresh-database fixture used 1 GiB, two CPUs and 256 PIDs. Its
schema dump exactly matched `database/schema/current.sql`; it had no invented
pending work or unresolved identities. Container and temporary data cleanup were
verified. The live test database was not used to generate the snapshot.

Only the local Classifarr Compose service was recreated, using `--no-build --pull
never --no-deps`. At 22:34:16 UTC it was healthy with HTTP 200, zero restarts and
no OOM; its 2 GiB limit, read-only root and user `1000:1000` were unchanged. The
read-only probe found ten current captures, eleven unresolved items, zero mapping
approvals and no startup warnings/errors in the inspected window. It made zero
database writes and zero provider calls. No other application was replaced.

The final Chromium run passed after the copy adjustment; the complete narrow
panel screenshot was visually inspected. Its other dashboard reads use incomplete
fixture responses and log unavailable-state messages; no live mapping was posted.
The Unraid browser tab was found, but two read-only attachment attempts timed out.
No fresh production count is claimed. This is not a published-upgrade rehearsal.

## Operator path

In Command Center, open **See items & recovery**, then **Draft a catalog mapping
(admin)** on the affected item. Check the draft structure and source/catalog
evidence. Review the displayed typed works and each excluded episode's guidance.
Do not approve until the proposal is complete and its identity is correct. Saved
mappings shows committed state and retry guidance; refreshing it does not retry a
provider or post an approval. After a lost response, read that state before acting.

## Recommendation stack

1. Keep complete typed mappings and explicit operator approval. This preserves
   grouping and auditability; individual review is still required.
2. Use the new per-item evidence and failure guidance before changing IDs. It adds
   no provider traffic to status views, but cannot make an ambiguous mapping valid.
3. Next: bounded catalog candidate discovery with visible provider provenance,
   followed by individual review of the eleven remaining items. Do not choose the
   first search hit, discard an extra ID or split a correctly grouped source show.
4. Before release, investigate timing-sensitive source-scan/Knip checks and require
   fresh CI for the exact release candidate. Do not extend deadlines to hide failures.

Unraid and shared Plex/Ollama were not modified. The local count is not a fresh
Unraid measurement. No real mapping was approved and the eleven conflicts have
not been claimed as resolved.
