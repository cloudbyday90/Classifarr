# Legacy suggestion support window outcome

November 23, 2026 Eastern. See the
[design](legacy-suggestion-support-window-design.md) and
[migration guide](../api/suggestions.md).

Classifarr has set a minimum 90-day support window for legacy full detail.
The window starts with the first public release that ships the two bounded
alternatives, the deprecation notice, and the migration guide. A downloadable
beta qualifies. The latest published beta at this review predates those
changes, so the window has yet to start. A later review will consider reported
workflows before a removal date is chosen.

The legacy read keeps the shipped fields, authorization, and feedback ordering.
Its query names the columns from both tables explicitly and successful reads
carry `Cache-Control: no-store`. Existing raw feedback stays available during
the transition. Public searches found no known external consumer, and
installed usage remains unknown. The migration guide asks for field names
and use cases without response data or logs.

## Older suggestions

Older rows can use the bounded proposal and evidence reads when their
configuration and linked feedback are present. Apply still refuses missing
historical provenance. A fresh analysis of current feedback can supersede
pending proposals and generate new ones for review. The compatibility work
does not change saved history or recreate missing evidence.

## Verification

All 76 focused PostgreSQL tests passed. They verified member access, the
ordered response fields, identical response bytes and ETags after adding
synthetic columns to both tables, and `no-store` on GET, HEAD, and `304`.
An older fixture remained readable through the proposal and administrator
evidence endpoints. Apply still returned `409 SUGGESTION_EVIDENCE_REQUIRED`
with the saved suggestion, policy, and audit record intact. The existing
analysis regression confirmed that current data can produce replacements.

All 62 focused server tests passed, including the generated API guide.
The full backend run passed 64,523 tests in 1,958 suites with one skip and
89.33% line coverage. Client coverage was reused after verifying its source
tree, installed dependency tree, and report hash. Both coverage ratchets
passed. Lint, type checks, preflight, ESM checks, and policy gates passed.
All three npm audits reported zero findings. GitHub listed no open PRs
for local adoption or Dependabot rebasing.

## Next recommended item

Record the qualifying release and its publication date when it ships.
Review the reported member and administrator workflows after the minimum
window before deciding how to narrow or retire legacy detail. If a deployment
shows unavailable legacy data, start with a read-only inventory of which
fields and references can still be recovered. The next independent code
batch can assess list callers and a bounded suggestion-list response.
