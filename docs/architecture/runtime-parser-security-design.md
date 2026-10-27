# Runtime parser security design

Date: 2026-10-27. Scope: the parser-security batch recommended by the
[previous outcome](server-tooling-pr572-outcome.md), on main without a release
or deployment.

## Boundary and compatibility

Normal bootstrap installs Express JSON and extended form parsers before CSRF,
authentication and routing. Restore bootstrap installs JSON with a 100kb limit
before its CSRF and maintenance allowlist. An unauthenticated encoded request
therefore reaches body-parser's decompression stream. The invariant is that
decoder errors remain contained to the request and cannot terminate the process.
Preserve compressed requests, decoded size limits, parsing shapes and existing
authentication, CSRF and maintenance decisions.

Pin the existing overrides to body-parser 2.4.0 and qs 6.16.1. Express 5.3.0's
body-parser range admits this version; all inspected qs consumer ranges admit
6.16.1. No application comma-format qs serialization sink was found. Patching
that shared dependency still removes the affected implementation. Do not add
application sanitization for a sink the application does not use.

The dependency is the narrow shared fix boundary. Keep the two small bootstrap
files intact and put process probes and binary HTTP helpers in separate test
modules; a new application singleton or parser wrapper would add no enforcement.

## Official research and alternatives

URLs were discovered or followed using connected GitHub/search MCP services on
2026-10-27, then read alongside exact npm registry metadata and installed sources.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Exact patched overrides | Upstream fix across both bootstraps; reproducible graph | Minor body-parser update also adds Zstandard; test this explicitly. Recommended. |
| Disable inflation | Avoids decompression path | Rejects currently supported gzip, deflate and Brotli requests; incompatible workaround. |
| Local stream patch | Could preserve old dependency | Duplicates upstream internals and cleanup semantics; unnecessary maintenance. |
| Latest qs minor / Express upgrade | Additional upstream features | Larger behavior surface than this security fix; review separately. |

- The [maintainer body-parser advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
  identifies trailing compressed bytes and patches 2.4.0. Body limits and route
  authentication do not close its post-decoding error path.
- The [2.4.0 release](https://github.com/expressjs/body-parser/releases/tag/v2.4.0)
  also adds Zstandard on supported Node versions and changes read-option handling.
  Review content-type 2.1 and iconv-lite 0.7 transitive changes, not only versions.
- The [iconv-lite 0.7.3 release](https://github.com/pillarjs/iconv-lite/releases/tag/v0.7.3)
  adds charset aliases and corrects UTF-32 streaming. Whole-buffer encoding and
  decoding are unchanged. The lock already contains content-type 2.1.0; only
  iconv-lite changes transitively, from 0.7.2 to 0.7.3.
- The [qs advisory](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) identifies
  comma serialization of elements with non-callable own `toString`; 6.16.1 is
  patched. Test both encoder branches and null-prototype elements in isolation.
- [Express parser documentation](https://expressjs.com/en/resources/middleware/body-parser/?trk=public_post_comment-text)
  defines default inflation, 100kb limits, extended-form limits and parser errors.
  Preserve those contracts and verify decompressed limits, malformed input and
  unsupported encoding controls.
- [OWASP REST security guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports bounded bodies, secure parsers and explicit content types. Keep the
  current limits rather than increasing them to make compatibility tests pass.
- [W3C WCAG 2.2 error identification guidance](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  supports descriptive text errors. Preserve the existing JSON error response;
  this backend dependency change adds no form controls and does not establish
  application-wide accessibility conformance.

## Verification and recommendation stack

1. Reproduce trailing-byte failure locally with the installed vulnerable graph.
   Use loopback-only child processes without an uncaught-exception handler;
   delay trailing bytes until the parser has completed, require request completion
   and a later healthy request. Never send these probes to Unraid.
2. Apply exact patched overrides with scripts disabled, inspect every lock change,
   then clean-install under the existing strict lifecycle policy.
3. Require the same probes to pass; test gzip and truncated encoding alternatives,
   legitimate encoded JSON/forms and actual normal/restore bootstrap behavior.
4. Run server quality checks, dependency-policy tests and full backend coverage.
   Keep frontend evidence separate: no client source or API contract changes.
5. Retain the npm CLI bundled ip-address next-release hold. Track the newly
   observed, unpatched deepmerge advisory in Jest separately; do not downgrade
   Jest based on audit's suggested major-version workaround.
6. Return to operator correction outcome evaluation as the next classification
   refactor after this bounded security batch. This update does not fix library fit.

PR 573 requests qs 6.17.0. Its security objective overlaps this batch, but its
minor-version behavior is not implemented by 6.16.1; keep it for separate review.

Observed results belong in [the outcome](runtime-parser-security-outcome.md).
