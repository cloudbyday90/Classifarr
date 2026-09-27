# Source enumeration completeness — outcome

## Implemented

The importer no longer equates an empty/defaulted array or a short page with a
complete library. Provider envelopes retain offset, total and stable source-key
evidence independently of normalized media. Plex headers and body counts must
agree when both are present. Emby/Jellyfin requests explicitly ask for totals.
Music and other supported-by-the-provider but out-of-scope types remain ignored;
a missing media type now defers the scan instead of impersonating ignored audio.

Small ESM modules separate response validation, enumeration accounting and typed
failures. Both media and collections require successful enumeration before the
existing owned finalization transaction can prune or declare the capture complete.
Collection transport failures propagate rather than masquerading as empty lists.
Actual returned counts determine subsequent offsets, not the requested page size.

| Source result | Stored data | Completion and recovery |
| --- | --- | --- |
| Short page, consistent total, more items remain | Import validated items | Continue at actual next offset |
| Missing/malformed response, duplicate IDs, changed total or premature empty page | Preserve existing records and any valid partial writes | Fail capture; durable cooldown and replay from zero |
| Missing optional total | Retain useful partial ingestion | Withhold completion, pruning and learning readiness |
| Collection failure after media import | Preserve media and collections | Withhold finalization; retry the whole scan |
| Affirmative zero total and empty page | No new records | Normal complete-empty reconciliation is allowed |
| Complete media and collection enumeration | Normal upsert/recovery | Owned, source-fenced, atomic pruning and completion |

Request/response pages are limited to 1,000 items. Each enumeration is bounded to
10,000 pages and 1,000,000 unique keys; counts must fit a nonnegative signed 32-bit
integer. Oversized or non-progressing sources defer rather than bypass limits.
Invalid enumeration objects cannot recover themselves into a completion receipt;
a retry creates a new enumeration under the normal ownership lifecycle.

## Diagnostics and safety

Contract warnings use the existing in-process throttle with a library/reason key
and a requested 24-hour window; this is not durable deduplication across restarts. They
identify the media/collection phase, requested offset, previously observed total
and safe recovery guidance. No raw provider response, source keys, titles or
credentials are added to these warnings. The existing sync record retains a safe
failure message and the existing ingestion ledger retains cooldown/progress.
Successful in-memory enumeration receipts are included in the completion log;
this change does not add a durable receipt table or claim an atomic source snapshot.

For a repeated warning: inspect its library, phase and reason; check source server
availability/version and pagination behavior; let the scheduled replay run after
cooldown. Do not clear inventory to force completion. Optional totals can be absent
in valid upstream APIs: the stricter completion rule is our safety policy, not proof
that the provider is broken. A stable count cannot detect every concurrent upstream
edit, and an always-missing total will not self-heal merely by retrying.

The authenticated public REST/client shapes, database schema, routing and release
version are unchanged. Array-returning provider helpers remain available for a
single page, but malformed pages and collection request failures now reject.
The synthetic upgrade handoff adapter was updated to supply explicit page evidence.
Automated tests use synthetic providers and disposable databases, not live data or AI.

## Verification

- Focused adapter/orchestration and completeness tests exercise malformed counts,
  unknown totals, header conflicts, unsupported media, missing types, invalid keys,
  repeated pages, count changes, bounded enumeration and legitimate empty sources.
- Three disposable-PostgreSQL integration suites: 48 tests passed, including
  preservation, cooldown, full replay, learning deferral, short media/collection
  pages, empty replay, session loss and recovery-to-learning handoff.
- A separate read-only compatibility probe checked one configured Plex movie
  library and one TV library, using four bounded GET requests (two-item pages).
  Both media and collection endpoints supplied offset and total evidence. An
  empty collection response omitted its array but explicitly reported size and
  total zero, which the parser supports. Only count/shape diagnostics were printed;
  no credentials, titles or item IDs were exported. This is not an exhaustive
  version/provider compatibility claim. No application data or settings were written.
- Backend lint and both workspace typechecks passed; lint retains one unrelated existing warning
  in `captureOperatorCorrectionFrozenPolicy.mjs` (non-literal filesystem path).
- CI preflight passed: copyright, ownership drift and both dependency checks.
  Five new dependency pins retain the existing 474 unresolved ownership paths;
  passing drift review is not a repository-wide safety certification.
- Full frontend coverage: 397 suites / 5,573 tests passed. Statements 85.87%,
  branches 78.33%, functions 85.33%, lines 87.85%.
- ESM static-import/mock-shape checks and migration/schema integrity passed.
- Full backend coverage: 1,497 suites / 44,801 tests passed in 1,257 seconds.
  Statements/lines 90.31%, branches 84.65%, functions 92.28%.
- The unchanged coverage ratchet passed using fresh reports for both workspaces.
  The final ownership-gate unit repeat also passed (39 tests).
- Markdown validation passed across 1,575 files.

Two GitHub MCP open-PR queries returned no open PRs in this repository. No closed PR
was substituted and no PR was merged. This work stays under **Unreleased**, with no
release or local container replacement.

## Recommendation and next item

Keep validated provider pages → bounded enumeration → existing owned transaction
→ durable retry/readiness gating. This avoids another workflow dependency while
protecting destructive reconciliation. Its cost is stricter completion requirements
and bounded in-memory key tracking. See the separate
[design and official research](source-enumeration-completeness-design.md).

Follow-up implemented: [owned source preflight and compatibility canaries](source-enumeration-preflight-outcome.md).
The bounded check now runs before capture creation, reports actionable failures and
rechecks on eligible attempts. It observes actual behavior rather than certifying a
provider-version matrix. The original verification above describes this earlier
change; first-page failures now avoid partial writes through the preflight.
