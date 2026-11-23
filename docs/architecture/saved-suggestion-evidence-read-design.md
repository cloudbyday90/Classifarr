# Bounded read for saved suggestion evidence

November 23, 2026 Eastern. This follows the
[bounded manual analysis outcome](manual-suggestion-analysis-result-outcome.md).

## Existing contract

The authenticated suggestion detail route expands every saved support ID
and returns whole feedback rows. The tuning dashboard uses this route to
display configuration and evidence. Both administrators and regular users
can use it. The analysis summary describes a POST outcome. Saved suggestion
evidence comes from a different source and can change as feedback is edited
or deleted. Duplicate-only or unsuccessful analysis can leave no new
suggestion to read.

## Alternatives

| Option | Benefit | Cost |
| --- | --- | --- |
| Add a bounded administrator read | Limits the new request and discloses only fields needed for review | Existing callers and the dashboard need a separate migration to benefit |
| Replace the existing detail read | Bounds current dashboard traffic immediately | Changes the response shape and the access contract used by regular users |
| Save exact evidence by analysis run | Supports later inspection even when no suggestion was saved | Requires durable run membership, outcomes, access, and retention |

## Selected contract

- Add `GET /api/suggestions/:id/evidence` under existing authentication.
  Require the administrator role and an exact administrator and suggestion
  ID before querying. Accept only an optional `afterPosition` from 1 to 5,000
  in canonical decimal form. Unknown and repeated parameters are errors.
  Return `404` if the saved suggestion no longer has a policy and library.
  Use `Cache-Control: no-store` for this read.
  [OWASP endpoint access rules](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  · [HTTP caching rules](https://www.rfc-editor.org/rfc/rfc9111.html)
- Return `suggestionId`, `referenceCount`, `items`, and `nextAfterPosition`.
  For one-dimensional, one-based support of up to 5,000 references, a page
  walks at most 20 positions in stored order. Missing or empty support has
  count zero. Legacy support of an unsupported shape or size has a null
  count and no items. A valid cursor past the last position returns an empty
  page. Duplicates retain their own positions. Slice the array before joining
  feedback in one SQL statement so a page uses one committed snapshot.
  [PostgreSQL array semantics](https://www.postgresql.org/docs/18/arrays.html)
  · [PostgreSQL statement snapshots](https://www.postgresql.org/docs/18/transaction-iso.html)
  · [OWASP response limits](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- An `available` slot contains `position`, `status`, `feedbackId`, `title`,
  `promptedAt`, `wasCorrection`, `originalLibrary`, and `selectedLibrary`.
  Title and library names are capped in SQL at 160 and 80 characters,
  respectively. The timestamp is UTC text or null. A null correction flag
  stays unknown. A deleted, invalid, or differently attributed reference
  produces only its position and `unavailable` status. Attribution requires
  the saved policy and its current destination. A policy relink can make
  previously readable slots unavailable. Omit free-text reasons, raw metadata,
  scores, and internal configuration. Cap compact UTF-8 JSON at 48 KiB.
  [OWASP response property selection](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/)
- The existing client API adapter exposes one read with optional
  continuation. It does not fetch further pages on its own. This additive
  change preserves the dashboard and existing detail contract. The new route
  describes current feedback linked to a saved suggestion. Cohort validation,
  write admission, routing, and learning remain with their existing owners.

## Verification and follow-up

Check role and input refusal, legacy detail compatibility, stored ordering,
gaps, cursor progress, and worst-case encoding in HTTP and isolated
PostgreSQL. Verify the client adapter with the real request contract and run
the affected quality gates.

Design the dashboard migration alongside the future access rules for the
legacy detail route. Render feedback labels as text. Use explicit pagination
with a labelled control, announce loading and unavailable evidence, and
preserve sensible focus when a page arrives. Decide on run-level evidence
retention separately.
[W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
· [W3C focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
