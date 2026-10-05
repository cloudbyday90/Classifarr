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
README and release documents. Lockfile changes contain version metadata only.
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
