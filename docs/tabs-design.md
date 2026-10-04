# Tabs modernization: design

Date: 2026-10-03. Scope: the shared Tabs component and its only application
caller, Presets Manager. No API, database, dependency or deployment changes.

## Findings and selected behavior

Presets Manager switches between two in-page panels, so the tab pattern fits.
The existing component presents a navigation landmark with ordinary buttons;
it has no tab/panel relationships, explicit button types, arrow-key behavior or
typed tab objects/events. Both preset lists are fetched on page mount, but only
the selected slot is mounted. Keep that lifecycle and the controlled string model.

Use native non-submitting buttons with tab roles, a named horizontal tablist,
selected state and linked panels. Give Presets Manager the name "Preset types".
Each panel has a persistent shell; only its selected slot is mounted. Inactive
shells are hidden. Panels are focusable because their content can start with
non-focusable loading, error or empty-state text.

Use manual activation: Left/Right wrap focus; Home/End reach the ends; native
Enter/Space/click activates once. Moving focus alone must not mount a panel or
emit a model change. Up/Down retain scrolling; modified keys and composition
events are ignored. One tab participates in sequential focus; leaving the
tablist resets its entry point to the selected tab. Focus and selection have
separate visible indicators. Keep native horizontal overflow scrolling visible.
Reveal the focused tab with nearest-edge, non-animated scrolling and a small
scroll margin for its outline; native focus alone can leave a tab partly clipped.

An instance-owned ESM helper handles keyboard focus and stable IDs. Read actual
tab order from the rendered list, not Vue's unordered v-for ref array. IDs must
not contain user-provided strings or be interpolated into selectors. Keep labels,
icons and badges as escaped text; decorative icons are hidden from assistive
technology, and a zero badge is still meaningful. No HTML rendering or network
work belongs in this component.

Invalid or removed selections show no panel and emit nothing automatically; the
first tab remains keyboard reachable so the user can choose. Reject malformed
tab entries and duplicate IDs deterministically, retaining the first valid
entry. Empty lists render no tablist. Changes must not steal focus from outside
the widget. If a focused tab disappears, recover to the selected/first tab when
one remains. Do not add tab closing, routing, disabled options or vertical mode
without a real caller and a separate interaction contract.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limit | Decision |
| --- | --- | --- | --- |
| Manual native-button tabs | Predictable focus, preserves lazy panel lifecycle | Enter/Space needed after arrow navigation | Implement |
| Automatic selection on focus | Fewer keystrokes | Would mount content on every focus move; panel latency must be proven | Defer |
| Route links | Correct for URL navigation | This caller switches local panels, not routes | Not applicable |
| Third-party widget library | Packaged behavior | Dependency and styling migration for one small component | Not needed |

Recommended stack: semantic native buttons and panels → small ESM focus helper →
strict tab/model/event contracts → caller, unit, compiler and browser regressions.
Keep the existing checked-listener convention and supported Vue toolchain.

## Validation plan

Test selected/focused state independently, named relationships, unique/stable IDs,
escaping, zero badges, active-only slot lifecycle, no accidental submission,
controlled parent updates, malformed/empty/dynamic lists and inherited disabled
fieldsets. Add real-compiler negative checks for tab shapes and event payloads.
Exercise the real Presets Manager tabs with mocked APIs. Extend the isolated
Chromium fixture for native keyboard activation, Tab/Shift+Tab, wrapping focus,
overflow, multiple instances and narrow-screen focus visibility.

Run focused checks, client lint/typechecks/build, full coverage and Chromium.
Keep real-compiler fixtures separate from lint and Vite browser execution.
Document limitations rather than claiming full assistive-technology conformance.

## Official research

Sources discovered through web search and retrieved on 2026-10-03:

- [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
  tab/panel relationships, horizontal navigation and selection/focus separation.
- [W3C manual tabs example](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-manual/):
  manual activation when panels are not already displayed instantly, distinct
  focus/selection indicators and the need for assistive-technology testing.
- [Vue Composition API helpers](https://vuejs.org/api/composition-api-helpers.html):
  application-unique, hydration-stable IDs and typed template refs.
- [Vue template refs](https://vuejs.org/guide/essentials/template-refs):
  v-for ref arrays do not guarantee source order; refs exist only after mount.
- [MDN scrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView):
  nearest-edge alignment, instant behavior and scroll margins for visibility.
- [ESLint Node API](https://eslint.org/docs/latest/integrate/nodejs-api) and
  [Vitest suite hooks](https://main.vitest.dev/api/hooks): explicit configuration
  loading and one-time bounded setup, used for the lint contract harness.

These guide the design; the guards and lifecycle choices are project decisions,
not claims that the APG example can be copied into production without testing.
