# Runtime dependency transport compatibility outcome

Date: 2026-09-07.

## Local PR adaptation

Selected [PR #529](https://github.com/cloudbyday90/Classifarr/pull/529) by one
uniform random draw from the five open PRs returned by GitHub MCP (526–530).
Fetched and verified head `1ebd60db884e9646166e90ff791af785552b2125`, then applied
only `server/package.json` and its lockfile. The versions are express-rate-limit
8.7.0, Undici 8.10.1 and Zod 4.5.4. Existing nested Undici overrides remain intact.
The original PR was not merged through GitHub.

The manifests preserve the PR's lockfile integrity entries. `npm ci` succeeded
and `npm ls` confirmed the installed versions. Official release/source review and
the architecture alternatives are in the
[comparison design](policy-comparison-values-design.md) and
[transport design](runtime-dependency-transport-design.md).

## Defect found and fixed

The first direct runtime smoke test failed because Node 24.18.1's bundled Undici
7.29.0 fetch rejected the npm Undici 8 Agent's dispatcher interface. A disposable
baseline container reproduced `invalid onRequestStart method` with the prior
8.10.0 package. This failure predates the selected update; mocked consumer tests
had not exercised the cross-version dispatcher boundary.

The new ESM transport helper pairs npm fetch and Agent only when certificate
verification is explicitly disabled for a buffered request. Ordinary requests
keep native fetch and normal verification. A private Agent is disposed after
response consumption or failure. No global TLS/dispatcher setting is changed.
Null and other nonboolean options retain verification. Streaming and binary
request paths retain their existing behavior.

This implements the selected PR locally together with the compatibility repair
needed to pass real transport checks. It does not add a new provider or setting.

## Validation

| Check | Result |
| --- | --- |
| Existing baseline image | Reproduced the dispatcher failure with Node 24.18.1, bundled Undici 7.29.0 and installed Undici 8.10.0. |
| Targeted server tests | 116 tests across 7 suites passed: actual rate-limit rejection/retry metadata, actual loopback HTTP requests/timeouts, Agent lifetime and strict opt-in, Zod validation and existing parser/schema consumers. |
| HTTP response compatibility | Loopback checks exercise JSON success, preserved HTTP error shape and timeout normalization. |
| Disposable self-signed HTTPS check | Passed: default requests rejected the certificate before and after an explicit `false` request succeeded; null also retained verification. Only the opted-in request reached the HTTPS handler. |
| Production image build/fresh startup | `classifarr:comparison-values-local` built successfully; disposable startup/schema verification passed with no schema changes. |
| Type checking, ESM checks and affected lint | Passed. |

No full backend suite or combined coverage ratchet was run. Focused validation
targets the changed dependencies and actual transport interface; it does not
assert that all external provider integrations have been exercised. No real
provider requests or production data were used for these tests.

The HTTPS check generated a one-day certificate inside a disposable container;
OpenSSL was installed only in that test container. No certificate/key or extra
runtime package is committed or added to the production image. The existing
Compose instance was not upgraded. Local logs/scripts/screenshots remain ignored.

## Final recommendation

Accept the exact PR dependency updates together with the small transport helper;
container verification passed. Keep verified native fetch as the default, and
use a matching package fetch/Agent with explicit ownership for custom TLS.
This avoids coupling npm versions to Node internals and prevents custom trust
from affecting unrelated requests. The tradeoff is no connection reuse across
custom requests. Consider bounded pooling only if connection measurements
justify its additional trust-keying and shutdown complexity.

The main product follow-up remains the passive lifecycle breakdown recorded in
the [comparison outcome](policy-comparison-values-outcome.md). No release is
included in this work.
