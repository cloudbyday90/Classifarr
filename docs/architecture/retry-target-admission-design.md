# Retry target admission design

November 15, 2026 (America/New_York). Agreed first batch at main
`c6ed9348d1e04a78afc17a5aeafe68ef0e41a7d3`; complete shared understanding was
confirmed under the repository workflow before implementation.
This is the next boundary after the
[notification-side retry repair](retry-notification-id-matching-outcome.md).

## Observed problem

The public retry route accepts an ID through Number conversion, while the retry
service later uses Number.parseInt. The same decoded value can therefore select
a different History row. In isolated tests using the real router, retry service
and production database factory, string `"1e2"`, numeric `1e21` and a nested
array each queued row 1. Row 100 remained unchanged. These are local synthetic
reproductions, not established production incidents or authorization bypasses.

Internal batch calls also truncate fractions and partial strings. Direct
`retrySingle` calls bypass batch normalization. The notification parameter still
requires INTEGER, so wider targets can reach lookup and link-clearing writes
before refusal and rollback; missing wider targets can instead return not_found.

Historic route-safety refresh normalizes its selections with Number, then creates
a durable receipt before calling the common retry service. An isolated control
using the actual receipt repository confirms that a later service admission
refusal can leave a requested receipt. A common service guard alone would not
close that command's pre-write boundary.

Baseline evidence: three existing unit suites passed 59 tests. Fourteen isolated
diagnostics passed, covering those HTTP wrong-row cases, normalization, direct
target coercion, missing out-of-range lookup and receipt ordering. Read-only
consumer tracing and Astra review are separate from these executed tests.

## First batch: one exact server admission contract

Add a small, pure retry-target leaf, reusing the existing canonical database-ID
validation without changing that shared helper. Admit only:

- Number primitives that are positive safe integers from 1 through 2147483647.
- Canonical ASCII decimal strings in that same range, without signs, whitespace,
  leading zeroes, exponent notation, decimal points or trailing text.

Reject other primitive types, containers, objects, unsafe/fractional numbers,
zero/negative values and out-of-range IDs. Check primitive types before numeric
conversion; scalar validation must not execute object coercion hooks. Reuse the
existing bounded canonical parsing before range comparison, without parsing
arbitrarily large integers.

This is a decoded-value contract. Numeric JSON `1e2` has already become Number
100 and remains admissible; string `"1e2"` is rejected. The server cannot recover
spellings or identity already lost through upstream coercion. Existing client
bulk conversion is outside this first admission guarantee.

Use the leaf at these boundaries:

1. Public `/retry` scalar validation before forwarding to the service.
2. `normalizeIds`, validating the complete raw batch before any item executes.
   Preserve maximum 100 raw entries, numeric normalized results, input order and
   deduplication of 41 with `"41"`.
3. Direct `retrySingle`, before opening a retry transaction, acquiring its locks
   or invoking eligibility/receipt callbacks. Use the parser for admission;
   preserve admitted raw scalar types in bindings, results and lineage.
4. Historic-refresh command selection, before receipt creation. Preserve its
   maximum 50 entries, stricter duplicate rejection, actor checks and existing
   receipt protocol. Leave its legacy result-map normalization separate.

Keep HTTP/batch ValidationError statuses and envelopes. Existing validation
wording may become fixed and range-aware, without echoing invalid values. An
invalid direct target returns the existing failed/retry_failed result envelope
before lookup. Valid absent targets retain not_found; all other existing skips
remain for admitted targets. Thus newly invalid inputs intentionally fail earlier,
including wider missing IDs previously reported as not_found.

Document the narrowed request contract in the existing client API leaf and test
its raw forwarding/error propagation. Add no client coercion or UI validation
framework. Existing named API functions, credentials, CSRF, cancellation and
transport/retry behavior remain unchanged.

## Authority, lifecycle and limits

The no-retry-write guarantee starts at the server boundaries above: rejected
targets cause no retry transaction, cleanup, queue insertion, new historic
execution receipt or associated callbacks. It excludes upstream client
conversion, authentication, diagnostic logging and provider-probe coordination
that can precede a direct retry call. Do not claim that all platform activity is
suppressed by invalid target admission.

For admitted targets preserve identity/row locks, eligibility/readiness,
duplicate-task refusal, cleanup, budgets, task construction, receipt callbacks,
History/outcome writes and postcommit follow-up. Keep the one-attempt transaction
runner, resource limits, cancellation, restart behavior and uncertain-COMMIT
handling. A lost reply can still produce durable state with retry_failed; add no
refund, replay, unknown-outcome status or new receipt type.

Do not widen the notification INTEGER parameter, change low-level cleanup's
legacy coercion, modify SQL/schema, rewrite historical records or alter library
scoring, routing or learning authority. Add no endpoint, setting, job, page,
operator CLI trigger, provider call, live configuration write, release or
deployment. Existing application actions and automatic recovery remain the
entry points.

## Lineage is still a separate problem

Fresh capture preserves the original retry target, but request/webhook lists and
later rebinding use parseInt. Rebinding performs separate writes and catches
failures after earlier writes may already have committed. Moreover, when current
capture returns no lineage, retry construction can retain an older inherited
metadata.retry_lineage object and copy it into the queued payload.

Exact admitted targets do not prove inherited lineage ownership, historical
receipt identity or downstream reference exactness. Do not repair those through
current History/configuration guesses in this batch. A later design must settle
fresh capture versus explicit absence, per-domain ranges, whole-record versus
partial refusal, transaction ownership and truthful completion reporting.

## Verification and delivery

After shared-scope confirmation, add old-failing regressions before runtime
implementation. Exercise:

- Public string exponent, unsafe numeric exponent and nested-array requests
  against owned rows 1 and 100; neither row may change after rejection. Keep
  ordinary numeric 100 and canonical `"100"` valid.
- Scalar grammar/type/range boundaries, hostile coercion hooks, canonical strings
  and safe numbers, zero/negative and INTEGER maximum/maximum-plus-one. Preserve
  raw direct-call scalar types for admitted targets.
- Complete mixed-batch refusal, raw count limits, order and numeric deduplication.
  Invalid direct inputs reach no retry transaction or callbacks; admitted absent,
  ineligible, duplicate and exhausted-budget outcomes retain their semantics.
- Historic pre-receipt refusal, including mixed/duplicate/out-of-range selections,
  with real PostgreSQL proving no new receipt header/items or retry work. Preserve
  actor/read-write authorization, valid receipts and existing replay/reconciliation.
  Visit sparse-array holes as invalid entries rather than skipping them; pass
  array-valued test cases as single arguments so the regression tests that boundary.
- Actual retry cleanup, concurrency, SQL/receipt rollback, delayed/lost native
  COMMIT acknowledgement, postcommit follow-up and no uncertain replay.
- Client API forwarding and server-error propagation, existing views and affected
  browser controls, without changing transport or UI behavior.

Run fresh affected backend/client coverage and normal quality/security gates.
Review every affected ownership entry without weakening classifications, parser,
baseline or review cap. Maintain artifacts, write a separate observed outcome and
Unreleased note, then commit/push intended changes on main and inspect exact-source
CI. No PR is open at intake; recheck and rebase only genuinely stale applicable
Dependabot work, without reusing closed PRs or merging one.

## Official research and independent review

Discovered and opened through MCP on November 15, 2026:

- [ECMAScript 2026 parseInt](https://tc39.es/ecma262/2026/multipage/global-object.html)
  defines conversion that can consume only a prefix. Application inference:
  identity admission must not use permissive prefix parsing.
- [ECMAScript 2026 Number](https://tc39.es/ecma262/2026/multipage/numbers-and-dates.html)
  defines safe-integer precision boundaries. Reject unsafe Number identities;
  do not infer the original integer from an already rounded value.
- [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
  distinguishes INTEGER and BIGINT ranges. The first contract retains the smaller
  range required by current retry cleanup rather than implying wider support.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  supports early syntactic and semantic allowlisting. Here the application
  inference is one bounded typed parser before target-specific side effects.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  supports explicit structural/representation contracts. Document decoded numeric
  values separately from canonical string IDs; no UI/conformance claim follows.

Astra independently recommends this shared positive INTEGER admission batch,
including the historic pre-receipt boundary and preserved result/error envelopes.
It supports leaving lineage and result-map compatibility separate. The proposed
scope preserves its stated limits; no runtime edits were made during review.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Route-only validation | Smallest public fix | Internal/direct calls and receipt ordering remain inconsistent |
| Shared exact INTEGER admission plus pre-receipt guard | Closes established command boundaries without widening support | Deliberately rejects former alternate spellings and changes earlier refusal results |
| Full BIGINT admission now | Wider target range | Cleanup, lineage, client and outcome boundaries are not ready |
| UUID migration | Avoids numeric identity representation for new keys | Broad reference/API/receipt migration; does not fix current parsing by itself |

Recommended stack: reuse canonical primitive validation, apply the existing
INTEGER range, share admission across route/batch/direct commands and the historic
pre-receipt boundary, preserve valid execution/replay authority, then establish
fresh exact lineage before widening ranges or considering UUID migration.
