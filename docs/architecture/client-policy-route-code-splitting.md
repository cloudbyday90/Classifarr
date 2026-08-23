# Client Policy-Route Code Splitting

Status: implemented in source. This change does not create a tag, GitHub
release, package publication, or container publication.

## Outcome

The client no longer gathers policy authoring, policy maintenance, and policy
insight pages into one `policy-tools` bundle. The Vite 8 configuration now uses
the supported Rolldown `output.codeSplitting` API and creates entry-aware groups
for the three operator workflows:

```text
Policy authoring     Policy maintenance       Policy insights
Policy list          Native reconciliation    Evidence
Presets              Historic safety refresh  Statistics
                                              Tuning suggestions
```

Vue/Pinia/router and Socket.IO dependencies remain in their existing cacheable
vendor groups. Settings and RAG settings remain independently grouped. The
configuration is now owned by the small ESM
`client/build/clientCodeSplitting.mjs` module rather than a growing Vite
singleton.

The local production build measured the largest emitted policy JavaScript asset
at 187.86 kB (48.89 kB gzip) for native-intent reconciliation. This replaces
the prior combined `policy-tools` asset of 510.45 kB (152.84 kB gzip). No
generated asset exceeded Vite's 500 kB uncompressed warning budget in the
verified build. These are build-output measurements, not a claim that every
route's full request waterfall has the same byte total.

## Design

Each route group names only known, static source paths. The matching helper
normalizes module identifiers to forward slashes before it tests them, so the
same policy applies on Windows CI and Linux image builders. There are no
dynamic path inputs, remote imports, runtime configuration reads, client-side
authorization changes, or new network requests.

Policy route groups have priority `20`; focused vendor groups have priority
`30`, so framework modules are consistently captured before app routes.
`entriesAware: true` separates modules by the lazy entries that actually use
them. `includeDependenciesRecursively: true` retains Rolldown's safe default
for avoiding circular chunks.

```text
Lazy policy navigation
        |
        +--> authoring    -> Policy List, Presets
        +--> maintenance  -> Reconciliation, Historic refresh
        +--> insights     -> Evidence, Stats, Tuning
```

The configuration test asserts the supported API, the Windows-path behavior,
the historic maintenance route, priorities, and the route-group safety
settings. The production build remains the integration check for generated
asset size and import order.

## Research Basis — August 2026

- Vite's [v7-to-v8 migration guide](https://v8.vite.dev/guide/migration)
  says the `manualChunks` function form is deprecated and directs projects to
  Rolldown `codeSplitting`.
- Vite documents
  [`build.rolldownOptions`](https://v8.vite.dev/config/build-options) as the
  supported way to customize the underlying production bundler.
- Rolldown's [code-splitting reference](https://rolldown.rs/reference/OutputOptions.codeSplitting)
  supports named groups and deterministic priorities, while warning that
  manual splitting requires attention to side-effect timing.
- Rolldown documents that
  [`entriesAware`](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup)
  keeps entries from loading matching modules they do not use; the same
  reference documents recursive dependency capture as the safe default for
  reducing circular chunks and recommends Windows-safe path matching.

## Options Considered

### Raise Vite's chunk-warning threshold

Pros:

- Minimal configuration change.
- No change to generated chunk topology.

Cons:

- Leaves the `policy-tools` payload combined and delays every policy route.
- Hides the build signal instead of addressing it.
- Does not retire the deprecated Vite 8 configuration API.

Decision: rejected.

### Retain one `manualChunks` policy bundle

Pros:

- Keeps prior asset names and loading shape.
- Smallest behavioral diff.

Cons:

- `manualChunks` is deprecated in Vite 8.
- It forces unrelated policy workflows to fetch the same large bundle.
- It omitted the historic-route refresh screen from the explicitly managed
  policy root list.

Decision: rejected.

### Selected: entry-aware Rolldown groups by operator workflow

Pros:

- Uses the supported Vite 8/Rolldown API.
- Aligns transfer cost with the page the operator chose.
- Keeps framework and transport dependencies cacheable across routes.
- Handles Windows module identifiers deterministically and is unit tested.
- Includes dependencies recursively to reduce circular-chunk risk.

Cons:

- Adds more immutable build assets and import requests on a cold navigation.
- Future policy pages must be intentionally assigned to a workflow group.
- Generated asset names and cache boundaries change, requiring a production
  build check before a later release.

Decision: selected.

## Final Recommendation Stack

1. Keep route groups based on stable operator workflows, not arbitrary file
   size alone.
2. Use Vite 8's Rolldown `codeSplitting` API; do not add new
   `manualChunks` configuration.
3. Preserve `entriesAware: true` and recursive dependency capture for lazy
   page groups unless a measured build and execution-order review justify a
   different design.
4. Treat the production build and route-level browser tests as the required
   regression checks whenever a page is added or moved.
5. Continue to keep API authorization, session handling, and provider data out
   of the build configuration; code splitting is a delivery optimization, not
   an authorization boundary.

## Follow-up Outcome

The recommended production-browser verification is now implemented. It builds
the client, serves `dist/` only on loopback, cold-loads each policy page, and
enforces an uncompressed JavaScript budget. See
[Production Policy-Route Asset Smoke](production-policy-route-asset-smoke.md)
for the design, security boundary, and current checks.

## Next Recommended Item

Add the production policy-route asset smoke to the protected client CI path so
every pull request verifies the emitted bundle rather than relying on a local
pre-release check.
