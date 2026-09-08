# Passive Policy Lifecycle Capture Design

Status: implemented on 2026-09-08.

## Problem

The policy-purpose evidence inventory already counted initial native intent
establishment and ordinary native-intent changes. A verified library rebuild
also persists a replacement chain, but that chain was not an inventory source.
A current replacement intent could therefore be excluded even though the
platform had already automatically recorded evidence sufficient to verify it.

The platform should use existing durable evidence before requesting any
operator input. It must remain agnostic to library choice and configuration,
return only bounded aggregate information, and never select a study cohort,
collect labels, invoke AI, edit policy, or route media.

## Design

`policyPurposeLifecycleReceiptSources.mjs` owns the three fixed lifecycle
sources used by both the current-policy inventory and the bounded administrator
receipt panel:

1. established initial native-intent receipts;
2. applied native-intent change receipts; and
3. verified terminal library-rebuild replacements.

A rebuild becomes the third source only when all of these database-local facts
agree:

- the execution gate is terminal (`replacement_applied`) and names a
  replacement intent, replacement event, and applied time;
- the replacement event has the expected type and binds the same policy and
  replacement intent;
- the source and replacement intent revisions match the event's source and
  target revisions;
- the immutable verification run binds the same policy, source intent,
  library-transition fingerprint, and verifier fingerprint; and
- its fixed source, verifier, and coordinator audits are complete with zero
  migration differences.

The shared source builder has an active-policy scope for the inventory and a
bounded recent-history scope for the panel. Both project only the internal
transition, resolvability, and aggregate purpose-provenance counts. SQL IDs,
actor data, fingerprints, library identity, configuration, rules, media, and
other operational records stay inside the database.

The public review contract is `policy_purpose_coverage_review.v11`; its nested
lifecycle receipt is version 3 and separates native intent changes from
verified rebuild replacements. The Vue panel reports both aggregate counts in
a labelled polite status region. It does not introduce an action, focus change,
or automated decision.

## Authority boundary

This change consumes only evidence that the existing normal rebuild workflow
has already persisted. It does not add a migration, table, dependency,
configuration setting, backfill, or operator attestation. A nonterminal,
unverified, mismatched, or incomplete rebuild remains ineligible. No semantic,
cohort, selection, labelling, or routing flag becomes true.

## Research basis

W3C PROV-DM models provenance as relations among entities, activities, and
agents so consumers can assess quality, reliability, and trust. The receipt
source preserves those bindings without disclosing the underlying records.
[W3C PROV-DM](https://www.w3.org/2012/10/prov-dm)

NIST's current draft revision of SP 800-92 treats collection, protection,
review, and retention as parts of log management. Reusing verified durable
records avoids a second, weaker manual evidence channel. [NIST SP 800-92 Rev.
1 IPD](https://csrc.nist.gov/pubs/sp/800/92/r1/ipd)

OWASP recommends excluding sensitive data from logs and controlling access to
logging information. The aggregate contract deliberately excludes authoring,
configuration, identity, and media data. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

W3C WCAG 2.2 says status messages should be programmatically determinable
without moving focus. The existing passive status presentation continues to
meet that pattern. [W3C WCAG 2.2 Status
Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

## Options considered

| Option | Advantages | Costs and risks |
| --- | --- | --- |
| Consume the verified terminal replacement chain (chosen) | Automatic, deterministic, library-neutral, and based on existing durable evidence | Applies only to rebuilds that satisfy every verification binding |
| Infer intent from a library or profile | May make more records appear available | Treats configuration as declared meaning and exposes operational detail |
| Count every migration event | Simple query | An unfinished or mismatched event can look like a verified replacement |
| Synthesize or backfill receipts | May improve a count immediately | Does not prove normal capture and recreates operator work |
| Begin semantic review now | Appears to advance automation | Skips the required independent cohort and measured-error gates |

## Recommendation stack

1. Keep the three-source receipt builder as the only lifecycle evidence source
   for inventory and administrator receipt views.
2. Let normal authoring and fully verified rebuild workflows accumulate passive
   evidence; do not infer from library configuration or manufacture receipts.
3. When all active policy evidence is complete, capture one real 24–32-case
   cohort and label it independently.
4. Run the existing readiness and frozen-study preflight against that cohort.
5. Only if the measured error profile is acceptable, add semantic
   counter-evidence that refers ambiguous items to review. It must never route
   them automatically.
