# TagInput modernization: outcome

Date: 2026-10-03. Starting revision:
`77c35bebdc50f35a5e8b5e7e71e7ba16c146a3d2` on `main`.
Local environment: Windows, Node 24.21.0, npm 12.2.0.

## Delivered

- Connected labels at all four keyword/domain usages; native attributes,
  caller listeners and hint/error descriptions reach the entry, not its wrapper.
- Named Add/Remove buttons with explicit non-submitting types, visible focus,
  wrapping long tags and a polite status message. Add supports pointer/touch
  interaction without requiring a physical Enter key.
- An instance-owned ESM composable keeps the draft separate from the parent
  string-array model. Trimming, case-sensitive deduplication and ordering remain
  unchanged; neither comma splitting nor domain normalization is added.
- Internal focus moves preserve the draft; leaving the editor commits it.
  Removal focuses the input before removing the active button. Composition,
  repeated/modifier keys and disabled/readonly controls cannot accidentally
  add/remove tags. Inherited disabled fieldsets are respected too.
- TagInput joins strict Vue component/event checking, with executable positive
  and source-mapped negative compiler fixtures. No relaxed compiler or lint rule.

See [design, alternatives, pros/cons and official sources](tag-input-design.md).

## Verification

- Full client suite with coverage: **427 files, 6,101 tests passed, no skips**.
  Statements 86.43%, branches 79.18%, functions 85.95%, lines 88.29%.
  The editor composable has 100% line/function coverage and 94.36% branch coverage.
- Client lint, API/component typechecks and production build: passed.
- Real compiler fixtures cover string-array models and model-handler types;
  scoped ESLint contract checks include TagInput without relaxing other controls.
- Runtime tests cover exact values, immutable updates, escaping, descriptions,
  parent replacement, listener delivery, composition order, held/modifier keys,
  disabled/readonly/fieldset guards and draft/focus preservation.
- Chromium: six tests passed twice, **12 executions with no retries**, including
  the existing shared-control/password regressions and two tag-editor scenarios.
  Tests cover native keyboard/pointer actions, no accidental submit, focus,
  single model delivery, disabled fields and synthetic IME event ordering.
  No API requests occurred in the tag interaction scenario.
- The 390px preview was inspected: long tags wrap without horizontal overflow;
  the Add button has a visible keyboard focus outline.
- ESM static-import, npm CLI flag, copyright and whitespace checks: passed.
- Markdown validation: 1,828 documents, zero errors.
- Gitleaks: no secrets found in the staged patch.

## Findings during validation

The previous tests used Vue Test Utils' `keydown.enter`/`keydown.backspace`
shortcuts, which construct lowercase `event.key` values. Native keyboard events
use `Enter` and `Backspace`. The fixtures now pass explicit native keys rather
than weakening production handlers to accept unrealistic keys. Chromium tests
exercise actual keyboard activation separately.

Additional event-order tests reproduced two composition boundary bugs during
review. A final input event in the same turn could restore a committed draft
before Vue rendered its cleared value, and returning to an internal button
could retain a pending external-blur commit. Clearing the native draft alongside
its state and cancelling the pending commit on editor focus-in resolves both,
without timers. Unit and Chromium protocol regressions exercise these orders.

Provider/preset integration tests mount the real editor with mocked surrounding
services. Updating a tag does not save provider configuration or submit a preset.
The preset test also exercises its existing disabled fieldset, not only the
component's explicit disabled prop.

## Limits

This is not a full WCAG audit, screen-reader certification or native OS/IME
certification. Browser automation covers Chromium; composition events are
synthetic protocol checks. Other browsers and platform-specific pointer focus
behavior still need manual acceptance testing. The editor does not validate or
serialize the entire array through native draft-input attributes; server-side
validation and authorization remain authoritative. Parent updates remain
controlled by the caller, without an optimistic queue for delayed responses.

No dependency, lockfile, backend, database, image, Compose or live-data change is
included. No network, storage, global listener or background timer is added.
Backend tests, combined coverage ratchet and image rehearsals are not part of
this client-only change. Local results do not establish remote CI completion.
The existing `NO_COLOR`/`FORCE_COLOR` browser-runner warning remains visible;
it was not suppressed or treated as an application failure.

## Final recommendation stack

1. Keep native controls, the shared attribute helper and the small ESM editor
   composable. Benefit: browser semantics and no new dependency; cost: maintaining
   explicit keyboard, composition and focus tests.
2. Keep runtime, real-compiler and browser checks together. Each catches a
   different class of regression; compilation alone does not prove interaction.
3. Next modernize **Tabs**. Its shared component currently uses untyped tab
   objects/events and buttons without explicit types; it lacks tab/panel
   associations and a tab keyboard contract. Review its callers first to
   distinguish in-page panels from navigation, then implement the appropriate
   semantics, focus behavior and typed model without a blanket ARIA conversion.
4. Keep dependency/tooling updates separate from this interaction change and
   retain Vue's supported compiler plus the existing checked-listener convention.

## PR and publication scope

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr PRs
on this date. There was no PR to select randomly; none was invented or merged.
Work stays on `main` with an Unreleased entry. No branch, version bump, tag or
release is created. The plainspoken skill kept updates short; the design and
outcome remain separate documents for the detailed decisions and evidence.
