# Policy Runtime Pending-Question Cleanup Plan

**Status:** Complete for Phase 5R.7.1

## Purpose

Older pending policy questions can have incomplete contracts, obsolete candidate
libraries, stale policy context, free-form genre-priority wording, or
untrusted answer state. They must not be silently treated as valid questions or
as evidence for durable learning.

Phase 5R.7.1 adds a pure, server-owned classification contract. It evaluates
one persisted pending record and returns a bounded cleanup plan. It does not
read or write the database, regenerate a question, resolve an item, contact a
provider, or write learning evidence.

## Research Basis

The implementation uses these official practices available at the June 2026
planning cutline:

- The [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlist and semantic validation. Cleanup therefore
  accepts only known pending states, question contracts, runtime-answer fields,
  and positive library IDs; all other shapes remain non-actionable.
- The [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls out state-transition validation, transaction integrity, and workflow
  bypasses. The plan is pure so the later apply component can lock and
  revalidate state rather than mutate a record discovered by an earlier scan.
- PostgreSQL documents [transaction-level advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html)
  and their transaction cleanup behavior. Phase 5R.7.3 will use the existing
  transaction/lock conventions when it applies a plan; this component does not
  make durability claims.
- [Dependabot alerts](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts)
  and [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/) remain
  separate supply-chain checks, not substitutes for workflow validation.

## Options Considered

### 1. One SQL migration that rewrites all old questions

**Pros:** Fast deployment and a small immediate operational surface.

**Cons:** Cannot safely regenerate context-dependent questions, has limited
per-record explanation, is difficult to preview, and risks overwriting a
record that changed after the migration scan.

### 2. Mutate stale records when they are read

**Pros:** Avoids a separate cleanup workflow.

**Cons:** Turns an ordinary read into an unannounced write, obscures audit
history, creates concurrency ambiguity, and does not give an operator a
dry-run view before changes occur.

### 3. Pure classifier, then dry-run inventory and locked apply

**Pros:** Bounded reasons make every planned change inspectable; the database
layer can revalidate current state under a lock; no old question text, AI
rationale, or metadata becomes part of the cleanup result; and each action can
be tested separately.

**Cons:** Requires staged implementation and a later administrative execution
boundary.

## Decision

Use option 3. The pure ESM module is
[policyRuntimePendingQuestionCleanupPlan.mjs](../../server/src/services/policyRuntimePendingQuestionCleanupPlan.mjs).
Its output contains only a classification ID, canonical action and reason IDs,
question-contract category, non-learning disposition, and execution flags.

| Condition | Cleanup action | Learning outcome |
| --- | --- | --- |
| Current native or normalized question | `none` | Blocked by the runtime answer contract. |
| Current state was not evaluated | `mark_stale_require_retry` | Blocked until the inventory supplies current state. |
| Missing question, missing contract, vague genre priority, or missing learning metadata | `mark_stale_require_retry` | Permanently blocked for the old question. |
| Current policy context or candidate library changed | `regenerate_under_current_contract` | Permanently blocked until fresh evaluation. |
| Proven current runtime answer was recorded | `resolve_outcome_only` | No learning is created or reconstructed. |
| Raw AI context or untrusted legacy response | `block_learning_permanently` | No automatic resolution or learning. |

The classifier recognizes the native persistence envelope and the normalized
runtime question form independently. A valid native envelope must also carry
its safe outcome-only learning metadata. Any plan carries
`canWriteLearning: false`; the audit rejects plans that retain raw question or
metadata fields.

## Security Properties

- The caller cannot turn a plan into a learning write: no write operation or
  candidate evidence appears in the plan.
- Raw question text, AI rationale, answer labels, and stored metadata never
  leave the classifier.
- The audit allowlists every top-level, learning, and nested audit field, so a
  caller cannot use the bounded plan as a container for persisted content.
- A recorded answer is accepted only when it has the current runtime answer
  contract version, fingerprint, and action ID. A legacy response is not
  inferred as a final outcome.
- Library-reference and policy-context freshness require server-supplied current
  state. Missing current state cannot be interpreted as proof that a stale
  reference is valid.

## Implementation Outcome

Focused tests in
[policyRuntimePendingQuestionCleanupPlan.test.mjs](../../server/src/__tests__/services/policyRuntimePendingQuestionCleanupPlan.test.mjs)
cover current records, obsolete genre-priority wording, changed context and
libraries, proven recorded answers, raw AI or legacy response blocks, and plan
audit behavior.

## Follow-on Work

The next task is **Phase 5R.7.2: Dry-Run Pending-Question Inventory And
Bounded Report**. It will query only pending rows, obtain current context and
library state on the server, apply this classifier, and return an auditable
preview without mutating classifications.
