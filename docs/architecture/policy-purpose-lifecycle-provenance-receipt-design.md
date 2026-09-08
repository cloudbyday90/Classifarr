# Policy Purpose Lifecycle Provenance Receipt Design

Status: updated on 2026-09-08.

## Problem

Classifarr could show whether the current active policy purpose was retained,
profile-only, or absent. It needed to establish, without operator input,
whether that declared purpose also survived the normal lifecycle pathway that
created the current intent. The original receipt aggregate covered initial
native-intent establishment and native-intent changes. It did not recognise an
already durable, fully verified library-rebuild replacement.

The solution must stay library- and configuration-agnostic. It must return no
configured rule values, receipt fingerprints, actor identities, timestamps,
media data, or profile data. It cannot edit a policy, create a cohort, collect
labels, invoke AI, or route media.

## Design

The administrator-only purpose-coverage endpoint includes the read-only
`policy_purpose_lifecycle_provenance_receipt.v2` aggregate. Its ESM source
module owns three normal lifecycle sources:

- an established `policy_initial_intent_establishments` record, which refers to
  the first declared native-intent revision;
- an applied `policy_native_intent_change_receipts` record, which refers to the
  target revision of a normal native-intent change; and
- a terminal `policy_library_rebuild_execution_gates` replacement, which binds
  its source and replacement revisions to one immutable verification run and
  replacement event.

A rebuild can contribute only when all durable bindings agree: the execution
gate is `replacement_applied`; its replacement intent, event, and time exist;
the event has the expected type and exact source/target revisions; both intents
belong to the same policy and library; the verification run binds the same
policy, source intent, library transition fingerprint, and verifier fingerprint;
and every fixed source, verifier, and coordinator audit has zero differences.

The shared source builder supports a complete active-policy inventory scope and
a bounded recent-history scope. PostgreSQL verifies that every receipt still
matches its native-intent ID, policy ID, source, and expected version before it
reduces identity-purpose rules for `genres`, `keywords`, and `studios` to
aggregate retained, profile-only, or absent counts. The response contains only
transition and provenance totals. Its parent review response is
`policy_purpose_coverage_review.v8`.

## Decision boundaries

This receipt is evidence about durable authoring history. It cannot establish
semantic correctness, a semantic cohort, independent labels, readiness,
frozen-study preflight, counter-evidence, automatic routing, or a policy
change. A retained result only supplies passive evidence for the existing
private eligibility audit. The existing readiness and frozen-study gates remain
required.

## Security and privacy controls

- Sources are durable lifecycle records protected by existing normal authoring
  and verified rebuild workflows.
- The query is bounded and selects no rule values, identifiers, actors,
  fingerprints, timestamps, media IDs, titles, profile observations, history,
  RAG data, or AI data for the application layer.
- A mismatched, incomplete, nonterminal, or nonzero-difference rebuild is never
  considered a receipt.
- The client validates a closed status allow-list and exact count relationships.
  Semantic, labelling, selection, and routing flags remain false.
- The view has no mutation control; existing server-side administrator
  authorization remains the enforcement point.

## Research

W3C PROV-DM describes provenance through entities, activities, and agents. The
aggregate keeps the entity/activity relationship while withholding the
underlying records. [W3C PROV-DM](https://www.w3.org/2012/10/prov-dm)

NIST's SP 800-92 Rev. 1 draft treats collection, protection, review, and
retention as log-management concerns. Existing durable verification evidence is
stronger than a new manual attestation channel. [NIST SP 800-92 Rev. 1
IPD](https://csrc.nist.gov/pubs/sp/800/92/r1/ipd)

OWASP recommends limiting sensitive data in logs and controlling access to log
data. This contract returns aggregate counts and fixed statuses only. [OWASP
Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options considered

| Option | Advantages | Costs and risks |
| --- | --- | --- |
| Shared aggregate receipt source (chosen) | Automatic, bounded, deterministic, and prevents inventory/panel drift | Does not explain an individual policy term or prove semantic correctness |
| Return receipt or rule details | Faster manual diagnosis | Discloses unnecessary identifiers, timestamps, and configuration |
| Infer from a current library profile | No receipt query | Confuses observed configuration with declared policy purpose |
| Ask for operator attestation | Explicit acknowledgement | Reintroduces manual work and does not verify stored evidence |
| Add semantic counter-evidence now | Appears to advance automation | Bypasses cohort, independent-label, measured-error, and preflight gates |

## Recommendation stack

1. Keep the three-source aggregate-only lifecycle receipt as shared inventory
   and administrator evidence.
2. Treat unmatched revisions, incomplete rebuild verification, profile-only
   purpose, absent purpose, and truncated history as non-verifying states.
3. Let normal authoring and verified rebuilds accumulate passive evidence;
   never infer it from library configuration or manufacture receipts.
4. When the aggregate is complete, capture one real independently labelled
   24–32-case cohort and run the existing readiness plus frozen-study preflight.
5. Only a good measured error profile may justify semantic counter-evidence that
   sends ambiguous items to review; it must never route automatically.
