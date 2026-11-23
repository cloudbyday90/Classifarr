# Suggestion reads and migration

These endpoints accept Classifarr session authentication or a valid access
token under the existing suggestion route permissions.

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
header and a link to the installation's API documentation. The current
legacy response and its access remain available during this migration.
No removal date is scheduled.

Switch proposal and status reads to `/proposal`. Use `/evidence` for allowed
feedback review. Account for unavailable references and the new page order.
If a workflow depends on raw fields or notes, review that requirement before
switching the integration. The bounded endpoints provide the fields listed
above.
