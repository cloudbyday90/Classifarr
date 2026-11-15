# Pending notification ID matching outcome

November 14, 2026 (America/New_York). Implemented the agreed
[design](pending-notification-id-matching-design.md) on main. This follows the
[exact-ID lifecycle repair](pending-replacement-bigint-outcome.md); it adds no
UUID migration, release or deployment.

## Behavior and boundaries

Pending replacement now compares the notification's extracted classification ID
as text against the lifecycle's already validated canonical predecessor list.
The small `pendingDecisionNotificationSql.mjs` leaf retains the existing filters
and read timestamp behavior, strips leading ASCII zeroes and uses exact C
collation. It performs no numeric conversion of notification data.

An unrelated digit-only value beyond BIGINT range previously raised `22003` and
rolled back a valid replacement before its insertion callback. The old-code
regressions reproduced this for both active statuses. The repaired transaction
completes while leaving the malformed notification's payload, read flag and
timestamp unchanged. No production occurrence or durable corruption was proved.

Successful legacy matches remain: ordinary numbers/strings, arbitrary zero
prefixes and exact large numeric/string IDs through BIGINT maximum. JSONB's
extracted representation still governs numeric exponent and decimal-scale
behavior. The new code does not normalize signs, whitespace, decimal strings or
other invalid forms into IDs. Zero cannot match a positive predecessor.

The complete predecessor list is still validated before mutation. The same
transaction/client and single parameter array execute the notification UPDATE;
there is no added query. Identity/row locks, History writes, successor links,
callback result types, bypasses, timestamps and failure handling are unchanged.
Genuine SQL failures still roll back. A lost COMMIT acknowledgement remains
unknown and is not replayed. Notification matching grants no command authority.

Malformed records are retained, not repaired or deleted. There is no new length
cutoff, index or constant-time claim: long text still requires scanning. Other ID
consumers, retry cleanup and historical migration SQL remain separate.

## Verification

- Baseline: three existing unit suites passed 128 tests; a separate isolated
  PostgreSQL diagnostic passed 42 matching/baseline checks. The two new
  replacement regressions failed against the old production SQL before repair.
- Focused final checks: five suites passed 184 tests, including lifecycle,
  persistence, ID admission and ownership-gate controls.
- Production-factory PostgreSQL: five suites passed 146 tests. The new 44-case
  suite covers malformed/oversized values, 64-KiB prefixes/digits, JSONB spelling,
  exact neighboring large IDs, read timestamps and real callback/backlink SQL
  rollback. Existing suites retain concurrent replacement, late notification
  locking, delayed/lost COMMIT acknowledgement, HTTP/read-state and completed
  answer replay controls.
- Fresh backend coverage passed 1,954 suites and 63,973 tests with one existing
  skip. Statement/branch/function/line coverage is 89.35/86.86/90.91/89.35 percent.
- The full browser sweep passed 105 tests. A fresh production build and its
  eight browser controls passed without changed assertions, retries or deadlines.
- Client coverage was reused only after verifying unchanged relevant source,
  installed graph and the coverage report hash. Its 488-file report retains
  7,587 passing tests and 87.93/82.17/87.71/89.61 percent statement/branch/function/
  line coverage. The cross-workspace client fixtures do not reach this runtime
  leaf or the reviewed ownership metadata.

The combined coverage ratchet passes with these settled reports. The earlier
interrupted backend attempt is not counted as a result. Markdown checks pass for
2,559 documents with zero errors.

All ordinary quality checks passed, with the ownership check rerun after its
explicit review. Extracting the statement exposed an existing scanner limitation:
the imported SQL argument is unresolved static analysis. One source/analysis
digest was added under the existing `analysis_debt` review with that classification
preserved. Existing entries, parser pin, baseline, protected relations and the
100-review limit remain unchanged. This is not a claim of scanner-proven ownership.

Root and client npm audits report zero findings. The server retains five known
LOW findings from the existing Jest/deepmerge chain; no scanner severity,
exception or expiry was changed. No dependency or toolchain was updated.

## Research, alternatives and recommendation

The separately researched [design](pending-notification-id-matching-design.md#official-research-and-independent-review)
links the official PostgreSQL evaluation, string, collation and JSONB contracts,
and the applicable W3C representation guidance, discovered through MCP in
November 2026. Astra independently supported the canonical-target text approach
and reviewed the implementation and limited ownership metadata update.

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Another AND guard around numeric conversion | Small apparent change | Does not establish safe evaluation order |
| CASE plus input/range validation | Can fence conversion | More validation and conversion dependencies |
| Canonical target text with zero-prefix removal | Removes the failing operation and preserves successful matches | Requires the existing validated positive target contract; still scans long text |
| Rewrite or delete malformed notifications | Could simplify stored data | Different retention/compatibility scope with unnecessary data changes |

Recommended stack: validate the entire predecessor list, retain the existing
transaction and filters, compare exact trimmed text in the small SQL leaf,
preserve malformed records, and keep genuine failures and uncertain commits
truthful. The existing application path runs this automatically during pending
replacement; operators need no new page, setting or CLI trigger.

## Delivery, maintenance and next item

No PR was open at intake or delivery recheck. No closed PR was reused, PR merged
or unrelated/fresh branch rebased. Separate design/outcome documents and an
Unreleased note accompany the change. Delivery uses main and exact-source CI
verification, without a release or deployment.

Local artifact maintenance preserved recovery/reference assets, current evidence,
toolchains, registered worktrees and shared resources. No asset was verified
stale/disposable, so no deletion or reclaimed-capacity claim is made. The final
inventory retained 27 containers, 493 image/tag entries and four worktrees on the
same pinned daemon. Container identities, image references, start times, state
and observed health were unchanged. Shared cache, volumes and other projects
were untouched.

The next bounded item is the analogous notification predicate in retry-artifact
cleanup: it still casts IDs to INTEGER and accepts both `classificationId` and
`classification_id`. Establish its producer, match and retention contracts before
removing that conversion; do not copy the pending-only predicate without those
checks. Historical upgrade SQL and the broader INTEGER/API/receipt/Discord and
UUIDv7 readiness boundaries remain separate.
