# Episode gap diagnosis outcome

Observed on 2026-10-11 (America/New_York). This is local development work, not a
release or an Unraid deployment. See the [design](source-episode-gap-design.md).

## Findings and implementation

Bounded local reads used PostgreSQL read-only sessions, a 10-second statement
timeout, a one-second lock timeout, the existing source-evidence advisory lease,
and configured providers only. No approval, library rematch or provider write
was performed. The four unresolved source conflicts were not hidden or reset.

| Checked single-candidate scope | Source evidence | Catalog evidence | Interpretation |
| --- | --- | --- | --- |
| 155 / 156 episodes matched | S5E27 has no supported external IDs in list or detail | Season 5 ends at episode 26; a same-titled special exists at S0E2 | Ordering discrepancy is plausible; title alone is not identity proof |
| 135 / 136 episodes matched | S10E13 supplies TMDb and TVDB IDs; detail agrees with list | Season 10 has 12 episodes; no specials season; TVDB lookup returns no match | Catalog evidence does not verify the source reunion record |

These observations do not prove why the catalog lacks an entry, whether it was
deleted, or which provider has the correct ordering. They do rule out the narrow
hypothesis that the source list omitted IDs available from item details for these
two records. Private source IDs, filenames, provider bodies and credentials are
not committed. Current Unraid data was not inspected or changed.

The application now projects source-ID presence and exact proposed catalog
position from the already validated scope reads. Per-episode review gives
specific source/catalog next steps without another HTTP request. Numbering alone
cannot supply an ID or increase the matched count. Client parsing checks the
target against the declared whole-work or season proposal and rejects malformed
included reports. Old servers can omit the added projection.

The implementation is library-agnostic ESM and uses small deterministic modules.
No migration, automatic retry, new cache, approval authority or backfill admission
was added. Complete membership, source/configuration freshness, parent-ID checks,
explicit approval, ownership and memory safeguards remain unchanged.

## Random open PR trial

Fresh enumeration found two open PRs; random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`.

Locally applied its exact server `@types/node` 24.19.2 to 26.6.4 and undici-types
7.24.6 to 8.9.0 change. The generated lock diff contained only those two packages;
the reviewed strict lifecycle policy remained enabled. Registry metadata declared
no candidate lifecycle scripts or peer requirements. Fresh server outdated output
showed Node types as the only outdated package (wanted 24.19.2, latest 26.6.5).

- Installation and complete dependency-tree validation passed.
- npm audit, including development dependencies, reported zero advisories at
  trial time; this is not a general safety guarantee.
- Server typecheck failed at the Discord delivery boundary: incompatible Undici
  `FormData`/`File` declarations, including `webkitRelativePath`.
- Tooling checks: 39 / 40 passed; Node 26 declarations failed the Node 24 runtime
  alignment guard.
- Restored the exact original manifest/lockfile and reinstalled. No dependency
  changes or PR merge remain. No guard, type assertion or peer policy was weakened.

Recommendation: defer this major declaration update to an intentional Node-runtime
migration; its benefit does not justify incompatible build-time API assumptions.

## Verification

Verification is in progress. Focused checks so far: 91 backend tests in five
suites, 76 frontend tests in three files, and 45 isolated PostgreSQL tests in two
suites passed. Backend/client typechecks, full lint, copyright, ownership,
dependency analysis, four policy gates, ESM checks and Markdown lint passed.
All 40 tooling checks passed on rerun; an intermediate offline installer fixture
hit its unchanged 30-second subprocess timeout while other checks were running.

Both Chromium scenarios passed with one worker (42.9 seconds), including keyboard
activation, narrow reflow, incomplete approval refusal and unchanged unresolved
count. A taller 320-pixel screenshot of the new gap panel was visually inspected.
Other browser runs hit the unchanged 30-second deadline during initial page load
under concurrent checks; final lower-contention verification is still pending.
No timeouts or assertions were weakened. Full coverage and the requested
exact-image no-cache rebuild/schema dump must finish before final handoff.

## Recommendation stack

1. Retain the precise episode diagnostics. Benefit: actionable evidence without
   new provider load. Limitation: upstream metadata remains unresolved.
2. Verify the apparent regular-episode/special ordering difference using typed
   provider identity evidence. If confirmed, design explicit **episode-level**
   exceptions that preserve grouping; a whole-season remap would affect unrelated
   episodes and is not an adequate repair.
3. Investigate the unmatched reunion's catalog record separately; do not invent
   an ID or reinterpret an empty external-ID lookup as a successful match.
4. Establish parent-ID equivalence before an unattended recovery/backfill design
   with durable provenance, complete coverage and idempotent upgrade behavior.
5. Review the bounded tooling queue separately; retain Node 24 declarations now.

Final recommendation: improve diagnosis now, verify the missing identity evidence
next, and keep unresolved data visible until a justified repair is possible.
