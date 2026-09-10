# Source identity evidence replay observation outcome

Date: 2026-09-10. See the separate
[design](source-identity-evidence-replay-observation-design.md).

## Delivered behavior

Classifarr now automatically observes the existing source-identity external
evidence replay once each day after application readiness. It reuses the same
source-neutral adapter contract and the same daily rotating 12-library /
32-observation bound as the repair worklist and manual diagnostic replay.

The database selection runs in a short PostgreSQL `REPEATABLE READ READ ONLY`
transaction. The transaction completes before any media-server or TMDb call.
The result is then projected into one aggregate-only UTC-day receipt. A
separate next-minute task retains exactly 120 inclusive UTC dates (rather than
an off-by-one 121-date range). Daily work is protected by
scheduler no-overlap and separate cross-replica advisory locks; no startup run
can cause external calls.

## Persisted receipt boundary

The new table stores the UTC date, timestamp, receipt version, fixed status,
and a contract-validated JSON aggregate. Its validation rejects unknown
fields, unsupported outcome or reason codes, invalid counts, and totals that
do not reconcile to the selected observation count.

The receipt retains only:

- selected-capacity and active/selected/excluded-library counts;
- the fixed rotating-window identifier;
- fixed outcome and resolver-reason counts; and
- a fixed `complete`, `no_current_conflicts`, or `failed` status.

It never retains raw source evidence, media/provider/candidate IDs, source
URLs, credentials, library/server identifiers, error messages, configuration,
policy, AI, decision, or routing data.

## Validation

Focused local tests verify the read-only transaction ordering, strict receipt
projection, parameterized upsert and retention queries, UTC cutoff, absence of
a startup replay, scheduler locks, failed-replay signalling, source replay
behavior, scheduler receipts, and bootstrap registration. Type checking,
targeted ESLint, and migration naming checks pass.

## Final recommendation

Use the daily history to measure whether source repairs and fresh full captures
improve evidence quality across the library-agnostic rotating scope. Do not
extend this release into automatic identity correction, semantic
counter-evidence, AI work, or routing. The next valid automation candidate is
a frozen, independently labelled cohort only if the resulting profile meets
the existing readiness and preflight gates; ambiguous cases must remain
review-only.
