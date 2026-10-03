# Routing CI acceptance outcome

Date: 2026-10-03. No release or live deployment.

## Delivered

CI now builds one revision-labelled candidate for installation and routing
rehearsals. A separate fixed historical image seeds routing state. Version 4
installation receipts require the eight routing phases and exact aggregate results.
Release acceptance downloads this run's artifact and validates source, image,
workflow run/attempt, age, checks and cleanup against trusted workflow context.

The job remains read-only and gains a 60-minute deadline plus full checkout history
for the fixed baseline. Existing standard and opt-in budget modes remain separate.
All added automation is ESM; no runtime service, dependency or migration changed.

## Verification

| Check | Result |
| --- | --- |
| Focused backend tests | 17 suites, 382 passed, zero skipped |
| Workspace lint and client/server type checks | Passed |
| Copyright, dependency and ownership-drift preflight | Passed; no baseline refresh |
| ESM import/mock checks | Passed |
| Migration naming and schema snapshot integrity | Passed |
| Workflow contract and actionlint | Passed; actionlint shellcheck integration disabled |
| Markdown and skill metadata validation | Passed |
| Staged patch secret scan | Passed |
| CLI missing receipt and unexpected argument checks | Both exit 1 with sanitized output |
| Full local installation + routing run | Passed; owned-resource cleanup passed |

The full local command was `node scripts/run-runtime-installation-acceptance.mjs`.
It verified 12 installation checks and all eight routing phases, observed exactly
two movie GETs and two TV GETs, and observed zero provider writes. History remained
unchanged; legacy rows were not automatically enrolled.

Candidate image ID:
`sha256:95108d7db781f0917e82769082a6ce992d399ffa7463c6628c8e02a72e03023c`.
Routing baseline image ID:
`sha256:98b270ee6d5042251ebe038b175937794c150903aedcd4270c7f935bbe00c84d`,
built from `eef03e57ffdd26d638f32f1593c424b438041ea2`.
Published-upgrade baseline remains the attestation-verified `v0.48.4-beta` digest
defined in `publishedUpgradeProvenance.mjs`. PostgreSQL stayed at 18.6; migration
counts advanced from 222 to 315.

The local receipt completed at `2026-10-03T15:07:10.315Z`. It correctly records
`worktreeClean: false` and no workflow identity: source HEAD was
`f9fd8202643653537047247bdf36c8c0075cab92` with this work in progress. This is local
behavioral evidence, **not clean-source CI acceptance**. No receipt was edited to
make it pass the CI gate. Scratch containers, volumes, build tags and archive
directory were removed; the live Classifarr container was not replaced.

## Scope and limitations

Both GitHub MCP search and the saved GitHub CLI login reported zero open Classifarr
PRs. No PR could be selected, applied or merged. The previous HEAD's seven remote
workflows were successful; that does not certify this commit. Post-push CI must
produce its own clean-source evidence.

Full workspace coverage, the opt-in resource-pressure scenario, saved-template
matrix and published multi-platform routing rehearsal were not rerun this round.
Existing coverage/security baselines were not weakened. The new
[release-evidence skill](release-evidence-skill-outcome.md) preserves these distinctions.

## Recommendation stack

1. Require same-image, same-run CI evidence — implemented. Benefit: repeatable
   regression protection. Cost: an extra baseline build and routing run.
2. Run routing checks against the exact published registry digest before promotion.
   Benefit: closes the local-build versus distributed-artifact gap. Cost: additional
   publication-stage wiring and test time.
3. Keep the frozen saved-template/resource-soak matrix as a separate release
   prerequisite, not a substitute for artifact identity verification.

See the [design and official sources](routing-ci-acceptance-design.md) for rationale.
