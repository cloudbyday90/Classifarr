# Policy-purpose initial-establishment receipt proof outcome

Policy-purpose inventory, recent coverage, and held-out re-audit now
qualify initial establishment on the exact saved intent and event. The
shared query checks revision one, the recorded policy and library, and
the establishment event's operator, kind, reason, revisions, and typed
request metadata. The same SQL check applies at every ID size and runs
before the recent source limit. Only aggregate results leave PostgreSQL.

## Local verification

- The before-and-after PostgreSQL probe used the real establishment writer
  with IDs `9007199254740993` and `9007199254740992`. The foreign key
  accepted the adjacent event for a different intent. Before the fix,
  current-revision credit, complete-policy credit, recent declared
  purpose credit, and the held-out establishment count were all one.
  After the fix, the mismatched receipt contributed zero and the original
  establishment replay still returned its saved result.
- The proposed event check worked for ordinary safe IDs and valid adjacent
  large IDs. The authenticated native-create route contributed verification
  credit with the BIGINT maximum for both the intent and its event.
- The regression removed report credit for the wrong event kind, actor,
  source or target revision, authority metadata, and fingerprint type.
  Recent coverage refilled its one-row window with an older proven
  receipt. The stored receipt remained available for replay.
- The original intent still supported recent and held-out history after it
  became inactive and its rollback payload was redacted. Current-intent
  credit followed the existing active-revision rule.
- The single-receipt local plan used indexed intent and event lookups.
  PostgreSQL reported 0.64 ms for that synthetic limit-one execution.
- The isolated PostgreSQL 18 run passed 15 tests. The focused backend
  run passed 224 tests, including the existing administrator route and
  aggregate projection checks. Astra reviewed both producer paths and the
  matching query.

## Quality gates

Fresh backend coverage passed 64,982 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client report recorded
7,751 passing tests and 87.84% statement coverage. Its inputs and SHA-256
were verified before reuse. The coverage ratchet, type checks, preflight,
policy and ESM gates, server and documentation lint, schema checks, and
staged secret scan passed. All three production dependency audits reported
zero vulnerabilities.

The disposable PostgreSQL fixtures were removed. The local Classifarr
container retained its identity, start time, and healthy status.
GitHub showed zero open PRs.

## Follow-up

Qualify observed-evidence retention markers across backup restore.
Restore maps the relational establishment, policy, library, and intent
links to destination rows while copying the snapshot payload. In a
disposable restore, determine whether a saved marker's owner IDs describe
the source archive or the restored row, then verify how readers handle
that relationship before proposing any metadata changes.

[Design, official sources, and tradeoffs](policy-purpose-initial-establishment-receipt-proof-design.md)
