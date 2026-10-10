# Provider-specific identity guidance: outcome

## Findings — 9 October 2026

Read-only local SQL confirmed twelve current unresolved observations: nine
recorded TVDB conflicts with insufficient independent evidence, two recorded
TMDb conflicts with inconclusive external evidence, and one TMDb conflict rejected
by title/year validation. The [preceding investigation](unresolved-identity-october-investigation.md)
confirmed the same titles/categories in the Unraid UI and descriptions/posters
on all twelve Plex records. Metadata presence does not resolve contradictory IDs.

A new bounded read-only probe followed the one title/year refusal through current
Plex evidence, independent IMDb/TVDB lookup, candidate-bound TMDb details and
TMDb's alternative-title endpoint. Both independent IDs agreed on a declared
candidate. The year agreed; the Plex title matched a catalog alternative title
exactly, but not the primary/original title. This explains the rejection without
proving that any other conflict shares that cause. Private titles, IDs, endpoint
credentials and response bodies are not retained in these repository documents.

No probe reset a cooldown, changed a catalog, recovered an item or wrote to either
application database. Unraid and the shared Plex/Ollama services were not deployed,
restarted or reconfigured.

Two further bounded current-source checks explained the waiting category:
one returned `incomplete_external_evidence` and the other `external_id_not_found`
from the existing resolver. These are missing catalog cross-references, not
evidence of missing Plex descriptions. Unraid's read-only report was refreshed
at 23:30 Eastern and still showed twelve items: ten source review, two retry wait.

## Implementation

The existing paginated status endpoint now projects a bounded allowlist of stored
provider categories. No schema change, new provider request or data backfill is
necessary. Older responses remain readable; malformed supplied fields are rejected
by the client, while malformed stored categories are withheld by the server.

Command Center explains the difference between metadata and trustworthy identity,
names the detected provider, and distinguishes invalid IDs from conflicting IDs.
It does not claim the parser recorded every conflict. Source-review guidance
avoids blindly rematching a correct-looking title, and explains that an alternative
title can account for the exact-title refusal. Existing retry eligibility,
authorization, escaping, capture scope and memory safeguards remain unchanged.

## Random open PR trial

[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`, was randomly selected from the two open
PRs and verified still open after the trial. Its client Node 26 declaration patch
was applied locally, inspected and installed first with scripts disabled, then
with the repository's reviewed lifecycle policy. Install, dependency-tree check,
client typecheck and full-scope npm audit passed (zero reported vulnerabilities).
Toolchain policy produced 39 passes and one expected failure: Node 26 declarations
do not match the pinned Node 24 runtime. Only the trial's manifest/lockfile edits
were reversed; reinstalling the retained versions restored all 40 policy tests.
There is no retained dependency diff, and no PR was merged or closed.

## Verification

Focused backend checks passed: four suites / 146 tests, including recovery and
title-matching guards. Disposable PostgreSQL passed thirteen tests, including
provider projection, unchanged stored observations, complete pagination and
exclusion of stale, incomplete or superseded captures.

The first focused frontend run exposed a wording regression: the alternative-title
guidance omitted the explicit statement that no conflicting ID had been selected.
That statement was restored without weakening the existing assertion.

The first full backend run detected the expected whole-file ownership-review
drift in `sourceIdentityIssues.mjs`. Review confirmed only the read-only SELECT
projection and allowlisted response mapping changed: no writes, lock/owner changes
or new provider calls. Only that file's source digest was refreshed; its analysis
digest and existing unresolved `analysis_debt` classification were retained.
This does not claim broader ingestion compatibility or waive existing review debt.

The ownership gate rerun passed all 39 tests. Full frontend coverage passed all
448 files / 6,530 tests. Lint, both typechecks, backend dependency analysis,
documentation, copyright and ESM import checks passed. The production frontend
build and production-only backend dependency check also passed.

Full backend coverage completed in 985 seconds: 1,762 suites passed and one
failed, with 54,899 passing tests, the one stale-review assertion above and one
Linux-only directory-fsync test skipped on Windows. After completion, Jest's
failed-suite rerun against the corrected review passed all 39 tests. No other
full-run failure occurred. This records the full run and correction separately,
not an uninterrupted green run. The skipped filesystem behavior passed inside
the actual Linux image as described below.

The coverage ratchet passed with both fresh reports: server statements/lines
89.72%, branches 85.88%, functions 91.13%; client statements 87.00%, branches
80.51%, functions 86.57%, lines 88.81%. No threshold or assertion was relaxed.
Staged secret scanning passed. No release or version change is part of this work.

## Local image and schema evaluation

Built without cache from clean committed source
`9bd482ba721933f9531b4e28647392cb88d68e69`. The inspected local Docker image identity
is `sha256:04f8236286e9c540f9d374a5e3556bab434c9ca9e4032010e55f25c4d8b1a22d`;
this is local testing evidence, not a claim of registry publication or a signed
release. Only the local Compose service was recreated using its existing override.

A 76,672,388-byte database backup was checksum-verified and readable with
`pg_restore --list`; the exact prior image has a private rollback tag. The new
container started at `2026-10-10T03:33:15.339421401Z`, became healthy and returned
HTTP 200. Early checks showed zero restarts, no OOM event, a read-only root,
UID/GID 1000, `no-new-privileges`, and the unchanged 2 GiB limit. A 372.3 MiB
sample is startup context, not sustained memory-soak evidence. The startup-window
error-log query returned no rows at that check.

The rebuilt browser UI rendered all twelve entries, nine detected TVDB providers
and three TMDb providers, the metadata explanation and alternative-title guidance.
Keyboard Tab reached the first Open library link with a visible focus outline.
The count correctly remained twelve: diagnostics do not erase unresolved evidence.

After the rebuild, the existing isolated schema-dump runner regenerated
`database/schema/current.sql` through migration
`20261009_230000_comparison_incident_ledger.sql` with no tracked schema difference,
then removed its disposable container/data. The actual Linux image also passed
the directory-fsync/exclusive-copy/unchanged-source probe that Windows cannot
exercise natively. No live application data was used for either fixture.

## Recommendation

Keep the selected stack from the [design](source-identity-provider-guidance-design.md):
stored PostgreSQL evidence, allowlisted ESM status projection, strict client
validation and specific Vue guidance. It is inexpensive and immediately useful,
but intentionally does not expose every candidate or repair upstream links.

Next: design a candidate-bound **exact alternative-title check**, only after
independent external-ID agreement and exact year validation, followed by the
unchanged-source recheck and fenced write. Bound alias response size/count,
preserve cancellation and cooldowns, and test ambiguous/malformed aliases and
changed-source rejection. Do not strip parenthetical suffixes, use fuzzy matching,
ignore disputed TVDB IDs or infer identity from artwork. This is deferred work,
not an implemented recovery claim.

Follow-up on 10 October: the [exact-alias outcome](source-identity-alternative-title-outcome.md)
records implementation and current-source verification of that deferred check.
It does not claim the other unresolved identities were repaired.
