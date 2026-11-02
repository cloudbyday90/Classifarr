# Client compiler PR 581 compatibility assessment design

Date: 2026-11-02 (America/New_York). Status: assessed; candidate deferred after reproduced regressions.
Observed result: [compiler assessment outcome](client-compiler-pr-581-outcome.md).
Base: 7285cbb6a782e12970af04827b8812018054051a on main.

## Random selection and current facts

GitHub MCP found open PRs 581 and 580. One uniform Get-Random selection chose
[PR 581](https://github.com/cloudbyday90/Classifarr/pull/581), reviewed at head
15b66950a5739e6fdb5290f2cf4c0120d4259015 against the current main base. It proposes
exact vue-tsc 3.3.14 in place of 3.3.13 with its coupled Vue/Volar graph. PR 581 is
fresh and mergeable at intake; PR 580 remains open. Recheck at delivery and rebase
only genuinely stale applicable branches. Leave provider PRs unmerged. The outcome
records the later merge conflict and synchronization of PR 580.

This is the compiler portion deferred in the
[previous client tooling outcome](client-tooling-pr-579-outcome.md). The registry
reports installed/wanted 3.3.13 and latest 3.3.14. Its manifest requires
@vue/language-core 3.3.14 and @volar/typescript 2.4.30; the proposed graph also
introduces the matching Volar language-service and language-server protocol
dependencies. TypeScript stays 6.0.3 and Vue stays 3.5.44.

The [3.3.14 release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14)
changes template control-flow isolation and dot-value handling. Official upstream
reports [6322](https://github.com/vuejs/language-tools/issues/6322) and
[6328](https://github.com/vuejs/language-tools/issues/6328) remain open/pending
triage on November 2, with no fixed-release link established by this review.
They describe literal double-slash attributes disrupting model narrowing/event
inference, and whole-slot defaults plus imported-property reads producing
generated syntax errors that can hide an unrelated semantic error.

These are reported upstream regressions, not locally reproduced Classifarr
failures or verified security vulnerabilities. Passing the two application
typecheck scopes alone is insufficient: the strict component scope enrolls 19
SFCs, not the entire application. No application enrollment expansion is proposed.

## Bounded differential assessment

Retain the actual-CLI helper's no-shell execution, sanitized environment,
384-MiB heap, 30-second timeout, 1-MiB output and owned temporary cleanup. Extend
it narrowly for fixed companion files and explicit .ts inclusion where needed;
do not add a general project runner or operator workflow.

Add permanent normative controls that must behave identically on the baseline
and candidate, covering:

1. Valid reactive non-Ref model bindings with URL and non-URL literal attributes.
2. URL/non-URL event inference controls plus an exact source-mapped invalid
   operation, proving that contextual typing was not silently widened.
3. Whole-slot parameter defaults with an imported property's template read, with
   inside-destructuring and no-property controls to isolate the reported trigger.
4. The clean slot fixture must exit zero. Add an unrelated included .ts semantic
   error and require that exact TS2322; generated syntax errors or missing
   semantic checking must fail the test rather than satisfy a negative control.

Preserve existing exact diagnostic/exit-code assertions, both application
typecheck scopes, all flags/exclusions and legitimate JavaScript SFC behavior.
Do not rewrite application templates, ignore diagnostics or mix older Volar
pieces into the candidate to make it pass.

First run the controls on installed 3.3.13 and retain its baseline receipts.
Review an exact 3.3.14 manifest and complete lock generated with scripts disabled
before strict installation. Inspect every graph addition/change/removal, engine,
peer/optional-peer, platform and published lifecycle-script boundary. Keep all
other pins, security overrides, script decisions and root/server trees intact.

Run the same controls against the coherent installed candidate graph. If a
regression reproduces, restore/retain the complete 3.3.13 manifest/lock/tree and
document PR 581 as assessed but inapplicable. Keep baseline-compatible regression
controls. Do not adopt a failing compiler merely to complete a dependency update.
If the candidate and all normal gates pass, retain exact 3.3.14 with the reviewed
coherent graph and record local adoption. No further design question is needed
to choose between these two evidence-defined outcomes.

## Quality, security and resource boundaries

Use Node 24.22.1/npm 12.2.1 and existing strict lifecycle policy. Do not upgrade
global tools, broaden script permissions, relax peers or suppress scanners.
The existing npm bundled-parser release hold is independent and unchanged.

Check artifact growth before install/build work and preserve current evidence,
recovery assets, toolchains, worktrees, other projects and shared Docker resources.
No container replacement or live appdata access is needed for this assessment.

Run npm ci, npm ls --all and full npm audit including development dependencies
for the retained tree. Compare advisory identities and report remaining findings
without claiming audit silence proves safety. Run the actual lint/type contracts,
both project typechecks, fresh client coverage/build/browser and the dependency
suite. The [independent advance fence](capture-advance-fence-design.md) requires
fresh backend checks; run the joint ratchet only with current reports.

This is developer/CI verification through existing test entry points. It adds
no operator CLI requirement, application API/UI, job, setting, provider call,
routing/learning permission or production behavior workaround.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Install candidate and trust existing project checks | Fast | Missing template patterns can weaken diagnostics unnoticed | Insufficient |
| Keep baseline without testing | Avoids compiler change | Leaves applicability unknown | Use only after a demonstrated refusal |
| Differential real-CLI controls, conditional adoption | Evidence defines the safe result and creates lasting protection | Extra bounded compiler processes and graph review | Recommend |
| Suppress errors or mix compiler dependencies | Can hide failures | Weakens quality authority and upstream support | Reject |

Final stack: immutable selected PR, current official reports, baseline-compatible
semantic controls, reviewed coherent candidate, strict install and differential
results, then either tested adoption or explicit retained-baseline deferral.
The result cannot be presented as an application failure until locally proved.

## Documentation and delivery

Create a separate observed outcome with exact candidate/baseline diagnostics,
versions, audit scope, test results and remaining gaps. Update the previous
compiler follow-up and Unreleased. Commit/push all final changes on main after
quality, staged secret/diff checks and artifact reconciliation. Do not create a
branch, version bump, release, deployment or PR merge.

Sources above were discovered/read through GitHub and web MCP tools on November
2, 2026; registry metadata and immutable PR/selection receipts remain private
under .tmp. Upstream status is evidence of an unresolved report, not a substitute
for the planned real-library comparison.
