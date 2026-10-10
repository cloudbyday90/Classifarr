# Source scope draft review

## Decision — 2026-10-10

Add an administrator-only structural review beside Command Center's unresolved
items. An operator can propose one catalog work or explicit TV season mappings
without splitting the source show. This is an unsaved draft, not identity approval.
Retained observations contain conflict categories, not episode evidence. Therefore
all episodes remain excluded from mapping-backed backfill; no missing episode is
silently counted as verified. The existing exact-ID diagnostics remain separate.

## Contract

The existing issue list gains an opaque stored-source revision. It changes with
the observation, capture, library or server configuration. The draft POST uses
the page offset, issue key and revision, then reads the same current complete-
capture population. Missing, moved, disabled, stale or changed sources return a
conflict requiring refresh. A revision describes stored evidence, not a fresh
Plex/Jellyfin/Emby read or authorization to apply later.

Reuse the administrator access-session boundary: reject API keys, automation,
refresh tokens, inactive or demoted users. Check the database actor before and
after reading. Apply CSRF protection to cookie POSTs and no-store to responses.
Validate exact request fields, a 32 KiB JSON budget, numeric bounds, at most 256
seasons/mappings and 64 target works. Parameterize reads. No provider calls,
database writes, stored drafts, scheduler, retry, lease or cache is introduced.
Fresh setups have no draft work. Restart loses the unsaved form by design.

The server supplies conflict categories and a fixed backfill exclusion; it never
trusts caller verification flags. A successful review means structurally valid
input only. Invalid input is a validation error; source drift is a conflict;
database failures remain generic errors. Cancellation/navigation/editing discards
late UI results. No background retry or silent resubmission occurs.

API: `POST /api/media-identity-review/source-scopes/:key/review` accepts only
`{ offset, sourceVersion, scope }`; `scope` reuses the offline plan's whole-work
or season contract. It returns `source_scope_review.v1`, a canonical draft,
fingerprint, parent conflict and `backfill.eligible: false`. There is no confirm
endpoint for this contract. The list's sourceVersion is optional for compatibility
with older servers and null for inactive/missing source configurations. The form
is unavailable without it. Requests use the existing 30-per-15-minute limiter.

Use labeled native form controls, a non-modal disclosure, visible scope limits
and a polite result announcement. Clear results whenever the draft or source
revision changes. Never offer Apply, Confirm identity or Clear warning here.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Revision-bound unsaved draft | Operator can describe grouping safely | Does not repair an identity | Implement |
| Reuse scalar identity confirmation | Existing write path | Loses season scope and exclusions | Reject |
| Accept matching episodes as whole-series proof | Fewer warnings | Can select the wrong parent identity | Reject |
| Fresh typed episode review and scope-aware consumers | Enables safe activation/backfill | Requires provenance, invalidation and consumer tests | Next |

## Official research

Retrieved through MCP on 2026-10-10:

- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  calls for permission checks on every request, including specific resources.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires server-side workflow validation; client fields are not authority.
- [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)
  supports clear correction guidance, labels and programmatic feedback.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  identifies a season by series and season number. Our inference: matching source
  season numbers alone cannot establish the same catalog scope or episode identity.

## Independent PR trial

Fresh open-PR enumeration found #555 and #556; a random draw selected
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Trial its exact client Node types
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0 diff separately. Registry
integrity agrees; neither package declares an installer. Retain Node 24 and
restore the trial if runtime-alignment checks reject it. No PR merge or release.
