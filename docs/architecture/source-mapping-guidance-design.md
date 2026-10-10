# Source mapping review guidance

## Design — 2026-10-10

The fresh local read-only check at 22:10 UTC still finds eleven unresolved items:
nine with conflicting TVDB declarations and two grouped shows with multiple TMDb
series. All have Plex descriptions and artwork. Metadata presence is not proof
that conflicting identifiers describe the same work. No real mapping is approved
by this change; Unraid and shared providers remain unmodified.

The next bounded improvement is explanatory, not automatic identity selection:
show the typed catalog titles actually checked, describe each excluded episode's
next review step, and retain a fixed reason when approved recovery is deferred.
Search/ranked candidate discovery is deferred until this review context is useful.

## Contract

- Existing admin-session authorization, CSRF, source/configuration fingerprints,
  owned capture writes and complete-season approval remain unchanged.
- Reuse the existing evidence reads: at most four works, 32 seasons, 2,000 source
  episodes and 10,000 catalog episodes, with a 90-second deadline. No background
  search, extra provider reads, auto-selection or increased resource budgets.
- Project bounded catalog titles, media types, IDs and dates from already checked
  details. Client rendering is text only; never return provider URLs or raw errors.
- Keep fixed diagnostics for source/configuration drift, incomplete membership,
  missing seasons, malformed catalog data, provider unavailability and timeout.
  Unknown failures stay unknown, with a mapping reference for a GitHub report.
- Save failure reasons in the existing outcome field using a fixed namespace.
  Read legacy generic outcomes conservatively. A persisted `checking` state means
  completion is unconfirmed, including after a crash; it is not success.
- Cached-layout read failures also retain the existing one-day cooldown. Caller
  cancellation propagates without claiming success or clearing observations.
  Catalog and layout admission limits are unchanged; status reads call no provider.
- Completion still requires atomic owned materialization. Partial mappings remain
  unresolved until every source season is verified. No schema change is needed.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Clear conflicts when artwork exists | Smaller counter | No identity evidence | Reject |
| Automatically select a catalog hit | Less operator work | Can conflate grouped shows | Reject |
| Typed review context and fixed repair guidance | Explains what was checked and what failed | Operator still supplies a proposed mapping | Implement first |
| Bounded catalog candidate discovery | Reduces manual ID entry | Requires independent candidate provenance and ambiguity tests | Next |

Fresh installations and installations without approved mappings gain no scheduled
work. Test unknown/malformed responses, source drift, restart cooldown, cancellation,
partial mappings and unchanged completion semantics in isolated PostgreSQL and UI
fixtures. Rebuild the local image without cache and dump its isolated fresh schema.

## Official research

Discovered and opened through MCP on 2026-10-10:

- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) separates
  text search from external-ID lookup. Neither is user approval of a mapping.
- [TMDb season details](https://developer.themoviedb.org/reference/tv-season-details)
  requires a series ID and season number. Keep season mappings visibly typed.
- [W3C error suggestions](https://www.w3.org/WAI/WCAG21/Understanding/error-suggestion.html)
  recommends explaining known corrections without compromising security. Use fixed
  actionable text alongside the failed check, not raw upstream error messages.
- [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  aligns declaration major/minor versions with the represented library. Keep
  Node declarations on the deployed Node major; audit success is not compatibility.

Random draw from the two currently open PRs selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555) again, immutable head
`4cbffcb7dd726af152382a1f92edb9dc326fe349`. Trial its Node 26 declaration changes
locally and retain Node 24 alignment if rejected. No PR merge, release or runtime
major upgrade is authorized by the trial.
