# Reviewed episode mappings outcome

Work date: 2026-10-11. Starting checkout: `8c2512ca476060959c62f9b6543e4d3a8c8ee408`
on `main`. This is development work, not a release or production deployment.
See the [design and official research](reviewed-episode-mappings-design.md).

## Implementation and operator choice

The operator explicitly chose administrator-confirmed episode mappings inside
Classifarr rather than correcting shared Plex. Implemented optional bounded TV
episode rows within existing whole-work/season proposals. Each row identifies a
source position and a typed catalog episode ID plus coordinates. No ID is inferred
from a title, filename, position or missing provider record.

Preview separates source-ID matches from human decisions and shows the returned
catalog episode title. Saving requires both the existing mapping confirmation and
a separate episode-identity confirmation. The approval audit records human
authority. Normal owned sync can materialize only a complete approved scope,
retaining capture fences, cooldowns, revocation and the normal backfill handoff.
Human episode consent cannot transfer across source-layout changes. Season-backed
documents include only represented catalog seasons; a mapped special is not
silently promoted to a whole-series scalar ID.

No migration, new scheduler, provider write or automatic real-item approval is
introduced. Existing scopes keep their contract. No Unraid, Plex or Ollama setting
is changed. No local mapping is approved merely to lower the unresolved count.

The ownership gate flagged the changed recovery service as expected. Reviewed its
sole owned-sync caller and atomic persistence path, then updated only that file's
review digest and rationale. SQL, retry admission and its analysis digest remain
unchanged; the gate passes without weakening the ownership contract. Existing
season mappings retain legacy catalog read order and evidence fingerprint shape.

## Independent random PR trial

Fresh enumeration found open #555 and #556; the recorded random draw selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. The exact local patch upgraded server
`@types/node` 24.19.2 → 26.6.4 and `undici-types` 7.24.6 → 8.9.0 only.

Script-disabled lock generation, reviewed normal installation and full dependency
tree checks passed. Registry metadata declared no candidate lifecycle scripts or
peer requirements. All-dependency npm audit reported zero advisories at trial time.
Fresh outdated output listed only Node types (wanted 24.19.2; latest 26.6.5).
This is not a universal safety guarantee.

Typecheck failed at the Discord Undici `FormData`/`File` boundary; tooling passed
39/40, with the Node 24 runtime-major guard rejecting Node 26 declarations.
Restored the exact original manifest/lockfile and reinstalled. Backend and frontend
typechecks passed again. No dependency change, PR merge, type cast or weakened
compatibility guard remains. Recommend an intentional runtime migration instead
of treating a declaration-major update as maintenance.

## Validation

Focused backend: 204/204 across seven suites, including the reviewed ownership
gate and legacy fingerprint ordering. Initial focused frontend: 111/111. Isolated
PostgreSQL: 34 recovery tests and 15 scope-review tests passed in separate runs.
Two earlier combined runs each had one `ECONNRESET` in different existing fixture
queries, with 48/49 passing. Their cause was not established; no timeout or retry
guard was changed to hide them.

Chromium: 3/3 passed with the final copy, including keyboard-only confirmation,
320/390-pixel reflow, pending-count preservation and saved human declarations.
Visually inspected the narrow evidence/approval panel. Fixed an initially ambiguous
test locator, not the approval controls. These use synthetic routed responses;
unrelated dashboard panels intentionally lack fixture data and report unavailable.

Full lint, server/frontend typechecks, 40/40 restored dependency-tooling checks,
all four policy-language gates, preflight copyright/ownership/Knip checks,
Markdown and ESM gates passed. Full coverage, no-cache local Compose rebuild and
post-build schema dump remain in progress and will be recorded before handoff.

## Recommendation stack

1. Use typed target review and explicit human decisions for genuinely missing or
   conflicting episode IDs. Benefit: preserves grouping/provider state. Cost:
   administrators must verify identity; no automatic truth claim.
2. Let existing owned sync apply complete approved scopes and normal backfill.
   Benefit: durable, revocable and idempotent. Cost: approval is not immediate
   completion, and changed source layouts require renewed review.
3. Review the four real remaining conflicts separately. An absent catalog episode
   still needs catalog repair or a verified existing target; no arbitrary substitute.
4. Keep Node 24 declarations until a separately tested runtime migration.

Final recommendation: reviewed episode exceptions, not title-based self-healing or
release-time blanket approvals. Operator-specific mappings must not be copied to
other deployed installations.
