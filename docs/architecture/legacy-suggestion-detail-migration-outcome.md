# Full suggestion detail migration outcome

November 23, 2026 Eastern. See the
[design and alternatives](legacy-suggestion-detail-migration-design.md)
and [caller migration guide](../api/suggestions.md).

Authenticated members and administrators can now request a single proposal
with its status and reference count. The endpoint uses one parameterized
query and returns at most 8 KiB of JSON. The three supported proposal types
use fixed configuration fields. Invalid, unknown, or oversized configurations
return an unavailable status and null configuration. The client adapter
validates the exact ID before calling the proposal route.

The legacy GET carries a dated `Deprecation` header and a link to the
same-installation API documentation. Its access and response body continue
during the transition, including full feedback for regular members. No
shutdown date is scheduled. Administrators can migrate evidence work to
the existing bounded pages. The dashboard already uses those pages.

## Verification

The focused PostgreSQL suites passed all 74 tests. They checked the exact
proposal body, member and administrator access, invalid-ID refusal, missing
rows, read-only behavior, and maximum encoding. The legacy control still
returned a saved member-visible note and carried the deprecation header.
The focused server and client runs passed 62 and 74 tests, respectively.
The server run parsed the API specification used for the migration link.

The full backend suite passed 64,513 tests with one skip and 89.33% line
coverage. The full client suite passed 7,693 tests with 89.71% line
coverage. The coverage ratchet passed for both workspaces. The production
build, 30 Chromium checks, lint, type checks, preflight, ESM checks, and
policy gates passed. All three npm audits reported zero findings. GitHub
listed no open pull requests for local adoption or Dependabot rebasing.

## Next recommended item

Agree on the support window and migration contract for legacy callers.
External usage remains unknown. Establish the replacement requirements for
any workflows that still rely on raw feedback before narrowing the legacy
response or access policy. Suggestion list paging can be assessed separately.
