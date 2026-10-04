# Preset saving: outcome

Date: 2026-10-03. Branch: `main`. Starting revision: `5393ca7d`.

Follow-up: [durable creation receipts](preset-save-receipts-outcome.md) supersede
the creation-recovery limitations below. This document retains the prior round's
measured results; the update path still uses manual review.

## Delivered

- The manager owns request state through the small ESM `usePresetSave`
  composable. The form emits intent, rather than pretending an event is an
  asynchronous save operation. One pending write is allowed per manager.
- Saving disables the draft, Save, Cancel and the modal close button. Escape
  and backdrop requests cannot dismiss the pending form. State remains busy
  until the actual request settles; late completion after unmount is ignored.
- Create/update use one attempt and a 30-second client timeout. Existing
  authentication and CSRF headers remain; transport retries and authentication
  replay are disabled for these two writes only.
- Explicit refusals show safe, actionable text inside the modal. Drafts remain
  available for correction. Uncertain results offer **Check saved presets**
  instead of another Save. Closing/reopening does not bypass that requirement;
  it clears only after the requested review read succeeds.
- Review clears filters and opens My Presets without replaying the write. An
  acknowledged save closes the form before refreshing the list, so a failed
  refresh cannot incorrectly offer to repeat successful creation.
- The name field has a connected label/validation message, and saving uses an
  in-dialog status region. Error bodies are not rendered or logged by the save
  path. The related deletion error is also inside its modal, with dismissal
  blocked while deletion is pending.

See the separate [design and verified official sources](preset-save-state-design.md)
and [native modal outcome](../native-modal-outcome.md).

## Verification

- Focused save, form, manager, API and transport tests: **87 passed**.
- Full client coverage: **431 files / 6,199 tests passed**, no skips, 383.57s.
  Statements 86.60%, branches 79.42%, functions 86.14%, lines 88.46%.
- Chromium: **50 executions passed**, zero retries, 25 scenarios run twice.
  The initial run exposed two new-test selector mistakes (three status regions
  in the real form, and an Edit button labelled simply Edit). Corrected the
  selectors; no application behavior, timeout or assertion was weakened.
- Client lint and strict API/component typechecks passed.
- Backend unit coverage: **1,654 suites / 50,694 tests passed**, 900.555s.
  One existing Linux directory-fsync case was skipped on Windows; no new skip
  was added. See [its purpose and Linux execution](../testing-linux-filesystem.md).
  Statements/lines 90.04%, branches 85.50%, functions 91.53%. Database integration
  tests and a fresh Linux execution of that case were not run in this UI round.
- Production build passed (6.94s). Synthetic dialog fixture labels are absent
  from the production JavaScript. The bundler's timing advisory is diagnostic,
  not a failed build; the browser runner's color-environment warning is unchanged.
- Combined coverage ratchet, static-import check, npm CLI flag check,
  copyright check, whitespace check and Markdown lint passed (1,836 documents).
- Staged Gitleaks scan passed with redacted output and networking disabled;
  no secrets were detected. No release or deployment was performed.

Local logs are in `.tmp/preset-modal-*.log` and are not committed. Remote CI,
release acceptance and deployment are separate from these local results.

## Limits and tradeoffs

This is not a durable exactly-once guarantee. Reloads and other tabs do not
share the local admission guard. A client timeout cannot cancel a committed
server write, and even a successful list read does not prove a timed-out request
has stopped. Review reduces accidental duplicates; receipts would provide
stronger reconciliation. No server endpoint, schema, migration or dependency
changed, and no live presets were created, edited or deleted during tests.

Keeping pending dialogs open costs up to the request timeout, but avoids
suggesting that Cancel rolls back a server write. Safe fixed error text avoids
leaking internal details but is less specific than raw server messages.
Browser evidence is limited to Chromium; it is not a full accessibility audit.

## Final recommendation stack

1. **Keep parent-owned state and single-attempt writes.** Small, maintainable
   modules with accurate feedback; uncertain outcomes still require review.
2. **Next: durable receipts for preset creation.** An idempotency key and an
   authenticated lookup can reconcile lost responses across reloads and tabs.
   Benefit: stronger duplicate prevention. Cost: an explicit database/API
   contract, retention policy and concurrency tests; do not infer identity by name.
3. **Before release: Firefox/WebKit and assistive-technology checks.** Keep the
   same real-caller scenarios; extra browser coverage costs setup/runtime but
   tests behavior that jsdom cannot establish.
4. **Resume dependency/tooling updates separately.** Recheck official releases
   and advisories rather than expanding this interaction fix with unrelated
   version changes. Audit other create endpoints' retry policies as a scoped task.

## Scope and process

GitHub MCP returned **zero open Classifarr PRs** during this round. There was
no random open PR to implement; none was invented or merged. The native-dialog
work also checked the saved GitHub CLI login with the same result.

The recovery-change skill shaped admission, unknown-outcome handling and tests;
the plainspoken skill kept updates concise. This is an Unreleased change on
`main`, not a release, version bump, tag, image rebuild or live recovery.
