# Policy Purpose Lifecycle Provenance Receipt Outcome

Status: updated on 2026-09-08.

## Implemented outcome

The administrator policy-purpose coverage response is now version 8 and carries
a read-only `policy_purpose_lifecycle_provenance_receipt.v2`. It summarizes the
most recent complete or bounded window of ordinary initial-intent
establishments, applied native-intent changes, and verified terminal
library-rebuild replacements.

A rebuild contributes only when its terminal execution gate, immutable
no-difference verification run, replacement event, policy binding, transition
fingerprints, and source/target intent revisions agree. The server verifies
every target revision before reducing specialized purpose to retained,
inferred-profile-only, or absent aggregate counts. Missing, inconsistent,
nonterminal, or incomplete records are not allowed to claim retention.

The same ESM source module now drives both the bounded receipt panel and the
active-policy evidence inventory. The response returns only transition and
aggregate count totals. It contains no rule values, library or policy identity,
receipt identity, actor information, fingerprint, configuration, media,
history, RAG, AI, or routing data.

The purpose coverage screen displays the receipt as an information-only
section. It has no button and the client rejects malformed or unknown response
data. Neither the UI nor endpoint can create a cohort, collect labels, change a
policy, select media, call AI, or route media.

## Validation

Validation for the version-2 evolution includes:

- server unit tests for source bindings, data minimization, aggregate retention,
  profile-only purpose, absent or mismatched revisions, and contract versioning;
- PostgreSQL integration proving a fully verified rebuild qualifies the current
  replacement intent while stale or incomplete lifecycle evidence does not;
- client tests for allow-list normalization, contradictory response rejection,
  aggregate values, and no mutation controls;
- server security/test lint, server and client typechecks, production client
  build, static ESM import verification, migration validation, and
  documentation lint; and
- a security diff review of the changed runtime paths.

The implementation adds no database migration or dependency. Existing lifecycle
storage and indexes continue to support the newest-first bounded read.

## Outcome against the platform goal

This reduces operator work by measuring normal authoring and verified rebuild
retention from durable records. It remains a provenance observation, not
semantic accuracy or authorization for automation. The policy-linked source
gate is documented in [Policy-Purpose Lifecycle Source-Readiness
Design](policy-purpose-lifecycle-source-readiness-design.md), and the specific
implementation is documented in [Passive Policy Lifecycle Capture
Outcome](policy-purpose-passive-lifecycle-capture-outcome.md).
