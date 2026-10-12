# Shared status components: design

Research date: 2026-10-12. Baseline: `4c03a23796e42e6a477e0d62d60080969b72e9e6`
on `main`. Scope: ConnectionStatus, Toast, the existing toast store and their
compiler, unit and browser contracts. No release, API or schema change.

## Findings and decision

Enrolling the remaining two common components in the strict Vue project exposes
16 diagnostics: untyped date/style arguments, a toast array inferred as `never[]`,
and untyped store actions. Runtime `Object` props also hide a real caller mismatch:
TMDb supplies string success/error messages; Discord supplies both structured
details and string errors/warnings. The error template reads `.message` on those
strings and displays no explanation.

Keep JavaScript ES modules and add JSDoc contracts at the existing owners. Declare
connection details/error props as their supported string-or-object shapes and
narrow before rendering. Show text messages as text, including structured warning
messages, without dumping arbitrary object fields. Preserve codes, troubleshooting,
additional information, six status presentations, optional timestamps and the
existing empty presentation for unrecognized status strings. No request or retry
behavior moves into this presentation component.

Type the toast store's four supported kinds, numeric IDs, text payloads, optional
titles and duration options. Keep the setup store, ordered list, default duration,
manual removal and automatic expiry unchanged. Use the existing checked listener
prop convention for dismissal. Give its native button `type="button"` and a
descriptive accessible name. Do not introduce a new global service, dependency,
live-region announcement policy or timer refactor in this batch.

## Alternatives and tradeoffs

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| JSDoc at component/store boundaries | Small ESM change; checks real consumers and templates | Does not validate network payloads at runtime | Use |
| Convert all settings screens to TypeScript | Wider checking coverage | Cross-cutting migration; unrelated failures | Defer to reviewed batches |
| Keep generic Object or suppress diagnostics | Minimal edits | Misses the reproduced blank-message bug | Reject |
| Replace notifications wholesale | Opportunity for timer and announcement redesign | Larger behavior/accessibility changes without evidence | Defer |

## Official research

URLs were discovered with search MCP and retrieved on the research date.

- [Vue composition API typing](https://vuejs.org/guide/typescript/composition-api)
  documents runtime prop inference and `PropType` for complex payloads. Apply that
  mechanism through JSDoc without changing the project's language/module system.
- [Pinia state typing](https://pinia.vuejs.org/core-concepts/state.html) recommends
  explicit types where empty arrays or null initial values cannot convey the
  intended shape. The existing setup-store array receives an explicit Vue Ref type.
- [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) explains
  button naming and native keyboard activation. Keep a native dismiss button with
  an action-oriented name; verify Enter and Space in Chromium.
- [MDN button reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)
  describes explicit non-submit button types and accessible names for icon buttons.

The existing [event-checking design](../vue-event-checking-design.md) supplies the
locally reproduced reason for listener props. Types and Vue prop warnings are
developer checks, not authorization or input sanitization. Vue text interpolation
must remain in place, with hostile-markup regression cases and no `v-html`.

## PR review

The fresh GitHub MCP inventory returned one open PR, [#560](https://github.com/cloudbyday90/Classifarr/pull/560).
`crypto.randomInt(1)` selected index zero. Head
`ee260e7d5cc7be8dfd6a25ab55bd3a62450a0fe6` and base
`f31df0ea14fc8ea5f6afd9e9b75e17b40f7458b1` match the prior reviewed diff: four
CodeQL action references in two workflows. All are already implemented at this
baseline. Re-run their local workflow contracts; do not duplicate a patch, merge,
close or invent a different PR. No dependency or lockfile edit is warranted.

## Verification and recommendation stack

1. Enroll both components without weakening strictness. Add real compiler positive
   and negative probes for props and store actions, plus all-state rendering,
   escaped text and timer/removal tests.
2. Exercise real Teleport and native keyboard dismissal with a synthetic browser
   fixture; no live API/provider requests. Run full frontend coverage, lint,
   typechecks, production build and workflow/tooling contracts.
3. Commit the implementation on main. Back up the local test database, build
   Compose without cache from that exact clean revision, dump/check schema against
   a disposable image fixture, then replace only the local test container.
4. Record evidence separately, including health, exact image identity and readonly
   aggregate checks. Keep Unraid, shared Plex/Ollama and all safeguards unchanged.
5. Next enroll a small leaf component group used by settings, following actual
   contracts. Toast timer ownership and announcement/focus policy need a separate
   design before changing lifecycle behavior.
