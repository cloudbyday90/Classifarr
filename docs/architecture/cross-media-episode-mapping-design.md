# Cross-media episode mapping design

Date: 2026-10-11. Development on main; no release or production recovery.

## Problem and boundary

A source TV episode can correspond to a standalone catalog movie. Numeric movie
and TV episode IDs are different namespaces. The reunion candidate found during
the previous investigation is not proof of the local file's identity. Miraculous
stays unresolved until the operator verifies it. No real approvals in this work.

Preserve source grouping and library placement. Extend explicit episode decisions
with the disjoint shape `{ sourceSeason, sourceEpisode, tmdbMovieId }`, alongside
the existing six-field TV episode shape. Movie exceptions require explicit season
scope, never whole-series identity. Reject mixed/unknown fields, duplicate source
positions, reused typed targets, incomplete groups and ambiguous source IDs.

Operator decision: preserve placement and exclude movies from TV learning. This
is a consumer contract, not approval of any particular episode's identity.

Use a typed movie details read, not a TV episode lookup with the same number.
Display both source and catalog titles and the movie type. Titles remain context,
not proof. Bind fresh movie details and displayed source context into the existing
evidence fingerprint. Require separate human confirmation of all exceptions.

## Recovery and consumer contract

Admission remains active administrator + fresh stored source version + existing
preview lock + current configuration. Approval re-reads source/catalog and commits
only under the existing transaction locks; no HTTP inside the transaction.
Every source episode must be accounted for before a group can be approved.

Owned sync keeps the source item typed TV with no scalar TMDb parent ID. Store
movie documents as explicitly typed, review-only references without descriptions.
Only verified TV-season documents may enter the TV description corpus. Do not
use the movie as TV-learning evidence, infer a movie-library membership, reroute
files, update Plex/Emby/Jellyfin, or synthesize an episode ID. Existing scalar
consumers continue to exclude the null-parent scoped item.

At most 64 human exceptions, four total catalog works and 32 total season/movie
documents per checked scope. Existing 90-second operation deadline, bounded
provider HTTP reads, 2,000 source episodes, 10,000 catalog episodes, cancellation,
20 layout reads/four catalog admissions per sync and durable one-day cooldowns
remain. No new scheduler, retry loop, migration, cache or provider write.

Malformed/missing targets remain unresolved. Transient provider failure and
unknown errors use existing sanitized diagnostics and persisted retry budgets.
Source-layout/configuration changes require fresh review; revocation invalidates
only inventory carrying that mapping receipt. Uncertain approval responses require
checking saved mappings, never automatic resubmission. Fresh installs do no work.
Older binaries cannot approve this new shape; rollback with these mappings must
be treated as unsupported recovery, not as proof of compatible materialization.
The source season still needs a valid TV-season mapping. Movie-only source seasons
absent from every proposed TV work need a separate design; do not invent seasons.

## Research and alternatives

Official sources discovered and opened through MCP on 2026-10-11:

- [TMDb search and details](https://developer.themoviedb.org/docs/search-and-query-for-details)
  separates finding a candidate from reading typed movie details.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  addresses TV seasons by series and season. Inference: movie identity must not
  be substituted into episode membership.
- [OWASP authorization patterns](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Patterns_Cheat_Sheet.html)
  calls for service-level enforcement and re-evaluation when the resource changes.
- [W3C G168](https://www.w3.org/WAI/WCAG22/Techniques/general/G168)
  describes confirmation that explains the selected action and consequences.
  Apply this guidance; do not claim full WCAG conformance from one technique.
- [DefinitelyTyped versioning](https://github.com/Definitelytyped/DefinitelyTyped)
  aligns declaration major/minor versions with the represented library.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Typed reviewed exception, no TV learning | Preserves grouping and catalog identity | Requires actual human verification | Implement |
| Movie ID in episode field | Small apparent change | Cross-type corruption | Reject |
| Teach movie placement as TV evidence | Fewer exclusions | Pollutes future classification | Reject by default |
| Require source reorganization | Simpler catalog relationship | Changes operator's source grouping | Not required |

Stack: typed proposal → fresh evidence and explicit consent → owned complete sync
→ TV-only evidence projection. Test same-number movie/episode IDs, malformed and
missing targets, stale evidence, revocation, repeat sync, cancellation and real
PostgreSQL corpus exclusion. Browser tests cover explicit target type, confirmation,
escaping and narrow-screen use. No real item approval is part of verification.

## Independent PR trial

Fresh enumeration found #555 and #556. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Trial client Node declarations
26.6.4 / undici-types 8.9.0 using pinned Node 24.21.0 and npm 12.2.0. Review the
lockfile, lifecycle metadata, normal install, typecheck, audit and toolchain guard.
Restore if incompatible; do not merge, weaken guards or change the runtime.
