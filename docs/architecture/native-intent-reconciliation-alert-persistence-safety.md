# Native Intent Reconciliation Alert Persistence Safety

Status: implemented on 2026-07-16 as Phase 8R.3.2.7 failure-injection and
alert-lifecycle coverage.

## Problem

Native intent reconciliation alert evaluation writes a durable alert lifecycle
state and, when due, one in-app notification in the same transaction. On
PostgreSQL 18, the alert-state upsert reused an untyped `$2` parameter as both
an `INSERT` value and a `CASE` condition. PostgreSQL could infer incompatible
types for that one parameter and rejected the statement with SQLSTATE `42P08`.

The transaction therefore rolled back. A scheduled reconciliation result stayed
truthful, but the system could neither persist the alert state nor apply its
notification cooldown. The previous outer error record exposed only a generic
alert-evaluation failure, leaving the actionable persistence boundary unclear.

## Research

- [PostgreSQL PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html)
  explains that unspecified parameter types are inferred from their SQL
  context.
- [PostgreSQL libpq command execution](https://www.postgresql.org/docs/current/libpq-exec.html)
  recommends explicit casts in query text when the server cannot determine or
  chooses an unsuitable parameter type.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends structured, useful operational context while excluding sensitive
  exception material and unneeded raw data.

## Options

1. Keep inferred query parameters: smallest change, but a valid alert can fail
   on PostgreSQL type inference and continually retry without durable cooldown
   state.
2. Persist raw PostgreSQL errors or SQL text: faster diagnosis, but turns
   support logging into a store for internal query detail and possible
   connection or payload information.
3. Explicitly type all reused parameters and map alert failures to fixed
   stage/reason IDs: deterministic query behavior and actionable support
   evidence without exposing raw database text.

## Decision

Use option 3.

`nativeIntentReconciliationAlertPersistence.mjs` now explicitly casts the
alert-state upsert parameters to `varchar` and `timestamptz`. This makes the
database contract independent of contextual inference while retaining the
existing single-transaction lifecycle semantics.

`nativeIntentReconciliationAlertFailureAttribution.mjs` defines a bounded alert
failure boundary:

- status read;
- transaction ownership;
- alert-state load;
- in-app notification persistence; and
- alert-state persistence.

The outer reconciliation result and log record receive only a fixed stage and
reason. SQLSTATE `42P08` at the alert-state persistence boundary maps to
`reconciliation_alert_state_parameter_contract_invalid`. Raw database messages,
SQL text, stack traces, credentials, and notification payloads do not leave the
failing call.

## Security And Operational Outcome

- Alert failure remains observational: it cannot change an already-completed
  reconciliation result or authorize policy conversion, routing, or learning.
- The lifecycle upsert and in-app notification remain atomic, preventing a
  notification from being recorded without its cooldown state.
- Future persistence failures identify the safe failing boundary without
  retaining sensitive infrastructure detail.
- No database migration is required because the schema contract did not
  change.

## Verification

- Unit tests prove the upsert query declares all reused parameter types.
- Failure-injection tests prove SQLSTATE `42P08` becomes a bounded
  alert-state-persistence reason and removes source error text.
- A Testcontainers PostgreSQL 18 integration test executes the real upsert,
  creates one repeated-failure in-app alert, suppresses its duplicate inside
  the cooldown, and persists the resolved lifecycle state.
