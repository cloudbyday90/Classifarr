# Offline migration source and copy outcome

Date: 2026-10-05. Design and researched alternatives are in
[the source/copy design](offline-migration-source-design.md).

## Implemented

- Small ESM modules now validate the original stopped PG18 cluster, join the
  bounded control-data reader, register protected source provenance and copy only
  an admitted, unpublished candidate. The journal retains source identity across
  restarts rather than learning it from the converted candidate.
- Resumption rejects lost provenance, changed original content/cluster/OS identity,
  unsafe candidate trees, insufficient disk space, later phases and selection.
  Files and directories are synced before digest verification. Cancellation never
  advances the phase; native filesystem work still needs the caller's join policy.
- The existing disposable migration rehearsal now uses these modules. It kills
  real workers after source registration and after a partial copy, then resumes.
  Its partial-copy fault deliberately writes the first two tree entries before
  process death; it is not production behavior. Separate negative checks alter
  only synthetic provenance/source files and verify the candidate is unchanged.
- Reviewed ownership entries describe this coordination; no ingestion writer debt
  was waived. No API, UI, dependency, schema, saved-template or entrypoint change.

## Validation

Focused backend checks passed: 6 suites, 135 tests; one directory-fsync test is
Linux-only and skipped on Windows. The first full run passed 1,698 suites and
52,779 tests, with only the expected stale ownership-review gate failing. Its
reviewed entries were then updated. The final full run passed all 1,699 suites:
52,783 passed, one Linux-only skip. Backend lint/typecheck, copyright, ownership
review, both dependency gates, Markdown lint, ESM import/mock checks and staged
Gitleaks scan passed. Actual image results are recorded after the rebuild.

No real library recovery, source mutation, credential rotation or Unraid update
was performed. This component does not yet remove `legacy_owner_unknown` warnings.

## Random open PR trial

Fresh CLI enumeration returned open PRs #555 and #556; a `crypto.randomInt` draw
selected [#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`.
The exact two-file patch changes `@types/node` 24.19.1 to 26.6.4 and
`undici-types` 7.24.6 to 8.9.0. Registry versions, dependency metadata and lockfile
integrities matched the proposed patch.

Applied locally without merging: dependency-tooling tests went from 30/30 to
29/30 because the Node-24 type/runtime alignment assertion rejected Node-26 types.
The patch was reversed and manifests/locks remain unchanged. This is a tested
compatibility rejection, not a runtime installation or adoption of the PR.
Keeping runtime and declarations aligned avoids advertising APIs absent in the
supported runtime; the tradeoff is postponing the major type update.

## Recommendation stack

1. Keep durable source registration and resumable whole-cluster copy. It preserves
   the original and makes interrupted work explicit, at the cost of extra disk,
   sequential hashing and offline time.
2. Next replace fixture-only account/layout and policy/role provisioning with
   bounded production modules, preserving supported database/vector tuning.
3. Integrate the trusted root bootstrap and rehearse upgrades from the published
   old image before activation. Forced-non-root legacy templates retain their
   current compatible path; this work does not require editing them.
4. Enable unattended ingestion recovery only after database-enforced old-writer
   isolation is proven. A missing PID, record age or advisory lock is insufficient.

The recovery skill kept source preservation and explicit refusal conditions in
scope; the release-evidence skill keeps local image tests separate from published
upgrade evidence. No release is created.
