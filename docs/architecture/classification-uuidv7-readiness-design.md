# Classification UUIDv7 readiness assessment design

November 14, 2026 (America/New_York). The user requested preliminary work after
asking whether UUIDv7 would improve the pending replacement problem. This is a
bounded identity assessment alongside the agreed
[BIGINT repair](pending-replacement-bigint-design.md), not a UUID migration.

## Goal and boundary

Determine what changing `classification_history.id` would actually affect before
choosing an identifier strategy. Start with this row identity and its immediate
relational, JSON, transport, receipt and recovery consumers. Keep TMDB, media-server
item, source-library, library/policy, queue-task, Discord snowflake and review-token
identities separate. Identifying a record and identifying the same media item are
different responsibilities; UUIDv7 would not replace `pending_identity_key`.

Produce an observed inventory, alternatives, prerequisites and a recommendation.
Do not add a UUID column, generator, resolver, dual-ID API, dependency, schema,
historical remapping or operator workflow. Keep the existing repair moving through
its agreed verification and delivery.

## Evidence process

1. Record source revision and worktree scope. Inspect the authoritative schema
   snapshot and subsequent migrations; do not treat an older widening migration
   as the complete current reference graph.
2. Read catalog metadata in a read-only transaction using the production database
   factory against a fully initialized isolated integration database. Capture the
   History key/default, direct FKs and types, classification-named columns,
   indexes and UUID generator presence. Do not read production records or secrets.
3. Cross-check direct FKs against loose references and JSON fields. FK absence can
   be deliberate retention/replay policy, not evidence that a reference is unused.
4. Trace route/API input, client props/comparisons, Discord commands, queues,
   receipts, immutable snapshots, ordering/cursors and backup provenance. Separate
   current BIGINT correctness restrictions from changes needed only for UUIDs.
5. Compare retaining exact BIGINT, replacing current keys and a separately justified
   public identifier. Identify missing requirements and evidence before any choice.
6. Ask GPT-6 Astra to review uncertainties and the recommendation. Its source
   review does not substitute for catalog execution or a migration rehearsal.

This is a preliminary inventory of a defined identity chain, not an exhaustive
whole-platform dependency graph, security assessment or measured production sizing
study. Report catalog counts with their exact query scope.

## Decision prerequisites

Choose UUIDv7 only for a demonstrated requirement, such as independently generated
cross-installation record identity. Document whether the identifier is internal,
public or both. Public exposure still requires normal authorization and privacy
decisions; UUIDv7 carries an observable timestamp.

Before implementation, settle generation ownership and supported PostgreSQL
versions, current/retained History volume and write rate, legacy URL/Discord/receipt
compatibility, historical mapping semantics, acceptable upgrade downtime, resource
limits, mixed-version operation and recovery after new-format writes begin.

Keep frozen evidence and tombstones trustworthy. A column remap alone cannot
upgrade old numeric snapshots or authenticated receipts into UUID-bound proof.
Preserve each reference's retention behavior and independent uniqueness boundary.
Do not use UUID timestamp order as commit order, replacement authority or replay
proof. Scope any versioned contract transition explicitly.

## Verification required for a future migration

A future implementation design would need a representative full-data restore
rehearsal, schema/loose-reference/JSON integrity checks, legacy and new command
interoperability, replay and uncertain-commit controls, concurrent replacement,
cursor/order compatibility, performance measurements and an explicit recovery
boundary. A configuration export is not automatically a complete History backup.

Any intentional operator action belongs in existing application workflows with
bounded automatic execution, status and authorization. Do not require a recurring
operator CLI procedure. Developer-only catalog/test tools are acceptable evidence
interfaces, without becoming a product migration trigger.

## Deliverable and current recommendation

Record findings separately in the [assessment outcome](classification-uuidv7-readiness-outcome.md).
Use the existing exact-BIGINT repair for the demonstrated problem. Decide the next
identity strategy from actual requirements and consumer compatibility, rather than
adding another identifier system solely to avoid Number coercion.
