# Runtime-aligned Node declaration policy outcome

Date: 2026-10-12. Baseline: main
`ef2b35615982745cf879ce6f98b41be107a56a35`.
No release, version bump, production deployment or manual PR state change.

## Change

Both npm workspaces now exclude only routine major `@types/node` proposals.
Patch/minor updates remain eligible. The rule uses `update-types` without a
`versions` restriction, preserving security-only eligibility according to the
inspected upstream implementation and tests. Account-level security settings were
not changed or audited; this is not a claim that a hosted security job ran.
The existing client TypeScript 7 exclusion remains unchanged.

Eight new ESM tests parse the actual YAML using the server's existing `js-yaml`
dependency. They protect the exact rules, workspace coverage, schedules, groups,
PR limits, absence of broader restrictions and the independent runtime guard.
No new package, production service or schema migration was needed. See the
[design and source rationale](dependabot-node-runtime-policy-design.md).

## Random PR trial

Fresh enumeration returned two open PRs, in order #558 and #556. A Node crypto
random draw returned index 0, selecting
[PR #558](https://github.com/cloudbyday90/Classifarr/pull/558), immutable head
`a32e85effe1aaf9f30265363ad09fa978279c2d8`.
Its exact client manifest/lockfile patch was applied locally: Node declarations
24.19.2 to 26.6.4, and undici-types 7.24.6 to 8.9.0. Registry metadata showed no
new lifecycle scripts or extra dependency paths. The newer registry release
26.6.5 was not substituted for the selected PR.

Strict clean installation, full dependency-tree validation, full npm audit
(including development dependencies; zero reported advisories) and both Vue
typecheck scopes passed. The runtime-alignment test rejected Node 26 declarations
on Node 24: 40 of 41 tooling checks passed. Passing compiler checks did not prove
runtime compatibility. No guard was weakened to accept the PR.

The exact trial patch was reversed, followed by a clean reinstall. Final client
manifest and lockfile have no diff from baseline. The restored tree, full audit,
all 41 tooling checks and both Vue typecheck scopes passed. The PR remains
unmerged; no dependency changes from it are retained. After the policy push,
GitHub recorded `dependabot[bot]` automatically closing #558 at 12:05:49 UTC.
No merge or manual close action was performed. New policy-triggered Dependabot
jobs started; their eventual update proposals require their own review.

## Validation

The eight policy tests and six existing security-workflow tests passed together
(14 tests, two suites). Two deliberate YAML mutations were independently rejected
with exit 1: adding a minor-update exclusion and adding a future-version range.
After restoring the intended policy, all 14 tests passed again. These local
checks validate repository configuration, not a simulated Dependabot engine.

Client lint, backend test lint, backend typechecking and dependency analysis
passed. Local checks use Node 24.21.0 and npm 12.2.0 with existing strict
lifecycle-script decisions. Markdown checks passed for 2,129 files and copyright
checks passed for 1,591 files. The staged secret scan found no leaks.

The complete restored frontend suite passed 458 files / 6,890 tests with no skips
or failures in 399.53 seconds, using two workers and unchanged test deadlines.
Coverage: statements 87.33%, branches 81.07%, functions 87.04%, lines 89.08%.
The production frontend build and all eight isolated Chromium route/asset/history
checks passed. These passing runs do not diagnose or fix the previously observed
intermittent timeout.

The coverage ratchet passed without baseline edits. It used the fresh frontend
report and the unchanged backend runtime's existing October 12, 05:59:50 Eastern
report (SHA-256
`4b39222137f36440d2543be344ca920c38d820e245c0bd7b247ed73afc87d244`).
Only the focused backend suites ran afresh in this batch; no fresh complete
backend coverage run is claimed.

## Local baseline

The pre-rebuild read-only probe at 11:56:10 UTC reported 6,836 classifications,
coverage of 10/10 active libraries, four unresolved identities (two source review,
two retry wait), zero pending text embeddings and 6,814 pending image embeddings.
The ten-item batch contained ten unique items. One existing
`cached_vectors_incomplete` warning was present. This policy work does not repair
that application condition or approve identities. The probe made zero writes or
provider calls.

A 75,889,159-byte local database backup passed checksum and archive-readability
checks. The current image
`sha256:6d0a373e62d91859646506b51bf362be03ad1c3a2527e0e47b21cf5d48b90c82`
is retained as `classifarr:pre-memory-0f03df21-011a-4052-8a24-68a85597f39f`
for exact rollback. The backup remains private under ignored `.tmp/`.

## Local image and schema verification

The no-cache Compose build succeeded from clean implementation commit
`c1a44eb8850def07349d3aa62981f685096d565b`, producing local image ID
`sha256:4292b08b40d5c42f40468892baa58e579fb7ba03f78fcf3c75f5e3aec2ccf1b2`.
The OCI revision and running container image were verified against those exact
values. This is local image evidence, not a published multi-platform digest or
signed provenance claim. A documentation-only follow-up records these results.

Only local Classifarr was recreated, with no pull or dependency recreation.
It is healthy, returns HTTP 200 from `/health`, has zero restarts and no recorded
OOM kill. UID/GID 1000:1000, read-only root filesystem, `no-new-privileges` and
the 2 GiB limit are unchanged. The unrelated local container was not modified.
Unraid and shared Plex/Ollama configuration were untouched.

At 12:03:49 UTC, the post-rebuild read-only probe returned the same classification,
library coverage, unresolved-identity and embedding counts as the baseline.
The ten-item batch was unique and read in 6 ms. The bounded startup-warning query
was empty at that time; this does not prove the earlier cached-vector condition
is repaired. The probe again made zero writes or provider calls.

After rebuilding, the schema dump ran against a fresh, network-isolated database
from the exact new image (1 GiB, two CPUs, 256 PIDs, ordinary entrypoint).
Migrations through `20261010_220000_source_catalog_mappings.sql` and 22 seed
migrations produced an unchanged `database/schema/current.sql`. Fresh-database
checks found no invented classifications, pending work, images or unresolved
identities. The owned fixture container and its data directory were confirmed
removed; retained backups and application data were not deleted.

The baseline commit's [CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/38244074139)
completed successfully, including database tests, fresh-install/published-upgrade
checks and the acceptance readout. Release/publishing jobs were skipped as
expected on main. That run is for the preceding commit, not this new policy;
the new push requires its own CI result. No release is authorized or created.

## Available updates and next item

Fresh `npm outdated --json` results show no root updates. Both workspaces have
Node declarations 24.19.2 installed and wanted, versus latest 26.6.5. The client
has TypeScript 6.0.3 installed/wanted versus latest 7.0.2; its existing compiler
compatibility restriction remains intentional.

Two compatible-range candidates remain: Vue Router 5.3.1 to 5.4.0 in the client,
and Zod 4.6.5 to 4.6.6 in the server. These are available updates, not findings of
vulnerability or completed compatibility reviews. Next, review Zod 4.6.6 as a
separate validation-boundary batch, including upstream changes, malformed-input
rejection and existing route/schema contracts. Then review Vue Router separately
with navigation and production route/asset checks. Neither upgrade is part of
this policy change.

Intermittent frontend timeout diagnosis still needs a captured slow phase before
choosing a fix. A passing rerun does not establish its root cause. Memory limits,
background recovery, identity approvals and shared providers remain unchanged.
