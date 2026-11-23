# Suggestion reads and migration

These endpoints accept Classifarr session authentication or a valid access
token under the existing suggestion route permissions.

## List one page

Use `GET /api/suggestions/page` to receive `{ items, nextBeforeId }`. The page has
up to 20 summaries ordered by descending suggestion ID, with a 64 KiB JSON limit
before compression and `Cache-Control: no-store`.

| Optional query parameter | Contract |
| --- | --- |
| `status` | `pending` by default. Also accepts `applied`, `rejected`, `superseded`, or `all`. All includes any stored status. |
| `policyId` | Restrict the page to one policy. |
| `beforeId` | Select only IDs below this value. Use the prior page's `nextBeforeId` with the same filters. |

Both IDs accept decimal digits without leading zeros from `1` to `2147483647`.
Empty, repeated, malformed and unknown query parameters yield `400`.
`nextBeforeId: null` indicates the end of the current results. Omit `beforeId`
to refresh from the beginning. Pagination reads live data, so policy or status
changes between requests can affect membership in later pages.

Each summary contains `id`, `policy_id`, `policy_name`, `library_name`,
`suggestion_type`, `status`, `confidence`, `impact_estimate`, `created_at`,
`applied_at`, and `superseded_at`. Policy and library labels use at most 160
characters. The page includes suggestions with a positive ID and a resolvable
policy and library. Dates are UTC strings or `null`. Non-finite confidence
values appear as `null`. Use the proposal and evidence reads below for inspection.
The legacy global list continues to use its confidence-first order and payload.

The tuning dashboard uses this page and loads an individual proposal when the
user opens Details. Its navigation and counts describe the current page. It
retains the existing Policy filter for administrators.

If a dashboard Apply or Reject response is uncertain, the dashboard reads the
same suggestion's proposal to check its saved status. Check status repeats only
that read. The result describes the saved row without attributing its state to
the original request.

## Read a proposal

Use `GET /api/suggestions/:id/proposal` for a single signed-in proposal lookup.
The ID must be decimal digits without leading zeros, within `1` to
`2147483647`. Invalid IDs yield `400`. A missing suggestion or destination
yields `404`.

The response includes `id`, `policy_id`, `policy_name`, `library_name`,
`suggestion_type`, `status`, `confidence`, `impact_estimate`, `created_at`,
`reference_count`, `proposal_status`, and `suggestion_config`. The reference
count describes stored positions, which can include unavailable evidence.
Policy and library labels use at most 160 characters. The response is at
most 8 KiB and asks HTTP caches to avoid storage.

| Suggestion type | Projected configuration |
| --- | --- |
| `adjust_threshold` | `threshold_type`, `current`, `recommended` |
| `adjust_weight` | `signal`, `current`, `recommended` |
| `create_pattern` | `pattern_type`, `pattern_value`, `confidence` |

Threshold values use 0 to 100 and weights use 0 to 1. A missing current
value is `null`. Supported pattern types are `genre`, `studio`, `keyword`,
and `collection`. Pattern confidence is a number from 0 to 100 or `null`.

An unsupported type or invalid configuration yields `proposal_status`
`unavailable` with `suggestion_config` set to `null`. `available` describes
the saved display fields. Authorization and evidence for Apply are checked
by the existing write endpoint. The display projection accepts at most
4 KiB of stored JSON text and pattern values of up to 240 UTF-16 code units.
An oversized pattern value makes the proposal unavailable. Other stored
configuration fields are excluded.

## Read evidence as an administrator

Use `GET /api/suggestions/:id/evidence` to read up to 20 saved reference
positions. Send the returned `nextAfterPosition` as `afterPosition` for the
next page until it is `null`. The response uses stored reference order and
marks missing or mismatched positions unavailable. It omits free-text
feedback, raw metadata, and scores. A regular member can read a proposal
and receives `403` when requesting this evidence page.

## Migrate from full detail

Successful `GET /api/suggestions/:id` responses carry a dated `Deprecation`
header, a link to the installation's API documentation, and
`Cache-Control: no-store`. Classifarr supports the current legacy fields and
member access for at least 90 days from the first public release that ships
both bounded alternatives, the notice, and this guide. A public, downloadable beta
qualifies. The window starts at publication. Its end is the earliest review
point for a possible change. There is no scheduled removal date.

Switch proposal and status reads to `/proposal`. Use `/evidence` for allowed
feedback review. Account for unavailable references and the new page order.
If a workflow depends on raw fields or notes, review that requirement before
switching the integration. The bounded endpoints provide the fields listed
above.

When reporting a migration gap through the project's issue tracker, include
the Classifarr version, whether the integration uses member or administrator
access, the field names it needs, and the task those fields support. Keep
sample responses, feedback notes, identifiers, credentials, and logs out
of the report.

Older saved suggestions can still use the bounded reads when their saved
configuration and references meet those contracts. If an older pending
suggestion lacks its original analysis snapshot, run the existing analysis
for its policy to generate a fresh proposal when the current data supports
one. Apply continues to require current evidence. Existing history stays
available under its current access rules.
