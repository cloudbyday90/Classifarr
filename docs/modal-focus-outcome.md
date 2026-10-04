# Modal focus: outcome

Date: 2026-10-03. Starting revision:
`b7619d488a83bcd2ea5f7ed79021d8757e822a7b` on `main`.
Local environment: Windows, Node 24.21.0, npm 12.2.0.

Follow-up: [native modal isolation](native-modal-outcome.md) replaces this
round's custom overlay and exit fade. The results below describe the earlier
focus-lifecycle patch, not the later native-dialog validation.

## Delivered

- Extracted DOM eligibility and tab ordering into `modalFocusTargets.js`.
  It handles hidden/inert ancestors, native disabled fieldsets (including the
  first-legend exception), closed details, negative/positive tabindex and radio
  groups without interpolating names into selectors.
- The instance-owned focus helper checks actual focus success, recalculates
  keyboard boundaries, honors child-handled/composing events, invalidates stale
  work and cleans up on unmount. Leaving controls become inert during the fade.
- Returning focus checks usability, not connectivity alone. A typed optional
  `fallbackFocusTarget` resolver supplies a workflow-specific destination when
  the opener is unavailable. Preset deletion returns to the existing search
  input after the old card disappears; this uses the existing delete API.
- Kept parent-controlled close requests, named heading focus, attributes, slots,
  the close button/backdrop and route-owned `restoreFocus=false` behavior.
  Closing cannot steal focus already assigned to a route or sibling dialog.
- Enrolled Modal in strict Vue checks and the existing checked-event lint rule.
  Boolean model/emit payloads and element-resolver contracts have real compiler
  regressions. Reduced-motion users no longer receive the fade transition.

See [design, alternatives and researched official sources](modal-focus-design.md).

## Verification

- Full client suite with coverage: **429 files, 6,163 tests passed, no skips**.
  Statements 86.54%, branches 79.34%, functions 86.08%, lines 88.38%.
- Focused utility, Modal and real Presets Manager tests: **47 passed**. The
  deletion test mocks the API and mounts the actual shared Modal; it deletes no
  live data.
- Installed Vue compiler/event/lint contracts: **60 passed**. Invalid boolean
  models, incorrect callback payloads and selector-returning fallback resolvers
  fail with source-mapped diagnostics.
- Production client build, npm CLI flag, ESM static-import and copyright checks
  passed. The focused browser fixture made no API requests and had no page
  errors. The mobile preview was inspected at 390px: heading focus is visible
  and there is no page-level horizontal overflow.
- Client lint (no warnings), API/component typechecks, whitespace checks and
  Markdown validation passed: 1,832 Markdown files, zero errors.
- Gitleaks found no secrets in the staged patch.
- Final Chromium run: **28 executions passed, zero retries** (14 scenarios run
  twice). Five Modal scenarios cover actual keyboard boundaries, unavailable
  targets, unmount, route/sibling handoffs, reopen-during-leave, backdrop close
  delivery and reduced-motion/mobile behavior. Nine existing Tabs and shared
  control scenarios also passed twice.

## Validation findings

- Strict Vue checking caught the pre-existing nullable `aria-labelledby` binding;
  absent labels now use `undefined`, preserving omission in the rendered DOM.
- The first repeated browser run passed all ten Modal executions but had one
  failure in an existing password test: the trace records Chromium's
  `net::ERR_NO_BUFFER_SPACE` for `Button.vue`, preventing the fixture from mounting.
  This was not a password assertion failure. The trace was retained under
  `.tmp/modal-browser-first-run/`; no assertion, timeout or retry policy was
  weakened. The same three-spec command was rerun with a fresh runner and all
  28 executions passed. This does not claim the environmental failure was fixed.

## Scope and limits

This is a focus-lifecycle repair, not a claim of full WCAG or assistive-technology
certification. The custom overlay still does not make the surrounding document
inert. Shadow-root/iframe traversal, arbitrary external focus changes while
open, and all nested-overlay combinations are not covered by this contract.
Callers must not put operable controls in `aria-hidden` subtrees: ARIA alone does
not remove controls from the browser's native tab order. Caller-provided fallback
targets must be meaningful and programmatically focusable; if neither target
works, the helper does not select an unrelated control.

No dependency, lockfile, API contract, backend, database, image, Compose or live
data changes are included. No polling, timer, global listener or network request
was added. Browser evidence is Chromium only; manual screen-reader and other
browser acceptance remain necessary. Backend tests, the combined coverage
ratchet and image rehearsals are not claimed for this client-only patch. Local
validation does not establish remote CI completion. The existing browser-runner
`NO_COLOR`/`FORCE_COLOR` warning remains visible.

## Final recommendation stack

1. Keep the scoped ESM repair and typed component contracts. Benefit: safer
   keyboard behavior without changing application workflows or dependencies.
   Cost: maintaining custom DOM focus rules until the broader dialog migration.
2. Keep browser tests alongside unit/compiler checks. Benefit: native disabled,
   visibility and transition behavior is exercised; cost: an additional browser
   test stage. A jsdom assertion is not browser accessibility evidence.
3. Next evaluate **native dialog background isolation and stacking**. Start with
   the Preset Summary-to-Customize handoff and the policy builder's route focus
   opt-out. Native modality removes background interaction without an application
   global listener, but automatic focus restoration/top-layer placement require
   explicit compatibility decisions before rollout.
4. Resume dependency/tooling updates separately, with current registry/advisory
   evidence. Do not mix unrelated package changes into the UI lifecycle patch.

## PR and publication scope

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs
on this date. None could be randomly selected or implemented; no PR was invented
or merged. Work stays on `main`, under Unreleased, with no branch, version bump,
tag or release. The plainspoken skill kept conversational updates short; these
separate documents retain the implementation rationale and evidence.
