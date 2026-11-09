# Client Tailwind PR 587 assessment design

Research: November 9, 2026 Eastern. Baseline main c5f4dd183. Status: agreed and
locally implemented; see the separate [outcome](client-tailwind-pr-587-outcome.md).
No release or deployment.

## Selection and observed baseline

Uniform crypto.randomInt selection from the current open-PR set selected its sole
member, [PR 587](https://github.com/cloudbyday90/Classifarr/pull/587), at
2026-11-09T22:16:30.763Z. Assess immutable head
1e96827673b4e51b1f8fc540f2c64f28ca6a9244. This is a new assessment of its current
Tailwind 4.3.5 proposal, not the earlier 4.3.4 proposal. The already-adopted
JSDOM-owned Undici patch needs no second adoption.

The installed Tailwind core/PostCSS pair is 4.3.3. Registry wanted/latest is
4.3.5. A bounded real installed-compiler control reproduces incorrect transparent
fallback output for color-mix(currentcolor 50%, transparent); the explicit
in-oklab control retains currentcolor. Top-level CSS CDO/CDC handling also emits
malformed extra rules. These are library controls, not a demonstrated application
failure or security exploit.

The [official 4.3.5 release](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.5),
published November 6 and retrieved through GitHub MCP, documents repairs for these
cases, WASI initialization and subsequent file scans, functional-variant work and
published Node declarations. Its linked implementation changes are the primary
sources for regression inputs and intended behavior.

## Proposed bounded adoption

Conditionally pin tailwindcss and @tailwindcss/postcss to exact 4.3.5. Keep their
published coherent Node, Oxide and native/WASI 4.3.5 graph. Review and admit only
coupled resolutions needed by this subset; do not copy the whole grouped PR lock
or refresh unrelated caret ranges.

Retain JSDOM 30.1.3, vue-tsc/language-core 3.3.13, TypeScript 6.0.3, Vue and
application runtime transports. The same previously demonstrated compiler
deferral remains applicable. Preserve every override, lifecycle-script decision,
peer default, lint/type setting, timeout, browser assertion and scanner gate.

The reviewed candidate graph changes LightningCSS 1.32.0 to 1.33.0 and introduces
a Node-leaf magic-string 1.x resolution. Review actual generated-lock consumers,
engines, integrity values, platforms and new packages rather than assuming a
Tailwind patch has no transitive impact. None of the assessed Tailwind packages
declares an installation hook.

WASI packaging changes are material: the candidate removes the former wasm32 CPU
restriction, allowing the optional WASI runtime graph to install on x64. Its
published engine supports the pinned Node. Upstream filesystem WASI integration
controls skip Windows. Exercise supported Linux WASI behavior in an isolated
bounded child/container, while testing the real native Windows scanner locally.
Do not infer working WASI file observation from a Windows skip or a version string.

## Verification

1. Freeze old-library failures using the actual installed core/compiler and
   scanner. Keep ordinary CSS, explicit interpolation and custom-property token
   controls so a patch cannot pass by dropping supported content.
2. Verify exact output/semantics for omitted interpolation and top-level CDO/CDC;
   test actual PostCSS compilation and application CSS. The current
   [CSS Color Level 5 draft](https://www.w3.org/TR/css-color-5/) specifies Oklab
   when interpolation is omitted. This is draft-language alignment, not a claim
   of complete browser support or W3C conformance.
3. Exercise native scanning, bounded WASI startup, existing/new/changed source
   files and cleanup. Use real packages, explicit deadlines and owned temporary
   files/children. Keep platform exclusions visible and validate the supported
   Linux path separately.
4. Verify shipped Node declarations with a bounded real type-checking consumer
   and unchanged application scopes. Check legitimate positive behavior and an
   unrelated semantic-error sentinel; do not enable skipLibCheck to hide defects.
5. Generate the minimal client lock with scripts disabled, review every delta,
   then perform a strict clean install, full package-tree checks and development-
   inclusive audits across the workspaces. Preserve installer/scanner policy.
6. Run fresh client coverage, build, lint/typecheck and production/shared-form
   browser controls, plus affected dependency/configuration gates. Reuse backend
   coverage only after its qualified inputs, installed tree and report hashes
   are verified unchanged; runtime feature changes in the parallel agreed batch
   require fresh backend coverage. Run the coverage ratchet with current reports.

Integrate regressions into existing automated developer/CI test paths; add no
operator CLI trigger, setting, page or job. If a candidate fails, retain compatible
installed versions and document the exact failure without weakening controls.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Exact coherent Tailwind 4.3.5 subset | Repairs reproduced compiler behavior and assesses current native/WASI fixes | Coupled platform graph needs real verification | Recommended conditional adoption |
| Retain 4.3.3 | Avoids graph movement | Leaves reproduced library defects and WASI fixes unqualified | Fallback on failed gates |
| Adopt all PR 587 packages | Broad tooling refresh | Mixes a JSDOM major with a known compiler deferral | Separate work |
| Whole-lock refresh or disabled native checks | Less review work | Loses attribution or hides relevant platform failures | Reject |

First qualify the coherent Tailwind subset, then assess JSDOM's major migration
separately. Keep the existing compiler deferral until a corrected artifact passes
its preserved differential controls. Node/npm security availability remains a
separate priority; this CSS tooling work does not remediate their known gaps.

## Delivery

Recheck PR state at delivery. At research handoff it is mergeable with unstable
checks, one commit ahead and five behind main; that is not evidence of a conflict.
Rebase only a genuinely stale applicable branch. Leave PRs unmerged and send no
bot comments as an incidental maintenance action.

Use scoped artifact maintenance before heavy work and at handoff. Record actual
adoption, failures/skips, audit findings and verification in a separate outcome
document and Unreleased. Commit/push all intended changes on main without a
version bump, release, publication or deployment.
