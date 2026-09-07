# Embedding response budgets outcome

Date: 2026-09-07. See the separate
[design, official sources and alternatives](embedding-response-budgets-design.md).

## Result

A small ESM embedding HTTP service now applies a fixed **4 MiB decoded-response
budget**. Dedicated cloud providers, same-provider cloud/Gemini mode, direct and
shared Ollama, local/cloud image providers and Ollama embedding warmup use it.
Caller options retain their headers, deadlines and cancellation signals but cannot
override the budget. No dependencies or operator settings were added.

The existing bounded HTTP reader rejects oversized plain, compressed and HTTP-error
bodies before complete buffering/parsing. Embedding wrappers preserve
HTTP_RESPONSE_TOO_LARGE with its fixed message and numeric budget, without a body,
credentials or upstream error payload. Failed transfers do not return vectors or
record cost-success events. The immediate retry wrapper does not retry this error;
existing outer fallback, circuit and background retry policies retain their
behavior. Fallback embedding requests have the same protection.

Warmup reports failure through its existing success/errorCode envelope. Successful
response shapes, vector dimensions and request payloads are unchanged. Model lists,
inventory reads, generated content and caller-owned streams retain their separate
contracts. Image download inputs retain the existing 10 MiB budget. No public API,
database schema, classification authority or study-readiness gate changed.

## Measured sizing and validation

These are generated compatibility fixtures, not measurements from paid providers
or a classification accuracy study. The reviewed dimensions 384, 768, 1,024, 1,408,
1,536, 2,048 and 3,072 passed through each of six response envelope shapes. An
expanded fixture uses 16,384 finite values with long numeric representations,
pretty formatting, multibyte content and a 1 MiB echoed text field.

| Envelope | 3,072-value JSON bytes | Expanded fixture bytes |
| --- | ---: | ---: |
| OpenAI-compatible | 67,687 | 1,556,744 |
| Gemini | 67,610 | 1,523,852 |
| Cohere v1 | 67,670 | 1,523,913 |
| Ollama | 67,665 | 1,523,918 |
| Vertex | 67,650 | 1,556,678 |
| Local sidecar | 67,611 | 1,491,079 |

All expanded fixtures use less than half the 4,194,304-byte boundary. The cap
does not promise arbitrary custom output compatibility, impose a dimension limit
or validate vector meaning. Unusually large extensions or numeric/whitespace
representations may fail and need an explicit contract review.

The focused suite passed **268 tests across eight suites**, including all 13
embedding adapter paths and warmup. Tests use actual loopback HTTP consumption,
rerouting hard-coded provider URLs locally and mocking cost persistence. They
verify expanded payload success, plain/compressed error rejection, no immediate
retry or cost-success recording, exact decoded boundary, override resistance and
unchanged generation/model-list size contracts. Existing cancellation and HTTP
response-limit regressions passed. One existing direct-Ollama assertion was
updated to include the new response-budget option.

The full backend suite passed **31,595 tests across 1,103 suites** in 121.592
seconds, using two workers and 512 MB idle worker recycling. Backend typechecking,
scoped ESLint, production dependency checks and ESM import/mock-shape checks
passed. Documentation lint passed across 1,087 Markdown files. No public endpoint
or database schema changed; frontend compilation is included in the Compose build.

## Local Compose validation

Before recreation, a 44,543,685-byte database archive was copied to ignored local
storage, checksum-verified and inspected with pg_restore. The prior image is
retained locally for rollback. The no-cache build passed from clean source
revision `f9559b1850524f862720e0339fd19236f0c76105`. Both dependency installs
reported zero audit vulnerabilities; the frontend production build passed in
3.59 seconds. The recreated container is healthy and reports that source revision.

The in-container embedding fixture passed **34 assertions across 17 local HTTP
requests**: six expanded response shapes, oversized plain/compressed/error bodies,
the actual cloud helper and local-image adapter, exact boundary, override
resistance, cancellation and timeout. The existing cancellation fixture passed
another **59 assertions across 15 local HTTP requests**. Both fixtures made zero
real provider calls and zero database writes. The runtime fixtures use smaller
metadata envelopes than the sizing table above; neither is live-provider evidence.

All ten authenticated read-only inventory/statistics/settings requests returned
200. Six anonymous requests returned 401, and unsupported health/overlap query
parameters returned 400. Masked provider settings matched the selected runtime
configuration. Health and overlap remained available with no-store, 6,692 inventory
rows and ten libraries, at sample times of 622 ms and 581 ms. History remained at
6,775 records, with zero feedback records and 250 applied migrations. Provider
integrity reported zero invalid providers; quota availability remained available
in a read-only transaction.

The startup/smoke sample contained **279 informational records, four slow-query
warnings, zero provider-drift warnings and zero error/fatal records**. Existing
background work remained enabled; these fixture assertions do not describe all
background operations. Credentials, raw logs, configured quotas and backups remain
outside committed artifacts. Final outcome documentation is the only difference
from the tested image source.

## Open PR availability

GitHub MCP returned an empty open-PR collection at task start and final readback.
There was no PR population for random selection; no closed PR was substituted or
merged.

## Recommendation stack and next item

Retain TLS, cancellation and deadlines; apply the shared embedding POST budget;
reuse bounded decoded-byte consumption; preserve fixed size errors; then apply
existing provider/retry policies. This gives uniform coverage without operator
input. The tradeoff is a finite compatibility boundary for custom providers; an
arbitrary universal HTTP cap would affect unrelated inventory/generation payloads,
and a post-buffer check would arrive after allocation.

Next, validate embedding vectors before success/cost accounting and persistence.
Current adapters can accept absent/empty vectors, and the local image path trusts
returned dims. The storage path can attempt schema repair after a dimension
mismatch. Reject malformed, nonfinite or inconsistent vectors at the provider
boundary and ensure invalid responses cannot drive dimension-based schema changes.
Preserve model-space compatibility and existing data rather than silently changing
vector dimensions. This is a separate semantic validation task; byte limits alone
do not solve it.

No release or tag is created.
