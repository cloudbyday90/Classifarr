# Source recovery outcomes: design

Date: 2026-09-26. Unreleased; no deployment or release.

## Finding

The previous visual-overview commit (`cde32de5`) correctly separates freshness,
metadata issues, and pending decisions. Recovery details still have only a retry
timestamp. `mediaSyncIdentityRecovery` collapses provider failures, unsupported
evidence, and changed source snapshots into `null`. Successful repairs already
have server-owned receipts; another queue would duplicate existing machinery.

## Recommendation stack

1. Keep one latest bounded outcome on the existing source observation. This
   survives restarts and follows existing retention/cascade deletion. Tradeoff:
   it is current evidence, not an append-only history or trend dataset.
2. Fence outcomes by capture generation, source digest, and attempt UUID. Record
   the claim before provider IO, without holding database locks during IO.
   Tradeoff: a crash leaves an attempt without a result, explicitly unknown.
3. Preserve the eight-attempt session budget, daily retry gate, and independent
   identity checks. Record preflight limitations without claiming provider work.
   A budget/cooldown skip must not overwrite an earlier useful outcome.
4. Extend the existing read-only API and Vue/SWR details with fixed reason labels
   and concise next steps. Tradeoff: old rows have no outcome until eligible work
   occurs; never fabricate a historical diagnosis from a timer.

Final recommendation: existing PostgreSQL storage and recovery services, small
ES modules, allowlisted reason codes, native accessible status text. No new
telemetry platform, worker, AI call, or automatic identity selection.

## Safety and concurrency

Only unresolved observations with matching server/library/generation/digest can
receive outcomes. Completed attempts are immutable for their attempt token.
Changed source evidence clears both cooldown and diagnostic state. Unclaimed
diagnostics cannot replace a claimed attempt. Successful persistence timestamps
the existing receipt in the same transaction that removes the observation.

No exception messages, URLs, tokens, provider payloads, or raw identifiers enter
the outcome. Recording failure cannot approve a repair or interrupt normal sync;
it produces a deduplicated operational warning. Existing observations retain
their count/age bounds. Neither retry eligibility nor an unfinished attempt
means a worker is currently running.

## Official research

Sources discovered and read through web tools on September 26, 2026:

- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html):
  conditional updates and `RETURNING` identify whether a guarded write occurred.
- [OpenTelemetry error recording](https://opentelemetry.io/docs/specs/semconv/general/recording-errors/):
  distinguish operation outcomes and avoid duplicate exception reporting. This
  guidance is marked Development; we adopt the principle, not a new dependency.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  expose status changes programmatically without unnecessarily moving focus.
- [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color):
  retain text labels and counts alongside the existing colored recovery bar.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  use validated reason categories, exclude sensitive data, and keep diagnostic
  failures from disrupting otherwise safe application processing.

## Validation plan

Exercise provider exceptions and malformed responses, insufficient evidence,
source changes, cooldown/budget skips, rejected diagnostic writes, replayed and
superseded outcomes, atomic successful receipts, changed-evidence reset, legacy
unknown rows, and client contract/next-step rendering. Use isolated PostgreSQL
and synthetic browser responses; do not run live provider repairs.
