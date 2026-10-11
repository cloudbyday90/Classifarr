# Episode review context outcome

Work date: 2026-10-11. Starting main revision:
`ed3e6936b8f4142288029540c928ac724b489ad9`. All seven workflows for that exact
starting revision passed. This is development work, not a release or an Unraid
deployment. See the [design, research and tradeoffs](episode-review-context-design.md).

## Findings and implementation

Fresh bounded, read-only local checks still found the two previously checked
single-candidate gaps: 155/156 episodes covered for one series and 135/136 for
the other. The first source title is generic, while a named catalog special is
available at a different position. The second source title names a reunion, but
the proposed catalog season ends one episode earlier and has no specials season.
Netflix describes that reunion as a separate publication; this is an explanation
to investigate, not a verified replacement catalog ID. Neither check approved a
mapping, refreshed Plex metadata or changed Unraid.

Added optional source-title context to human episode mapping reviews. A small ESM
projection module retains bounded display text, separate from structural source
identity. Existing source-page reads supply the titles only when requested for
human preview/approval. Ordinary captures do not retain them. Only requested rows
are returned; no opaque source keys, filenames or raw provider payloads are added.

The review displays source and typed catalog target together, escapes markup,
marks unavailable source titles explicitly and warns that titles are not identity
proof. The context is bound into human-review fingerprints and rechecked before
approval. Changed displayed context requires a fresh confirmation. Legacy scope
fingerprints, saved structural layout digests, sync admission and backfill remain
unchanged. No migration, automated real-item approval, new retry or relaxed guard.

## Independent random PR trial

Fresh enumeration found open #555 and #556; the random selection again chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact server declaration
change locally: `@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0.
The final trial manifest range and lock entries matched that patch. Initial
lock generation had scripts disabled; reviewed `npm ci` and full tree checks
passed. Candidate registry metadata declared no lifecycle scripts or peers.
All-dependency npm audit reported zero advisories across 725 dependencies; this
does not establish general dependency safety.

Server typecheck reproduced the Discord/Undici FormData/File incompatibility.
Tooling passed 39/40, with the Node 24 major-alignment guard rejecting Node 26
declarations. Restored the exact original manifest/lockfile and reinstalled;
both workspace typechecks and all 40 tooling checks then passed. No PR merge,
dependency change, type cast or relaxed guard remains. Fresh outdated metadata
also identified Zod 4.6.6; keep that separate from this identity change.

## Verification

- Initial regression reproduced eight missing-context failures, with 54 tests
  passing, before implementation.
- Expanded backend regression: 319 tests in 14 suites passed. Focused coverage:
  147 tests in six suites passed, 98.68% statements/lines, 93.82% branches and
  100% functions across the four selected production modules. The new projection
  module has 100% in all four metrics.
- Frontend: 72 tests in two files passed. Scoped changed-file coverage: 96.49%
  statements, 96.20% branches, 90.90% functions and 100% lines. These are scoped
  reports, not a new full-workspace coverage or ratchet claim.
- Isolated PostgreSQL: 35 recovery tests passed, including stale title rejection
  without an approval write, complete owned materialization, repeat sync and
  revocation. A final stricter error-code assertion is checked before commit.
- Chromium: all three scenarios passed (36.6 seconds), covering keyboard-only
  consent, escaped source titles, 320/390-pixel reflow and unresolved-count
  preservation. Visually inspected the narrow review panel. Unrelated dashboard
  endpoints intentionally lack synthetic fixture data; their unavailable messages
  are not production failures.
- Full lint, both workspace typechecks, copyright, unchanged ownership gate,
  normal/production dependency analysis, ESM and all four policy-language gates
  passed. No security/coverage baseline was refreshed or weakened.

## Local image and handoff

The requested clean-commit no-cache build, local replacement and subsequent
isolated schema dump are pending at the implementation checkpoint. Their exact
results will be recorded in the documentation handoff commit. Do not infer image
or final-commit CI success from the starting revision's green runs.

## Recommendation stack

1. Use source and typed target context to guide review. Benefit: fewer blind
   coordinate-only decisions. Limitation: titles may be generic, stale or wrong.
2. Verify actual episode identity and explicitly approve only supported mappings;
   let complete owned sync/backfill apply them. Benefit: preserves grouping and
   provenance. Cost: human review remains necessary for missing provider IDs.
3. Keep missing catalog entries and incomplete grouped shows unresolved; investigate
   the separate reunion target and remaining season identities before expanding
   supported mapping types. No arbitrary substitute ID or cross-type coercion.
4. Review Zod 4.6.6 as the next small dependency batch. Keep Node 24 declarations
   until an intentional, separately tested runtime migration.
