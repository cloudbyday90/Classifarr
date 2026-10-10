# Source candidate lookup — outcome

## Diagnosis and implementation

Implemented on `main` on 2026-10-10 without a release or version bump. The
[design](source-candidate-lookup-design.md) records the contract, official TMDb,
W3C and DefinitelyTyped research, alternatives and tradeoffs.

The read-only local database check at 23:09:07 UTC found eleven unresolved items:
nine source-review and two retry-wait, across ten current library captures. A
bounded read of all eleven Plex records confirmed descriptions and artwork on
every item. Nine declare two TVDB IDs; two grouped shows declare multiple TMDb
series IDs. Existing metadata is not proof those identifiers describe one work.
This is a fresh local measurement, not a fresh Unraid measurement.

Command Center's mapping draft now offers **Find candidate IDs**. Opening the
draft makes no request. An explicit lookup reads source-declared identifiers,
returns typed catalog titles/dates and shows each candidate's provenance. Missing
matches, missing details, unsupported TVDB movie lookups and other-scope matches
are distinct. Episode, season and person IDs cannot become whole-work candidates.

The small ESM projection, orchestration, API, parser, composable and UI modules
do not select a result, alter draft fields, approve a mapping or clear the count.
Current active-administrator checks, CSRF, no-store, bounded sequential reads,
shared review locking, fixed failure messages and cancellation remain mandatory.
All three media-server identity adapters reject redirects; Emby/Jellyfin now
expose the same transient source fingerprint already used by Plex. No ownership,
memory or complete-season safeguard is relaxed. No schema change, background
work, persistent cache, automatic approval or new backfill is added.

## Separate PR trial

Random selection from the two open PRs (#555 and #556) chose
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Its exact manifest and lockfile changes
were applied locally: server `@types/node` 24.19.2 → 26.6.4 and `undici-types`
7.24.6 → 8.9.0. Registry integrity values matched, with no candidate lifecycle scripts.

Script-disabled and policy-controlled installs, dependency-tree validation and
audit completed; audit found zero advisories. The trial failed server typecheck
in the existing Discord delivery body contract (incompatible Undici `FormData`)
and passed only 39/40 tooling tests: Node 26 declarations violate the deployed
Node 24 alignment guard. The trial was reverted, not merged. Reinstalled Node 24
declarations pass typecheck, all 40 tooling checks and a zero-finding audit. No
dependency change is retained and no check was weakened.

The same inventory found Express 5.2.1 → 5.3.0 and Knip 6.40.0 → 6.41.0 available
within existing ranges. These are deferred, separate update candidates, not
claimed compatible upgrades. `npm outdated` is not a vulnerability assessment.

## Verification

Initial focused backend checks passed seven suites / 131 tests; client checks
passed three files / 50 tests. Final focused backend checks passed six suites /
137 tests, including actual source HTTP redirect rejection and the ownership gate.
Isolated PostgreSQL checks passed two suites / 44 tests: lookup contention uses
the shared advisory lock, retained observations remain unchanged, and existing
mapping recovery/cooldown contracts remain intact.

The Chromium mapping flow passed with intercepted synthetic APIs. Keyboard
lookup, typed provenance, unchanged draft/count, explicit approval separation and
390/320-pixel reflow passed. The narrow candidate panel screenshot was visually
inspected. Other dashboard fixture reads deliberately lack complete responses;
their unavailable-state console messages are not live application failures.

Lint, server/client typechecks, development/production dependency checks, ESM
gates, copyright and Markdown validation passed. The ownership gate detected the
two adapter edits before their review. Only those exact source digests were
updated after reviewing the new fingerprint projection and redirect refusal;
neither changes ingestion SQL or ownership. Their analysis digests are unchanged.

Broad coverage, exact-image evaluation and post-build schema evidence are recorded
below after completion; focused tests are not a substitute for those checks.

## Operator path and recommendation stack

1. In Command Center, open **See items & recovery**, expand **Draft a catalog
   mapping (admin)**, then choose **Find candidate IDs**. Inspect provenance and
   identifier results before entering a TMDb ID in the draft. This reduces blind
   ID entry but still requires human identity review.
2. Keep the existing evidence check and explicit approval. Grouped shows remain
   unresolved until every source season is verified. Lookup agreement alone is
   not approval, completion or permission to discard another identifier.
3. Next, review the eleven conflicts individually using these results. Investigate
   missing external-ID catalog mappings separately from contradictory whole-work
   matches; do not choose the first title hit or split a correctly grouped show.
4. Before release, trial Express and Knip separately and require current CI for
   the exact release candidate. Keep Node declaration/runtime majors aligned.

No real mapping has been approved by this change. Unraid and the shared provider
configuration are unchanged; the eleven conflicts are not claimed resolved.
