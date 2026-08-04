# Policy Learning Boundary Regression Suite

**Status:** Complete

## Purpose

Phase 5R.6 separates a resolved classification outcome from a durable change
to learning evidence. This document records the regression boundary that keeps
that separation intact as runtime paths evolve.

The suite deliberately tests server contracts and narrowly scoped source
boundaries. It does not preserve or snapshot the retired diagnostic UI. The
browser remains a consumer of server-owned question and answer contracts, not
an authority over durable learning.

## Research Basis

The design applies these current practices, reviewed against official sources
available through the June 2026 planning cutline:

- The [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny-by-default authorization, server-side
  enforcement on every request, and authorization test coverage. Durable
  learning therefore requires the server guard, locked execution state,
  revalidated authorization, and source-event receipt.
- The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends event logging that supports security investigation without
  recording sensitive data unnecessarily. The learning intake retains only
  that AI explanation text was present, never the raw text.
- GitHub describes [Dependabot alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts)
  as dependency vulnerability notices with remediation guidance. They remain a
  release-maintenance input, separate from learning-authority decisions.
- The [npm audit command](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
  provides the package-manager vulnerability report for the installed dependency
  graph. It is run for both client and server packages during this work.

## Options Considered

### 1. Browser-only end-to-end coverage

**Pros:** Exercises controls in a user-visible flow.

**Cons:** Cannot reliably detect a newly imported direct server writer, is
slower to run, and would unnecessarily retain or freeze the diagnostic UI that
the product is removing.

### 2. Broad source snapshots or repository-wide token bans

**Pros:** Quick to add and can detect obvious reintroductions.

**Cons:** Treats maintenance, migration, and authorized executor code as the
same risk surface; produces brittle failures during legitimate refactors; and
does not establish behavior for stale state, replay, or authorization.

### 3. Focused path allow/deny checks plus behavioral contract tests

**Pros:** Detects reintroduced learning calls in the runtime paths removed by
5R.6.4, proves the authorized executor retains required controls, and verifies
the security-relevant behavior without coupling the suite to retired UI.

**Cons:** Requires the explicit writer inventory and test rules to be kept
current when a legitimate runtime writer is added.

## Decision

Use option 3. The implementation is
[policyLearningBoundaryRegression.test.mjs](../../server/src/__tests__/services/policyLearningBoundaryRegression.test.mjs).
It is test-only: no production runtime service, API contract, or client surface
is introduced.

| Boundary | Regression evidence |
| --- | --- |
| Removed direct runtime writers | Rejects legacy writer calls from classification completion, queue administration, retry, reclassification, and media synchronization. |
| Authorized writers | Requires the executor command, receipt claim, exact-item writer, and refresh-backed compatibility/identity writer paths. |
| Stale question and AI input | Marks a stale question with AI explanation context as blocked and proves raw explanation text is absent from intake. |
| Outcome-only and durable tiers | Verifies outcome-only, exact-item, compatibility, identity, and hard-limit policy-edit decisions retain their canonical capabilities. |
| Cross-destination learning | Rejects a learning candidate whose destination differs from the locked final outcome. |
| Duplicate source event | Treats the receipt replay as a no-op for outcome and learning writers. |

## Final Recommendation Stack

1. Keep `policyLearningGuard.mjs` as the decision authority. A resolved item
   remains outcome-only unless an allow-listed tier is admitted.
2. Keep `policyAuthorizedOutcomeTransactionExecutor.mjs` as the final runtime
   authority before durable learning writes. It combines the persistence
   command, locked state, revalidated authorization, receipt claim, and effect.
3. Keep direct writer checks limited to normal runtime paths that were removed
   in 5R.6.4. Maintenance, backup, and migration paths remain separately
   inventoried and do not become automatic runtime authority.
4. Keep raw AI explanation text out of intake, persistence commands, and audit
   feedback. Record only bounded state needed by the guard.
5. Continue dependency vulnerability review with Dependabot and `npm audit`;
   do not use dependency tooling as a substitute for server authorization and
   replay protection.

## Outcome

The suite makes the Phase 5R.6 authority boundary executable without expanding
the production surface. A future change that reintroduces a removed direct
writer, permits an unsafe question to learn, creates cross-destination evidence,
or writes after a source-event replay fails before release.

## Follow-on Work

The next task is **Phase 5R.7: Stale Question Cleanup And Migration Safety**.
It will identify persisted legacy question records, expose deterministic dry-run
and apply actions, and ensure old questions cannot become durable learning.
