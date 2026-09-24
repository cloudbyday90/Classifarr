# Reconnectable batch activity design

## Problem and scope

Reviewed baseline: `d969c91b` makes execution durable, but closing the batch modal
discards its browser-local ID. A running or paused batch then becomes difficult
to rediscover. Add a compact Command Center entry point for saved work, not a new
execution system or another acknowledgement gate. Movie/TV scope, music
exclusions, routing policy, learning and confidence thresholds remain unchanged.

## Contract and responsibilities

- A small server read model exposes administrator-only `GET
  /api/reclassification/batches/activity`. It returns ten started batches per page,
  running/paused first, then newest ID. Drafts do not bury active work.
- A server-issued `after` cursor encodes the priority bucket and ID.
  Validate the complete cursor, bind SQL parameters, and fetch one extra row to
  determine whether another page exists. No arbitrary caller-controlled limit.
- Return only batch ID, status, item-derived outcome counts and exact-journal
  recovery counts. Do not return move plans, paths, provider configuration,
  validation payloads, raw errors or media descriptions in the summary.
- Reuse the existing batch modal for on-demand detail and existing explicit
  pause/resume/cancel/retry/skip controls. Opening it with a saved ID only reads;
  it must never create, validate or execute a batch automatically.
- Reuse Vue's existing `useSWR` composable with `persist: false`, visible-tab
  polling and reconnect refresh. Browser storage is not the source of truth.
  Refresh after closing the detail view; reject responses for a previous page.
- Reads use `Cache-Control: no-store`. The existing authentication/admin route
  boundary protects both summary and controls. Errors remove actionable stale
  summary state; authorization denial stops polling and hides the panel.

The cursor is a live view, not a database snapshot: state changes may move a batch
between priority buckets during paging. Refresh returns to page one. No GET or
pagination action changes worker intent. No schema or scheduler change is needed.

## Accessibility and security

Use native disclosure/buttons, descriptive batch-specific action names, existing
modal focus management and escaped text. Keep frequently changing rows out of a
live region; announce loading/error states and explicit action results, not each
poll. Distinguish successful items from failed/skipped/cancelled items and from
the batch's control state. Pause/cancel cannot undo an admitted move; recovery may
still complete. Never imply a completed batch proves classification accuracy.

## Official research (verified 2026-09-24)

- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  expose status without moving focus and avoid excessively chatty announcements.
- [W3C label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name):
  keep visible button wording within its accessible name, including when adding
  a batch ID for context.
- [Vue security guidance](https://vuejs.org/guide/best-practices/security): use
  trusted templates and escaped interpolation; do not render errors as HTML.
- [SWR mutation and revalidation](https://swr.vercel.app/docs/mutation): coordinate
  mutations with revalidation so older reads cannot become the final state.
  This is a design principle, not a reason to add React's SWR to a Vue application.
- [PostgreSQL 18 bounded query ordering](https://www.postgresql.org/docs/18/queries-limit.html):
  ordered pagination needs a unique tie-breaker. The activity view uses priority
  plus the unique batch ID, not timestamps alone.

## Alternatives and final recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Persist batch IDs in browser storage | Small change | Lost across devices; stale or private state; cannot discover existing work | Reject |
| Server read model + existing Vue SWR + existing modal | Durable rediscovery, bounded payload, shared controls | Poll latency and live-page movement | Implement |
| New workflow engine or WebSocket stream | Push updates and broader orchestration | Extra infrastructure and lifecycle complexity | Defer |

Stack: PostgreSQL saved batches and exact move receipts; small ESM read service;
authenticated/no-store Express endpoint; named client API function; nonpersistent
SWR observer; compact Command Center disclosure; existing accessible detail modal.

## Verification plan and release boundary

Test active-first pagination, strict cursors, exact recovery joins, privacy,
authentication/authorization and read-only behavior against synthetic PostgreSQL
data. Test reconnect/no-storage behavior, loading/empty/error states and saved-ID
modal opening without writes. Exercise reload, keyboard detail access, controls
and narrow layout in Chromium using intercepted APIs. Run coverage, integration,
type/lint/ESM/documentation checks. No release, version change, deployment or live
media operation belongs to this change.
