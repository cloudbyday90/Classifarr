# Reviewed-repair readiness outcome

Date: 13 October 2026 (Eastern). No release, version bump or live repair approval.

## Delivered behavior

The explicitly loaded reviewed-repair list now explains why each item is ready
or blocked. Reasons cover changed settings or requests, conflicting/invalid IDs,
unsupported request formats, unavailable retry budgets, ineligible task state and
prior work. The page records when the snapshot was taken. It does not claim TMDb
availability or successful classification.

A small shared ESM eligibility module serves both the readiness reader and the
locked retry writer. A separate read model uses PostgreSQL read-only repeatable-read
transactions, up to 20 items, sequential checks, existing timeouts and one active
read per service instance. Unknown failures abort the read instead of returning
ready items. The HTTP route propagates client disconnection, returns no-store
responses and retains ordinary admin-session restrictions and rate limits.

Fixed client copy describes blockers, associated checkbox descriptions expose
the reasons to assistive technology, and loaded counts use a status region. Missing,
unknown or inconsistent readiness cannot be selected. Reload clears selection and
consent. Every explicit retry still revalidates under the original write locks;
readiness is never a reservation or authorization token.

No schema, scheduler, automatic enrollment, source-library mutation, memory-safeguard
change or budget reset. Existing consumed receipts, individual retries and generic
Retry All retain their prior behavior. No actual task was approved or retried.

## Verification

- Focused backend unit/real HTTP: 93 tests across five suites passed, including
  cookie CSRF, access-token scope, shared limits, safe response projection and
  actual HTTP disconnect cancellation.
- Full frontend: all 473 suites and 7,325 tests passed with exit zero, including
  the final API projection assertion. Coverage: statements 87.72%, branches
  81.69%, functions 87.44%, lines 89.42%.
- Isolated PostgreSQL: 140 tests across six suites passed. New cases cover all
  common blocker reasons, read/write gate agreement, unchanged task rows, no
  provider requests, consistent snapshots during a separate committed write,
  stale-ready refusal, database-enforced write prohibition, cancellation without
  partial results, lock timeouts and revoked administrators.
- Type checks, final lint, preflight, ESM import/mock shape, migration/schema
  integrity and Markdown checks passed. One Vue formatting warning and a test-only
  Promise executor lint error were corrected; focused tests and final lint passed
  again. Markdown covered 2,194 files without errors.
  The ownership gate passed without baseline changes but retains its existing
  unresolved writer-isolation debt (`productionCompatible: false`).

Full backend coverage, packaged image and local deployment results will be recorded after
completion. No production-deployment or upgrade claim is made by these checks.

## Recommendation and scope

The [design](queue-repair-readiness-design.md) records verified official sources,
alternatives, pros/cons and the final recommendation stack. The benefit is an
explanation before submission; the cost is bounded extra local queries and a
snapshot that can become stale. Final write checks remain authoritative.

GitHub MCP enumeration found zero open Classifarr PRs. None could be randomly
selected or implemented; no closed PR was substituted and none was merged. All
seven workflows on preceding main commit `7d8bd280e` passed.

Next: design explicit unattended retry enrollment per repair receipt, including
durable consent/revocation, cooldowns and remaining-attempt checks. Do not enroll
existing approvals automatically. Investigate any new failures before expanding
recovery scope; current local/Unraid data is not assumed eligible.
