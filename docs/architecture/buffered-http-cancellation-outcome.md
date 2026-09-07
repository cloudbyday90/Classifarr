# Buffered HTTP cancellation outcome

Date: 2026-09-07. See the separate
[design, official sources and alternatives](buffered-http-cancellation-design.md).

## Result

Buffered GET, POST, PUT, DELETE and binary downloads now honor optional caller
signals alongside their existing request deadlines. A small ESM utility composes
signals and distinguishes cancellation from timeout. Pre-aborted requests fail
before body serialization, fetch or custom Agent allocation. Cancellation also
interrupts response consumption; bounded readers retain cancellation and lock
cleanup, and the custom Undici transport retains its disposal lifetime.

Caller cancellation returns a fixed AbortError / ABORT_ERR without retaining the
original reason or cause. This applies even if the caller's reason is itself a
TimeoutError. An internal deadline that wins during an active request remains
ETIMEDOUT. Fully received HTTP errors, successful response shapes, malformed JSON
compatibility, byte limits and omitted/null signal behavior retain their contracts.

The shared retry utility accepts an optional signal, checks it before attempts and
retry admission, and passes it to native promise timers. Explicit cancellation
names/codes take precedence over retryable messages, network codes and statuses.
Both cloud and direct-host Ollama embedding adapters pass their existing signal
through retry backoff. Cancellation exits their error handlers without provider
error extraction; the existing outer provider handler already excludes aborts
from failure metrics and circuit-breaker accounting.

There are no new dependencies, settings, public API/schema changes or operator
steps. Caller-owned streaming responses and classification/readiness authority
remain under their existing contracts. Cancellation cannot undo already accepted
upstream work. Generic retry-wrapped functions must cooperate during execution;
this wrapper controls their admission and waits.

## Verification

Focused loopback HTTP and retry regressions cover both native and package Undici
transports, pre-aborted calls, custom reasons, cancellation before headers and
during JSON/text/binary reads, reader lock release and closed connections. Tests
also cover retained deadlines, source precedence while fetch observes the signal,
cancelled Retry-After waits, retry listener cleanup and successful transient
retries through the actual cloud and direct-host Ollama helpers.

The initial focused run exposed fixture issues: forced closure of pooled idle
sockets could race the following request; the fixtures now use Connection: close
and wait for cancelled sockets to close. Native TypeError assertions use the error
name across Jest realms. The source-precedence fixture observes the composed
signal as fetch does, avoiding lazy unobserved-signal evaluation in the installed
Node runtime. These corrections change the tests, not the transport contract.

The full backend suite passed **31,530 tests across 1,102 suites** in 206.655
seconds, using two workers with 512 MB idle worker recycling. Backend typechecking,
scoped ESLint, production dependency checks and ESM static import/mock-shape checks
passed. Documentation lint passed across 1,085 Markdown files. No public endpoint,
client API or database schema changed; frontend production compilation is part of
the Compose build.

## Local Compose validation

Before recreation, a 44,533,519-byte database archive was copied to ignored local
storage, checksum-verified and inspected with pg_restore. The prior image is
retained locally for rollback. The no-cache build passed from clean source
revision `4fca64b4e28f029b524596ea5585d5a5a3ee6705`. Both dependency installs
reported zero audit vulnerabilities; frontend production compilation passed in
6.92 seconds. The recreated container is healthy and reports that source revision.

An in-container cancellation fixture passed **59 assertions across 15 local HTTP
requests**, covering pre-aborted calls, both transports, cancellation before
headers/during body reads, closed connections, sanitized errors, retained
deadlines, cancelled Retry-After and successful responses. The existing response
limit fixture passed another **23 assertions across 16 local HTTP requests**.
These fixtures made zero real provider calls and zero database writes.

All ten authenticated read-only inventory/statistics/settings smoke requests
returned 200. Six anonymous requests returned 401, and unsupported health/overlap
query parameters returned 400. Masked provider settings matched the selected
runtime configuration. Health and overlap remained available with no-store,
6,692 inventory rows and ten libraries, at sample times of 891 ms and 954 ms.
History remained at 6,775 records, with zero feedback records and 250 applied
migrations. Provider integrity reported zero invalid providers; local quota
availability remained available in a read-only transaction.

The startup/smoke log sample contained **237 informational records, five slow-query
warnings, zero provider-drift warnings and zero error/fatal records**. Existing
background work remained enabled; these helper assertions do not describe every
background operation. Credentials, raw logs, configured quotas and backups remain
outside committed artifacts. Final outcome documentation is the only difference
from the tested image source.

## Open PR availability

GitHub MCP returned an empty open-PR collection at task start and final readback.
There was no PR population for random selection; no closed PR was substituted or
merged.

## Recommendations and next item

Keep native signal composition, existing TLS/deadlines/byte budgets, fixed
cancellation errors and abortable retry waits. This avoids new dependencies and
operator input, at the cost of explicitly distinguishing timeouts from caller
cancellation. Replacing deadlines with caller signals can remove a time bound;
promise racing alone can leave underlying work running.

Next, assess explicit decoded-response budgets for remaining buffered provider
calls, starting with embedding responses. Derive limits from supported response
shapes and batch sizes, and test legitimate maximum responses before adoption.
Keep inventory page contracts and unknown evidence states intact. Any semantic
counter-evidence still needs the existing measured study/readiness gates and may
send ambiguous items to review only; it must not gain routing authority.

No release or tag is created.
