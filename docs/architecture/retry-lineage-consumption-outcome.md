# Retry lineage transfer outcome

November 21, 2026 Eastern. Implementation of the approved
[retry lineage design](retry-lineage-consumption-design.md).

## Behavior

- New retries retain the source classification's request and webhook
  associations until a verified replacement commits. The enqueue transaction
  saves the typed item, the exact reference snapshots and the source-to-task
  outcome. Missing or contradictory identity refuses the enqueue.
- A live queue claim authorizes processing. The private task proof and current
  owners authorize transfer. Pending History supersession, replacement insert,
  reference updates, source outcome and the completion marker share one
  PostgreSQL transaction. The reference rows are locked in indexed ID order.
- A later claim can recover the exact committed classification ID. A saved
  routing admission yields the existing routed or unconfirmed observation.
  With only local completion, the Queue result records the automatic routing
  hold and keeps the saved review or retry state. The claim that committed the
  replacement is the only claim eligible to admit its first automatic route.
- Legacy payloads lack transfer authority. A legacy routing admission can
  still be observed. Changed, missing or added references stop a protected
  retry and leave the associations as found. Command Center explains that
  refusal and omits its individual Retry control. Individual and bulk requeue
  commands enforce the same boundary. Manual queue selection returns a
  conflict for protected and unverified legacy tasks.

The proof expires with its queue row. History outcome links and existing
request and webhook foreign keys keep their ordinary lifetimes. The migration
and fresh-install schema add the private table and two partial indexes.
Retaining links can keep an original History row referenced for longer. Mixed
workers are unsafe for this migration because earlier builds can reassign links
using task metadata alone. Upgrade classification workers together when this
batch is deployed.

## Verification

- 64,081 backend tests passed with one existing skip. All 532 focused backend
  tests and 325 isolated PostgreSQL integration tests passed. Production
  database adapter tests covered retained source links,
  changed and missing references, legacy task refusal, same-claim overlap,
  acknowledgement after lease expiry, atomic rollback after the first update,
  and reclaim after a real COMMIT with a lost reply. They also checked fresh
  routing admission and the prior routing observation path.
- 19 focused client tests and 7,590 full client tests passed, including Command
  Center retry controls. The production UI build and eight Chromium checks
  passed. The backend and client reports both cleared the coverage ratchet.
- The isolated PostgreSQL 18.7 image generated a matching schema snapshot.
  Migration, type, lint, dependency, runtime audit and inventory checks passed.
  The ownership review preserved the existing ingestion classifications and
  parser pin. The new repository's indirect SQL analysis remains unresolved.

The independent [PR #593 dependency assessment](server-tooling-pr-593-outcome.md)
landed in the preceding main commit. GitHub's pipeline and OSV scan succeeded
for that exact commit. GitHub reports the PR closed without a merge.
The open Dependabot branches remained mergeable at review. Their failing
checks did not establish a merge conflict that a branch rewrite would fix.
[GitHub Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)

## Recommendation and tradeoffs

Retain ownership until transfer, verify under a live claim, and recover the
one committed replacement by exact task ID. Retention makes the current owner
verifiable with row locks. It also changes in-flight visibility and can delay
History deletion. Detaching with durable reservations would preserve in-flight
visibility but requires every ownership writer to update the reservation
protocol. The design leaves that coordination out of the current batch.

Next, assess a bounded review for retained or legacy links whose ownership
cannot be established. Report the existing association and missing evidence
through the current Queue or History surface before considering any repair.
Complete that authority review before widening retry-ID admission.
