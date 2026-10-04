# Native modal isolation: design

Date: 2026-10-03. Starting point: `5393ca7d` on `main`.

## Decision

Use a native `dialog` opened with `showModal()` for the shared Modal. The browser
owns background inertness and top-layer stacking. Keep Vue's boolean model as
the close authority and the existing instance-owned focus helper for heading
focus, keyboard boundaries, fallback return and route opt-out.

Close requests from the button, backdrop, Escape or native `cancel` emit a
boolean request. They do not perform a domain action or bypass the parent.
Cancel the native default so a parent that rejects the request stays modal.

On accepted close, Vue removes the dialog immediately through `v-if`. WHATWG
defines cleanup of a removed modal, including immediate removal from the top
layer. This avoids native `close()` automatically returning focus when the
caller explicitly requested `restoreFocus=false`. It also avoids manually
removing the native `open` attribute. Our existing post-render return logic
continues to restore a valid opener/fallback, unless another view owns focus.

The exit fade is intentionally removed: an invisible native modal must not
keep the next route inert. Keep a short entry animation, disabled for reduced
motion. Do not put tabindex on the native dialog. The title remains the initial
programmatic focus target; native focus is available as a last resort.

## Compatibility boundaries

- Preserve title, attributes/classes, slots, max-width customization and model
  payloads. Browser-native modality is an interaction boundary, not server-side
  authorization. No API, database, policy or recovery permissions change.
- Nested shared Modals each enter the native top layer. Only the upper modal is
  interactive; closing it restores its parent's invoking control. Closing a
  lower dialog must not disturb the active upper one.
- Preset Summary-to-Customize replaces one modal with another in the same update.
  Supply the stable search-field fallback to both real caller wrappers, because
  the Customize button is removed with the summary.
- Preserve the policy builder's route-specific focus handoff. Exercise actual
  Vue Router navigation and background reactivation, not just emitted values.
- Existing shared-modal descendants do not teleport interactive controls to
  body. New floating controls must render inside their owning dialog or use an
  appropriate native top-layer API. A larger z-index cannot escape inertness.
- Global body-level toasts/tooltips are background content during a modal. Do not
  whitelist them through inertness or move arbitrary DOM into the dialog. The
  deletion failure must be shown inside its active modal, not on the inert
  presets page. Broader notice/tooltip accessibility remains separate work.
  The [preset save-state design](architecture/preset-save-state-design.md)
  handles async saving in this round, including a `closeDisabled` prop that
  visibly disables dismissal while the caller's bounded request is pending.
- Modern browsers supporting `showModal()` are required. No silent non-modal
  fallback is added. jsdom lacks this API, so a clearly test-only opening double
  will exercise component wiring; real Chromium tests prove native behavior.

## Alternatives and tradeoffs

| Approach | Pros | Cons / decision |
| --- | --- | --- |
| Native modal plus Vue-owned removal | Browser background isolation/stacking; preserves return opt-out; no dependency | Drops exit fade, needs browser tests and top-layer-aware children; selected |
| Native `close()` for every path | Conventional imperative dialog lifecycle | Automatically restores focus, conflicting with the existing route contract |
| Custom inert/stack manager | Retains the old overlay implementation | Requires document mutation, restoration bookkeeping and global coordination; rejected |
| Keep only a keyboard trap | Lowest implementation effort | Background remains operable to other input/assistive technology; rejected |

Backdrop dismissal requires both pointer start and click end outside the dialog
rectangle. Dragging from content onto the backdrop must not dismiss a dialog.
No `closedby` dependency or native form `method="dialog"` contract is introduced.

## Official research

URLs discovered using web search, then opened and reviewed in October 2026:

- [W3C native dialog technique H102](https://www.w3.org/WAI/WCAG22/Techniques/html/H102)
  describes browser-owned modality and the testing expectations. It is guidance,
  not a claim that this patch proves full WCAG conformance.
- [WHATWG interactive elements](https://html.spec.whatwg.org/multipage/interactive-elements.html)
  defines `showModal`, cancellation, automatic close focus and dialog removal
  cleanup. Vue-owned removal is a deliberate application of that lifecycle.
- [Vue Teleport](https://vuejs.org/guide/built-ins/teleport)
  preserves component ownership while relocating DOM. Teleport-to-body alone
  does not place custom content in the browser's top layer.

## Verification plan

Retain existing Modal tests and add native opening/cancel contracts. Use real
Chromium for background focus/pointer isolation, nested stacking, lower-dialog
removal, drag-safe dismissal, immediate close/reopen, route return opt-out,
actual preset handoff and mobile/reduced-motion layout. Run the full client
suite, strict checks, lint, production build and repository/document checks.
Record outcomes and remaining limits in a separate document. No release or
deployment change belongs in this patch.
