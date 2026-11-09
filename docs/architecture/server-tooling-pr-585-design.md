# Server tooling PR 585 assessment design

Research: November 9, 2026 Eastern. Baseline main
4a6d345dbc91e948c55b142a2b5ee194807efebd, clean at intake.
Status: agreed November 9; implemented and qualified locally and in exact-source CI.
See the separate [observed outcome](server-tooling-pr-585-outcome.md).
No release or deployment.

The user confirmed this exact two-tool and documentation-correction scope before
implementation. The [repository grilling skill](../../.agents/skills/grilling/SKILL.md)
requires: "Do not act on it until the user confirms you have reached a shared
understanding." That agreement covers this bounded batch.

## Why this is the next applicable batch

The first security follow-up was to assess an actually published corrected Node 24
artifact. Fresh official research still finds Node 24.22.2, whose bundled Undici
remains 7.30.1. The security announcement schedules releases on or after November
11; it does not identify an available corrected artifact. npm registry latest and
next-12 remain 12.2.2, with no published 12.2.3. The actual existing npm bundle
still contains Glob 13.0.6 and Minimatch 10.2.5.

Keep the current Node/npm pins and explicit residual findings. The pending npm
release PR is neither a published artifact nor proof of future bundle contents.
Do not substitute a vendor patch, global-fetch replacement or scanner exception.

The independently requested random PR supplies a bounded available assessment.
Uniform crypto.randomInt selection from open PRs [587,585] at
2026-11-09T20:57:26.315Z chooses [PR 585](https://github.com/cloudbyday90/Classifarr/pull/585),
immutable head bd25a3f3212d1e6e3774850a4658a07f7965a49f against
2d5f12dad66e35d46ff28ee198a90495e9d4e350. Both current PRs are fresh and mergeable;
an unstable check state or an older base alone does not establish staleness.

## Exact candidate and preserved boundaries

Conditionally adopt both server development tools with exact direct pins:

| Package | Installed baseline | Candidate |
| --- | --- | --- |
| Globals | 17.13.0 | 17.14.0 |
| Knip | 6.44.0 | 6.44.1 |

The immutable PR changes only the manifest declarations and two locked package
records. Candidate registry integrity matches. Neither candidate declares install
hooks. Knip's published dependencies and engines are identical across these two
versions; no parser/native-platform migration is required. Preserve its scoped
smol-toml 1.9.0 override, all other overrides and strict lifecycle/peer decisions.

The server ESLint configuration uses Globals' Node map and its own fixed Jest
names. The actual 17.13.0 and 17.14.0 Node maps are identical: 81 entries with the
same values. The nodeBuiltin maps also match. Upstream browser/worker additions
do not admit new server globals or expand the application's Node support.

Keep ESLint severities, Knip configuration/ignores, ownership classifications,
parser versions and runtime dependency records unchanged. The client, TypeScript/
Vue compiler graph and installed Node/npm tools remain outside the update.

## Meaningful before/after verification

An existing bounded real-CLI fixture already reproduces Knip 6.44.0 missing unused
sibling exports behind both import().then(mod => mod.used) and a destructured
callback. Its static-import control reports the unused sibling, all used exports
remain retained, and stderr is empty. The normative result contains three unused
exports; the old CLI reports only the static-import one. This is a tool-analysis
defect, not evidence of an application vulnerability. The private receipt and
scoped failing harness are retained under .tmp/node-security-followup.

1. Reuse the existing knipCliFixture helper and installed CLI. Add permanent
   regressions for both corrected forms with static/awaited-import positives and
   genuine unused siblings. Fixtures are parsed, not executed.
2. Preserve normal/production missing-import and dependency findings, tagged
   exports, entry boundaries, invalid-config refusal and cold/warm-cache controls.
3. Exercise actual configured ESLint against known Node globals and an undefined
   sentinel; compare the actual used Globals map rather than invent a changed
   server API. Preserve all security-rule severities and exclusions.
4. Generate the lock with scripts disabled, review every delta, then strict clean
   install. Require unchanged runtime records and parser/native graph; investigate
   any unexpected change before proceeding.
5. Run complete package trees, full development-inclusive audits, server lint/
   types, both Knip modes, ownership, dependency-tooling and normal policy/ESM/
   copyright/Markdown gates. Obtain fresh backend coverage and run the ratchet
   with a verified current client report.
6. Reuse client coverage/build/browser evidence only after source, configuration,
   installed tree and report hashes prove unchanged. No client install or image/
   database-driver change is proposed.

If a candidate exposes unexpected findings, investigate them without weakening
the analysis policy. Defer a candidate that requires a separate runtime cleanup
or incompatible graph. Keep normative failing evidence private when retaining an
older tool; do not commit a failing suite or require defective behavior forever.

The baseline full server audit has the same five low affected nodes in the
existing deepmerge/Jest chain and zero moderate/high/critical entries. Candidate
audits must be reported separately; a successful lint run does not clear advisories.

Fresh npm outdated also reports Knip 6.44.2. Its separate release advances the
OXC parser to 0.156.x and adds further plugin/script work. Official review finds
no blocking fix or reversal of the assessed dynamic-import correction. Keep it
outside the immutable selected batch; assess its new parser graph separately.

## Correct the queued classification follow-up

The [consumer trace](compatibility-purpose-consumer-boundary.md) establishes that
the previously named compatibility-purpose prompt gap is in a post-choice
learning-provenance adapter. Correct its six queued design/outcome references and
record the fresh Node/npm availability result. Preserve historical test receipts.

This batch changes no runtime prompt, scoring, learning, routing, authorization,
schema, provider disclosure or historical data. Future prompt evidence and future
learning-provenance work require separate contracts. Do not relabel a learning
change as presentation cleanup or implement the omitted pair under this proposal.

## Options and recommendation stack

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Assess the exact two-package PR subset | Available compatible tooling; concrete missed-analysis regression | New analysis can reveal findings requiring investigation | First applicable implementation |
| Wait for all security fixes before any work | Fewer batches | Published independent tooling improvement remains unassessed | Keep security wait separate |
| Change Node to 24.22.2 as claimed remediation | Newer point release | Actual affected bundle is unchanged | Do not make that claim |
| Expand the mislabeled compatibility mapper now | Could change future evidence behavior | Changes learning guards and needs declared-rule provenance decisions | Separate scope |

Recommended stack: verify the selected tooling patch; correct the consumer-boundary
documentation; assess the actual published Node security artifact when available;
then verify an npm bundle repair. Define provider-prompt evidence separately from
post-choice learning provenance before either runtime change.

After agreement, document the observed outcome separately, update Unreleased,
perform scoped artifact maintenance and staged checks, commit/push all changes on
main and inspect exact-source CI. Leave PRs unmerged; rebase only genuinely stale
applicable branches. Add no operator CLI requirement, UI, job, release or deployment.

## Official sources

Sources discovered/retrieved through MCP on November 9:

- [Globals 17.14.0 release](https://github.com/sindresorhus/globals/releases/tag/v17.14.0)
  and [exact data diff](https://github.com/sindresorhus/globals/compare/v17.13.0...v17.14.0).
- [Knip 6.44.1 release](https://github.com/webpro-nl/knip/releases/tag/knip%406.44.1)
  and [dynamic-import fix](https://github.com/webpro-nl/knip/commit/14565eb56ec16140d30708fa498c8b34f23c1f9f).
- [Separate Knip 6.44.2 release](https://github.com/webpro-nl/knip/releases/tag/knip%406.44.2)
  and [comparison](https://github.com/webpro-nl/knip/compare/knip@6.44.1...knip@6.44.2).
- [Node security announcement](https://github.com/nodejs/nodejs.org/blob/main/apps/site/pages/en/blog/vulnerability/november-2026-security-releases.md),
  [published Node 24.22.2](https://github.com/nodejs/node/releases/tag/v24.22.2)
  and [actual bundled Undici](https://github.com/nodejs/node/blob/v24.22.2/deps/undici/src/package.json).
- [Official npm metadata](https://registry.npmjs.org/npm/latest) and
  [pending upstream release PR](https://github.com/npm/cli/pull/10244).
- [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  keeps enforcement outside model text. The consumer-boundary correction follows
  that separation; it does not implement an injection-defense redesign.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/) supports precise
  labels and clear process descriptions. No UI or WCAG conformance claim is added.
