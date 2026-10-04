# Native modal isolation: outcome

Date: 2026-10-03. Starting revision: `5393ca7d38e483b1a8dbf5d30f61505da046f6c6`
on `main`. Local environment: Windows, Node 24.21.0, npm 12.2.0.

## Delivered

- The shared Modal now uses native `dialog.showModal()`. The browser owns
  background inertness and top-layer order; no custom document-wide inertness
  manager, background service, dependency, timer or global listener was added.
- Parent-controlled close requests still use boolean model events. Native
  cancellation is prevented until the parent accepts the request. Accepted
  close removes the node immediately, releasing modality without native
  `close()` forcing an unwanted return to the old route's opener.
- A small ESM dismissal helper requires pointer start and click end outside the
  dialog. Dragging from a field to the backdrop cannot accidentally close it.
  Existing typed focus management still handles headings, tab boundaries,
  unavailable openers, fallbacks and explicit route handoffs.
- Preset Summary and Customize both receive the stable preset-search fallback.
  The second dialog no longer depends on a Customize button removed with the
  first dialog. Existing preset deletion keeps its search fallback.
- Preset deletion failures now appear as a safe alert inside the active dialog,
  rather than on the inert background page. The message resets on retry/reopen;
  duplicate in-flight delete submissions are ignored and dismissal is disabled
  until the request settles. The deletion endpoint is unchanged.
- The panel retains caller classes, slots and labels. Entry animation is short
  and disabled for reduced motion. There is no exit fade to leave an invisible
  modal blocking the next view.
- Synthetic browser controls are explicitly labelled as a developer dialog test
  fixture, not a recovery workflow. Real preset and policy caller fixtures
  exercise application components with intercepted requests.

See [design, alternatives and official research](native-modal-design.md).

## Verification

- Focused Modal, dismissal, focus-target, Presets Manager and policy-builder
  tests: **78 passed**. The two corrected Node-only suites: **5 passed**.
- Chromium: **50 executions passed, zero retries** (25 scenarios run twice).
  Nine modal cases cover keyboard boundaries, actual native background
  focus/pointer isolation, nested stacking, lower-modal removal, opener fallback,
  immediate reopen, drag-out gestures, native cancel/parent refusal and reduced
  motion. Four real-caller cases cover deletion failure/retry, Summary-to-Customize
  plus successful and guard-rejected Vue Router navigation from the real policy builder to the real
  Library Detail view. Three preset-save cases cover pending/refused requests,
  uncertain outcomes without replay and acknowledged updates. Nine existing
  shared-control and tabs cases also passed.
- The 390px mobile screenshot is a developer-only focus fixture, not product
  recovery UI. Panel/heading visibility and lack of horizontal page overflow
  are checked; reduced motion disables the entry animation.
- Full client coverage: **431 files / 6,199 tests passed**, no skips, 383.57s.
  Statements 86.60%, branches 79.42%, functions 86.14%, lines 88.46%.
  Client lint and both strict Vue typechecks passed.
- Backend unit coverage: **1,654 suites / 50,694 tests passed**, with one existing
  Linux directory-fsync skip on Windows. No new skip was added and no Linux or
  database-integration result is claimed for this round. See the
  [platform explanation](testing-linux-filesystem.md).
- Production build, combined coverage ratchet, static-import check, npm flag
  check, copyright, whitespace and Markdown lint passed. Synthetic dialog
  fixture labels are absent from the built JavaScript. The bundler's timing
  advisory is not a failed build. Full figures are also recorded in the
  [preset save outcome](architecture/preset-save-state-outcome.md).
- Staged Gitleaks scan passed with no secrets detected.

## Findings during validation

- jsdom does not implement `showModal()`. The test-only setup double checks a
  connected element and marks it open; it does not pretend to implement
  inertness, stacking or native focus. Real browser tests cover those behaviors.
- Installed Vue typings reject `autofocus` on a heading. Keep the existing
  explicit heading focus after native opening without weakening typechecks.
- The first policy-navigation fixture incorrectly marked a zero-suggestion
  proposal as available. The existing production validator correctly rejected
  it. The fixture was corrected; no production contract, assertion or timeout
  was relaxed to make the test pass.
- The first full suite had two five-second timeouts in the lint-global contract
  and CSRF source scan (6,173 other tests passed). Both are Node-only checks
  unnecessarily using jsdom. Move them to the Node environment and initialize
  ESLint's config/plugins in bounded suite setup, matching the existing event
  lint contract. Keep every assertion, default timeout and scan path intact.
  That first run also overlapped the end of lint/typechecking; final validation
  runs separately with two workers. Its log remains in `.tmp/native-modal-coverage.log`.

## Limits

This patch covers the shared Modal, not every custom overlay in the application.
It does not establish complete WCAG or screen-reader conformance. Background
toasts/tooltips cannot cross native modality with a larger z-index; future
interactive floating controls must belong to their dialog or use a suitable
native top-layer API. Do not whitelist arbitrary background content.

Native `showModal()` support is required; no silent non-modal fallback is added.
Browser evidence is Chromium only. Manual assistive-technology acceptance and
Firefox/WebKit remain follow-up checks. jsdom results are component wiring
evidence, not native accessibility evidence.

No backend, database, image, Compose, dependency, lockfile, live recovery or
authorization changes are included. Browser API requests are intercepted and
the caller tests reject unlisted reads and mutations except explicitly mocked
preset requests; no live data is changed. Image rehearsals and remote CI
completion are not claimed. The existing `NO_COLOR`/`FORCE_COLOR` runner warning
is unchanged.

## Final recommendation stack

1. **Keep native modality with Vue-owned removal.** Benefit: browser background
   isolation and stacking without a dependency or custom global coordinator.
   Cost: no exit fade; floating controls must respect the top layer.
2. **Keep unit, compiler and browser checks together.** Benefit: validates both
   component contracts and actual focus/navigation. Cost: browser test runtime;
   jsdom cannot substitute for it.
3. **Parent-owned preset save state and errors: delivered in this round.** See
   the separate [preset save outcome](architecture/preset-save-state-outcome.md).
   Benefit: accurate pending/errors and no silent write replay; cost: uncertain
   outcomes need review. Durable creation receipts are the next safety step.
4. **Before release: cross-browser dialog acceptance.** Run these scenarios in
   Firefox and WebKit and perform a screen-reader pass before release. Benefit:
   checks engine-specific focus and accessibility behavior; cost: extra browser
   binaries and manual acceptance time.
5. **Then resume dependency/tooling updates separately.** Recheck current
   registry/advisory evidence instead of mixing unrelated upgrades into this
   lifecycle change. Global toast/tooltip accessibility is another scoped item.

## PR and publication scope

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs
during this round. There was no PR to randomly select or implement; none was
invented or merged. Work stays on `main`, under Unreleased, without a branch,
version bump, tag or release. The plainspoken skill kept user-facing updates
short; these separate documents retain the design and evidence.
