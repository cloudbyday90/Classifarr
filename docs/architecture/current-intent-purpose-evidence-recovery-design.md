# Current-Intent Purpose Evidence Recovery Design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The passive policy-purpose inventory required every historical normal lifecycle
receipt for a policy to retain declared-purpose provenance. That condition was
correctly cautious about profile-derived purpose, but it also made recovery
impossible: an ordinary explicit declaration creates a new current intent and a
new native-change receipt while the older profile-derived receipt remains in
history. The old receipt permanently prevented the policy from contributing
complete evidence.

That behavior creates needless operator work and contradicts the platform's
library- and configuration-agnostic automation goal. The correction must keep
profile-derived material out of authority, avoid exposing configuration, and
not advance the semantic-study workflow.

## Decision

Complete policy-purpose evidence now requires evidence for the active current
intent only:

1. an active authoritative native intent with a positive version and schema;
2. declared native-purpose provenance on that active intent; and
3. a durable normal lifecycle receipt that names the same intent, matches its
   expected version when that version is recorded, and itself retains declared
   native-purpose provenance.

The PostgreSQL aggregate adds a count of policies with a current
intent-to-declared-purpose receipt match. The ESM inventory contract bounds the
new count by the active declared-purpose and current-lifecycle counts. The
client independently applies the same bounds before showing the aggregate-only
metric.

Historical receipts remain historical evidence. A profile-derived receipt never
establishes declared purpose, and it cannot select a cohort, label media, call a
provider, create semantic evidence, or route media. It also no longer vetoes a
later current declaration that has its own matching durable receipt.

The public policy-purpose review advances to version 12, the inventory advances
to version 3, and the lifecycle re-audit purpose adapter and source advance to
version 3. The changed source version changes its fingerprint, allowing the
existing passive scheduler to re-evaluate a qualifying aggregate state without
a manual trigger.

```text
historic profile-derived receipt ──────> excluded historic observation

current native declaration
  + matching normal lifecycle receipt ─> bounded aggregate evidence
                                        -> existing passive eligibility audit
                                        -> stop

no cohort capture, labels, semantic retrieval, provider calls,
policy mutation, or media routing
```

## Data and security boundary

The query returns fixed counts only. It does not project a policy, library,
intent, receipt, actor, provider, media item, configuration value, rule value,
or idempotency key. The browser rejects unexpected authority flags and cannot
turn the observation into an action. The source fingerprint stores only a hash
of aggregate state.

Matching receipt and intent versions in the database keeps stale receipts from
qualifying a changed current intent. This follows OWASP guidance to enforce
property-level authorization and data minimization at the server boundary rather
than trusting a client-side interpretation. [OWASP API Security Top 10,
API3](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Research basis

W3C Data on the Web Best Practices recommends provenance that lets users and
software assess data quality and reuse. The design retains the provenance link
needed for the derived aggregate without exposing the source records. [W3C Data
on the Web Best Practices](https://www.w3.org/TR/dwbp/)

W3C PROV-DM distinguishes entities, activities, and derivations. The current
intent and its matching lifecycle activity provide a narrower derivation than a
policy-wide historical receipt set. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

W3C WCAG status-message guidance supports presenting the existing aggregate
observation through a polite programmatic status without moving focus. [W3C
WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require every historical receipt to retain declared purpose | Strong historic consistency signal | A past profile-derived receipt permanently blocks ordinary recovery | Reject |
| Promote profile-derived evidence | Immediately increases eligible counts | Falsifies provenance and turns configuration into authority | Reject |
| Ignore lifecycle receipts | Reduces query complexity | Accepts an unreceipted current declaration | Reject |
| Require current declaration plus current matching receipt | Recovers through durable normal authoring while preserving provenance | Historical counts need separate explanatory metrics | Adopt |

## Recommendation stack

1. Treat current declared purpose and its matching durable lifecycle receipt as
   the only passive evidence-recovery path.
2. Keep profile-derived and historic evidence descriptive and excluded from
   authority.
3. Let the existing passive re-audit observe changed aggregate source state.
4. Run one real balanced 24–32-case cohort only after the private eligibility
   audit can support it, with independent labels and the existing readiness and
   frozen-study preflight.
5. Add semantic counter-evidence only after a good measured error profile, and
   send ambiguous items to review only.
