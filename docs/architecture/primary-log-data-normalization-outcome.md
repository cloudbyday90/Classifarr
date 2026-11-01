# Primary log data normalization outcome

Date: 2026-10-31 (America/New_York). Status: implemented and verified locally on
main. See the separate [design, research and tradeoffs](primary-log-data-normalization-design.md).

## Implemented behavior

LoggerShim now uses a dedicated inert data projection across error, warn, info and
debug. Own data descriptors preserve small ordinary JSON shapes and the existing
sensitive-key substring redaction. Sensitive values are redacted before inspection.
Accessors, proxies, unsupported objects and cycles become fixed markers without
executing their hooks. Repeated aliases remain usable within a shared value budget.
The input is not mutated. Null-prototype output records/arrays have no inherited
serialization or property hooks, and own prototype-like keys remain safe data.

The projection admits eight container levels, 1,024 visited values, 64 members per
container, keys up to 128 UTF-16 units, string prefixes up to 2,048 units and 64 KiB
of compact UTF-8 JSON. Prefix truncation never splits a valid surrogate pair.
Omitted-container envelopes preserve the retained prefix without overwriting a
source field to insert a diagnostic. Markers and envelopes count toward the byte
budget. Encoding only examines the inert projection, never the original graph.

Root arrays/primitives and records with reserved log identity fields receive an
application-owned envelope. Data cannot replace severity, timestamp, message,
process or module fields. Ordinary records keep their shape. Absent/null data
retains empty primary objects and its existing absent/null database metadata.
There is no new recursive warning, counter, cache, settings page or operator task.

Admitted error/warn calls share one prepared projection between primary output
and ordinary database metadata. The internal prepared path is private; direct
persistToDb calls always normalize their data, including when extra arguments are
supplied. Warning deduplication still happens before data inspection. Skipping
database persistence still emits projected primary output. Primary transport
exceptions retain their existing propagation boundary.

Upstream error selection now uses own data descriptors, skipping proxies,
accessors and inherited references, while preserving option/field priority and
the existing exclusion of array side properties. Node's native error brand check
also recognizes cross-realm errors without prototype-based instanceof checks.
A small type bridge uses Node 24's Error.isError without changing the project's
ES2024 compile library or using the deprecated util API. Plain data.error stacks
are hydrated only from own string properties. The stack_trace column retains
original native/hydrated content and the separate native materialization policy.

The shared legacy sanitizer, durable comparison ledger, request-context builder,
messages, bindings, stack-size policy, persistence fallback, database-registration
guard, every normal INSERT attempt and IDs/null results retain their boundaries.
No schema, API, job, CLI requirement, UI, routing, learning, deployment, release,
service restart or production cleanup is added.

## Verification

The regression failed on the old code at all four levels: cyclic data overflowed
the recursive sanitizer before primary output or persistence. It passes with the
projection, retains safe siblings and proves that primary/DB calls share the same
prepared value. Hostile error selectors are not invoked.

Focused logging checks passed fifteen suites / 191 tests, covering exact
depth/member/value/key/string limits, alias expansion, redaction, accessors,
live/revoked proxies, coercion and serialization hooks, sparse arrays, inherited
properties, prototype-like keys, input immutability, multibyte/escaped byte
budgets, root collisions, stack priority and fallback/transport boundaries.
Real Pino workers exercised the shim through stdout and both rolling-file
targets, verifying parseable JSON, severity filtering, identity and redaction.

Isolated PostgreSQL compatibility checks passed six suites / forty tests, including
readiness diagnostics and durable comparison recovery. Successful
hostile-data logging returns an ID and retains the original stack plus matching
bounded JSONB. A read-only INSERT is genuinely refused; rollback restores writes
and later pool use. JSONB rejects NUL and unmatched-surrogate inputs with actual
database errors, preserving null results without poisoning the pool. These are
synthetic isolated fixtures; no physical disk was filled or production data used.

Backend lint/type checking, both dependency scans, static ESM import/mock shape
checks, copyright and four policy gates passed. The ownership gate passed without
changing any review entry or baseline and retains productionCompatible: false;
this is not release-readiness evidence. Markdown lint and whitespace checks passed.
Staged secret scanning also passed.
Full backend coverage passed 1,909 suites / 61,891 tests, with one existing skipped
test. Overall coverage was 89.20% statements/lines, 86.61% branches and 90.73%
functions. The new projection reached 96.69% statements/lines, 90.83% branches and
100% functions. The coverage ratchet passed without baseline changes. It reused
the October 30 client report because client source is unchanged; no fresh client
test/build run is claimed. No dependency has been changed.

Artifact maintenance reused the same-day verified inventory and preserved fresh
results and every recovery asset. No stale artifact or image needed removal in
this batch. The isolated PostgreSQL containers are gone; the Classifarr container
retained its identity, image, start time and healthy state. Shared Docker listings
also changed for an unrelated transient container; this batch managed none of
those containers and makes no claim about that change's cause.

## Limits and next item

The bound applies to projected data, not the whole log record. Messages, bindings,
request context and native/hydrated stacks retain their existing policies.
The budget covers prepared data before existing Pino formatting/serializers or
PostgreSQL's JSONB representation, which can add representation overhead.
Materializing a selected native stack can still execute Error.prepareStackTrace
or an application stack accessor and can fail through the existing persistence
fallback. The projection does not sandbox compromised built-ins or guarantee
recovery from memory exhaustion. Ordinary-object key enumeration still occurs
before the member cap; constant-time CPU/allocation is not promised.

JSONB's independent Unicode restrictions remain. Already invalid NUL or unpaired
surrogate data may be emitted safely by the primary JSON sink but refused by the
database. There is no replay, recovery announcement or broad Unicode rewrite.
The diagnostic markers are not trustworthy evidence or authorization signals.

Recommended next batch: inspect and scope preliminary readiness cancellation and
database-acquisition deadlines. The existing readiness outcome documents that
caller cancellation does not reach the probe's read and its statement timeout
starts only after BEGIN. Establish one bounded acquisition/cancellation contract
before changing retry behavior. Keep existing scheduler surfaces and automatic
execution; add no operator CLI requirement. Broader log-record limits and JSONB
Unicode handling remain separately documented follow-ups. Resume classification
evaluation with production evidence after a separately authorized deployment.

GitHub MCP found no open PRs, including Dependabot, so no random PR or stale
dependency PR was applicable. No PR was merged. Dependencies remain unchanged.
Unreleased records the logging behavior.
