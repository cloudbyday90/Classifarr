# v0.49.3-beta release design

## Agreed scope

The maintainer selected **v0.49.3-beta**, not the proposed v0.50.0-beta, on
2026-10-23 and requested the complete [release runbook](../../.agent/workflows/release.md).
Prepare on main without a separate branch. Release publication is not a live
deployment, VM operation, shared Ollama change or permission to retry retained
fixture cleanup. No new runtime architecture is introduced in release preparation.

Development baseline: `0025d37802cf2c0c997f0d4819e617c6f68106ca`.
Previous published release: v0.49.2-beta, source
`2eb62e0e2390ac837d79e0421d3ac3a1d3a8f98e`.
The eventual clean candidate SHA must be recorded separately; baseline evidence
cannot be attributed to a later version/docs commit.

## Recommendations and tradeoffs

| Decision | Benefit | Cost or limit |
| --- | --- | --- |
| Maintainer-selected patch prerelease | Preserves the requested beta sequence | Contains new opt-in/product capabilities as well as fixes; notes must make scope explicit |
| Retain qualified runtime during preparation | Avoids adding an unqualified image architecture change | npm's separately bundled moderate advisory remains an explicit publication decision |
| Archive original development entries, summarize by system | Keeps release review readable without losing chronology | Requires exact archive/published-block comparison, not just Markdown lint |
| Fresh checks on a frozen exact source | Makes results attributable to the release | Prior green tests and receipts are context only; changes require new qualification |
| Native digest-bound published consumers | Tests what users actually pull on AMD64 and ARM64 | Version images become public before downstream checks; publication and aliases remain gated |

Recommended verification stack: pinned Node/npm with unchanged strict installers;
three committed lockfiles; fresh lint/full CI/audits; synthetic schema and
pg_stat_statements checks; isolated installation/routing; one no-cache frozen
image with soak and saved profiles; exact-source remote checks; tag-only native
published-image evidence; immutable release and independently verified provenance
and aliases. Local image IDs are never described as registry digests.

## Security decision boundary

The server override uses patched `ip-address` 10.7.4. npm 12.2.1 independently
bundles affected 10.7.2; the application override cannot patch it. The
[reviewed advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) is moderate.
The [official npm release](https://github.com/npm/cli/releases/tag/v12.2.1) and
live registry review on October 23 identified no newer patched npm candidate.
Normal startup executes Node directly, but the affected files remain in the
production image. Guarded SOCKS consumers are not proof of non-exploitability.

Do not vendor-patch npm, downgrade to another affected CLI, suppress scanners or
silently waive the finding. Explicit residual-risk acceptance or a separately
reviewed remediation is required before publication. Version selection alone
does not settle that decision. Removing npm/npx only from the final runtime
would reduce exposure but needs maintenance compatibility and new exact-image
qualification; it is not part of this release preparation by assumption.

## Required review and checks

1. Check live tags/releases; preserve main and unrelated work. Align the three
   manifests/locks, public UI version, README and notes with v0.49.3-beta.
2. Preserve the original Unreleased block verbatim in a new dated archive and
   leave published blocks unchanged. Check all changed systems, operator actions,
   four application migrations, mixed-writer warning and optional gateway/VM gates.
3. Verify live Docker Hub repository identity/count and record its exact time.
   Describe image pulls only, excluding GHCR and unique-installation claims.
4. Use Node 24.22.1 and private npm/npx 12.2.1; install all three lockfiles with
   strict script approvals. Metadata-only lock regeneration must not change graphs.
5. Run the runbook's source, browser/provider-fault and security checks. Inspect
   manual checklist boundaries rather than equating lint with security review.
6. Build one uniquely tagged verification image. Dump/review/check schema and
   exercise pg_stat_statements startup/recovery/upgrade on that exact image with
   disposable data. Commit any fixes before freezing.
7. Run local installation/routing and the complete no-cache frozen rehearsal
   against clean committed source; inspect receipts, resource budgets and cleanup.
   The pinned historical upgrade baseline is v0.48.4-beta, not v0.49.2-beta.
8. Push reviewed main only and verify every applicable exact-source remote check.
   Recheck live immutable-release, tag-only environment and credential boundaries.
9. Only after all gates and explicit security/source approval, push the one
   annotated v0.49.3-beta tag. Watch source/provider/publication/native-consumer
   gates; independently verify release asset attestation, immutable publication
   and both aliases before announcing success.

No fabricated workflow context, timestamp edits, skipped cleanup, lowered
thresholds, broad pruning, force promotion or tag reuse is acceptable. A failure
must retain its evidence and actual side-effect state; follow runbook recovery
rules rather than assuming a failed workflow published nothing.

## Outcome ownership

The [separate outcome](release-0.49.3-beta-outcome.md) records only observed
results, exact identities, failures/skips and outstanding gates. Do not amend the
immutable release to attach later local evidence. Deployment and the original
representative-refresh/VM investigations remain separate follow-up work.
