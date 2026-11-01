# Primary log data normalization design

Date: 2026-10-31 (America/New_York). Status: implemented and verified locally.
See the separate [outcome](primary-log-data-normalization-outcome.md).
Predecessor: [persistence fallback outcome](logging-persistence-fallback-outcome.md).

## Problem and scope

Primary LoggerShim normalization recursively reads arbitrary values before Pino
or ordinary database persistence. Cycles can throw before either sink receives
the event. Accessors, proxies and serialization hooks can execute application
code; repeated aliases and large acyclic data can also expand output. The
existing persistence fallback cannot protect the earlier primary path.

Add a dedicated logging data projection for error, warn, info and debug, and
ordinary error_log metadata. Keep the exported legacy sanitizer unchanged:
the comparison incident ledger uses it for a separate durable transaction.
This batch does not change messages, bindings, request context, stack size or
materialization policy, warning deduplication, transport failures, persistence
fallback, database-registration guards, IDs/null results or INSERT retry policy.
There is no routing, learning, schema, endpoint, job, setting or UI change.
Application execution stays automatic; no operator command is required.

## Agreed contract

Project only null, booleans, finite numbers, strings, ordinary records and array
indices. Preserve small ordinary JSON shapes, including nested arrays and
null-prototype records, without mutating input. Match the existing case-insensitive
sensitive-key substrings before examining a value. Redacted values remain
`[REDACTED]`. Non-finite numbers use JSON's null representation.

Read own enumerable string data properties through descriptors. Accessors become
a fixed marker without invocation. Reject live/revoked proxies before reflection,
and replace unsupported values/objects without calling toJSON, coercion, custom
inspection, species or iterators. Ignore symbols and inherited properties.
Array holes retain JSON's null representation. Clone records and arrays with
null prototypes so the resulting projection has no inherited hooks, including
safe treatment of an own `__proto__` key. Built-in native errors are unsupported
data values; their separate persisted stack policy remains available.

| Bound | Maximum | Meaning |
| --- | --- | --- |
| Input container depth | 8 | Root is the first container; deeper containers become a marker |
| Visited values | 1,024 | Includes repeated aliases; stop expanding after the shared budget |
| Members per container | 64 | First own enumerable keys or array indices, including rejected entries |
| Key length | 128 UTF-16 code units | Reject overlong keys; never truncate/rename them |
| String prefix | 2,048 UTF-16 code units | Retain prefix plus fixed marker; do not split a valid surrogate pair |
| Encoded projection | 64 KiB UTF-8 | Includes all markers and envelopes, excludes the rest of the log record |

Use ancestor tracking for true cycles and the shared value budget for repeated
aliases. Preserve useful siblings. Replace an unsafe subtree with a fixed
`[LogData:category]` marker. When members, key length, visited-value or byte limits
omit entries, wrap that container's retained prefix in an application-owned
`logData` / `logDataStatus` envelope. The wrapper avoids overwriting an original
input field to insert a diagnostic. Categories contain no caught error text.
Envelopes add bounded output nesting; the depth limit governs input traversal.
Each affected container reports one fixed category, not exhaustive omission counts.
These markers are diagnostic text, not authenticated evidence or permissions.

Always supply an inert record as Pino's merging object. Wrap root arrays and
primitives in a `logData` envelope. Wrap records with reserved root identity keys
(`level`, `time`, `msg`, `pid`, `hostname`, `module`) so they cannot replace sink
severity, timestamp, message or module identity. Preserve absent/null data's
existing empty primary object and absent/null metadata semantics. Include root
wrapping in the byte admission budget. No source string is directly serialized;
only inert projected values are encoded to measure output.

Use a single prepared projection per admitted error/warn call for primary output
and ordinary database metadata. Direct persistence calls prepare their own
projection. The private persistence path must not expose a caller-selectable
normalization bypass. Preserve every existing INSERT attempt and persistence
result; normalization omissions do not become a persistence failure.

## Upstream errors and limits of the guarantee

Select options.error and data.error/err/exception/cause through own data
descriptors, skipping proxies and accessors. Preserve priority and native error
references using Node 24's Error.isError. Preserve the existing plain data.error
hydration only from own string stack/message/name data properties. Never infer
an upstream stack from inherited properties or execute selectors to obtain one.
Array side properties remain outside upstream data-error selection, as before.

Reading a selected native stack can still invoke Node's Error.prepareStackTrace
hook or an application stack accessor. That separate existing stack policy is
outside this projection's no-callback and output-size guarantees. A stack failure
continues through the existing persistence fallback; no recovery is announced.
Messages, request options/context and transports also remain outside the bounded
data contract. The byte budget covers the prepared value before Pino's existing
formatting/serializers and PostgreSQL's JSONB representation. This is not a
whole-log-record size or exception guarantee.

Own-key enumeration materializes keys before the per-container limit applies.
Reflection therefore cannot promise constant CPU/allocation for an already huge
ordinary object. The contract bounds inspected values, retained traversal and
encoded output; it does not preempt synchronous JavaScript or guarantee progress
after memory exhaustion. Rejecting proxies prevents their reflection traps; it
does not sandbox compromised built-ins or the application process.

JSON-compatible projection does not remove PostgreSQL's independent JSONB
Unicode restrictions. Existing NUL/unpaired-surrogate input can still make the
database refuse an INSERT; the existing null result/fixed fallback applies.
Primary output survives. Prefix truncation avoids introducing an unpaired
surrogate when the original pair was valid. Broad Unicode rewriting or a second
database-specific data representation is outside this batch.

No queue, replay, backoff, transaction or persistent state is added. Each call
owns its traversal state; concurrency/restart loses no new durable state. Existing
ownership, cancellation, authorization and resource-admission boundaries remain
unchanged. Do not retry uncertain writes or treat a successful log as recovery.

## Official research and recommendation stack

Sources discovered and read through MCP on 2026-10-31:

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)
  recommends validating event data, safely replacing malformed fields, retaining
  events and testing logging/resource failures. Our application is a bounded
  projection with local omission markers rather than raw error forwarding.
- [Pino security guidance](https://github.com/pinojs/pino/security) assigns data
  size, depth, breadth, reference topology and root-field control to applications.
  [Pino API documentation](https://github.com/pinojs/pino/blob/main/docs/api.md)
  explains that depthLimit/edgeLimit apply only after JSON.stringify throws.
  Inference: fallback limits alone cannot bound ordinary acyclic log data.
- [Node 24 util documentation](https://nodejs.org/docs/latest-v24.x/api/util.html)
  provides isProxy and marks isNativeError deprecated in favor of Error.isError.
  Verify behavior on the repository's actual Node 24 runtime, including revoked
  proxies and cross-realm native errors.
- [PostgreSQL 18 JSON types](https://www.postgresql.org/docs/18/datatype-json.html)
  documents JSONB's NUL and surrogate-pair restrictions. The MCP search extract
  was available; direct page retrieval timed out. Isolated PostgreSQL tests
  independently verify these refusals and unchanged null/fallback behavior.
- [ECMAScript JSON serialization](https://tc39.es/ecma262/2024/multipage/structured-data.html)
  specifies property reads and toJSON calls.
  [Reflection](https://tc39.es/ecma262/2024/multipage/reflection.html) specifies
  own-key collection and descriptor operations. These stable versioned sources
  support avoiding original-value serialization and documenting enumeration cost;
  they are not represented as a newly published October 2026 standard.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  W3C Statement, supports purpose-limited data minimization. Apply that principle
  to retained logging context; this batch changes no UI/ARIA behavior and makes
  no web conformance claim.

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Dedicated inert bounded projection | Predictable data output; preserves ordinary context and existing ledger semantics | Explicit omissions; reflection has unavoidable enumeration cost | First batch |
| Only catch sanitizer failures | Small change; cycle events could continue | Hooks still execute; successful oversized serialization remains unbounded | Insufficient |
| Pino fallback limits alone | Existing options | Do not constrain successful JSON serialization or earlier sanitizer recursion | Insufficient |
| Replace shared sanitizer globally | One implementation | Changes durable comparison evidence and request context outside agreed scope | Defer |
| Drop entire malformed events | Simple failure path | Loses valid diagnostic siblings and the primary event | Reject |
| Enforce a whole-record limit | Broader storage protection | Requires separate message, bindings, stack and request-context contracts | Later design |

Recommended stack: own-descriptor selection, inert logging-only projection,
explicit redaction and resource limits, protected root identity, one prepared
value per sink pair, then real transport/PostgreSQL regressions. Keep the process
quiet and automatic without a new operator surface.

## Verification and delivery

First reproduce the cyclic/getter failure through LoggerShim, then verify all four
levels, small JSON compatibility, input immutability, sensitive keys, live/revoked
proxies, accessors, serialization/coercion hooks, unsupported types, hostile
prototypes, cycles, aliases, sparse arrays and exact depth/member/value/key/string
limits. Test encoded escaping, multibyte data, byte ceilings, envelope collisions
and reserved root fields. Prove primary and DB metadata share prepared data.

Preserve native/original hydrated stacks, selection priority, skip/dedupe behavior,
transport exceptions and the existing fallback bound. Exercise real Pino workers
through the shim, with stdout and rolling files. Use isolated PostgreSQL for
hostile-data persistence, read-only refusal/rollback, successful IDs and subsequent
pool use; never fill a disk or mutate production.

Run focused checks before backend coverage/ratchet and applicable quality gates;
do not refresh review baselines. Record results in a separate outcome document,
update Unreleased, inspect current PRs and commit/push on main. No release,
deployment, cleanup or restart is implied. Review remaining logger record fields
and readiness acquisition/cancellation as separately scoped follow-ups.
