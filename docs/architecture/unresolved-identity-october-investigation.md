# Twelve unresolved source identities: investigation

## Follow-up — 10 October 2026

The exact-alternative-title fix has now recovered the title/year case locally
through normal scheduling, including metadata backfill. Eleven local conflicts
remain; the unchanged Unraid deployment still displays twelve. The new
[cross-reference diagnostic](source-identity-cross-reference-outcome.md) separates
missing catalog mappings from contradictory results without selecting an ID.
The findings below describe the original twelve-item snapshot.

## Read-only findings — 9 October 2026

The same twelve TV titles were confirmed in the local database and the Unraid
Command Center's expanded item list. Local queries used PostgreSQL read-only
sessions and bounded statement/lock timeouts. Twelve sequential, bounded Plex
item reads then verified the source record and library before counting distinct
provider IDs. No import, recovery, metadata refresh, catalog edit or production
database mutation was requested by the probe.

All twelve current Plex records have a description and poster. All twelve also
have conflicting external IDs. The warning is **not** evidence that Plex has no
metadata, and it is unrelated to ingestion ownership or dotenv.

| Current source evidence | Items | Recorded recovery result |
| --- | ---: | --- |
| One TMDb, one IMDb, two distinct TVDB IDs | 9 | Insufficient independent evidence; no catalog attempt needed |
| Two TMDb, one IMDb, one TVDB ID | 1 | Independent evidence inconclusive; durable retry wait |
| Three TMDb, one IMDb, one TVDB ID | 1 | Independent evidence inconclusive; durable retry wait |
| Two TMDb, one IMDb, one TVDB ID | 1 | Independent result rejected by title/year validation |

Unraid independently displays ten source-review items and two waiting retries,
matching the local categories. Its retry timestamps differ, as expected for
separate databases and schedules. The source conflicts were still present in
fresh Plex reads; rebuilding Classifarr does not remove them. Production was
inspected through its existing authenticated UI, not by claiming a remote SQL
query occurred. Private titles, source IDs, credentials and provider payloads
are intentionally absent from this repository document.

## Why the current behavior is conservative

The [existing self-healing design](source-identity-self-healing-design.md)
requires unique independent evidence for TV, agreement with a declared TMDb
candidate, title/year validation and an unchanged source digest. Nine items
fail before catalog calls because their TVDB identity is ambiguous. The other
three have a stored catalog-verification outcome; this investigation did not
force another attempt or reset the one-day cooldown.

The title/year outcome does not establish which field differs or prove the
Plex match is wrong. Alternate catalog titles can require investigation. Likewise,
multiple external IDs do not alone prove a corrupt Plex installation: catalog
cross-links or record grouping may be involved. Choosing the first ID, ignoring
TVDB conflicts or relaxing title matching would erase evidence, not resolve it.

## Operator guidance and next work

Start in Command Center → Metadata issues → See items & recovery. Inspect the
affected title's match and external IDs in Plex, not just its artwork or summary.
[Plex's official Fix Match documentation](https://support.plex.tv/articles/201018497-fix-match-match/)
describes correcting a genuinely wrong match. Use it only when the intended match
has been established; an already correct visible match may still have conflicting
catalog links. No bulk refresh or rematch was performed here.

The follow-up [provider guidance design](source-identity-provider-guidance-design.md)
uses the already stored rejection provider; it needs no new capture or migration.
A bounded read-only check of the title/year case found the year agrees and the
source title exactly matches a TMDb alternative title, but not its primary or
original title. The strict matcher currently reads only primary/original titles.
This is a Classifarr acceptance limitation, not proof that the source match is wrong.
No ID was selected, cooldown reset or catalog changed during the check.

The original recommended next item was a bounded, read-only identity diagnostic that shows
which provider conflicts and distinguishes missing evidence from contradictory
evidence. Investigate the title/year rejection against verified original or
alternate catalog titles separately before proposing any change to acceptance.
Avoid promising that a metadata refresh will fix upstream catalog links.

| Option | Benefit | Drawback |
| --- | --- | --- |
| Keep generic wording | No behavior change | Suggests missing metadata and leaves the operator guessing |
| Add provider-specific, read-only explanations | Actionable evidence without choosing an identity | Needs a small privacy-reviewed diagnostic contract and tests |
| Automatically choose/ignore a conflicting ID | Removes the count | Can misidentify series; reject |

Recommendation stack: retain the identity guard and durable retry budgets;
improve provider-specific explanations; investigate verified title alternatives;
repair upstream matches only with item-specific evidence. Memory safeguards,
ownership fencing, routing and backfill behavior remain unchanged.

Research used official Plex support retrieved through MCP on 9 October 2026.
The official PMS API landing page was discovered but could not be opened by the
research service; it is not represented here as successfully retrieved evidence.
