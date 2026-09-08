# Policy Purpose Lifecycle Provenance Receipt Design

Status: implemented on 2026-09-08.

## Problem

Classifarr could show whether the *current* active policy purpose was retained,
profile-only, or absent. It could not automatically show whether declared
purpose survived ordinary policy lifecycle operations. That leaves a gap before
a retained policy-purpose source can be treated as a candidate input to the
existing held-out-study eligibility audit.

The solution must add no operator workflow, policy edit, label, cohort, or
routing action. It must also avoid returning configured rule values, receipt
fingerprints, actor identities, timestamps, media data, or profile data.

## Design

The administrator-only existing purpose-coverage endpoint now includes a
`policy_purpose_lifecycle_provenance_receipt.v1` aggregate. It reads only two
existing append-only normal-authoring records:

- an established `policy_initial_intent_establishments` record, which refers to
  the first declared native-intent revision;
- an applied `policy_native_intent_change_receipts` record, which refers to the
  target revision of a normal native-intent change.

For each receipt, PostgreSQL verifies that the referenced native-intent ID,
policy ID, source, and intended version still agree. It then reduces only
identity-purpose rules for `genres`, `keywords`, and `studios` to two counts:
all specialized rules and the inferred-library-profile subset. The server
contract derives retained, profile-only, and absent states from those counts.

The reader fetches the most recent 101 receipts, returns at most 100, and marks
the result `normal_lifecycle_history_truncated` when an omitted receipt exists.
A missing or mismatched revision is `unverifiable`; the receipt then requires
verification rather than making a retention claim. The response contains
transition totals and aggregate provenance totals only.

Two partial indexes support the bounded, newest-first reader. A new Vue child
component and independent allow-list normalizer present the result within the
existing purpose-coverage review. The API remains administrator-only, and the
client discards unknown statuses or inconsistent counts.

## Decision boundaries

The receipt is evidence about authoring history. It cannot establish semantic
correctness, a semantic cohort, independent labels, readiness, frozen-study
preflight, counter-evidence, automatic routing, or a policy change. A retained
result simply makes it possible for the separate private eligibility audit to
consider a current policy source. The existing readiness and frozen-study gates
remain required.

## Security and privacy controls

- All source records are append-only lifecycle receipts already protected by
  the existing normal authoring path.
- The query is parameterized and bounded. It selects no rule values,
  identifiers, actors, fingerprints, timestamps, media IDs, titles, profile
  observations, history, RAG data, or AI data.
- The SQL reader checks that receipt and intent references agree before it
  treats a record as verifiable.
- The client validates a closed list of statuses and exact count relationships.
  It hard-codes every semantic, labeling, and routing flag to `false`.
- The view has no mutation control. Existing server-side administrator
  authorization remains the enforcement point.

## Research

W3C PROV-DM describes provenance in terms of entities, activities, and
responsible agents. The receipt follows that model by connecting a durable
normal authoring activity to its resulting intent revision, while exposing only
the minimal aggregate needed for quality assessment. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

NIST's AI RMF Measure guidance emphasizes documenting and revisiting metrics so
that results remain repeatable and useful for governance. The fixed schema,
bounded scope, truncation signal, and explicit non-decision flags provide a
repeatable measurement boundary rather than a probabilistic semantic claim.
[NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP logging guidance recommends protecting recorded events and excluding or
sanitizing sensitive material such as session values, credentials, and secrets.
The design therefore reduces receipt records to counts and never serializes
actor or idempotency material. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options considered

| Option | Advantages | Costs and risks |
| --- | --- | --- |
| Aggregate lifecycle receipt (chosen) | Automatic, low-disclosure, deterministic, bounded, and directly checks normal authoring retention | Does not explain a specific policy term or prove semantic correctness |
| Return receipt or rule details | Faster manual diagnosis | Discloses unnecessary identifiers, timestamps, actor data, and configured purpose |
| Infer lifecycle provenance from current policy only | No additional query | Cannot distinguish a normal authoring transition from an unrelated current state |
| Ask an operator to attest after each change | Explicit acknowledgement | Adds recurring manual work and does not independently verify storage |
| Add semantic counter-evidence now | Appears to advance automation | Bypasses cohort, independent-label, measured-error, readiness, and preflight gates |

## Recommendation stack

1. Keep the lifecycle receipt aggregate-only, bounded, and read-only.
2. Treat unmatched revisions, profile-only purpose, absent purpose, and
   truncated history as non-verifying states.
3. Use a complete retained result only as passive evidence for the existing
   private held-out eligibility audit.
4. Run one real 24–32-case cohort and collect independent human labels only
   after the source audit reports eligible retained purpose.
5. Add semantic counter-evidence only if measured error satisfies readiness and
   frozen-study preflight; it may send ambiguous items to review and must never
   route them automatically.
