# PasswordInput modernization: outcome

Date: 2026-10-03. Starting revision:
`8799c3495cf497a9ee86cc5c7315277cbeead4f8` on `main`.
Local environment: Windows, Node 24.21.0, npm 12.2.0.

## Delivered

- Connected labels, stable hint/error IDs, merged external descriptions and
  native attribute/listener forwarding. Wrapper layout classes/styles stay put.
- Replaced emoji-only visibility controls with named Show/Hide buttons, input
  associations and visible keyboard focus. Improved border, hint and error
  contrast for the existing dark theme.
- Kept the string model, exact entered values and autocomplete defaults.
  Disabled spelling, autocorrection and capitalization while revealed. Synthetic
  edits are ignored when disabled or readonly; readonly values remain inspectable.
- Added an instance-owned ESM visibility composable: default masking, concealment
  on disabling/submission, form reassociation after updates and listener cleanup.
  No timer, global listener, network request or credential persistence is added.
- Updated all ten usages across six settings screens to supply connected labels.
  Web-search provider keys now have distinct names and linked keep-existing help.
- Enrolled PasswordInput in strict template checks and the existing checked-event
  lint rule. Added exact compiler negatives for its string model/event contract.

See [design, alternatives, trade-offs and official sources](password-input-design.md).

## Verification

- Full client suite with coverage: **426 files, 6,067 tests passed, no skips**.
  Statements 86.38%, branches 79.13%, functions 85.84%, lines 88.24%.
- Client lint, API/component typechecks and production build: passed.
- Real compiler tests exercise valid bindings, wrong password model/handler
  types, invalid hint expressions and unrelated native-attribute typos. Real
  ESLint tests include the newly enrolled component automatically.
- Runtime tests cover exact string delivery, caller listeners, escaping, hint
  lifecycle, distinct IDs, external accessible names, disabled/readonly guards,
  synchronous submit concealment, external forms and unmount cleanup.
- The provider settings integration test uses the real PasswordInput with mocked
  provider APIs, proving distinct labels and connected help at the actual caller.
- Chromium: four tests passed twice, **eight executions with no retries**. Tests
  cover keyboard focus and activation, native validation, single model delivery,
  no accidental submit on Show/Hide, submit-time concealment and no API requests
  during credential interaction. The 390px preview was inspected visually; no
  horizontal overflow and a visible keyboard focus outline.
- ESM static-import, npm CLI flag, copyright and whitespace checks: passed.
- Markdown validation: 1,826 documents, zero errors.
- Gitleaks: no secrets found in the staged patch.

## Findings during validation

1. Strict Vue templates reject the existing vendor data hints by default. The
   documented compiler option now recognizes only those two exact names. It is
   not a wildcard exemption. A negative test confirms their bound expressions
   still receive checks, and another rejects an unrelated attribute typo.
2. That typo produces TS2561 (with a spelling suggestion), not TS2353. The test
   now requires the actual source-mapped diagnostic, not just a nonzero exit.
3. Running compiler fixtures alongside the Vite browser server caused a reload
   during the first keyboard test. Run these stages sequentially. Lint can also
   encounter temporary compiler fixtures while they are being created; no new
   ignore rule was added to conceal the issue.
4. The expanded fixture exposed an ambiguous `Submissions` locator and overflow
   in its raw JSON debug output. The locator is exact, debug text wraps, and the
   fixture now uses the same body theme as the application. Browser checks pass
   repeatedly without increasing retries or timeouts.
5. Browser callbacks and fixture DOM checks use explicit `globalThis` access;
   lint remains enabled without blanket browser globals in Node-side tests.

## Limits

This is not a full WCAG audit, screen-reader certification or browser-extension
compatibility guarantee. The automated browser coverage is Chromium. Masking
does not encrypt values or prevent a browser extension from reading them.
Autocomplete and vendor hints remain advisory. No new secret logging is added.

Submit concealment handles native submit events, not direct `form.submit()` or
arbitrary AJAX-save callbacks. Form association follows Vue component updates;
out-of-band DOM reparenting is not observed. Existing credential request/storage
contracts and the application login/setup screens are unchanged.

No dependency, lockfile, backend, image, Compose or live-data change is included.
Backend tests, the combined coverage ratchet and image/live-data rehearsals were
not run for this client-only change. Old backend coverage must not be presented
as current combined evidence. The existing `NO_COLOR`/`FORCE_COLOR` browser-runner
warning remains visible. Local tests do not establish remote CI completion.

## Final recommendation stack

1. Keep the native control, shared attribute helper and bounded visibility
   composable. Benefit: consistent behavior without a new dependency. Cost:
   maintaining a small, explicitly tested form lifecycle helper.
2. Next modernize **TagInput**. Its current label is unassociated, removal
   buttons lack names and `type="button"`, and its array model/events are not
   strictly checked. Add keyboard, focus and no-accidental-submit regressions
   before expanding the strict component scope again.
3. Separately review login versus remote-provider credential autofill policies.
   Correct password-manager support can help users, but API keys and remote
   server passwords must not inherit an unreviewed site-login policy.
4. Keep Vue's supported compiler and the existing event-binding mitigation;
   reconsider ordinary JavaScript v-on only after upstream and runtime tests
   demonstrate a fix. Do not combine this with a broad language migration.

## PR and publication scope

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs
on this date. There was no PR to choose randomly; none was invented or merged.
Changes stay on `main` with an Unreleased entry. No version bump, branch, tag or
release is created. The plainspoken skill kept progress updates concise while
these separate documents retain the design and validation details.
