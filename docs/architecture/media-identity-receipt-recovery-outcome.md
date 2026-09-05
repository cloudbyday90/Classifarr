# Media identity receipt recovery outcome

## Delivered behavior

The follow-up to [administrator identity review](media-identity-review-outcome.md)
recovers the audit evidence when confirmation commits but its response is lost.
The browser retains only the item/preview reference in the current tab, checks
the receipt once after an uncertain response, and restores recovery on reload.
A missing or unreadable receipt leaves the outcome unknown and offers a manual
check or an explicit return to the queue without a confirmed outcome.

The [separate design](media-identity-receipt-recovery-design.md) records the official
research, alternatives, and contract. New code uses ESM with a small read service,
storage utility, recovery composable, and notice component. The existing named
API leaf and review orchestration integrate them. The migration adds one partial
expression index to the existing audit log; it introduces no duplicate receipt
storage, dependency, version bump, or release.

## Security and accessibility outcome

The GET checks the current active administrator and committed audit entry in one
SQL statement snapshot. It returns only the original actor's typed historical
receipt for the requested item and preview. Other-actor or wrong-item evidence
is not disclosed. Duplicate and malformed evidence fails closed. The read uses
bound parameters, a two-row limit, and the existing ordinary session restrictions
and `no-store` response policy. It requires neither a surviving source item nor
an unexpired preview. The original atomic confirmation transaction is preserved.

The shared transport was found to retry mutations after network and selected
HTTP failures. A typed `skipAutomaticRetry` option now disables transport retries
and authentication replay for this confirmation and its recovery read. Tests
prove that network loss produces exactly one confirmation POST through the real
browser transport. Each subsequent attempt to recover is a GET.

The notice uses native buttons, text explanations, status announcements, and
logical return focus. A recovered receipt explicitly describes a past event;
it does not claim the current inventory still has that ID. Unknown outcomes never
announce a saved or failed identity write. Media content and credentials are not
stored in the recovery reference. Blocked browser storage produces an in-memory
fallback and a visible instruction to keep the page open.

## Local validation

- PostgreSQL 18: 26 integration checks passed across the original review and new
  recovery suites. They include real transaction rollback, actor isolation and
  revocation, historical recovery after source changes/deletion, repeated reads
  inside `BEGIN READ ONLY`, and an uncommitted audit entry becoming visible only
  after commit. Duplicate audit evidence is rejected.
- A 10,001-receipt fixture used the new partial expression index in the actual
  service's `EXPLAIN (ANALYZE, FORMAT JSON)` plan, without forcing the planner.
- Chromium: three tests passed for the original keyboard confirmation flow,
  lost-response recovery by a keyboard read, and recovery after reload. They
  check a single confirmation POST, historical receipt text, focus, and a
  390-pixel viewport without horizontal overflow. The mobile recovery capture
  was visually inspected.
- The full application Docker image built. An isolated application container
  applied migrations and regenerated the authoritative schema snapshot. A
  separate fresh-container schema comparison passed and cleaned up afterward.
- The running local Compose instance executed the receipt service within a
  read-only transaction, verified a current administrator, and returned
  `not_observed` for a new reference. No real inventory identity was changed.
  These checks do not claim human review or measured provider accuracy.

- Backend coverage: 1,048 suites and 29,287 tests passed in 619.4 seconds using two
  workers with a 1,024 MB worker-recycling threshold. Statements/lines 90.05%,
  branches 80.25%, functions 92.70%.
- Client coverage: 318 suites and 4,297 tests passed. Statements 85.62%, branches
  77.12%, functions 84.57%, lines 87.66%.

The coverage ratchet passed with fresh reports and no baseline changes.
Server/client lint and type checks, both Knip checks, static-import and strict
ESM mock-shape checks, migration naming/schema integrity, documentation lint,
and whitespace checks passed.

The first focused run exposed a storage test using the browser prototype while
this repository installs its own memory storage in Vitest. Spying on the actual
storage object now exercises the intended failure. The type check also required
an Axios request-option declaration; the ESM declaration is included by the
client type-check configuration.

## Recommendations, tradeoffs, and next item

Use ordinary administrator authorization → snapshot-bound audit lookup → strict
typed receipt projection → minimal tab reference → explicit GET recovery and
accessible outcome text. This recovers evidence without another identity write
and avoids inferring a past event from mutable inventory state.

The tradeoffs are dependence on existing audit retention and the original active
administrator account. Closing the tab, blocked storage, or explicit dismissal
can lose the browser reference. A storage removal failure can cause another safe
lookup on reload. An absent receipt cannot establish failure, especially during
an in-flight transaction. This is historical audit recovery, not an immutable
ledger or a repair operation.

**Next product task: unify observed-library prevalence and metadata coverage.**
The user's clarification prioritizes automatic understanding of existing library
contents over operational input. The [inventory-driven direction](library-observation-automation-direction.md)
maps existing profiles and refresh/retrieval services, records a real Compose
assessment, and identifies a reproduced genre-percentage denominator mismatch.
Build on that foundation; manual identity review remains an exception path.

The shared HTTP mutation-retry audit remains a correctness follow-up. Inventory
callers and their side effects, make retry eligibility explicit, and require
server idempotency or outcome recovery before replaying writes. Test network
loss, 429/5xx responses, and authentication refresh. Other endpoints still inherit
the existing retry behavior; this patch opts out the identity-confirmation workflow.

The semantic study remains gated on an eligible held-out 24–32-case cohort,
independent human labels, measured errors, readiness, and frozen-study preflight.
No semantic counter-evidence or automatic routing is enabled by this change.

## PR and delivery scope

The GitHub MCP open-pull-request query returned an empty list at both checks.
There was no open PR to select randomly or implement locally; closed PRs were
not substituted. This work is tracked under Unreleased, with delivery to
`origin/main` as requested. The version remains unchanged and no release is created.
