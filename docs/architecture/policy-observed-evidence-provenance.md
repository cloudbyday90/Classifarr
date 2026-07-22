# Policy Observed Evidence Provenance

## Status

Implemented on 2026-07-22 as a bounded companion record for initial native
policy establishment. It is not policy authority, routing state, learning
input, or a media action instruction.

## Problem

Classifarr can establish native policy authority from an operator's accepted
intent while a connected library profile supplies the observed context that was
available at that time. A transient-only workflow loses useful support and
reconciliation context. Persisting the full profile, media list, paths, or
provider responses would turn an observation into an oversized and ambiguous
second source of truth.

The system therefore needs a narrow, server-owned record that answers only:
"What bounded library-profile context was available when this native policy was
first established?"

## Research

- The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends recording security-relevant event context while excluding secrets
  and unnecessary sensitive data.
- [NIST's Privacy Framework](https://www.nist.gov/privacy-framework/privacy-framework)
  supports data-processing practices that are proportionate to the stated
  purpose and managed through explicit controls.
- [GDPR Article 5](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1510677980976&uri=CELEX%3A32016R0679)
  states purpose limitation, data minimisation, storage limitation, and
  integrity/confidentiality principles.
- [RFC 8785](https://datatracker.ietf.org/doc/html/rfc8785) describes
  canonical JSON for interoperable JSON-based signatures. Classifarr keeps a
  deterministic internal SHA-256 digest for audit correlation, but does not
  claim this local serialization is an interoperable signature scheme.

## Options Considered

### Option A: Retain No Provenance

Pros:

- No new storage or retention work.
- No retained observed data.

Cons:

- Cannot explain whether a stored profile was available at establishment.
- Makes safe recovery and backup/restore support less auditable.

### Option B: Retain Raw Library Data

Pros:

- Maximum historical detail.

Cons:

- Over-collects content, paths, and potentially sensitive metadata.
- Raises retention, backup, and redaction cost.
- Risks accidental use as policy authority or a later live-data substitute.

### Option C: Retain One Bounded Snapshot Per Establishment

Pros:

- Preserves limited establishment context without treating it as authority.
- Limits storage growth with one row per initial-establishment record.
- Supports a deterministic digest, expiration, redaction, and backup/restore.
- Does not depend on a user's library names, media paths, or provider setup.

Cons:

- Does not reconstruct the entire historical library.
- Requires a migration, cleanup job, and backup/restore mapping.

## Decision

Adopt Option C.

Each successful initial native-intent establishment writes exactly one
`policy_observed_evidence_provenance_snapshots` row in the same transaction as
the native intent, rules, routing record, migration event, rollback snapshot,
and establishment record. If the profile is unavailable, Classifarr records a
safe unavailable marker. If profile evidence is rejected by existing boundary
audits, it records a safe rejected marker. Neither condition prevents native
authority from being established from the operator's explicit intent.

An insert failure rolls back the entire establishment transaction. This avoids
an authority record that claims a provenance write was complete when it was
not.

## Data Contract

The snapshot stores only:

- establishment, policy, library, and native-intent foreign keys;
- version, source, capture state, capture reason, and profile freshness state;
- profile generation and update timestamps when available;
- a SHA-256 digest of the bounded payload;
- a bounded profile-evidence projection, its existing projection fingerprint,
  quality summary, and warning identifiers;
- expiration and redaction metadata.

The payload explicitly records `observed_context_not_policy_authority` and the
existing `media_server_contents` / `observed_evidence` authority vocabulary.
It does not store individual media items, titles, paths, descriptions, raw
provider output, prompts, browser selections, policy drafts, API keys, or
secrets.

## Retention And Redaction

The recovery window is 14 days, matching the native rollback-snapshot window.
At expiry, a daily, transactionally locked cleanup replaces the payload with a
minimal retention marker. The marker retains safe IDs, timestamps, original
payload byte count, and a digest, but no prior evidence labels or values.

The database update trigger permits only that one-way redaction transition.
It rejects metadata rewrites, repeat redaction, and arbitrary payload changes.
Cleanup does not change policy authority, routing, learning, or media state.

## Operational Behavior

- Reads originate only from the already stored `library_profiles` row.
- Creation does not refresh a media server, call providers, consume quota, or
  inspect live library contents.
- Backup exports the bounded snapshot and transactional restore remaps its
  establishment, policy, library, and intent references.
- Backup restore retains redacted markers as markers; it never recreates their
  original payload.
- The scheduler cleanup uses a dedicated PostgreSQL transaction advisory lock
  and `FOR UPDATE SKIP LOCKED` to prevent overlap across replicas.

## Final Recommendation Stack

1. Keep operator-declared native intent as the only durable policy authority.
2. Persist one bounded observed-profile provenance snapshot per initial
   establishment in the same transaction.
3. Use an internal deterministic SHA-256 digest for correlation, not a signing
   claim.
4. Redact payloads after 14 days and retain only the minimal marker metadata.
5. Include the bounded record in backup/restore and storage-closure evidence.
6. Reject any future proposal that uses this snapshot to infer, learn, route,
   refresh, or mutate policy authority without a separately approved contract.

## Verification

Focused tests cover bounded capture, missing and stale profiles, deterministic
digests, transaction rollback on provenance persistence failure, locked
redaction, scheduler delegation, backup/restore reference mapping, and schema
constraints. The schema snapshot is generated from a fresh migrated Docker
database rather than hand edited.
