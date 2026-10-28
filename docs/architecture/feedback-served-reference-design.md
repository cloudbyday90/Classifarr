# Explicit feedback and served references

Date: 2026-10-28. Status: agreed scope implemented and locally verified.
Follows the [selection provenance outcome](feedback-selection-provenance-outcome.md).

## Established facts

Legacy prompt and standalone feedback API leaves have no production Vue or
composable caller. Current operator review uses the pending classification
resolution contract, or History's actual correction command. Submitting feedback
alongside either command would create another observation for the same action.

Pending resolution already carries an explicit action and a deterministic contract
fingerprint. It validates current state under locks, but does not record delivery
to an actor, issue/expiry times or one-time consumption. Runtime resolution also
changes the recorded destination and invokes its own learning path. Its executor
has a different lock order from feedback. It must not become a feedback shortcut.

History detail opens the list row, rather than fetching a fresh per-item review.
History reads are administrator-protected and no-store. A new reference must come
from a fresh server projection, not the stale list row or current membership.
The existing feedback receipt remains one per exact classification, survives
history retention and preserves a tombstone after feedback deletion.

## Product decision frontier

The first product decision is confirmed: a feedback-only review opened from
History for eligible completed movie/TV classifications. It records
feedback and existing feedback statistics without moving media, reclassification,
new policy rules or an extra canonical outcome vote. Pending resolution, History
correction and legacy selection-only APIs retain their existing behavior.

The confirmed reference is the preserved original automated destination. Three
references have different meanings:

| Reference | What an explicit confirmation means | Limitation |
| --- | --- | --- |
| Preserved original classifier destination | Agreement with the saved classifier decision | Requires valid original typed decision evidence |
| Served policy shortlist leader | Agreement with a policy suggestion | May differ from the actual saved decision |
| Current recorded outcome | Agreement with the later record | May incorporate corrections or imported placement |

For a post-hoc assessment, the recommendation is the preserved original classifier
destination, clearly separated from the current recorded outcome and shortlist.
Do not infer that reference when original evidence is missing. This recommendation
and its reference are confirmed. The [outcome](feedback-served-reference-outcome.md)
records implementation and validation.

The initial population requires a preserved, completed classifier
destination with matching current typed identity and classifier method. Missing,
unsupported, imported or later manually changed source states are unavailable for
this review; no current placement supplies the missing original evidence. Existing
feedback receipts remain final and cannot be upgraded by this new interaction.
Existing retrospective feedback statistics keep their shortlist-relative meaning;
new frozen action evidence explicitly names its original-decision reference.

## Recommended protocol and safeguards

Use small contract, projection, repository, command and client review modules.
Reuse existing receipt/transaction ownership; do not record a parallel authorized
outcome or treat preparation as an observation. Legacy v1/v2 evidence stays final.

Use an explicit preparation POST with a bounded durable reference, following the
existing identity-review pattern. Return the exact server projection that the
controls render, an opaque random reference and its expiry. A server-issued
reference proves issuance of those facts; it cannot prove human attention or
comprehension. Avoid calling a fingerprint alone proof that a reference was shown.

The closest existing lifetime is ten minutes. Bound outstanding records globally
and per actor, prune expiry independently and invalidate prepared references on
restore. Keep operational references out of portable backups. Preparation has no
provider work and records no outcome. GET/receipt lookup must remain read-only.

History's first review surface should retain its administrator boundary and also
recheck the active account in the database. This avoids widening access to private
history through a new feedback projection. Existing authenticated-user selection
APIs remain available. Use the authenticated actor, never a body-supplied actor.

Fresh submission must bind the explicit action, actor, exact int64 classification,
typed item identity, named reference and relevant source version. Lock policies,
libraries and history in the established order; revalidate source/reference and
destination/policy availability before effects. Consume the reference, write
feedback/statistics and freeze its final source receipt in one transaction. An
expired, changed, cross-actor or consumed reference cannot authorize fresh work.
Confirmation must select the bound reference; change must select a different
validated destination. Never infer the command from destination equality.

Include server-derived actor, action and reference ID in the immutable command
fingerprint, preserving legacy hashing separately. A same-actor exact committed
replay must be checked before requiring a live prepared reference, so cleanup,
history deletion or snapshot expiry cannot recreate the vote or erase replay
availability. A scoped receipt lookup should remain usable after preparation
expiry without retaining full actor/content data in the evaluation snapshot.

Disable automatic write/auth-refresh retries for new explicit commands. An
uncertain response requires a receipt check or an explicit retry of the exact
command, not a new choice. Closing the UI discards its presentation; it cannot
undo an in-flight commit. Do not add request cancellation to write transactions
through the existing read-only cancellation helper.

Freeze validated action/reference evidence in a new snapshot version. Preserve
strict legacy parsing, receipt bindings, thirty-day evidence expiry, connected
holdouts, all-source conflicts and separate confirmation/change cohorts. No
current placement or raw mutable feedback flag supplies missing proof. Existing
retrospective statistics keep their documented shortlist-relative semantics.

## Presentation

Use a separate History review component/composable and centralized named API
functions. Render item/reference data only from the preparation response. Clearly
name the reference and command effects. Keep this assessment visibly distinct
from "Correct Classification" and its actual effects.

Reuse the native dialog/focus-management components, explicit native buttons and
associated select labels. Preserve opener/fallback focus, meaningful status/error
announcements and mobile reflow. Disable stale/busy actions and discard late
responses after item change, close or access loss. Never silently refresh a
reference and submit against facts the operator has not reviewed.

## Official research and alternatives

Sources were discovered and read through MCP services on 2026-10-28. These are
engineering applications, not compliance or accuracy certifications.

- [OWASP transaction authorization](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Transaction_Authorization_Cheat_Sheet.md)
  supports server-controlled transaction facts, final authorization, expiry and
  atomic one-time consumption. Expiry alone does not prevent replay.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) describes conditional
  state-changing requests. Current-state fingerprints are useful stale-state
  checks; they do not by themselves establish actor-bound issuance.
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  supports protected state-changing commands and avoiding mutation through GET.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/sql-lock.html)
  supports consistent lock acquisition and short atomic mutation boundaries.
- [W3C control labels](https://www.w3.org/WAI/tutorials/forms/labels/) supports
  explicit, associated names and instructions for the reference and choice.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports accessible status communication without unnecessary focus changes.

| Option | Pros | Cons / risk | Recommendation |
| --- | --- | --- | --- |
| History feedback-only review with durable reference | Real operator surface; atomic expiry/replay; survives restart | New bounded storage, API and UI | Recommended first product choice |
| API-only protocol first | Smaller presentation scope | No current production feedback caller uses it | Alternative |
| Reuse runtime resolution as feedback | Existing explicit actions | Adds routing/learning effects and conflicts with feedback lock order | Reject for assessment |
| Actor-bound signed projection | No issuance table | Still needs durable consumption and key/lifecycle design | Alternative |
| Fingerprint only | Small stale-state check | Does not establish issued reference or one-time use | Insufficient alone |
| Attach another feedback POST to correction/pending resolution | Easy UI wiring | Duplicate observations and mismatched command ownership | Reject |

Recommended stack: a fresh named reference, explicit bounded preparation,
actor/source binding, locked atomic feedback consumption, one final source
receipt, strict frozen evidence and an accessible History review.

## Verification and delivery

Both the History assessment and complete reference safeguards were confirmed
before implementation.
Test stale state, reference/identity edits, actor revocation, cross-actor use,
expiry, reissue, concurrent clicks and rollback. Verify exact replay and receipt
recovery after operational cleanup, history deletion and evidence expiry. Verify
that legacy selections stay non-inferred and one action cannot create two votes.

Use real disposable PostgreSQL/HTTP boundaries for consumption, lock order,
restore invalidation and no-write GET. Test named client API wiring, no automatic
mutation retries, correct displayed reference/action payload, uncertainty, focus,
keyboard, mobile layout and access loss. Follow with affected/full coverage,
ratchet, types, lint, dependency usage, ownership, schema reproduction, ESM,
Markdown, copyright and staged secret checks.

Work stays on `main`. Update Unreleased and the separate outcome evidence before
commit/push. No branch, PR merge, release, deployment or live historical import.

## Implemented boundaries

Preparation stores at most 100 outstanding references globally, ten per actor,
and one per actor/classification. A shared short advisory lock serializes cap
checks; read-committed counts see issuances committed while waiting. References
contain at most 128 library/policy choices and a 60,000-byte JSON projection
within the database's 64 KiB bound. They expire after ten minutes, cascade on
source/account deletion, are pruned in bounded batches and reset transactionally
on restore. No lock spans human review.

The server binds account ID and account creation time to prevent a reused ID from
recovering a previous account's command. Submission rechecks active administrator
status, the selected policy, reference/selected libraries, source row version and
exact prepared projection. Expiry is checked with current database time at
consumption. Consumption, existing feedback/statistics writes and the permanent
source receipt commit together. The operational table is excluded from portable
backup exports.

Any source, selected-policy or relevant library row revision conservatively
invalidates a prepared choice, including unrelated edits to those rows. This can
require a fresh review during background synchronization; it avoids silently
accepting a choice against changed facts.

The new endpoints are preparation `POST /api/feedback/:id/review`, submission
`POST /api/feedback/:id/review/submit`, and read-only receipt recovery
`GET /api/feedback/:id/review/:reviewId/receipt`. Responses are no-store;
preparation/submission have bounded transaction, statement and lock timeouts.
Commands accept only the issued reference, explicit action and selected IDs.
The GET does not prepare, consume, prune or write evidence. It returns a scoped
recorded/unverified result without exposing another actor's receipt.

`classification.feedback_outcome.v3` freezes exact typed identity, explicit action,
the original-decision reference, actor binding and issuance window. Independent
receipt fields and observation time must match before prospective scoring.
Present decision context must describe a completed automated decision; exact
BIGINT identities can retain a null legacy int32 context. Legacy v1/v2 parsing,
unknown actions and selection-only diagnostic semantics remain unchanged.

The client keeps only classification/reference IDs, action and selected IDs in
tab session storage for uncertain-result recovery. Storage denial falls back to
memory with a reload warning. Unknown submissions allow receipt checks or exact
retries, including after sign-in failure or account-switch conflicts; they cannot
silently prepare a different choice. Closing or late responses cannot replace
the pending command. Native dialog focus, explicit labels, polite status and
mobile reflow follow the cited W3C practices; this is not a conformance audit.

Final recommendation stack: server-owned original decision; bounded durable
reference; active-account and locked stale-state checks; atomic existing feedback
transaction; permanent scoped receipt; strict v3 action cohorts; accessible History
controls, including a native keyboard-operable History title entry. This enables
trustworthy new observations, not historical backfill or
an accuracy claim. Confirmation remains agreement with a displayed suggestion,
not independent ground truth.
