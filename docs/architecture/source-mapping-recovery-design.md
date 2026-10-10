# Approved source mapping recovery

## Design — 2026-10-10

Plex descriptions and artwork are not missing for the eleven local conflicts.
Nine declare two TVDB IDs; two grouped shows declare multiple TMDb series. Do
not discard the extra IDs or select the first series. Existing scope previews
are deliberately non-persisting and cannot repair these records.

Implement an administrator-owned mapping, separate from provider declarations.
Keep the source grouping and distinguish whole-work mappings from explicit
season mappings. Approval requires a fresh bounded source/catalog comparison,
the exact reviewed fingerprint, an active administrator session, and explicit
confirmation. No deployment automatically approves existing conflicts.

## Recovery and safety contract

- Complete mappings require nonzero verified membership and no exclusions.
  Partial mappings remain unresolved; no partial result may look complete.
- Provider reads remain outside transactions, with the existing 90-second
  deadline, one installation-wide evidence check, four catalog works, 32 seasons,
  10,000 catalog episodes, 2,000 source episodes and bounded transport responses.
  Cancellation before commit rolls back; a disconnected response after commit is
  uncertain to the caller and must be checked through saved mappings.
- Persist canonical scope, source/layout fingerprints, bounded typed metadata,
  actor and audit reference. Never persist credentials or raw provider payloads.
- Recheck actor, source and configuration in the final database transaction.
  A stale source, changed intent, disabled library or provider refuses activation.
- Normal owned ingestion, not the browser, materializes approved inventory.
  Keep existing retry/resource admission and ownership fencing. Resume after
  restart without resetting attempts or replaying external mutations.
  Scheduled full syncs check at most twenty approved source layouts and four
  fresh catalog scopes per library run. Oldest/unverified scopes are admitted
  first; failed catalog attempts retain a one-day cooldown. Catalog receipts can
  be reused for one day only after the fresh source layout matches exactly.
  Reuse does not extend the catalog timestamp. No new watchdog full-scan loop is
  added; absent source items cannot trigger repeated immediate rescans.
- Whole-work metadata retains its typed catalog identity. Grouped seasons never
  gain an arbitrary parent TMDb ID or borrow a whole-series synopsis. Existing
  whole-work-only consumers must abstain from season-scoped evidence.
- Approval is not completion. Only an atomically persisted, current mapping may
  clear its unresolved observation. Revocation must invalidate derived authority
  and make the source reviewable again without deleting inventory.
- Fresh installations with no approvals perform no additional provider work.
  Unraid and shared Plex/Ollama stay read-only during implementation/testing.

Transient failures retain intent and bounded retry state. Invalid catalog scope,
ambiguous membership and changed source evidence require review. Unknown errors
return fixed diagnostics, never raw provider bodies. Completion requires real
database tests of approval, ingestion, replay, source drift and revocation, plus
the exact rebuilt image; a preview or a reduced counter alone is insufficient.

## Options and recommendation stack

| Approach | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Ignore unmatched provider IDs | Fast apparent repair | May conflate unrelated works | Reject |
| Require Plex rematching/splitting | Simpler scalar identity | Changes shared media organization; may be incorrect | Not the default |
| Explicit typed mapping with guarded recovery | Preserves grouping and review history | Requires downstream scope support and lifecycle tests | Recommended |
| Retain preview-only behavior | No new write risk | Does not resolve the reported problem | Not completion |

Keep Node 24 runtime and declarations aligned. Independently trial the randomly
selected open [PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`, locally. Its Node types 26.6.4 and
undici-types 8.9.0 have no declared install scripts. Revert if runtime-alignment
tests reject it; do not merge or upgrade the runtime to make the trial pass.

## Official research

Discovered and opened through MCP on 2026-10-10:

- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  addresses a season using its series and season number, not a whole-work ID alone.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends default denial and permission checks on every request. Mapping
  approval must not derive authority from a browser-provided verification flag.
- [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  describes transaction-scoped row locks and consistent lock ordering. Network
  validation precedes the short final transaction; drift is checked again there.
- [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  associates declarations with the represented library version. The Node-major
  trial remains separate from recovery work.
- [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)
  calls for clear success/error feedback and actionable instructions. Approval,
  pending sync, completion and uncertain responses are distinct visible states
  announced through status/alert regions; controls retain labels and focus cues.

Record actual implementation, tests, limitations and deployment evidence in a
separate outcome document. No release or version bump is part of this change.
