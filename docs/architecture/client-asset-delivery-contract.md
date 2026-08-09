# Client Asset Delivery Contract

## Decision

The client entry document and its Vite-hashed assets have different cache and
fallback rules:

- `/assets/*` is a static-only namespace. An existing asset is served with
  `Cache-Control: public, max-age=31536000, immutable`; a missing asset is a
  404 and is never replaced with `index.html`.
- The application shell (`index.html`) is served with `Cache-Control: no-cache`
  for client-side routes. Each navigation can therefore discover the current
  hashed JavaScript and CSS names after a deployment.
- API routes remain registered before the client delivery boundary, so an API
  request never falls through to the application shell.

## Problem Addressed

A rebuild changes Vite asset names. Previously, a browser holding an old
`/assets/index-<hash>.css` URL received the SPA HTML fallback with HTTP 200.
The browser then rejected the HTML as a stylesheet and could continue using an
old JavaScript bundle, presenting retired UI language and stale authentication
behavior. The response was not a valid asset response.

The corrected contract makes the failed asset observable as a 404, while a
fresh shell points browsers at the currently deployed immutable assets.

## Security And Operations

The missing-asset response does not reveal filesystem paths or replace an
asset's MIME type with HTML. The application shell continues to receive the
existing CSP and security headers. This boundary does not repair an expired
login: a genuine `401` still requires a valid authenticated session, but an
obsolete bundle can no longer obscure that distinction.

Verify a deployment with:

```text
GET /                         -> Cache-Control: no-cache
GET /assets/<current-hash>.js -> Cache-Control: public, max-age=31536000, immutable
GET /assets/<retired-hash>.js -> 404, never index.html
```

## Research Basis

[MDN's HTTP caching guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
recommends `no-cache` for the HTML entry resource so it can discover updated
asset URLs, and a long immutable lifetime for cache-busted hashed assets.
[Express static-file guidance](https://expressjs.com/en/5x/starter/static-files/)
documents serving a dedicated static directory through `express.static`.

## Alternatives Considered

### Continue serving the SPA shell for every unknown path

Pros: client-side deep links work with minimal route configuration.

Cons: a missing CSS or JavaScript resource becomes a successful HTML response,
which causes MIME failures and can retain a stale application.

### Disable all client caching

Pros: simple invalidation behavior.

Cons: every navigation re-downloads unchanged content and discards the
integrity and performance benefit of content-hashed assets.

## Recommended Stack

- Dedicated non-fallthrough static middleware for `/assets`.
- Long immutable caching only for content-hashed assets.
- Revalidated application shell for client-side routes.
- Explicit 404 behavior for retired asset names.
