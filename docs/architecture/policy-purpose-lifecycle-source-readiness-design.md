# Policy-Purpose Lifecycle Source-Readiness Design

Status: implemented on 2026-09-08.

## Problem

The existing held-out study source signal counted current retained declared
purpose. The lifecycle receipt independently counted normal authoring history.
Those aggregate results could both be positive for different policies, which
would overstate whether one policy-qualified source could enter the private
eligibility audit.

The platform needs a passive answer to a narrower question: does at least one
currently active native policy both retain declared purpose and have complete,
matching normal lifecycle evidence? It must not select media, create a study,
collect labels, invoke AI, change a policy, or route media.

## Design

`policyPurposeEvidenceInventoryPersistence.mjs` evaluates this inside
PostgreSQL. For each active validated native policy, it combines:

- current specialized-purpose provenance;
- that policy's established initial-intent receipt and applied native-intent
  change receipts;
- each receipt's referenced intent and aggregate retained-purpose provenance.

It returns only fixed aggregate counts. The current retained-purpose policies
are partitioned exactly into:

1. `lifecycleRetainedPurposePolicyCount`: every recorded normal lifecycle
   receipt is present, verifiable, retains declared purpose, and at least one
   verifiable receipt identifies the current active native intent;
2. `lifecycleReceiptRequiredPolicyCount`: no matching normal lifecycle receipt
   has yet been observed; and
3. `lifecycleReceiptReviewRequiredPolicyCount`: lifecycle evidence exists but
   is unavailable, mismatched, profile-only, or has no retained purpose.

The existing source status is available only when the first partition is
nonzero. The server derives its status rather than accepting it as input. The
Vue normalizer derives the same status from a closed status allow-list and
exactly conserved counts, rejecting contradictory responses.

The new partial index supports the active-policy join for applied native intent
change receipts. The earlier bounded lifecycle-receipt display remains a
separate administrator diagnostic; this eligibility aggregate scans only the
receipt data associated with active policies and returns no history rows.

## Security and authority boundaries

- The query is read-only and parameter-free. It returns no policy, intent,
  library, actor, receipt, timestamp, fingerprint, rule-value, media, model,
  prompt, response, RAG, or classification-history data.
- Initial receipts require `state = 'established'`; changes require
  `result_status_id = 'applied'`. Change targets also match policy, source, and
  target intent version before being counted as verifiable.
- A current retained policy and a historical receipt must share the same policy
  ID inside the database, and one verifiable receipt must name that policy's
  current active intent. No cross-policy or stale-intent aggregate can qualify
  a source.
- The administrator-only coverage endpoint remains the sole presentation
  surface. It has no mutation or study action.
- Every semantic, cohort, labeling, selection, and routing flag remains false.

## Research basis

W3C PROV-DM frames provenance as information about entities and activities
that supports assessments of quality, reliability, and trustworthiness. The
policy-linked receipt relationship applies that model without exposing the
underlying provenance records. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

NIST's AI RMF Measure guidance supports repeatable, documented measurement.
The fixed partitions make source eligibility reproducible and distinguish
observed evidence from a semantic accuracy claim. [NIST AI RMF
Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP logging guidance advises excluding sensitive material from logs. The
contract uses aggregate counts rather than serializing author, idempotency, or
configured rule material. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

The W3C ARIA Authoring Practices Guide notes that alerts should be brief,
important, and non-disruptive. The status is persistent page information, so
the existing labelled section is retained rather than adding an interruptive
alert. [W3C Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)

## Options considered

| Option | Advantages | Costs and risks |
| --- | --- | --- |
| Policy-linked aggregate lifecycle gate (chosen) | Passive, deterministic, private, and proves both facts for the same policy | Requires ordinary authoring to create durable evidence |
| Separate global current and lifecycle totals | Simple query composition | A lifecycle receipt for one policy can incorrectly qualify another |
| Return policy or receipt identifiers | Supports manual tracing | Exposes unnecessary authoring and operational information |
| Require manual operator attestations | Explicit acknowledgement | Reintroduces recurring operator work and does not verify storage |
| Start semantic counter-evidence | Appears to advance automation | Bypasses cohort, independent-label, error, readiness, and frozen-study gates |

## Recommendation stack

1. Keep source readiness policy-linked, aggregate-only, and read-only.
2. Treat missing, mismatched, profile-only, and non-retained lifecycle records
   as ineligible for the private audit.
3. Passively reassess after normal native authoring; do not manufacture study
   evidence or ask for routine operator attestations.
4. When a qualified source exists, run the private eligibility audit and then
   capture one real 24–32-case cohort with independent labels.
5. Require the existing readiness and frozen-study preflight. Any future
   semantic counter-evidence may send ambiguous items to review only and must
   never route them automatically.

The implementation and complete library-neutral contract are documented in
[Policy Evidence Inventory Design](policy-purpose-evidence-inventory-design.md).
