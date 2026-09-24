# Durable reclassification move recovery: design

Status: implementation design, Unreleased, September 24, 2026. This follows
[correction outcome capture](correction-outcome-capture-outcome.md). The separate
[outcome document](reclassification-move-recovery-outcome.md) records verification.

## Problem and boundary

Reclassification previously copied/deleted files, updated Radarr or Sonarr, and
then committed history and correction evidence. Its rollback helper only logged.
A database failure or lost HTTP response could therefore strand an already-moved
item. Missing remote items were incorrectly treated as successful moves, and TV
lookup incorrectly fell back from TVDB to TMDB IDs.

This change makes that existing, explicitly requested movie/TV workflow durable.
It does not authorize new routing decisions, move music, backfill historical
operations, deploy code, or create a release. Recovery never starts a file move
from a stored intent and never automatically deletes a remaining copy.

## Decision

Use a small PostgreSQL operation journal and the existing scheduler, not a new
broker. A session advisory lock serializes foreground moves and recovery. A
persisted reservation survives connection loss and process restarts. One pending
operation per history row and remote resource prevents conflicting moves.

| Boundary | Evidence and behavior |
| --- | --- |
| Before filesystem effects | Persist typed identity, mapping/config revision, paths, classification revision, and source content digest. |
| File movement | The original request alone calls the existing verified copy/delete implementation once. |
| Recovery verification | Require source absent, destination content matching the recorded digest, unchanged mappings, and matching remote identity. |
| Remote path update | Accept only recorded old/new paths; use `moveFiles=false`, then independently read back path and quality profile. |
| Database completion | Lock history and journal; commit history, correction/evaluation evidence, and completion atomically. |
| Ambiguous state | Preserve the journal, stop automatic effects, and explain what must be inspected. Same-target retry rechecks evidence, not files. |

No fake physical rollback is promised. Content digests are streamed and bounded
by entry count, depth, and verification time. Symbolic links, root directories,
overlapping paths, cross-instance moves, unknown identities, and changed metadata
are rejected. API credentials are read from current configuration, never stored
in the journal. Path plans are private operational data, not public logs.

Recovery checks one due operation per five-minute tick, with exponential retry
delay capped at one hour. Completed journals expire after 30 days, 100 per tick.
Unresolved journals retain their reservation; a 1,000 unresolved-operation cap
stops new moves rather than discarding recovery evidence. Identical failures do
not generate another warning on every tick. An unavailable remote service is
retryable; contradictory evidence requires investigation.

The content-witness budget is 10,000 entries, depth 32, and five minutes per
fingerprint, checked during traversal/streaming. This is a cooperative budget,
not a hard timeout on a stalled filesystem syscall. Large or slow TV folders can
exceed it; they are not declared successfully moved. Repeated full-file hashing
costs I/O. A later optimization should reuse verified copy manifests without
weakening ownership checks. Libraries must be quiescent during a move: the lock
coordinates Classifarr instances, not unrelated filesystem writers. Radarr/Sonarr
updates have a final identity/path read guard, but no cross-system atomic CAS;
concurrent external edits remain a limitation, not a claimed exactly-once remote
transaction. Corrections and operation completion are atomic only in PostgreSQL.

## Official research and tradeoffs

Sources were discovered and opened through online tools on September 24, 2026.

- [Microsoft compensating transactions](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)
  explains why cross-system compensation needs durable progress and
  application-specific, repeatable operations. Blindly restoring old state can
  overwrite concurrent changes. Here, verified forward completion is preferred
  to an unproven reverse filesystem operation.
- [Radarr's official movie controller](https://github.com/Radarr/Radarr/blob/develop/src/Radarr.Api.V3/Movies/MovieController.cs)
  queues a separate command when `moveFiles=true`; accepting a path update is
  not evidence that files moved. Retaining Classifarr's file mover and explicitly
  disabling remote file movement avoids introducing a second mover.
- [PostgreSQL 18 advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  provide cross-session serialization, but do not make remote effects atomic.
  The durable reservation and evidence checks cover that separate boundary.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports bounded identifiers/reason codes instead of credentials, arbitrary
  remote error payloads, or full configuration in recovery logs.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) informs the distinction between
  intended activity and observed outcome. This journal is not a PROV serializer
  or a claim of standard conformance.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  informs the follow-up UI: report recovery status accessibly without moving
  focus. No new dashboard or accessibility conformance claim is added here.

| Option | Benefits | Costs / decision |
| --- | --- | --- |
| PostgreSQL journal + verified forward recovery | Reuses installed infrastructure; survives restart; avoids duplicate corrections. | Extra content verification I/O; serialized moves; ambiguous copies still need inspection. Recommended. |
| Automatic reverse copy/delete | Could restore original placement. | Risks deleting valid concurrent changes; requires stronger ownership and compensation proofs. Not adopted. |
| External workflow engine | Mature workflow timers and histories. | New service, operational complexity, and still needs idempotent filesystem boundaries. Not justified for this bounded workflow. |

Recommendation stack: durable move intent → content/identity verification →
bounded forward recovery → atomic correction outcome → compact actionable status
in existing history/batch views. Routing quality evaluation remains a separate
consumer of explicit correction outcomes, never proof of physical movement.
