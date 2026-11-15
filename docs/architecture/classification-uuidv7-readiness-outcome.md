# Classification UUIDv7 preliminary assessment outcome

November 14, 2026 (America/New_York). Bounded read-only assessment at
`46be868d175803ffc9a8578386f6c8a32c2e5fcd` plus the agreed application-only
[pending replacement repair](pending-replacement-bigint-outcome.md), following the
[assessment design](classification-uuidv7-readiness-design.md). No UUID/schema
migration, generator, public alias, dependency or operator control was added.

## Recommendation

Finish the exact-BIGINT repair and address the observed ID-boundary defects before
choosing a replacement key format. UUIDv7 can avoid numeric JSON precision loss
when carried as UUID/string values and can support independent generation. The
assessment did not establish a distributed/public-ID requirement or a performance
advantage over the existing sequential BIGINT key.

Astra independently reviewed this conclusion and the source prerequisites. A new
UUID value would still fail current numeric parsers, casts and bindings. UUIDv7
does not fix classification scoring, malformed notification conversion, uncertain
commits, replay or same-media identity on its own.

## Catalog evidence

One metadata-only integration check passed through the production database factory
and a read-only transaction on isolated PostgreSQL **18.6**. Catalog and schema
snapshot findings agree:

| Observation | Result and scope |
| --- | --- |
| History primary identity | BIGINT sequence-backed `classification_history.id` |
| Declared direct History FKs | 14 constraints referencing that table |
| Classification-named columns | 31 public columns matching the bounded classification-ID name pattern; not a complete loose-reference inventory |
| History indexes | 27 index definitions; no production size/bloat or performance measurement |
| Remaining INTEGER references | `classification_intake_receipts`, `manual_routing_check_state`, `reclassification_batch_items`, `reclassification_move_operations` |
| UUID functions | Catalog reports gen_random_uuid and uuidv7 overloads in this isolated database; not a main-runtime capability admission or generation benchmark |

The 14 direct FK sources are clarification responses, classification corrections,
embeddings, policy evaluation captures, queue witnesses, content analysis, Discord
delivery records, embedding errors, feedback review references, manual routing
checks, media requests, pattern match logs, purpose outcome supplements and webhook
logs. All source columns are BIGINT except the manual-routing state INTEGER.

March's widening migration lists nine historical FK relationships. Later schema
additions matter: October's manual-routing state again uses INTEGER. A historical
migration's list cannot stand in for the current catalog. This is a confirmed
compatibility restriction, not evidence of a production failure.

## Consumer and contract map

| Boundary | Verified current assumptions | Readiness implication |
| --- | --- | --- |
| Parser/validator | `database.mjs` returns safe numbers/large decimal strings; `databaseIntegerValues.mjs` validates decimal BIGINT IDs | UUID is a different admitted type, not a drop-in parser switch |
| Pending lifecycle | BIGINT array predicates, same-media identity lock, numeric/string notification references | Preserve replacement identity/locking; UUID does not replace the media identity key |
| Ordinary/current-review insertion | `classificationPersistenceService.mjs` returns the inserted ID; `currentPolicyReviewInsertSql.mjs` explicitly allocates the sequence and binds its text into the frame atomically | Changing the generator requires preserving atomic row/evidence binding |
| Pending/exact-memory routes | `classificationRoutePending.mjs` and `classificationRouteExactItemMemory.mjs` use Number.parseInt | Existing UUID values would be rejected or misparsed; route contracts need deliberate transition |
| Logs/retry/queue state | `logsRouteHelpers.mjs`, retry validation/services/payloads and queue handoff SQL use numeric validation/casts | Audit current BIGINT correctness separately from UUID-specific work |
| Intake receipts | INTEGER storage/casts and numeric-safe validation in the intake service/repository; reconciliation intentionally limits INTEGER range | Current schema and authority contracts require explicit work; changing History alone is insufficient |
| Queue witnesses | `classificationQueueDecisionWitnessRepository.mjs` converts to Number and rejects unsafe-range IDs | BIGINT storage alone does not prove consumer readiness |
| Feedback | Server/client feedback-review contracts already accept canonical decimal strings; review IDs separately use UUIDs | Preserve the distinction between classification row ID and review token |
| Client | API leaves often pass IDs unchanged, while needs-attention retry, refresh cursors and several manual-routing/profile props normalize/require numbers | Existing UI behavior needs a targeted consumer map, not a global ID replacement |
| Discord | Pending buttons and interaction handlers convert IDs to numbers; delivery markers/verification require decimal IDs | Existing sent messages, correlation versions and replay safeguards are compatibility surfaces |
| Ordering/maintenance | History and witness queries use ID tie-breakers; historic refresh uses BIGINT keyset cursors | UUID timestamp ordering cannot silently replace cursor, commit or recovery semantics |

Examples are source-verified in the named modules, not claims of end-to-end UUID
or large-BIGINT support. The map is bounded to the classification identity chain;
other identifier domains remain separate.

## Retained evidence and recovery

Current-review v1/v2/v3 frames bind the row ID through canonical decimal validation
in `currentPolicyReviewFrameContract.mjs`. Feedback snapshot checks compare embedded
classification IDs with column text. Purpose supplements encode those IDs in event
keys; some source provenance is protected against replacement.

Several loose links deliberately survive History retention: feedback sources,
queue routing references and intake decision context do not all have cascading
History FKs. Migrating only the 14 relational FKs would miss these references and
could change replay/retention semantics.

The configuration backup in `backupSnapshot.mjs` does not export classification
History. It can include classification evidence; `backupRestoreTables.mjs` restores
its source_classification_id unchanged. Existing configuration-ID remapping is not
History-ID remapping. A successful configuration export/restore would therefore
not demonstrate a safe History primary-key migration.

A future design must preserve old evidence rather than infer new proof by
rewriting numeric snapshots. It needs a representative full-data recovery rehearsal,
legacy reference compatibility and a defined recovery boundary after new UUID
writes begin. No such migration was attempted or validated here.

## Existing UUID precedent and official research

The isolated Ollama gateway ledger, request binding and archive repositories already
call uuidv7. That is a separate request/ownership identity domain, not evidence that
the main classification database has an admitted UUIDv7 capability. The packaged
tooling supports PostgreSQL 17 and 18; generation ownership/version compatibility
would need an explicit decision.

- [PostgreSQL 18 UUID type](https://www.postgresql.org/docs/18/datatype-uuid.html)
  documents the 128-bit type and native UUIDv7 generation. Its time ordering is
  useful compared with random UUIDs; this assessment did not benchmark it against
  sequential BIGINT. Larger identifiers do not imply a measured total index cost.
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html) defines UUIDv7 and its
  timestamp structure, and warns against using UUID possession as an access
  capability. Keep authorization and privacy controls independent.
- Existing BIGINT/JSON precision and W3C structural-metadata guidance are linked
  in the [repair research](pending-replacement-bigint-design.md#official-research-and-application-inference).
  The applicable practice is an explicit, documented identity/representation
  contract; no accessibility-conformance or security-remediation claim follows.

Sources were discovered/opened through MCP during the November 14 local assessment.

## Options, prerequisites and next step

| Direction | Appropriate benefit | Principal cost |
| --- | --- | --- |
| Exact BIGINT across existing boundaries | Reliable current single-database operations | Correct the remaining INTEGER, conversion, JSON and cursor restrictions |
| Replace current primary keys with UUIDv7 | Demonstrated independent/cross-installation identity requirement | Relational and embedded mapping, legacy messages/receipts, ordering and full-data recovery |
| Add a public identifier | Explicit external-reference requirement with stable internal joins | A second identity, resolver/compatibility rules and lifecycle maintenance |

Recommended stack: exact current row identity, complete catalog plus loose-reference
inventory, separate transport/receipt/media contracts, preserved immutable evidence,
existing authorization/replay/locking, representative recovery evidence, then an
identifier choice justified by a concrete requirement. Avoid adding an alias solely
to mask existing numeric consumers.

The preliminary work is complete for this bounded scope. Missing prerequisites for
a migration decision are the actual public/distributed requirement, deployed
PostgreSQL versions, retained History volume/write rate, acceptable upgrade downtime,
and required lifetime for existing URLs, Discord messages and receipts. None was
inferred from the isolated catalog.

Next, turn the confirmed boundary map into a prioritized correctness plan, starting
with the already reproduced malformed-notification conversion refusal. Evaluate
the INTEGER references and transport conversions as separate bounded changes.
Choose a UUIDv7 replacement or public-ID implementation only after its requirement
and compatibility/recovery contract are agreed.
