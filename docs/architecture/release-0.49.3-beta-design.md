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

The maintainer initially selected **hold publication pending remediation**, then
explicitly accepted this finding for **v0.49.3-beta only** and authorized continued
publication on 2026-10-23. **Remediation is required before the next release.**
This supersedes the hold only for this finding/version; all other runbook gates
remain mandatory. The exception is recorded in the runbook and Unreleased.
Do not vendor-patch npm, downgrade to another affected CLI, suppress scanners or
silently waive another finding or extend this exception. A separately reviewed,
verified remediation is required before any subsequent release. Removing npm/npx only from the final runtime would
leave local/CI tooling affected; it is not complete remediation of this finding.

Official npm [override documentation](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#overrides)
and the [bundled-dependency repair implementation](https://github.com/npm/cli/blob/v12.2.1/workspaces/arborist/lib/arborist/build-ideal-tree.js)
explain why a consuming project's override cannot repair this bundle. Disposable
tests confirmed the override leaves 10.7.2 installed; updating inside npm's
directory fails while resolving unshipped development/workspace packages.

Supported remediation is an upstream npm bundle refresh and published release
containing the patched parser, followed by exact-version adoption and fresh
qualification. The previous [upstream refresh](https://github.com/npm/cli/pull/10088)
stopped at 10.7.2; it does not fix this advisory. Even the
[October 23 upstream lockfile](https://github.com/npm/cli/blob/52f30938bd372dac25667f38fb771f5fe825e6e6/package-lock.json)
still resolves 10.7.2. No supported patched npm candidate was verified.

A reproducible replacement of the official parser package, without editing its
JavaScript, would still be a maintained downstream npm distribution modification,
not a supported override. That approach was proposed but not approved; the
maintainer requested official-source research instead. Do not implement it by
inference. Related open issues concern
[bundled overrides](https://github.com/npm/cli/issues/10120) and the
[installed-manifest failure](https://github.com/npm/cli/issues/9949), not this
specific advisory. No new upstream report is authorized by this research.

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
