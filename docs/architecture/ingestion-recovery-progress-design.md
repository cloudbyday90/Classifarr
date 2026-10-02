# Recovery-to-completion tracking

## Decision and completion contract

Track **import and metadata only**, as selected by the operator. Optional
embeddings, RAG, model evaluation and AI jobs do not gate completion. Preserve
existing ownership, explicit confirmation, retry, source and inventory safeguards.

Add a small recovery-progress row per retained audit receipt. Its request identity
survives owned import retries even though each attempt gets a new run ID. Record
import completion in the same transaction as the owned scan's finalization.
Enqueue-pass completion is necessary, but never sufficient, for recovery success.

An existing refill invocation verifies at most one due recovery. It first records
a 60-second cooldown, then checks the still-current run under a short transaction
and nonblocking library owner lock. Database statements have a three-second bound.
No provider calls, new timer or externally deployed service are introduced.

Completion requires a complete full capture, no unresolved/omitted source identity
evidence, the committed backfill enqueue pass and a consistent metadata snapshot:
every supported inventory item has completed enrichment evidence (or the existing
metadata-only, provider-disabled exemption), with no active metadata tasks or
pending/processing retries. Failed unresolved work remains blocked. Optional AI
tasks are excluded. An empty, explicitly completed source can complete with zero
items; a missing capture or missing verification cannot.

The snapshot is verification at a recorded time, not a promise that metadata can
never change again. A newer scan/recovery or changed source supersedes an unfinished
operation; its later progress cannot be attributed to the old request. Historical
completed receipts retain their verification. Older receipts lacking an explicit
tracking link remain **not tracked**; timestamps are not used to invent ancestry.

## Storage, access and resource boundaries

- Progress rows cascade with the existing retained audit receipt and library.
  No inventory is deleted, no new retention period or cleanup service is added.
- Exact library/run predicates fence updates. Receipt creation, superseding prior
  unfinished recovery and tracking insertion commit atomically.
- Existing history GET remains on demand, administrator/actor/library scoped,
  read-only and no-store. It returns allowlisted counts, stages and timestamps;
  source configuration and raw metadata remain server-side.
- Source identity includes server/library IDs, media type and a server-side
  SHA-256 fingerprint of provider type, endpoint and credential. Enable/disable
  toggles pause the same recovery rather than changing its identity. The digest
  is a change detector, not authorization or a credential replacement.
- The verifier uses the existing refill execution path and durable due index.
  No tracked demand means no inventory scan. One aggregate per due recovery
  filters by library and returns counts, not an in-memory item list.
  Large libraries may hit the statement deadline and remain unverified; never
  substitute guessed completion. Measure this before adding incremental cohorts.
- The UI uses a compact stage label, metadata progress bar when a denominator is
  known, last-checked time and one next step. Unknown is not zero percent. Native
  progress/text and a polite summary retain keyboard and screen-reader access.

## Alternatives and recommendation stack

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Match receipts to later scans by time | No schema change | Wrong attribution across retries and multiple requests | Reject |
| Treat enqueue completion as recovery success | Cheap | Pending, deferred and failed metadata looks successful | Reject |
| Add a new workflow engine/worker | Rich execution history | New deployment, concurrency and retention obligations | Defer |
| Correlate existing lifecycle and verify current evidence | No Compose changes; bounded demand-driven work | One small ledger; metadata aggregate cost | Implement |

Recommended stack: PostgreSQL receipt-linked progress + existing owned import
transactions + existing refill cadence + bounded metadata verifier + read-only
history projection + small Vue progress component. Do not expand routing authority.

## Official sources

Discovered through online search and read on **2026-10-01** for the requested
September baseline; current pages are not claimed to be archived September copies.

- [PostgreSQL concurrency consistency](https://www.postgresql.org/docs/18/applevel-consistency.html)
  explains explicit locking and snapshot limitations. Keep run/configuration
  fences and short transactions; a query result is evidence at its snapshot.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  supports short, appropriately isolated database work. Read-only history and
  committed verification have different transaction responsibilities.
- [AWS idempotent API design](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/?did=ba_card&trk=ba_card)
  motivates explicit intent identifiers and atomic recording, not timestamp-based
  inference or a new identity for each retry.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  and [progress announcements](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA25)
  support concise programmatic status without moving focus. Progress bars alone
  do not announce updates; keep meaningful text alongside them.
- [PostgreSQL binary-string functions](https://www.postgresql.org/docs/18/functions-binarystring.html)
  documents built-in SHA-256 and hex encoding; no extension is needed for the
  internal source-change detector.
