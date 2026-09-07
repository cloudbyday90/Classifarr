# Runtime dependency transport compatibility design

Date: 2026-09-07. Discovered while locally testing PR #529.

## Evidence and failure

The repository's HTTP utility creates an npm Undici Agent when a connection has
`rejectUnauthorized: false`, then passes that Agent to Node's built-in fetch.
The new direct dependency smoke test failed with `invalid onRequestStart method`.
A disposable run of the preceding `classifarr:statistics-scope-local` image
confirmed the same failure with Node 24.18.1, bundled Undici 7.29.0 and installed
Undici 8.10.0. It therefore predates the PR's 8.10.1 update.

The defect affects the buffered custom TLS path, including configured self-signed
media servers. The native path without an explicit dispatcher does not cross this
version boundary. The old per-request custom Agent also had no disposal step.

## Official sources

The [upstream Dispatcher documentation](https://github.com/nodejs/undici/blob/main/docs/docs/api/Dispatcher.md)
was discovered through web search and its `v8.10.1` content retrieved through
GitHub MCP. It documents the dispatcher callback interface and explicit close/
destroy lifecycle. The [upstream proxy example](https://github.com/nodejs/undici/blob/main/docs/docs/api/ProxyAgent.md)
pairs fetch and its custom dispatcher from the same package. Using that pairing
for this Agent is our compatibility decision, validated against the actual
failure rather than inferred solely from a dependency version number.

The releases considered in the
[comparison design](policy-comparison-values-design.md) were published by
31 August 2026. Research was read on 7 September; versioned dependency material
was checked at the selected release.

## Architecture and security boundary

Introduce a small ESM `httpClientTransport.mjs` module for buffered requests.
It selects the request function and owns the custom dispatcher's lifetime.
`httpClient.mjs` keeps URL/header construction, response parsing and error
normalization. Streaming and binary requests retain their existing native paths.

- With normal settings, call native fetch without a custom dispatcher.
- Only literal boolean `false` opts into custom TLS. Null, zero and string values
  retain normal verification rather than becoming a truthy/falsy TLS bypass.
- The custom path creates an Agent and uses fetch from the same installed Undici
  package. It never changes the global dispatcher or TLS environment settings.
- The callback consumes the buffered response. A `finally` block destroys the
  private Agent after success, HTTP failure, abort or body-read failure.

The existing `rejectUnauthorized: false` configuration still permits unverified
certificates for that individual request. This fix restores that explicit option;
it does not broaden certificate trust for other requests.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Pair package fetch/Agent only for custom TLS | Small scope, keeps native defaults and existing mocks, explicit resource ownership | Custom requests do not reuse pools across calls | Implement |
| Downgrade npm Undici to match the bundled major | Avoids the current interface mismatch | Couples dependency choice to Node internals and discards reviewed upstream fixes | Reject |
| Replace global fetch/dispatcher | One process-wide transport | Affects unrelated integrations and security boundaries | Reject |
| Share one insecure Agent globally | Reuses connections | Broader trust and shutdown ownership complexity | Reject |

Recommended stack: default verified native fetch → explicit per-request custom
transport when configured → matching package fetch/Agent → consume body → dispose.
Use actual loopback requests alongside unit checks of ownership and opt-in rules.
Verify a self-signed HTTPS connection fails by default, works only with the explicit
option, and still fails by default afterward. Keep test certificates disposable.
