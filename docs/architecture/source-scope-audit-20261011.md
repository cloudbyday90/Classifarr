# Remaining source identity conflicts — 2026-10-11 audit

## Method and boundary

Follow-up to the [candidate lookup design](source-candidate-lookup-design.md).
The fresh local read-only database check at 09:16:59 UTC found eleven unresolved
items: nine source-review and two retry-wait. This is not a fresh Unraid count.
No identity, mapping, retry state, shared provider or production database was
changed. Private titles, identifiers and provider payloads remain in ignored local
diagnostics, not the repository.

Use existing bounded source-layout and typed catalog evidence services. Compare
exact episode IDs and season membership, not title similarity or artwork. Single
declared-series proposals retain source season numbers. Grouped-source inspection
is limited to declared parent candidates, at most four works, 32 catalog seasons,
10,000 catalog episodes and 90 seconds. Database reads use read-only transactions
with statement/lock deadlines. Diagnostic membership is not an approval receipt:
the actual approval flow repeats source/catalog reads and revision checks.

## Findings

| Category | Items | Evidence and next action |
| --- | ---: | --- |
| Complete proposed single-series membership | 7 | All 489 local episodes match their declared TMDb series; conflicting parent identifiers still require explicit identity approval and fresh evidence |
| One episode lacks external IDs | 1 | 155/156 match; one source episode has no TMDb, IMDb or TVDB episode ID. Inspect that specific source record |
| One declared episode is outside proposed catalog scope | 1 | 135/136 match; compare that episode's typed identity and source/catalog freshness, without guessing a replacement |
| Incomplete grouped-source coverage | 2 | One of three source seasons and one of four source seasons respectively match the declared candidate worksets; later seasons remain unverified |

Descriptions and artwork are present but do not resolve these identity conflicts.
The grouped audit does not prove that catalog records are absent everywhere: it
only proves those episode IDs are absent from the bounded declared-candidate
worksets. Missing or stale source external IDs and alternate catalog organization
remain hypotheses until the specific records are checked.

## Official references and recommendations

Sources discovered and opened through connected search tools on 2026-10-11:

- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  scopes a season request to a particular series and season number.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) distinguishes
  title search from lookup using an existing external identifier.
- [Plex TV naming and organization](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)
  describes ordering differences and per-show ordering choices. This is a reason
  to inspect exact episode evidence, not to force a correctly grouped source to split.

Recommended stack: first seek explicit approval for the seven complete proposals,
then repeat the normal fresh evidence/approval flow if authorized. Next investigate
the two single-episode gaps, then locate exact typed works for the grouped seasons
using episode external IDs. Keep all incomplete items unresolved. This costs more
review than accepting the first parent ID, but prevents a partial mapping from
looking complete or contaminating downstream evidence. Do not reset imports,
discard conflicting IDs automatically or weaken ownership/memory safeguards.

At the time of this audit, no real mapping has been approved and the count remains
eleven. Automatic materialization/backfill may follow an explicitly approved,
fully verified mapping through normal owned sync; it is not implied by this audit.
