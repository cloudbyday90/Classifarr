# Tabs modernization: outcome

Date: 2026-10-03. Starting revision:
`9a27a9e25d8b8ce44b9f439a251fd07518ff42e3` on `main`.
Local environment: Windows, Node 24.21.0, npm 12.2.0.

## Delivered

- Reviewed the only application caller, Presets Manager: these are in-page
  panels, not route links. Named its tablist "Preset types".
- Native non-submitting tab buttons, reciprocal panel associations and distinct
  selected/focused indicators. Decorative icons no longer obscure names; zero
  badges remain visible. Every inactive panel shell is hidden and empty.
- Manual selection: arrows/Home/End move focus, native Enter/Space/click selects.
  Tab moves into the panel, and re-entry returns to the selected tab. Focused
  tabs scroll into view with minimal movement and no smooth animation.
- A small instance-owned ESM helper manages focus, IDs and validated tab items.
  IDs remain stable on reorder and never contain caller-supplied strings; the
  identifier map drops removed entries. Malformed entries and duplicate IDs are
  filtered deterministically. Labels/icons/badges are escaped text.
- Preserved the parent-owned string model and active-only slot lifecycle. Invalid
  selections render no panel and emit no automatic replacement. Removing a
  focused tab restores focus to a remaining entry without changing selection.
- Enrolled Tabs in strict component/event checks, including real compiler
  negatives for tab object shape, model and callback payloads.

See [design, alternatives, pros/cons and official sources](tabs-design.md).

## Verification

- Full client suite with coverage: **428 files, 6,131 tests passed, no skips**.
  Statements 86.49%, branches 79.24%, functions 86.06%, lines 88.34%.
  The Tabs helper has 100% line/function and 94.2% branch coverage.
- Client lint, API/component typechecks and production build: passed.
- Runtime contracts cover named relationships, escaped
  text, zero badges, focus versus selection, parent authority, reordered/removed
  entries, invalid selections, lazy slot lifecycles and disabled fieldsets.
- Real-compiler model/object/event regressions and the enrolled-path lint
  contracts passed with the installed Vue compiler and ESLint configuration.
- Chromium: nine scenarios passed twice, **18 executions with no retries**.
  Three new Tabs scenarios cover native activation, wrapping focus, Tab/Shift+Tab,
  panel linkage, no accidental submission, multiple-instance IDs, dynamic focus
  recovery and 390px overflow visibility. Six existing shared-control scenarios
  also passed twice. The main Tabs scenario made no API requests or page errors.
- Inspected the 390px preview: the focused tab and outline are fully visible,
  and the page has no horizontal overflow. Selection and focus remain distinct.
- ESM static-import, npm CLI flag, copyright and whitespace checks: passed.
- Markdown validation: 1,830 documents, zero errors.
- Gitleaks: no secrets found in the staged patch.

## Findings during validation

1. ESLint's configuration/plugin startup exceeded the first contract test's
   five-second budget during concurrent compiler checks. Configuration loading
   now runs once in `beforeAll`, under the unchanged default hook timeout.
   The test assertions, per-test limits and real installed lint rules remain.
2. Browser tests exposed partial clipping after native focus on a narrow tab
   strip. Nearest-edge scrolling plus scroll margin now keeps the focused tab
   and its outline visible. This was a behavior fix, not a relaxed assertion.
3. Two independent widgets correctly share panel names but not IDs. A global
   browser locator was ambiguous; panel queries now scope to the primary form.
4. The caller test confirms keyboard exploration does not change panels or
   refetch lists. Selecting My Presets updates the existing v-model without
   creating, updating or deleting preset data.

## Limits

This is not full WCAG, screen-reader or cross-browser certification. Browser
automation covers Chromium and the existing left-to-right horizontal layout;
manual assistive-technology and other-browser acceptance remains necessary.
No vertical tabs, tab-closing command, disabled-option API, routing or automatic
activation is introduced. The caller must provide valid string IDs and labels;
runtime filtering is a defensive boundary, not server authorization.

The parent remains authoritative, so an unaccepted selection request does not
optimistically replace the panel. Focus recovery covers removal of focused tab
buttons, not arbitrary caller-driven removal of focused slotted content. No
hidden content is kept alive; switching panels still unmounts local child state.

No dependency, lockfile, API, backend, database, image, Compose or live-data change
is included. No timer, global listener or network request is added to Tabs.
Backend tests, combined coverage ratchet and image rehearsals are not claimed
for this client-only change. Local checks do not establish remote CI completion.
The existing `NO_COLOR`/`FORCE_COLOR` runner warning remains visible.

## Final recommendation stack

1. Keep manual native-button tabs plus the bounded ESM helper. Benefit: clear
   keyboard behavior without a dependency or hidden panel work; cost: one
   activation keystroke after focus moves, plus explicit focus tests to maintain.
2. Keep typed model/objects, scoped event linting, runtime tests and browser
   regressions together. Compilation alone does not prove navigation behavior.
3. Next review **Modal's focus lifecycle and typed contracts**. Its existing
   helper already traps/restores focus, but candidate filtering checks only the
   element's own hidden/disabled attributes. Add cases for hidden ancestors,
   inert content, disabled fieldsets and disconnected focus-return targets before
   changing the shared behavior.
4. Keep dependency updates and any wider language migration separate. Preserve
   the supported Vue toolchain and the checked-listener convention for now.

## PR and publication scope

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs
on this date. None could be randomly selected or implemented; no PR was invented
or merged. Work stays on `main` with an Unreleased entry and no branch, version
bump, tag or release. The plainspoken skill kept conversational updates concise;
the separate documents retain design rationale and validation details.
