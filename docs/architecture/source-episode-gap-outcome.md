# Episode gap diagnosis outcome

Observed on 2026-10-11 (America/New_York). This is local development work, not a
release or an Unraid deployment. See the [design](source-episode-gap-design.md).

Follow-up: [reviewed episode mappings](reviewed-episode-mappings-design.md) adds
the explicitly requested human-decision path without modifying shared Plex.

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

Local verification is complete. Focused checks: 91 backend tests in five
suites, 76 frontend tests in three files, and 45 isolated PostgreSQL tests in two
suites passed. Backend/client typechecks, full lint, copyright, ownership,
dependency analysis, four policy gates, ESM checks and Markdown lint passed.
All 40 tooling checks passed on rerun; an intermediate offline installer fixture
hit its unchanged 30-second subprocess timeout while other checks were running.

Both Chromium scenarios passed on the final one-worker run (28.8 seconds), including keyboard
activation, narrow reflow, incomplete approval refusal and unchanged unresolved
count. A taller 320-pixel screenshot of the new gap panel was visually inspected.
Other browser runs hit the unchanged 30-second deadline during initial page load
under concurrent checks. Fixture-only unavailable dashboard responses remain
visible in the test log; they are not evidence of a production outage.

An initial full frontend run passed 454 files / 6,793 tests but failed to start two
workers, so its coverage was not accepted. A one-worker retry then exceeded the
existing lint-contract setup deadline and was stopped before completion. The
Windows validation host had approximately 630 MiB free during concurrent runs.
This is evidence of a constrained validation environment, not proof about the
application's historical memory warnings. No deadlines or assertions were
weakened. The final complete frontend run passed after the competing backend/build
workloads finished.

Full backend coverage subsequently passed: **1,790 suites**, **56,031 tests
passed**, one existing skip (56,032 total), in 1,936.815 seconds. Statements/lines
89.70%, branches 86.09%, functions 91.10%. The new backend episode-gap classifier
has 100% statement, branch and function coverage.

The final one-worker frontend run passed **456 files / 6,818 tests** in 901.37
seconds. Coverage: statements 87.21%, branches 80.92%, functions 86.80%, lines
88.99%. The combined backend/client coverage ratchet passed against the unchanged
baseline. These are local results, not remote CI or release acceptance claims.

## Exact local image and schema

- Clean code commit: `57a9c82039f62462c85b83cd690f724afefdb473`.
- No-cache rebuilt image:
  `sha256:44ed828072fb4c25bb99922d0659c37c327d50d30cf934326e5781de9ebd129d`.
- OCI revision matched the clean commit. This is a local Docker identity, not a
  published multi-platform artifact or signed release-provenance claim.
- The subsequent verification handoff is documentation-only; the running image
  remains bound to the code commit above. No version, release or tag was created.
- Previous image retained:
  `sha256:044a85c9123ba948e1408d95e9523ee536b77d29bd7449aef023b44e69132e31`.
- Pre-replacement local archive: 74,832,679 bytes; checksum and `pg_restore --list`
  verified. Backup and rollback tag remain locally.
- Replaced only local Compose using `--no-build --pull never --no-deps`; normal
  entrypoint, authentication, resource limits and safeguards retained. Healthy,
  zero restarts; startup `2026-10-11T12:56:05.069107678Z`.
- After rebuilding, `dumpSchema` ran from that exact image against a disposable,
  network-isolated database, bounded to 1 GiB / two CPUs / 256 PIDs. Schema stayed
  unchanged through `20261010_220000_source_catalog_mappings.sql`, with 22 seed
  migrations. Fresh database had zero invented unresolved or pending work. Its
  owned temporary container and data directory were removed; absence verified.

At **08:59:34 EDT**, rebuilt-image read-only diagnostics reproduced both gaps and
their new projections: `none`/`absent` for S5E27, `tmdb`/`absent` for S10E13.
Transient references: `e8c192ff-aaae-49c4-9735-b8338b733b27` and
`c50309bb-0c45-4a63-a949-bd7f3de9eb15`. Multiple-candidate conflicts were not
arbitrarily reduced to one proposal. Before/after: four unresolved items, zero
probe approvals and zero probe provider writes.

At **08:59:36 EDT**, all seven previously approved mappings remained materialized
with historical application dates and no pending recheck marker. All ten active
libraries were covered. Five status reads took 244.92, 8.33, 6.80, 6.44 and 11.12 ms;
this small observation is not a benchmark. A separate database-only consumer
check confirmed consistent pending totals and a distinct bounded embedding batch.
No WARN/ERROR rows were recorded since startup in this short window; that does
not establish resolution of unrelated long-running comparison/memory problems.

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
