# Library-Agnostic Policy Evidence Inventory Design

Status: implemented on 2026-09-08.

## Problem

The policy-purpose source gate already linked retained declared purpose to normal
lifecycle evidence for the same policy. It did not require a retained lifecycle
receipt to identify that policy's *current* active intent. A superseded intent
could therefore supply historical evidence after an unreceipted current intent
had become active.

The platform needs a passive, configuration-agnostic way to determine whether
current policy evidence exists. It must not infer purpose from a library,
inspect configuration, reveal a library or policy identity, select media, call
AI, collect labels, change policy, or route media.

## Design

`policyPurposeEvidenceInventoryPersistence.mjs` reads a fixed aggregate from
active authoritative native policies. For each policy, PostgreSQL compares:

- the current native intent's existence, version, and schema version;
- retained declared-purpose provenance, excluding inferred profile-only
  purpose;
- established and applied normal lifecycle receipts, including strictly verified library-rebuild replacements;
- whether a normal lifecycle receipt names the current active intent and, when
  recorded, its current version; and
- whether that current receipt itself retains declared native-purpose
  provenance.

The query returns counts only. The pure
`policyPurposeEvidenceInventory.mjs` contract bounds their relationships and
emits one of three fixed status IDs: no active authoritative native policy,
incomplete evidence, or complete evidence available. It does not create a
semantic readiness claim.

A policy is complete only when all of these are true:

1. its active native intent has a positive current intent and schema version;
2. its current purpose contains retained declared evidence;
3. it has at least one normal lifecycle receipt for that current intent, and
   that receipt retains declared native-purpose provenance; this includes a
   library rebuild only when its terminal gate, immutable verification run,
   event, and intent revisions agree.

Historic profile-derived or otherwise nonqualifying receipts remain visible
only through aggregate historical observability counts. They do not establish
purpose authority, and they do not permanently veto a later explicit current
intent with its own matching normal lifecycle receipt.

The existing held-out source signal consumes the same inventory record and now
requires a current-intent lifecycle receipt before it can become available.
The previous persistence module is a compatibility re-export; the inventory is
the sole query implementation.

The client has an independent normalizer and a passive, labelled inventory
panel. It accepts only the fixed status and bounded counts, rejects responses
that claim raw configuration exposure or semantic/routing authority, and uses
a polite status message without moving focus.

## Data and authority boundary

The server reads `libraries` only to restrict the scope to active destinations.
It never selects or returns a library name, ID, path, provider, profile,
policy name, policy ID, intent ID, schema value, intent value, receipt ID,
timestamp, actor, rule value, media record, history, prompt, response, or RAG
content. The browser receives no configuration and no per-policy row.

All inventory, source-readiness, semantic-cohort, selection, and routing flags
remain false. The only result is a read-only availability observation.

## Research basis

W3C PROV-DM describes provenance as entities and activities that support
quality, reliability, and trust assessments; it is domain-agnostic and has
clear extension points. The inventory retains the entity/activity relationship
without projecting its underlying records. [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)

NIST AI RMF Measure calls for evaluation data and methods that fit the context
of use. The inventory therefore distinguishes evidence availability from a
representative, independently labelled semantic evaluation. [NIST AI RMF
Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)

OWASP advises excluding sensitive and commercially sensitive data from logs.
The query and client contract use aggregate counts and fixed status IDs rather
than authoring or configuration material. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

W3C WCAG 2.2 says dynamically added status information should be
programmatically determinable without taking focus. The panel uses a polite
status role and does not create an alert or context change. [W3C WCAG 2.2
Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Options considered

| Option | Advantages | Costs and risks |
| --- | --- | --- |
| Aggregate current-intent inventory (chosen) | Passive, library-neutral, privacy bounded, detects stale lifecycle evidence | Cannot create evidence for legacy policies |
| Infer purpose from library or profile configuration | May populate more policies immediately | Treats configuration as declared meaning and leaks operational detail |
| Return per-policy or library evidence rows | Easier manual diagnosis | Exposes unnecessary identity and encourages operator-led selection |
| Accept an older receipt as current evidence | Smaller query | Allows an unreceipted current intent to appear complete |
| Manual attestation or synthetic backfill | Can appear to unblock a cohort | Reintroduces operator work and does not prove normal lifecycle storage |

## Recommendation stack

1. Retain the current-intent evidence invariant and aggregate-only inventory.
2. Passively capture normal authoring receipts; do not manufacture evidence for
   legacy policies or infer purpose from library configuration.
3. Use the existing private source audit only after complete policy evidence is
   available.
4. Capture one real 24–32-case cohort with independent labels, then use
   readiness and frozen-study preflight.
5. If measured error is acceptable, introduce semantic counter-evidence only
   to refer ambiguous items for review; it must never route them automatically.
