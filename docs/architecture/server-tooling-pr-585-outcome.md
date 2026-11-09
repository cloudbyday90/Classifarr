# Server tooling PR 585 assessment outcome

Date: November 9, 2026 Eastern. Baseline main 4a6d345db.
Agreed [design and trade-offs](server-tooling-pr-585-design.md).
Status: locally qualified; implementation delivery and exact-source CI are in progress.
No release or deployment.

## Actual local update

Uniform selection from open PRs [587,585] at 20:57:26.315 UTC chooses PR 585,
reviewed at immutable head bd25a3f3212d1e6e3774850a4658a07f7965a49f.
The server now directly pins Globals 17.14.0 and Knip 6.44.1 exactly. The provider
PR remains unmerged.

Scripts-disabled lock generation changes only the root declarations and the
Globals/Knip package entries. Registry integrity matches both entries. Runtime
records, OXC parser 0.155.0, native platform graph, smol-toml 1.9.0 override,
ESLint/Knip settings and lifecycle decisions remain unchanged. Strict clean
installation succeeds: 631 packages added, 632 audited.

## Real consumer results

Before the update, all four new Knip cases fail against the installed 6.44.0 CLI:
member and destructured import().then() callbacks in normal and production modes
miss the unused sibling. Static and awaited-import controls correctly retain used
exports and report their unused siblings; stderr is empty. The earlier private
three-module reproduction independently records the same two missed forms.

After installation, all four cases pass with exact expected export findings.
Existing missing-import, dependency, tagged-export, entry, invalid-config and
cold/warm-cache controls also pass. Four focused suites pass 38 tests.
Repository normal/production gates pass both with their configured cache and
through separate uncached CLI runs; no new exclusion is added.

The awaited-import source fragment is stored as explicit plain-text fixture data.
The source checker had mistaken its inline text for an import in the test module.
Generated fixture bytes are verified identical, the checker is unchanged, and
the corrected real-CLI suite passes. The preliminary coverage run is stopped;
the final coverage run starts only after this source correction.

Globals' actual configured Node map retains all 81 entries and values. Actual
ESLint accepts known Node globals and still emits the exact blocking no-undef
diagnostic for an undefined sentinel. This is compatibility evidence; no new
server global or Node support is claimed. Security-rule severities remain intact.

Knip 6.44.2 is independently available. Its additional parser 0.156.x and plugin/
script work are outside the reviewed immutable PR. Official comparison finds no
blocking reversal or security fix requiring its adoption in this batch.

## Quality and evidence reuse

Root/server/client full dependency trees pass. Development-inclusive audits report
root zero, client zero and the same five existing low server affected nodes in
the deepmerge/Jest chain, with zero server moderate/high/critical findings.
These audits do not clear the separate global npm or embedded Node residuals.

Lint, server/client type checks, 107 dependency-tooling controls, both Knip modes,
ownership, all four policy gates, ESM and copyright checks pass. The copyright
check covers 1,850 files. Fresh final backend coverage passes 1,933 suites /
62,796 tests, with one existing skip, in 726.65 seconds: 89.28% statements/lines,
86.72% branches and 90.81% functions. All 7,405 frozen non-Markdown inputs remain
unchanged through that run. The current-report coverage ratchet passes.

All 2,900 qualified production server files retain their prior bytes. The only
non-Markdown changes are the two manifests, two test modules and one text fixture.
No application runtime consumer is modified.

The prior qualified client source/report inputs are unchanged (1,228 checked
inputs). All 15,353 current client files, including installed packages, source,
configuration, coverage and build artifacts, match the pre-update byte snapshot;
there are no symlinks. Reuse the prior 486-file / 7,557-test client coverage,
production build, eight production-browser and fourteen shared-form checks.
They are not described as rerun locally. Keep the existing broader startup-browser
debt explicit; no assertion, timeout or application syntax is weakened.

## Corrected next-step premise

Fresh official research still finds no published corrected Node 24 or newer npm
artifact. Current pins and residuals remain. The existing zlib outcome records
the updated availability check and actual bundle versions.

The [consumer trace](compatibility-purpose-consumer-boundary.md) corrects six
queued-task references: the identified purpose/compatibility omission belongs to
post-choice learning provenance. Provider prompts consume different packets;
introducing native-purpose terms requires a new representation and disclosure
decision. This batch changes neither consumer, numeric scoring nor learning
authority. Historical implementation/test receipts remain intact.

## Delivery and next recommendation

Maintenance reuses the recent reviewed inventory on the pinned Docker daemon.
All three protected services retain exact identities/start times/state/health;
four worktrees remain unchanged. No current Knip fixture directory remains after
the completed tests. No new image is built locally, and no verified stale file/
image qualifies for retirement. Zero assets are removed; recovery/reference
images, tools, volumes, shared cache and other projects remain protected. About
1.06 TB is free on C:; global space changes are not claimed as cleanup savings.

Exact-source CI and commit/push identities remain to be recorded. Leave PRs
unmerged; rebase only genuinely stale applicable branches.
No operator CLI trigger, UI, schema, job, provider call, live configuration write,
release or deployment is added.

Retain the bounded compatible tooling updates. Next security item: assess the
actually published Node 24 security artifact, then a verified npm bundle repair.
Next classification planning item: choose a provider-prompt evidence contract
separately from post-choice learning provenance. Do not implement either under
the former misleading prompt-cleanup label.
