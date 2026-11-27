# Policy-purpose native change receipt proof outcome

Policy-purpose inventory, recent coverage, and held-out re-audit now qualify
large native-change target or event links using the receipt's saved
same-attempt evidence. The qualifying event, target, operator, actor,
policy, and revisions must agree. Replay and reporting share the SQL predicate.
Replay supplies its existing Node.js digest and the reports reproduce it
with PostgreSQL's built-in SHA-256. The proof material stays inside SQL.

Safe target and event links retain the legacy admission rule, including
when the receipt primary key is large. Reports exclude unproven large
links before the recent source limit. The ordinary aggregate fields and
ordered page size remain compatible. A receipt can still be retained in
the database while contributing no current policy-purpose evidence.

## Local verification

- The real PostgreSQL producer supplied both a high target with a safe
  event and a safe target with a high event, plus adjacent IDs and both
  links at the BIGINT maximum. Each valid change counted in the reports
  and replayed successfully. A legacy receipt with a large primary key
  and safe links also counted and replayed without a digest.
- Missing proof, a matching event with another attempt's digest, and a
  digest stored as a JSON array failed verification. The affected
  policies lost current-revision receipt credit. All seven receipts
  remained stored, and the recent window still returned two eligible entries.
- The baseline probe counted one native change in all three paths even
  after replay refused the missing proof. With the patch, current-intent
  and complete-policy credit dropped to zero, recent coverage returned
  the initial establishment, and held-out re-audit counted zero changes.
- An additional disposable PostgreSQL plan probe put 2,048 newer
  unproven receipts ahead of one eligible change. The existing
  limit-one reader returned that eligible change. PostgreSQL chose a
  sequential scan of the receipt table and reported 12.9 ms for one
  execution. This measures the synthetic fixture on the local host.
- The isolated PostgreSQL 18 run passed 23 tests, including existing replay,
  rollback, receipt retention, and native purpose cases. The focused
  backend run passed 221 tests, including administrator route controls
  and aggregate projections.

Astra reviewed the shared predicate, canonical digest input, and ordering.
The ownership inventory reported the same SQL analysis and review
classification for the receipt persistence module. Its reviewed source
digest was refreshed.

## Quality gates

Fresh backend coverage passed 64,970 tests across 1,959 suites with
one existing skip and 89.33% statement coverage. The client report
recorded 7,751 passing tests and 87.84% statement coverage. Its inputs
and SHA-256 were verified before reuse. The coverage ratchet, preflight,
policy gates, server and client type checks, ESM checks, server lint,
migration checks, documentation lint, and staged secret scan passed.
All three production dependency audits reported zero vulnerabilities.

The disposable fixtures were removed. The protected local Classifarr
container retained its identity, start time, and healthy status.
GitHub showed zero open PRs.

## Follow-up

Qualify the shared lifecycle source for library rebuilds. Check whether a
historical large run, original intent, or replacement link can satisfy
its relational joins while failing the more detailed replay and removal
readiness proof. Use isolated PostgreSQL to establish which information the
three reports can trust before changing their rebuild counts.

[Design, official sources, and tradeoffs](policy-purpose-native-change-receipt-proof-design.md)
