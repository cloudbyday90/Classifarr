# Classification intake task identity outcome

November 26, 2026. See the [design and tradeoffs](classification-intake-task-id-design.md).

The intake lifecycle writer uses the shared BIGINT validator when it
binds a queue task ID. Safe IDs stay numeric and canonical strings above
the safe limit remain exact through PostgreSQL's maximum. Invalid or
already-unsafe inputs decline before the repository is called.

Queue claim admission and acknowledgement still determine which events
reach the writer. The existing SQL derives state from the classification
task, protects attempt ordering and keeps earlier decision evidence as
before. Once a job is deleted, its receipt survives under the separate
retention policy. A new write against the absent job declines without
changing the retained receipt. The private report uses its existing
exact lookup and bounded projection.

## Verification

- Before the fix, four focused unit cases declined expected exact
  inputs. All three new PostgreSQL cases allocated the expected queue
  IDs but had no queued receipt for the large task.
- After the fix, 215 focused unit tests and 187 isolated PostgreSQL
  tests passed. The real queue service exercised enqueue, dequeue,
  successful completion, retry scheduling and terminal failure across
  the safe boundary, two adjacent large IDs and the BIGINT maximum.
  Wrong-task and superseded claims could not write acknowledgements.
- The classification link step exercised the shared intake service
  directly. The existing classification persistence and intake
  reconciliation tests also passed. The read-only diagnostic ran
  against the isolated database after queue deletion and returned the
  distinct exact IDs, statuses and History links. Its projection
  excluded the synthetic payload titles. Repeating the lookup returned
  the same receipt.
- Astra reviewed the boundary and diff. GitHub listed zero open pull
  requests. The root, server and client dependency audits each reported
  zero vulnerabilities.
- Full local CI passed with 64,806 backend tests, one existing skip,
  and 7,748 client tests. Statement coverage was 89.33% and 87.84%
  respectively. The coverage ratchet, server and Markdown lint, type
  checks, ESM checks and staged secret scan passed.

## Next recommended item

Verify the queue evidence fingerprint across its admission producer
and question-reduction reader. Both currently use general-purpose text
normalization and some fixtures use symbolic task IDs. Add evidence
for safe-number and canonical-text equivalence and separation of
adjacent large IDs through the real queue path. Establish whether
symbolic identities are a supported contract before tightening
validation. The current inventory establishes no further durable
queue-ID failure in those paths.
