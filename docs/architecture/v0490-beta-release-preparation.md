# v0.49.0-beta release preparation

Prepared on 2026-10-05 at the maintainer's request. This document describes the
candidate, not a claim that publication or deployment has completed. Follow the
[release runbook](../../.agent/workflows/release.md) for the remaining gates.

## Release scope

This release combines the movie/TV recovery, library learning, policy review,
routing, operations, deployment and tooling work since v0.48.4-beta. The
[release notes](../../RELEASE_NOTES.md) explain the combined behavior, upgrade
actions and known limits. The [changelog](../../CHANGELOG.md) retains a concise
system-level index linked to the unchanged detailed development archive.

Version metadata is aligned across the three packages and lockfiles, the UI,
README and release documents. The initial lockfile changes contained version
metadata only; the later approved dependency corrections are recorded below.
The version consistency smoke test follows the displayed version instead of
requiring a test rewrite for each release; the publication CLI still checks
every surface against the explicitly supplied release tag.

The complete database run also exposed an order-dependent recovery assertion:
it selected an arbitrary sync-history row after two attempts. The test now
selects the attempt referenced by the library's ingestion state and verifies
that both history rows remain. No recovery behavior or history is changed.

## Publication notes

Previously the evidence assembler generated a release body containing only its
verification summary. It did not include the reviewed release narrative.

The small ESM `releasePublicationNotes.mjs` module now extracts the first release
section, requires the exact requested tag, preserves its third-level headings,
and places it before the generated evidence. It rejects absent, empty,
oversized, wrong-version or unterminated-fence content before either artifact is
written. Earlier release sections are not copied into the new publication.
Evidence schema, provenance checks and publication authority are unchanged.

This keeps one reviewed narrative in source and avoids a separate manual
GitHub-body edit. The trade-off is an intentional formatting contract: the
current release uses a level-two version heading and internal level-three
headings. Regression tests exercise the parser and actual evidence assembler,
including rejection without output artifacts.

## Download milestone

Docker Hub's live repository API identified `cloudbyday90/classifarr` with
**20,421 image pulls** at **2026-10-05T22:04:47.2018601Z**:
<https://hub.docker.com/v2/repositories/cloudbyday90/classifarr/>.

The README and release notes include the observation date and source. Pulls are
not unique users or installations, and this number excludes GHCR. The runbook
now requires this verification for every release and prohibits presenting a
cached count as current when the API cannot be verified.

## Approved pre-release corrections

The maintainer approved two narrowly scoped HTTP boundary corrections found
during the release checklist. Unexpected, non-operational production 5xx errors
now sanitize both public message fields while preserving their status and
diagnostic ID. Unknown API paths return generic JSON 404 after the existing
routers and before static application delivery. Operational errors, database
timeouts, development diagnostics, authentication, CSRF, Swagger and restore
mode retain their existing behavior.

The focused regression suite reproduced both problems before the patch and
passed afterward. The independent read-only candidate review found no surviving
bypass or compatibility regression within this scope. This is not a claim of
an exhaustive repository security audit; the complete release checklist and
remote scanners remain required.

The maintainer also approved closing the query-credential logging gap found
later in the checklist. A shared logging-only URL projection strips query,
fragment and user-info from access-log request/referrer URLs, error request
context URLs and API-key audit endpoints. Parsed diagnostic queries retain
field names but redact every value, including nested URLs and unknown aliases.
This deliberately trades query-value diagnostics for a boundary that does not
depend on maintaining a credential-name denylist. Method, route, status and
ordinary access metadata remain available; Morgan's escaping and skip rules
remain intact. No request object, authentication input or stored key is changed.
Historical records and external reverse-proxy logs are outside this fix.

This follows [OWASP's exclusion of credentials from logs](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
and uses Morgan's documented [custom formatter and token contract](https://expressjs.com/en/resources/middleware/morgan/)
(checked 2026-10-05), without replacing its request completion or escaping logic.

## Validation and handoff

### Approved dependency gate corrections

The OSV run for `ea2f6e5c` reported three advisories absent from the earlier
passing run, despite all three npm audits still reporting zero. The maintainer
approved only these upstream patches: `proxy-addr` 2.0.7 → 2.0.8,
`source-map-js` 1.2.1 → 1.2.2 and `postcss-selector-parser` 7.1.4 → 7.1.6.
Exact overrides and regenerated lockfiles keep this batch reproducible; all
inspected parent ranges accept these versions. No installer permission or
application trust setting changes. Other outdated packages are deferred.

The recommendation is upstream patches plus consumer regressions and the full
release gates. This adds small override maintenance, but avoids both a broad
toolchain refresh before release and a local third-party backport. Scanner
suppression is not an alternative. Original regressions exercise unsafe proxy
trust, invalid/nested source-map offsets and repeated selector membership scans
without running an unbounded resource-exhaustion payload.

The proxy advisory's critical rating is not a claim of a working Classifarr
exploit: normal and restore applications leave Express proxy trust disabled.
The client packages are used by build/lint/test consumers; no untrusted runtime
entry point was identified. Vue compiler-sfc and Vite also contain embedded
parser copies that standalone overrides do not update; this batch makes no
claim to repair those copies. Their build-time scope remains a separate
dependency-review item.

Independent review also found a separate repeated keyframe-percentage regex
scan in selector-parser 7.1.6 for a digit prefix followed by many classes. Small
bounded probes confirmed the repeat count; the patch's Set-based membership
fix does not remove that path. The standalone consumer parses trusted ESLint
rule selectors, not HTTP input. Follow up on upstream bundled parsers and this
remaining complexity path; do not describe this batch as eliminating all parser
resource-exhaustion risks or patch third-party code without separate review.

Clean installs, both dependency-tree checks, all three npm audits, lint, type
checks, both server Knip checks, 30 tooling tests, the client build and eight
production-policy browser checks passed. Before the updates, the focused suite
reproduced three proxy-trust failures and ten client parser/map failures; after
the updates, all 11 server and 15 client tests passed. These focused results
do not replace the fresh full suite, image rehearsals or remote security gates.

Official advisories and release notes, checked 2026-10-05:

- [proxy-addr trust-subnet advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) and [2.0.8 release](https://github.com/jshttp/proxy-addr/releases/tag/v2.0.8).
- [source-map-js offset advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) and [1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).
- [selector-parser complexity advisory](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf) and [7.1.6 release](https://github.com/postcss/postcss-selector-parser/releases/tag/7.1.6).

### Final candidate evidence

Before freezing, focused HTTP/publication checks passed (9 suites, 140 tests),
followed by the version/runbook checks (2 suites, 6 tests). Source lint,
documentation lint, version alignment and the production-policy browser check
also passed. The preliminary broad run overlapped test additions and reproduced
the security/version failures; it is not final candidate evidence.

Require a fresh full suite and coverage ratchet, isolated database/provider
tests, fresh-image schema dump/check, PostgreSQL smoke checks, clean-source
installation acceptance and the no-cache frozen rehearsal. Keep the resulting
exact source/image identities and outcomes separate from this preparation
snapshot. The Windows-only run cannot prove Linux directory fsync; the Linux
CI suite must execute that test before tagging. Native published AMD64/ARM64
checks remain part of tag CI, not a claim made by local AMD64 tests.

Publication must use the protected tag pipeline and verify its immutable release,
attested v3 evidence and both registry aliases. No live Unraid deployment,
local app-data mutation or live/paid model-quality evaluation is authorized by
this preparation document.
