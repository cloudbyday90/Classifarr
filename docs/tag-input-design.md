# TagInput modernization: design

Date: 2026-10-03. Scope: the shared editor and its four usages in provider settings
and the custom-preset form. No package, API, database or deployment changes.

## Findings and selected behavior

The current editor has unassociated labels, unnamed remove buttons with implicit
submit behavior, untyped array emissions and no disabled/readonly guards. Its
Enter handler also consumes IME confirmation, while repeated empty Backspace can
remove several tags unintentionally. Input blur commits even when focus moves
to a remove button inside the editor, coupling two separate actions.

Keep a native text entry and native buttons, not a simulated listbox/combobox.
There is no suggestion list or selection-navigation contract to implement.
Reuse `useFormControlAttrs` for connected labels, hints, errors and native attrs;
keep layout attrs on the wrapper. A small instance-owned ESM composable manages
the draft, composition state, immutable updates and keyboard/focus handlers.

Preserve trimming, case-sensitive deduplication, insertion order and string-array
model updates. Do not split pasted commas or normalize domains/keywords here.
The parent model remains authoritative; the component does not save remotely.

- Enter adds one tag without submitting the containing form. An explicit Add tag
  button supplies a discoverable pointer/touch alternative.
- Empty Backspace removes the last tag once per press; repeated or modified
  key events do not remove more tags. Text editing retains native behavior.
- Composition input updates the draft but cannot add/remove a tag until the
  composition finishes. Use `isComposing` plus the documented 229 boundary guard;
  that narrow legacy compatibility check is not general key-code dispatch.
- Focus leaving the whole editor commits the draft. Moving between its input
  and buttons does not. Removal returns focus to the entry before the button
  disappears, keeping both focus and any draft intact.
- Disabled, readonly and inherited disabled-fieldset states block mutations,
  including synthetic events. Readonly still permits reading/selecting text.
- Provide distinct remove-button names and a polite, non-focusing status for
  addition, removal and duplicates. Never use HTML rendering for tag content.

An editor without a label must receive an external accessible name. Internal
hint/error references coexist with caller-supplied descriptions. Native attrs
apply to the draft input, not validation/serialization of the whole tag array;
the backend remains the validation and authorization boundary.

## Alternatives and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Native entry/buttons plus shared helper | Small dependency-free change, browser keyboard behavior | Own the editor's focus/composition tests | Implement |
| Full ARIA composite widget | Could support future suggestions/navigation | Much larger keyboard/selection contract without a current need | Defer |
| Remove all blur/Backspace actions | Fewer interactions to maintain | Breaks established editing behavior | Retain with guards |
| New third-party tag library | Packaged interactions | Dependency, styling and model migration | Not needed |

Recommended stack: native controls → shared attribute helper → bounded editor
composable → strictly checked string-array events → runtime/compiler/browser
regressions. Keep current dependencies and the existing checked listener-prop
convention; no compiler relaxation or new polling/timers.

## Validation plan

Extend existing TagInput tests, not a parallel test runner. Verify exact strings
and immutable arrays, deduplication, external attrs, escaped content, IME boundary
events, held/modifier keys, disabled fieldsets, internal/external focus and the
actual preset/provider callers. Enroll the component in strict Vue checks and
require source-mapped negative diagnostics for wrong model/handler types.

Extend the isolated shared-controls Chromium fixture: keyboard and pointer
add/remove, draft preservation, focus restoration, no accidental form submits,
no API calls, and narrow-screen wrapping. Use mocked/local data only. Run the full
client suite with coverage, then lint/typechecks/build and browser tests. Do not
run real-compiler fixtures concurrently with lint or the Vite browser server.

## Official research

Sources discovered with web search and retrieved on 2026-10-03. The interaction
choices above are project decisions based on these sources, not a standardized
ARIA tag-input pattern or a claim of full WCAG conformance.

- [W3C labels](https://www.w3.org/WAI/tutorials/forms/labels/) and
  [form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/):
  label associations and programmatic help descriptions.
- [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/):
  accessible names, native activation and deliberate focus after actions.
- [MDN button](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button):
  explicit non-submitting button type inside forms.
- [MDN keydown and IME](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event):
  composition-event ordering and the narrowly justified 229 fallback.
- [MDN focus destination](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/relatedTarget):
  distinguish internal focus moves from leaving the editor; the destination can
  be null, so this does not identify every platform's pointer-focus behavior.
- [Vue form bindings](https://vuejs.org/guide/essentials/forms): default text
  bindings defer IME updates; this editor deliberately tracks the composition
  draft through native input events while withholding model changes.
- [Vue attribute inheritance](https://vuejs.org/guide/components/attrs.html):
  explicitly route attrs to the input and read nonreactive attrs during render.
