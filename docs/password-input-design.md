# PasswordInput modernization: design

Date: 2026-10-03. Scope: the shared Vue control and its existing settings callers.
No package upgrade, backend change, data migration or release is required.

## Findings and decision

The current control has an unassociated label, an emoji-only visibility button,
unlinked hint/error text and wrapper-level native attributes. All ten settings
usages supply separate labels that are not connected to an input. The control
also lacks the strict checks already applied to the other shared form controls.

Keep the existing string model and API-key-oriented autocomplete defaults.
Reuse the shared attribute helper, adding optional hint descriptions without
changing existing callers. Route native attributes and listeners to the input;
keep layout classes/styles on the wrapper. Use stable generated IDs and preserve
external descriptions and invalid state when internal errors clear.

Use a native, non-submitting Show/Hide button with a field-specific accessible
name, an input reference through `aria-controls`, and a visible keyboard outline.
Its name changes with the command, so it does not use `aria-pressed`. Connect
existing settings labels through the component's label prop, including distinct
provider names where multiple keys appear together.

Use a clearer gray border and lighter error text against the application's dark
background. This is a scoped contrast improvement, not a WCAG conformance claim
for every screen, theme or assistive technology.

## Security and lifecycle

Mask by default. Preserve whitespace and symbols without secret-specific
trimming, parsing, length limits, copy/paste blocking or additional storage.
Disable spelling, correction and capitalization even while revealed. These
browser hints and masking are not encryption, authorization or guarantees about
third-party extensions. Existing transport/storage protections still apply.

A small ESM visibility composable owns reveal state and its form listener.
Conceal when disabled and synchronously on the associated form's submit event,
without changing the value or preventing submission. Refresh the association
after component updates and remove the listener on unmount. Do not introduce
polling, global listeners, observers or background work. Direct native
`form.submit()` bypasses submit events; consumers should use `requestSubmit()`
or normal submit controls. AJAX save handlers remain responsible for their own
post-save lifecycle.

The existing `autocomplete="off"` and password-manager hint defaults remain for
provider secrets, not Classifarr login passwords. Explicit autocomplete values
remain supported. This is not a repository-wide authentication UX redesign.

## Recommendations and trade-offs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Modernize the shared native control | One consistent fix for all callers; no dependency | Needs real browser and contract tests | Implement |
| Replace it with a UI library | Broader packaged widgets | Dependency/theme migration for one control | Defer |
| Change every credential/autofill policy | Potential password-manager improvements | API keys and remote-server logins need different policies | Separate review |
| Enroll whole settings screens in strict checks now | Wider type coverage | Much larger unrelated refactor | Review in batches |

Recommended stack: native input/button → shared attribute helper → bounded
visibility composable → typed string emission and checked listener props → unit,
real-compiler, lint and Chromium contracts. Keep the existing Vue-compatible
compiler; this work does not fix upstream JavaScript v-on checking.

The strict compiler recognizes exactly `data-lpignore` and `data-1pass-no-save`
through Vue's documented `dataAttributes` option. It does not validate the values
of those two vendor hints. Runtime tests verify them; compiler regressions still
require errors for invalid expressions and unrelated misspelled native attrs.
There is no wildcard attribute exemption or relaxation of strict templates.

## Validation plan

Test actual labels and descriptions, caller-attribute updates, distinct IDs,
escaped messages, exact model delivery, disabled and readonly behavior, external
forms, listener cleanup, form submission and strict negative diagnostics.
Exercise keyboard activation, focus, native required validation and no unintended
submissions/API requests in the existing isolated Chromium fixture. Use only
dummy credentials. Run the full client suite, lint, typechecks and build.
Run lint and browser checks after compiler tests finish: the real compiler tests
create temporary Vue/config files, which lint can encounter and Vite can watch.

## Official sources

Discovered using web search and retrieved on 2026-10-03. These are the documents
available on that date, not a claim about future October releases.

- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/): connect
  visible labels to controls; placeholders are not substitutes.
- [W3C form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/):
  associate supplementary help with `aria-describedby`.
- [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/): native
  keyboard activation and the distinction between changing command names and
  stable toggle names with pressed state.
- [GOV.UK password input](https://design-system.service.gov.uk/components/password-input/):
  masked defaults, distinct Show/Hide commands, concealment on submission,
  unrestricted paste and disabled spelling/capitalization. Our use of these
  principles for provider keys is a project design decision, not copied code.
- [MDN password input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/password):
  native semantics, autocomplete purposes and the limits of `off`.
- [Vue fallthrough attributes](https://vuejs.org/guide/components/attrs.html):
  explicit attribute routing and reading current, non-reactive `useAttrs` values.
- [Vue compiler options](https://github.com/vuejs/language-tools/wiki/Vue-Compiler-Options):
  narrow vendor-attribute recognition through `dataAttributes`.
- [MDN submit event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event):
  normal submission and `requestSubmit()` dispatch an event; direct `submit()`
  and failed native validation do not.
- [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html):
  distinguishable input boundaries and focus indicators.
