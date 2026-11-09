# Vue PR 583 assessment outcome

Date: November 9, 2026 Eastern. Baseline main 76599f4de. Adopted on main at
2d2d3b70c60572a58531eef58877231d6d637acd, with separate documentation-only receipt
completion. See the [design](vue-pr-583-design.md).

## Assessed change

Uniform random selection chose [open PR 583](https://github.com/cloudbyday90/Classifarr/pull/583)
from three candidates at 15:05:43.355 UTC. MCP verified immutable head
fecda340470aa7224839e421ba9e1b60ab520461 and its two-file comparison. The local
implementation pins Vue 3.5.45 exactly with all ten core/compiler packages aligned.
The only coupled changes are Babel helper-string-parser/parser 7.29.13 and types
7.29.11. All thirteen registry integrity values match; no package additions,
removals or lifecycle hooks occur.

vue-tsc/language-core 3.3.13, TypeScript 6.0.3, other tooling, overrides, application
syntax and negative diagnostics remain unchanged. PR 581's existing compiler
deferral remains. No PR is merged or used as a release/deployment command.

## Real before/after evidence

Seven bounded child controls use the real Vue compiler/runtime and DOM. Old
3.5.44 fails four: stopped-scope disposal, false static boolean attributes and
catch/switch lexical shadowing. Candidate 3.5.45 passes all seven. Ordinary SSR
escaping/style, late async settlement after unmount and current directive binding
controls pass. These fixtures establish library behavior, not a production
classification incident or application exploit.

The new fixture and three existing compiler/typecheck suites pass 71 controls,
including exact negative diagnostics, URL/model/event inference, imported
properties and slot defaults. The open named function/class expression issue
also reproduces on 3.5.44 and remains explicit upstream debt. No assertion is
added that requires incorrect behavior to persist.

## Normal gates and browser limitations

Strict clean install, full dependency tree and development-inclusive client audit
pass; audit findings are zero. Fresh coverage passes 485 files and 7,547 tests,
with a passing combined coverage ratchet. Lint, both type scopes, production build
and eight production-route asset/browser controls pass.

The first coverage run caught only a new test file's closing-line style convention;
wrapping its unchanged assertions in describe fixed that. The fresh full rerun
passes. An initial browser launch lacked the pinned browser directory; using the
existing Playwright 1.65.0 browser installation fixes launch without installing or
substituting a browser.

The complete broader browser run has 88 passes and seven failures; it is not an
all-green receipt. A controlled seven-case comparison against an archived clean
baseline, installed independently with Vue 3.5.44, gives the same five startup-panel
contract failures on both versions. Its current component names the region
"pgvector" while the older tests expect "pgvector startup compatibility" and
removed presentation fields. Both Command Center cases pass on both versions
in that comparison; their initial failures are not consistently reproduced.
No application syntax, browser assertion or timeout was changed to hide a failure.

The unchanged startup-browser debt needs its own contract review. It is not a
demonstrated Vue regression and remains visible rather than being counted as a
passing gate. Native ARM64, every upstream Vue issue and complete WCAG conformance
are outside this evidence. W3C-related existing form/focus checks remain intact.

## Delivery and next recommendation

All seven implementation-source workflows pass; the
[CI pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/42650233927)
reports 485 client files/7,544 tests, eight production-route cases and fourteen
shared-form cases. Local Windows coverage counts above remain separate. The same
frozen candidate passes the full isolated installation, budgeted fresh/upgrade
crash recovery and routing rehearsal; its image/source/cleanup details and scanner
limits are recorded in the [npm outcome](npm-12-2-2-security-outcome.md).

Dependabot automatically closes PR 583 unmerged at 16:02:06 UTC after the local
adoption reaches main. The agent neither merges nor closes it. At delivery, PRs
585/587 remain open, updated the same day and mergeable; no genuinely stale
applicable branch requires rebasing. Their unstable check state is not claimed
as passing PR validation or treated as a merge conflict.

No release, deployment, live write, provider write or new operator workflow is
introduced. Maintenance verifies protected service identities/state/health and
worktrees, with owned rehearsal resources removed. No newly verified stale asset
is eligible for retirement; recovery assets, toolchains, current evidence, shared
cache and other projects remain preserved.

Retain the exact coherent Vue patch with the reproduced fixes and unchanged type
controls. Review the five existing startup-browser contracts separately before
claiming a fully passing broader browser suite. The security-priority next batch
remains Node's newer bundled Undici; category-neutral prompt projection follows
the toolchain security work. Do not combine language-tooling/DOM/Tailwind updates
with either follow-up.
