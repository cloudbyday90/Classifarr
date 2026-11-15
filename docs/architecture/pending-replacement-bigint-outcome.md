# Pending replacement BIGINT outcome

November 14, 2026 (America/New_York). Implemented on main from
`46be868d175803ffc9a8578386f6c8a32c2e5fcd`, following the confirmed
[design](pending-replacement-bigint-design.md). No release or deployment.

## Result

Pending replacement now retains exact classification row IDs instead of rounding
large predecessors through Number. Existing safe IDs remain numbers; larger
predecessor IDs remain canonical decimal strings. The same exact list reaches
History updates, notification read tracking, the insertion callback, forward
metadata and the returned predecessor list.

New reverse links use validated JSON scalars. Small production IDs remain JSON
numbers and large IDs are JSON strings, so both lifecycle links survive ordinary
JSONB parsing. The fresh insertion result is validated inside the transaction
without changing any valid callback value or type. Invalid predecessor lists fail
before mutation; invalid inserted IDs fail while rollback remains available.

The implementation adds a small `pendingDecisionRowIds.mjs` leaf that reuses
`canonicalDatabaseBigintId`. The lifecycle service uses it at the two transaction
boundaries and binds JSON.stringify output as JSONB for the reverse link. The
production persistence callback, global parser and media identity builder are
unchanged. There is no new schema, endpoint, page, job or operator procedure.

Preserved behavior includes identity-first advisory locking, row locking, update
order, transaction isolation/limits, the active-identity unique index, retained
History rows, existing notification read times and late-notification protection.
Completed/missing-identity/no-transaction bypasses retain their prior behavior.
Scoring, routing/learning authority and provider work remain at their current
owners. Existing failures and uncertain commits are not reclassified as success
and are not replayed.

## Evidence and verification

Before implementation, three isolated PostgreSQL diagnostics reproduced:

1. Predecessor `9007199254740993` rounded toward adjacent row
   `9007199254740992`; the intended row remained active, the next INSERT failed
   with `23505`, and the transaction restored both History and notification state.
2. A large successor ID was exact in PostgreSQL and in the returned result, but
   its numeric JSON backlink rounded on JavaScript readback.
3. A separate oversized notification ID caused `22003` and rollback before the
   insertion callback. This independent limitation remains outside the fix.

These are synthetic local reproductions, not evidence of production occurrence
or durable neighboring-row corruption. Targeted unit regressions failed against
the previous implementation before the fix was applied.

- Focused lifecycle, identifier and persistence unit suites: **128 passed**.
- Production-factory PostgreSQL/application suites: **71 passed** across three
  suites, including provider-deferral lock ordering and existing saved-review /
  completed-answer replay controls.
- Fresh backend coverage: **1,954 suites, 63,962 passed tests**, with the existing
  single local skip. Statement / branch / function / line coverage is
  **89.35 / 86.85 / 90.91 / 89.35 percent**.
- Full single-worker Chromium sweep: **105 passed**; fresh production build and
  production-browser suite: **8 passed**.
- Typecheck, server/client lint, dependency analyses, ownership inventory, npm CLI
  policy, naming/language/removal/maintenance audits, static imports, mock shapes
  and copyright checks: **passed**. Test lint passed again after final test edits.

The unit matrix covers safe and unsafe boundaries, adjacent large string IDs,
PostgreSQL maximum, mixed list order, exact bindings, raw valid callback types,
malformed/overflow/unsafe values, unsupported coercion hooks, complete-list refusal,
empty cohorts and unchanged bypasses.

The new PostgreSQL suite exercises both active statuses, adjacent unrelated rows,
numeric/string notification IDs, existing read_at values, exact forward/reverse
JSON readback, concurrent replacement and actual writer-generated large IDs.
Forward links are captured at insertion/current state: the existing lifecycle
transition replaces that object when an intermediate row is later superseded.
The fix preserves that retention rule rather than adding a new history ledger.

Rollback controls execute real insertion and database failures at callback/backlink
boundaries, including an invalid returned ID. A separate production connection
commits before an intentionally delayed/lost acknowledgement; durable rows remain
exact, the callback/COMMIT occur once, and the original success/rejection is
preserved without replay.

The notification control observes an actual blocked PostgreSQL statement through
pg_stat_activity/pg_blocking_pids before releasing replacement. It requires no
underlying notification error and zero inserted notification rows, so a swallowed
error cannot masquerade as correct suppression.

Backend/client coverage passes the existing ratchet. The unchanged client unit
report covers 488 files and 7,587 tests, with statement / branch / function / line
coverage of 87.93 / 82.17 / 87.71 / 89.61 percent. Relevant source inputs, the full
installed client graph and report SHA-256 remain unchanged:
`2fc6f1ac926ff16cb4be44ef83d23dfd4db44624973a857d73c20351e6742f36`.
The cross-workspace unit inputs are the unchanged health-summary and Undici
loopback helpers; neither imports the changed lifecycle/row-ID modules.

All 7,473 non-Markdown inputs remained unchanged through full validation, with
source-set SHA-256
`b7a625d422d2fc1b02b940517a670e3e5a5081bca7dee91343d2b7ef6a093490`.
Validation uses Node 24.22.1 / npm 12.2.2 and preserves assertions, deadlines,
skips and scanner policy. The eventual pushed commit's own CI is inspected
separately; local evidence does not establish release or deployment acceptance.

Fresh full audits report zero root/client findings and the existing five
low-severity server tooling entries. No exception or severity change is introduced;
the existing scoped triage expires November 16 and needs its own timely review.
This is not a claim that all platform security debt is resolved.

GPT-6 Astra reviewed the design and actual production/test changes. It found no
blocking scope/correctness issue. Its request for observed notification blocking
and explicit error checks was incorporated and passed. The review was read-only;
execution results come from the implementation run.

## Options and recommended stack

Official PostgreSQL, node-postgres, RFC 8259 and W3C research, with application
inferences and verified source links, is recorded in the
[design](pending-replacement-bigint-design.md#official-research-and-application-inference).

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep numeric coercion | No compatibility work | Incorrect large-ID targeting and replacement refusal |
| Convert all platform IDs to strings | Uniform representation | Much broader API, receipt, schema and consumer work |
| Exact lifecycle IDs and JSON links | Repairs both local precision boundaries using existing validation | Prospective mixed types; downstream limitations remain |
| Fix predecessor list only | Smaller literal patch | Leaves the reverse-link JSON precision defect |

Recommend exact lifecycle IDs and JSON links: canonical validation, compatible
predecessor projection, complete-list admission, existing locks, validated raw
callback result, JSON-scalar backlink, atomic replacement and honest uncertain
acknowledgement handling. The process runs through the existing application path
without another control or manual operator trigger.

The user's UUIDv7 question is researched in the
[design comparison](pending-replacement-bigint-design.md#uuidv7-consideration).
UUID/string handling would avoid numeric precision loss, but current-key migration
would require broader reference/receipt/API changes and would not repair remaining
Number conversions by itself. Astra supports completing this lossless BIGINT repair
and considering UUIDv7 separately for a justified identity requirement. No UUID or
second identifier system was introduced.

At the user's subsequent request, the preliminary classification-ID inventory was
also performed. Its separate [assessment outcome](classification-uuidv7-readiness-outcome.md)
records catalog-backed prerequisites and a consumer map without a migration.

## Remaining limits and next item

This does not provide universal BIGINT support. Intake receipts still have
INTEGER/numeric-only boundaries; queue witnesses reject unsafe-range IDs; Discord
pending buttons still convert classification IDs through Number; retry artifact
cleanup has an INTEGER notification cast. Historical metadata is unchanged. Do
not infer global large-ID action/recovery support from successful replacement.

The next bounded correction is safe conversion of malformed notification
classification IDs. The existing digits-only predicate can still admit an
out-of-range value and abort replacement of otherwise ordinary IDs. Scope a
guarded conversion that preserves the intended legacy numeric forms, including
an explicit decision about leading zeros; AND ordering alone is not a safe guard.
No production occurrence was established. This is separate from the repaired
valid-ID precision boundary.

Repeated persistence still creates a new successor; this service has no durable
insertion replay key. It does not retry an uncertain commit or recover one through
an operator-answer receipt. Existing completed-answer recovery remains separate.

No open PR was available at intake or the delivery recheck. No closed PR was reused,
PR merged or fresh/unrelated branch rebased. No dependency,
historical-backfill, live configuration, release or deployment change is included.

## Local artifact maintenance

Applied the maintenance skill before PostgreSQL/build work and at the local
validation handoff. The pinned desktop-linux daemon retained 27 containers,
493 image/tag rows and four worktrees. Original container identities, image
references, start times and observed health were unchanged. No artifact was
verified stale/disposable in this pass, so no file/image retirement or reclaimed
capacity is claimed. Recovery/reference assets, current reports, toolchains and
shared resources were preserved; no blanket prune, volume or cache change occurred.
