# Ollama gateway credential lifecycle outcome

Status: Unreleased, 2026-10-14. See the separate
[design, tradeoffs and official research](ollama-gateway-credential-lifecycle-design.md).

## Implementation

Small ESM modules own the private file reader, bounded reload coordinator and
request-scoped credential authority. The standalone Linux CLI reloads only
credentials on SIGHUP. Atomic publication retains unchanged callers and cancels
removed or rebound credentials. File/configuration failure stops the gateway;
neither a reload nor a restart resets the durable attempt/uncertainty ledger.

There are no new dependencies, tables, migrations, HTTP administration endpoints,
application settings or automatic retries. Existing UUIDv7 identifiers remain.
Normal Classifarr routing is unchanged. The complete source-level cutover matrix
now includes interactive rule suggestions, inspection, warming, model installation,
embedding adapters and study tools as well as primary generation and verification.

## Verification in progress

Focused gateway checks passed: four suites, 86 tests. Real HTTP and isolated
PostgreSQL checks passed: one suite, 51 tests. They cover active buffered/streaming
revocation, queue cancellation, inspection, claim/completion races, token overlap,
unchanged authority, incomplete body intake, overlap queue limits, durable attempts,
cooldown and owner continuity. Type checking, backend test/security lint, normal
and production dependency reachability, static imports, ESM mock shapes,
copyright, Markdown, migration naming and schema snapshot integrity passed.
The inventory ownership gate passed without manifest changes or new waivers;
its existing unresolved paths remain unresolved.

The packaged fixture now tests Linux SIGHUP, atomic configuration replacement,
old/new token overlap and removal, POSIX private-file enforcement, malformed JSON,
symlink rejection and fail-closed restart behavior. Full unit tests, image rehearsal
and local no-cache replacement are pending; no claim is made yet.

Before replacement, the local database backup was written to
`data/backups/gateway-credentials-before-20261014.dump`. Its archive index has 1,933
readable lines; SHA-256:
`185CC60954E51586DA09D83CC4609E946A3FC28F6DD1472343EF758E7C3FE095`.
It remains local and has not been restore-tested.

GitHub MCP enumeration found no open Classifarr PRs. No PR could be selected or
implemented, and none was merged. No release, live provider inference, Unraid
write or shared Ollama change has been made.

## Remaining work

This is server-side local credential lifecycle, not installation-wide activation.
Clients still require explicit close/recreation when their credentials change.
Cross-host TLS, network bypass prevention, all-path provider composition, token
expiry/secret management and verified unknown-outcome recovery are still deferred.

Next recommended implementation: one explicitly injected installation-level
provider context covering generation, embeddings, inspection and warming, with
unsupported model administration rejected and no direct fallback. Prove it in
isolated tests before adding any activation setting or connecting shared Ollama.
