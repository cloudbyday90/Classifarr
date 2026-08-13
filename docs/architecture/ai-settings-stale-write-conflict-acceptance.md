# AI Settings Stale-Write Conflict Acceptance

## Status

11R.10 is complete on 2026-08-13. AI Settings now has a private,
single-resource optimistic-concurrency boundary that prevents one
administrator save from silently overwriting a later save.

This work does not add provider telemetry, provider calls, configuration
history, policy authority, routing authority, retry authority, or generic
configuration locking.

## Problem

The AI Settings resource is edited from several browser surfaces: the main AI
settings page, text and image embedding settings, RAG settings, and confidence
settings. Before this change, two administrators could read the same saved
configuration, submit different edits, and allow the later request to replace
the earlier one without an explicit conflict result.

The existing `configuration_revision` is intentionally private and supports
candidate-bound verification capability receipts. Sending it to the browser
would turn a narrow receipt implementation detail into a generic configuration
version API and would expose a value that browser code must neither derive nor
edit.

## Official Research Basis

This implementation follows official guidance reviewed in August 2026:

- HTTP defines `If-Match` as a conditional request precondition. A server that
  evaluates it as false must not perform the requested method and responds with
  `412 Precondition Failed`. [RFC 9110, section
  13.1.1](https://datatracker.ietf.org/doc/html/rfc9110#section-13.1.1) and
  [section 15.5.13](https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.13)
- HTTP `428 Precondition Required` exists for servers that require a
  conditional request to avoid lost updates. [RFC 6585, section
  3](https://datatracker.ietf.org/doc/rfc6585/#section-3)
- Responses with private administrative configuration state use `Cache-Control:
  no-store`, which forbids storage in caches. [RFC 9111, section
  5.2.2.5](https://datatracker.ietf.org/doc/html/rfc9111#section-5.2.2.5)
- Server-side validation and state-transition enforcement are required even
  when a client provides well-formed input. [OWASP REST Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  and [OWASP Input Validation Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

## Decision

### Opaque Write Tag

`ai_provider_config.configuration_write_tag` is an additive, non-null UUID
column. The migration backfills existing rows with `gen_random_uuid()` and
uses the same database default for future direct inserts.

The server turns that UUID into a strong quoted `ETag`. The tag is an opaque
freshness capability only; it is not authentication, authorization, a receipt
revision, a policy version, or a provider secret. The response sanitizer never
places the UUID in JSON.

The supported `GET /api/settings/ai` read returns:

- `ETag: "<opaque UUID>"`; and
- `Cache-Control: no-store`.

The browser keeps the tag only in view memory. It sends it as `If-Match` for
each `PUT /api/settings/ai` and accepts the response's replacement tag after a
successful save. It never persists, parses, derives, or exposes the tag.

### Conditional Write Boundary

Within the existing AI Settings transaction, the server:

1. acquires the transaction-scoped singleton advisory lock;
2. locks the current row with `SELECT ... FOR UPDATE` when present;
3. validates the supplied `If-Match` value against that locked row before any
   validation side effect, embedding cleanup, upsert, receipt, or runtime
   refresh;
4. applies the normal atomic save; and
5. rotates `configuration_write_tag` only on the successful upsert.

The result is intentionally bounded:

- omitted `If-Match` receives `428` with
  `ai_settings_write_precondition_required`;
- malformed, weak, wildcard, or non-current values receive `412` with
  `ai_settings_stale_write`; and
- either result includes only a fixed recovery message, code, and
  `reload_required: true`, with `Cache-Control: no-store`.

The browser reloads current AI Settings only for those two server-recognized
responses. It never auto-merges or retries a rejected save; the administrator
reviews the freshly loaded values and chooses whether to save again.

### First-Row and Upgrade Behavior

The application retains its supported no-row singleton state. A read in that
state emits a stable bootstrap precondition without writing a row. The first
write accepts that tag only while the row is still absent; its database insert
creates a random persisted tag. A concurrent first writer therefore causes the
other bootstrap request to fail with `412` after the advisory lock is released.

For existing installations, the migration adds, backfills, defaults, and marks
the column `NOT NULL` in one idempotent migration. There is no manual cutover,
configuration conversion, browser storage migration, or policy reconciliation
step. A deployment must run migrations before serving application traffic, as
the normal application startup path already requires.

### Rotation Scope

The tag rotates at the AI Settings persistence boundary, not on every update
to `ai_provider_config`. Runtime usage accounting, embedding cache metadata,
and other operational maintenance writes can update their own state without
creating a false administrator conflict. Any future writer that changes
AI-Settings-owned fields must use this same conditional persistence boundary or
receive a dedicated review and migration plan.

## Alternatives

### Expose `configuration_revision`

Pros: no additional column.

Cons: leaks a private receipt implementation detail, makes browser code reason
about a `BIGINT`, and pressures the narrowly scoped receipt sequence into a
generic configuration API.

Decision: rejected.

### Use a Deterministic Hash of Configuration Values

Pros: no persisted tag.

Cons: must define a canonical projection, changes when unrelated state changes,
and can reveal whether known configuration values are present. It also creates
cross-writer coupling that this resource boundary deliberately avoids.

Decision: rejected.

### Use a Session or User-Bound Tag

Pros: a tag cannot be replayed by another browser session.

Cons: breaks ordinary parallel administrator access and requires new server
session state. Authentication and authorization already protect the endpoint;
the tag's purpose is freshness, not identity.

Decision: rejected.

### Retry or Merge in the Browser

Pros: fewer visible conflicts.

Cons: can reintroduce a lost update, especially where separate settings views
hold different subsets of the resource.

Decision: rejected. Reload and explicit administrator review are required.

## Final Recommendation Stack

1. Use a database-persisted random UUID as the opaque, strong ETag source.
2. Require exact `If-Match` at the locked server persistence boundary and fail
   closed with `428` or `412` before side effects.
3. Rotate the tag only after a successful AI Settings upsert and return the new
   tag with `no-store` response directives.
4. Keep the tag and the private receipt revision out of JSON, logs, receipts,
   policy state, route state, and browser persistence.
5. Reload only after a recognized stale or missing-precondition result; never
   automatically retry, merge, or invoke a provider to resolve a conflict.
6. Keep runtime-maintenance updates out of this conflict resource unless a
   future design explicitly brings them under the same administrator contract.

## Acceptance Evidence

- `server/src/services/aiSettingsWritePrecondition.mjs` owns tag issuing,
  exact comparison, and bounded error classification.
- `server/src/__tests__/aiSettingsWritePrecondition.test.mjs` proves opaque
  strong ETags, bootstrap behavior, and fail-closed missing, weak, malformed,
  wildcard, and stale values.
- `server/src/__tests__/aiSettingsPersistence.test.mjs` proves precondition
  validation occurs after locking and before persistence effects.
- `server/src/__tests__/aiSettingsHandlers.test.mjs` proves stale writes return
  the fixed no-store response and do not refresh runtime state.
- `server/src/__tests__/integration/verification-capability-configuration-revision-integrity.test.mjs`
  proves fresh and existing-installation migration behavior and that two
  competing writes yield exactly one committed save, one `412`, and no rejected
  receipt.
- `client/src/__tests__/api/settingsProviders.test.js` proves ETag capture and
  `If-Match` propagation. Focused component and composable tests cover every
  editing surface and prove bounded reload behavior after a stale response.

## Next Task

Proceed with a release-readiness review of the remaining post-`v0.48.0-beta`
work. The next implementation candidate should be selected from a current
roadmap and production-risk review; 11R.10 closes the last planned AI Settings
concurrency gap and does not itself require a release.
