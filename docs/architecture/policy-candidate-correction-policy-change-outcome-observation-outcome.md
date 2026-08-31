# Policy Change Outcome Observation Outcome

## Status

Implemented and locally validated on the unreleased branch. No release,
version bump, or tag is authorized by this work.

## Intended Outcome

The component lets an administrator explicitly begin one content-free 28-day
observation after a recent approved native policy change. It preserves only
fixed aggregate pre-change counts and an opaque hypothesis identifier, then
automatically shows a descriptive comparison once the following full
observation period is complete.

## Implementation Checklist

## Delivered Design

- Modular ESM contract, persistence, service, and route layers.
- One expiring content-free observation control in PostgreSQL, using an
  internal receipt reference without a foreign key so normal short receipt
  retention cannot corrupt the longer observation read window. A daily,
  lock-coordinated cleanup deletes it at expiry, and any backup-restore mode
  clears this operational baseline before applying configuration.
- Strict administrator authorization, request-selector rejection, no-store,
  transaction advisory locking, a server-generated opaque identifier, and
  separate read/start rate limits.
- An automatic, read-only Security Settings refresh only while an observation
  is active; a native accessible table and a concise polite status message
  make the result usable without a second action.
- The existing-observation start path also loads the completed fixed follow-up
  aggregate, so a duplicate start cannot fail after the outcome becomes ready.
- Server contract, service, and route tests plus client API and strict response
  projection tests. The local Docker image was rebuilt and the migration was
  applied to the local compose instance before the schema snapshot refresh.

## Open Pull Request Check

On 2026-08-31, the repository had no open pull requests. Therefore no random
open PR could be implemented locally. This work does not substitute a closed
or merged pull request.

## Validation

- Targeted server tests passed: contract, service, and HTTP authorization / no
  selector route tests.
- Targeted client tests passed: fixed endpoint API and response-projection
  presentation tests.
- Client typecheck passed and the production Docker build completed.
- Migration naming and integrity checks passed. The local compose startup
  applied the migration and the running database schema was regenerated into
  `database/schema/current.sql`.

## Next Item

Evaluate a **separate, reviewed policy-change decision record** once at least
one outcome follow-up completes: link a chosen manual policy decision to the
content-free aggregate result and an explicit rationale, while retaining no
media identifiers and granting no automatic AI/RAG or routing authority.
