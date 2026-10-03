# Shared form controls: outcome

Date: 2026-10-03. Starting revision:
`3ae96335945e6baeaa339939b4334b1fc6a6eb0a` on `main`.
Local environment: Windows, Node 24.21.0, npm 12.2.0.

## Delivered

Input, Select, Toggle and Slider now join Badge, Button, Card and Spinner in the
strict component project. Initial enrollment exposed six DOM event diagnostics;
local, explicitly typed handlers now narrow the native event source. No `any`
escape hatch, wildcard component declaration or compiler relaxation was added.
Vue, vue-tsc and TypeScript versions and all lockfiles are unchanged.

The shared ESM `useFormControlAttrs` composable assigns stable IDs and routes
native attributes/listeners to controls while keeping layout class/style on the
wrapper. Labels and Input error text are associated programmatically. Error text
remains escaped; existing help descriptions survive error removal. Disabled
controls cannot emit model updates even from synthetic dispatches. Native
validation is a UI feature, never a server-side authorization substitute.

Three Confidence sliders and the AI settings pattern-mining toggle now use their
existing visible text as accessible names. The model contracts are unchanged:
Input/Select emit strings before parent modifiers, Slider numbers, Toggle booleans.
The small Chromium fixture uses real controls and synthetic state, not application
data or API calls. Its tests now run in the existing CI job with one worker and
no retries. No extra runner, runtime service or package was introduced.

See [design, tradeoffs and official Vue/W3C sources](shared-form-controls-design.md).
This is a focused accessibility improvement, not a full WCAG conformance claim.

## Verification

- Client lint, API typecheck and strict component typecheck: passed.
- Real Vue compiler contract: 11 tests passed, including invalid option/model
  props and an invalid public Input emit payload in a typed consumer. Negative
  tests require the expected source-mapped diagnostic, not just a failing process.
- Chromium: two tests passed, no retries. Covered accessible names, Tab/Space/
  Enter/ArrowRight interaction, label activation, model values, disabled state,
  native input constraints, descriptions and no accidental form submission.
- Production client build: passed. The test fixture is not a production entry.
- Dependency/toolchain policy tests: 30 passed, no skips.
- Full client coverage run: **422 files, 6,005 tests passed, no skips**.
  Statements 86.32%, branches 79.07%, functions 85.77%, lines 88.19%.
  This includes the 21 new control contracts, 11 compiler contracts and the
  updated AI/Confidence view tests. Elapsed time: 264.53 seconds.
- ESM static-import check, npm CLI flag check, copyright and whitespace checks:
  passed.
- Markdown validation: 1,822 files, zero errors. Gitleaks found no secrets in the
  staged patch.

The browser runner reports the existing `NO_COLOR`/`FORCE_COLOR` environment
warning. It does not fail these browser tests. No backend, dependency or image
changed; backend suites, combined coverage ratchet, dependency scans, Docker
rehearsals and live rebuilds were not rerun. Local results do not claim a completed
GitHub CI run or establish release readiness.

## Known compiler boundary

An exploratory JavaScript-template callback with a number-annotated argument was
accepted when attached to Input's string event. The exported declaration has the
correct payload and a typed consumer's invalid `$emit` is rejected, but these are
not evidence of complete JavaScript template event checking. Runtime tests cover
actual emitted values; compiler checking cannot replace them. Keep this gap visible
and investigate it before expanding claims of compile-time event safety.

## PR availability

GitHub MCP and the saved GitHub CLI login returned zero open Classifarr PRs; a
second CLI check after implementation also returned none. There was no random PR
to select or apply, and none was merged or substituted. All work stays on `main`.
No version bump, release, tag, new branch or live-data change is included.

## Recommendation stack

1. Keep the native-control/JSDoc approach: small ESM modules and no new dependency.
   Tradeoff: callers still need meaningful labels, and types must be verified.
2. Next investigate the JavaScript template callback gap with a minimal
   reproduction and supported configuration. Avoid broad assertions or suppressions.
3. Enroll PasswordInput and the remaining common controls, with explicit
   visibility-button names and consistent hints/errors.
4. Expand strict checking to screens in small reviewed batches. Do not describe
   eight checked components as whole-application type coverage.

The plainspoken skill kept progress and the handoff concise; the design and test
details remain in these separate documents.
