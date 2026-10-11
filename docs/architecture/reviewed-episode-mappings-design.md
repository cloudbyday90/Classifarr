# Reviewed episode mappings

Decision: 2026-10-11. The operator requested explicit administrator-confirmed
episode mappings inside Classifarr, leaving shared Plex unchanged. This extends
the [episode gap diagnosis](source-episode-gap-design.md), not automatic matching.

## Contract and boundaries

An optional `episodeMappings` array supplements a TV whole-work or season scope.
Each row names a source season/episode and a typed TMDb series, season, episode
and episode ID. At most 64 rows; unique source positions, target positions and
target IDs. Targets must stay inside the proposed works. Movies reject the field.
The combined catalog read stays within four works, 32 unique seasons and 10,000
episodes. A row must refer to a current source episode and an actual catalog
episode at exactly the proposed target position. No title/number-based inference.

These are **human identity decisions**, distinct from source-declared ID matches.
The preview shows each checked target's title and coordinates and separates the
counts. Saving requires an additional explicit episode-confirmation flag, current
administrator authority and fresh complete evidence. Ambiguous/reused source IDs
and duplicate effective targets still block approval. Every source episode and
season must be covered; unused declarations fail closed. There is no partial
activation or implicit selection of a suggested special.

Persist the canonical declarations in existing bounded scope JSON, bind them into
the evidence fingerprint and record human provenance in the approval audit.
Existing mappings without the field keep their contract. Normal owned sync applies
only already approved mappings and performs its usual idempotent backfill handoff.
For human episode declarations, any source-layout digest change requires renewed
review: a saved position must not silently transfer to a different episode.
Revocation, configuration checks, actor checks, capture fencing and retry budgets
remain unchanged. No migration or release-time approval of real records is needed.

Season-backed documents include each distinct catalog season actually represented
by the approved scope, including a mapped special, without turning it into a
whole-series scalar identity. Human episode mapping is not independent
cross-provider verification and cannot make the combined audit report automatic
catalog agreement.

## Lifecycle and verification

No work on fresh/disabled setups or status polling. Explicit preview/approval
retains one installation-wide advisory lease, one attempt per click, 90-second
deadline, bounded 10-second/1-MiB provider reads and repeated source/catalog reads.
Transient outage, malformed/oversized data, cancellation, timeout, changed intent
or lost lease produces no approval. Provider reads remain outside transactions.
Unknown failures retain sanitized diagnostics. A lost approval response is checked
through saved mappings, not blindly retried. Durable daily retry admission and
four catalog/20 source-layout checks per capture remain intact across restart.

Test strict structural validation, specials/season remaps, duplicate claims,
missing targets, mixed declared/human evidence, partial coverage, stale intent,
source-layout change, save/revoke/restart, and unchanged legacy mappings. Use real
isolated PostgreSQL for durable approval and owned materialization. Verify keyboard
confirmation and narrow layouts; no hidden or preselected approval checkbox.

## Operator workflow

1. In Command Center, open **Metadata issues → See items & recovery**, then the
   affected item's **Draft a catalog mapping (admin)** panel. Keep the appropriate
   whole-series or complete grouped-season proposal.
2. Add a reviewed episode row only for a verified exception. Enter the source
   season/episode and the intended TMDb series, season, episode number and episode
   ID. A series ID is not an episode ID. Verify the actual episode identity; a
   similar title or position alone does not establish it.
3. Check draft structure, then check source and catalog evidence. Review each
   returned target title/position and all exclusions. If the catalog target does
   not exist, stop; do not substitute another episode to clear the count.
4. With complete coverage, confirm both the episode identities and use of the
   complete mapping, then save. Editing the proposal clears the evidence and
   confirmations. Check saved mappings after an uncertain response.
5. Wait for normal library sync to revalidate and materialize the mapping. Saving
   alone does not lower the unresolved count. A source-layout change requires
   another review; revoke the old mapping before replacing it. Other installations
   need their own source-bound review, not a copy of this installation's approval.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Correct shared Plex first | All consumers receive corrected metadata | Shared external mutation; conflicts with requested boundary | Not this batch |
| Infer IDs from titles or numbers | Less review | False equivalence and contaminated backfill | Reject |
| Explicit reviewed episode declarations | Preserves grouping and provider state; auditable | Human mistakes remain possible; stricter re-review after source drift | Implement |
| Automatically approve all deployed legacy gaps | Unattended recovery | No installation-specific consent or identity proof | Reject |

Stack: typed target review → explicit human consent → complete owned sync → normal
backfill. Next validate real mappings with the operator; do not invent approvals
for local or deployed records. Missing catalog entries still require catalog repair.

## Official research

Discovered and opened through MCP on 2026-10-11:

- [Plex episode ordering and specials](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)
  documents alternate per-show orders and season-zero specials. Different numbering
  is possible; it is not proof two episodes are identical.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  supplies typed season membership; [find by ID](https://developer.themoviedb.org/reference/find-by-id)
  distinguishes episode lookup from series lookup. Empty results supply no identity.
- [W3C G168 confirmation](https://www.w3.org/WAI/WCAG22/Techniques/general/G168)
  informs explicit consequences and review before saving. This is not a full WCAG
  conformance claim.
- [DefinitelyTyped version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  informs the separate Node declaration trial. Fresh random selection from open
  #555/#556 chose #556, head `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`.
  Trial its exact Node 26 declarations; retain only if the Node 24 gates pass.
