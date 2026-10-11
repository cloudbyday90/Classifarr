# Combined source identity and scope evidence

Decision date: 2026-10-11 (America/New_York). No release or automatic repair.
Observed results are recorded separately in the [outcome](source-combined-evidence-outcome.md).

## Problem and decision

The parent-ID audit and mapping preview currently answer separate questions.
An operator can see complete episode membership beside an older parent lookup,
without evidence that both describe the same source revision. Plex metadata
availability does not establish that competing IDs name the same catalog work.

Add a read-only combined audit to the existing administrator-requested evidence
check. Reuse the bounded candidate reader and typed scope comparison. Read parent
lookups twice, using the same source layout, frozen provider configuration,
advisory lease and 90-second deadline as the scope check. Reject changes rather
than joining old evidence to new evidence. This is repeated-read consistency,
not an atomic snapshot across independent remote providers.

The report distinguishes parent agreement, complete source-scope membership, and
agreement with the proposed work. A complete multi-work mapping can be legitimate,
but is not single-parent equivalence. A missing match is not evidence that an ID
is obsolete. Even an all-positive report has no independent cross-provider proof
and grants no automatic recovery authority.

## Contract and bounds

- Only the read-only route enables this audit. Explicit approval retains its
  existing fresh-evidence and transaction checks; its fingerprint is unchanged.
  A separate audit fingerprint binds parent reads, the draft and scope evidence.
- Existing active-admin, current-page key/version and active-source checks apply.
  The fresh source identity digest must match the retained source digest.
- No scheduled work, retries, durable cooldown, database writes, provider writes,
  model calls or new caches. Fresh installations have no work. A restart loses
  only an unpersisted preview; an operator can request another read.
- One shared installation-level advisory admission lock; caller cancellation,
  lost lease and deadline all abort HTTP. Existing 10-second/1-MiB HTTP limits,
  redirect rejection and rate limiter remain. Additional parent reads are bounded
  to two passes of at most eight declarations and eight candidate details each.
- Existing source layout limit (2,000 episodes), catalog limit (10,000 episodes),
  four proposed works and 32 season edges remain. No resource limit is raised.
- Complete scope requires a nonempty comparison, every source item matched,
  no exclusions, and whole-work or explicitly complete season coverage.
- Changed evidence/configuration/actor is rejected. Missing or ambiguous catalog
  matches are review findings. Outages, limits, malformed replies, cancellation
  and unknown errors return sanitized failures, never an optimistic partial audit.
- The client validates enums, flags, counts, fingerprint and proposal consistency;
  older servers may omit the audit. An included malformed audit rejects the preview.
  Status is announced politely; detailed reasons remain outside the live region.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Join separate browser previews | Minimal provider reads | Stale and mixed revisions | Reject |
| One bounded, rechecked audit | Explains identity and scope together | More reads; may time out | Implement |
| Automatically approve matching membership | Removes operator work | Membership is not independent identity proof | Defer |

Recommended order: combined diagnostics now; independent typed alias evidence
next; then a separately specified automatic-repair policy with durable provenance,
idempotency and upgrade/backfill tests. Preserve unresolved counts, grouping,
existing approvals, ownership and memory safeguards throughout.

## Official research

Retrieved through MCP search/open on 2026-10-11. These sources support the mechanics;
the approval boundary and completeness rules are Classifarr design decisions.

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data): external
  ID lookup locates catalog matches; it does not authorize conflict repair.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details):
  membership reads are scoped by series ID and season number.
- [Node 24 AbortSignal](https://nodejs.org/download/release/v24.4.0/docs/api/globals.html):
  compose cancellation and deadlines, and avoid retained abort listeners. The
  versioned official page was reachable; the latest-v24 alias was not.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  announce results without moving focus or making detailed output overly chatty.

## Random open PR trial

Fresh enumeration contained #555 and #556; PowerShell Get-Random selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), reviewed at head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. It changes client Node declarations
24.19.2 to 26.6.4 and undici-types 7.24.6 to 8.9.0. Trial that exact candidate,
not the newer 26.6.5 registry latest, without merging or changing Node runtime.

[DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
aligns declaration major/minor with the library described. New declarations may
offer tooling support but can expose APIs absent from Node 24. Retain the candidate
only if compatible with the existing runtime policy; do not relax the guard.
Use scripts-disabled lock generation, reviewed npm install policy and scoped
type/build/toolchain checks. Restore the exact original files if rejected.

## Verification plan

Test positive and blocked parent results, empty/partial/full scope, multi-work
grouping, proposal mismatch, stale retained source, changing parent lookup,
configuration/actor drift, cancellation/lease loss, no writes and unchanged
approval fingerprints. Exercise real PostgreSQL admission and existing HTTP
transport fixtures; verify client validation and browser presentation. Run current
coverage and quality gates, no-cache local Compose rebuild, isolated schema dump
and bounded read-only local checks. Unraid and shared providers remain unchanged.
