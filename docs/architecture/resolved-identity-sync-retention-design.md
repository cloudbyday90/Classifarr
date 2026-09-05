# Resolved identity retention during source sync

## Decision and alternatives

The current sync upsert replaces a resolved TMDb ID with null when a later
media-server response omits it. Retaining every old ID with `COALESCE` would
instead carry identities onto changed or reused source items.

Record server-owned resolution provenance when the existing queue resolver or
administrator confirmation writes an ID. Retain it on omission only while the
typed source identity remains continuous. Keep this logic in small ESM modules,
using the existing JSON metadata storage and PostgreSQL concurrency controls.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Always overwrite from source | Simple | Erases resolved IDs and causes repeated enrichment/review | Replace |
| Always retain nonnull IDs | Low repeat work | Can associate a reused source item with the wrong work | Reject |
| Require operator confirmation on each sync | Explicit oversight | High recurring operational burden | Reject |
| Retain attributable IDs with continuity checks | Automatic and conservative | Legitimate metadata corrections can require fresh resolution | Implement |

Recommended stack: validated source identifiers → attributable typed resolution
→ source-continuity decision → conditional atomic upsert → existing enrichment
and profile-refresh lifecycle. Add no classification or routing authority.

## Ownership and continuity

Store `metadata.tmdb_identity_origin` with a version, resolution method, typed
TMDb identity, and a compact source anchor. The source anchor contains the media
server and external item key, media type, normalized title, year, and normalized
IMDb/TVDB identifiers. It contains no credentials, plots, or provider URLs.
Incoming source metadata cannot supply or replace this record.

Retention requires the same source key and type, equal normalized titles, no
contradictory known year or external IDs, and either an equal known year or a
shared IMDb/TVDB identifier. Validate the provenance against both the stored row
and incoming source. Preserve known anchors through later omissions and add new
consistent anchors; do not forget an ID and then accept a conflicting one.

Source-provided valid TMDb IDs remain authoritative. Preserve local provenance
when the source agrees with that same ID and continuity still holds. Otherwise
discard the old provenance. Changed types, IDs, or continuity invalidate cached
enrichment associated with the old source. Update the stored media type as well.
Existing background enrichment can then resolve the new source without new
operator setup; ambiguous cases keep the existing abstention/review behavior.

Legacy resolved rows without an attributable anchor are not grandfathered into
retention. If their source ID disappears, existing enrichment resolves them
again before new provenance can be recorded. This avoids fabricating historical
source continuity. Identical replacement items with indistinguishable anchors
cannot be detected from this metadata alone.

## Concurrency and provider validation

Capture caller input before asynchronous work. Read the current row and its
`xmin` revision, compute the decision in ESM, and use `ON CONFLICT DO UPDATE`
with that revision as a compare-and-swap guard. A concurrent insert or update
causes a bounded re-read/recompute, not a stale overwrite. Three unsuccessful
attempts leave the current row intact for a later sync. No network calls occur
inside a transaction or a row lock held for sync analysis.

Queue resolution captures the source identity fields before provider calls.
It replaces queued title/year/external identifiers with the current row and
cannot resurrect a queued TMDb ID that the source row has since lost.
Its ID/provenance write checks those fields together, allowing unrelated rating
or enrichment updates while rejecting source changes. Administrator confirmation
continues to use its existing transaction, source locks, expiring preview, and
audit receipt. Keep the origin write atomic with the identity write.

Normalize whole provider identifiers rather than accepting numeric prefixes.
Malformed or conflicting provider declarations make the source item ineligible
for sync persistence; a later valid source response can recover automatically.
Use bound SQL, fixed reason codes, and no user-controlled query fragments.

## Official research

Sources were discovered through MCP/web tools and checked on September 5, 2026,
for the requested August 2026 baseline. Living pages are not claimed to be
archived August snapshots.

- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
  documents atomic upsert behavior and conflict-update conditions. Use its
  conflict row lock and a revision predicate to protect the ESM decision.
- [PostgreSQL system columns](https://www.postgresql.org/docs/18/ddl-system-columns.html)
  describes `xmin` as a row-version transaction identity. Use it only as a
  short-lived equality token, not a permanent monotonic ID.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) describes provenance through
  entities, activities, and derivations. Record which resolution produced the
  retained identity and the source evidence it depended on, without claiming
  RDF serialization conformance or human-label authority.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends both syntactic and semantic checks. Apply whole-value identifier
  validation and continuity checks; valid syntax alone does not establish that
  two source snapshots describe the same work.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data)
  distinguishes search from lookup using external IDs. Continue using the
  existing typed resolver and its ambiguity checks rather than new fuzzy rules.

## Validation

Test omission, repeated omissions, added/lost/conflicting anchors, source moves,
type changes, reused keys, malformed identifiers, caller mutation, legacy rows,
stale provider responses, concurrent resolution, and concurrent sync writes.
Use real PostgreSQL and rollback-isolated local Compose assessments. Record
results and the next item in a separate outcome document. No release is created.
