# Policy Intent Write Admission

Date: 2026-08-02

## Outcome

5R.2 establishes one server-owned admission boundary for policy create and
update requests. Native initial creation now requires an `Idempotency-Key`, is
authorized server-side, persists the policy and initial native intent in one
transaction, and returns a fresh authority projection. A retry returns the
original result instead of inserting a duplicate policy.

Legacy create and metadata-update requests retain their compatibility contract.
A submitted draft sidecar is only validated and summarized; it cannot become
native authority or persist implicitly. Native establishment fields on legacy
updates are rejected rather than ignored.

## Official Research

- [IETF HTTPAPI Idempotency-Key Header draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header): recommends a client-generated unique key, server fingerprinting, `409` for an in-progress duplicate, and `422` when a reused key has a different payload. This was an expired IETF working-group Internet-Draft, not an RFC, when reviewed for the June 2026 design baseline.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html): authorize every endpoint, validate request data, and avoid exposing sensitive internals in errors.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): use allow-lists and both syntactic and semantic validation at the server trust boundary.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html): bind authorization to the exact operation and prevent parameter substitution after authorization.
- [PostgreSQL advisory-lock functions](https://www.postgresql.org/docs/15/functions-admin.html): transaction-level advisory locks provide a bounded, automatically released coordination primitive.

## Design

The browser creates a CSPRNG UUID only for a native create. It prefers
`crypto.randomUUID()` and falls back to a UUIDv4 assembled from
`crypto.getRandomValues()` when necessary. It keeps that value while the
semantic request is unchanged and sends it as a quoted structured
`Idempotency-Key` header. A changed request receives a new key, preventing an
accidental replay of an earlier operation.

The server performs the following work inside a caller-owned database
transaction:

1. Allow-list and validate the native create identity and establishment
   request, including the header.
2. Derive a signed 64-bit SHA-256 advisory-lock value from the idempotency key
   and attempt a transaction-level PostgreSQL lock.
3. Lock and inspect any existing establishment receipt before inserting a
   policy. A matching receipt replays its persisted result; a mismatch returns
   `422`; a concurrent request returns `409`.
4. Insert the policy and establish its native intent with the existing durable
   receipt mechanism. Any failure rolls back both writes.
5. Re-read the native authority projection before serializing the response.

Responses expose only bounded outcome metadata through
`policy_intent_write_result`; they never echo the header key, request body,
draft sidecar, prompt, provider data, or internal fingerprint.

## Options

### Server-generated request key

Pros: minimal browser work.

Cons: a network retry creates a new key, so it cannot safely identify the
original operation. Rejected.

### New generic receipt store

Pros: could eventually cover unrelated write endpoints.

Cons: duplicates the existing durable initial-establishment receipt and expands
the storage/migration surface. Deferred until a second native command needs a
shared primitive.

### Reuse the established native-intent receipt with a focused admission service

Pros: preserves durable audit provenance, creates no schema churn, coordinates
concurrent retries, and keeps native and legacy behavior explicit.

Cons: applies only to native initial creation; future commands must either use
this receipt deliberately or introduce their own bounded persistence contract.

## Final Recommendation Stack

1. Require client-generated idempotency keys for every native create command.
2. Validate, authorize, lock, receipt-check, and persist within one server
   transaction.
3. Return `409` for an in-progress duplicate and `422` for a reused key with a
   different admitted request.
4. Re-read authority after a committed or replayed native write.
5. Keep legacy draft sidecars validation-only until a separately authorized
   native command replaces each compatibility path.

## Deletion Criteria

The draft-sidecar preflight can be removed only when all of these are true:

- 4R normal authoring submits an admitted native command rather than a sidecar.
- No API client sends either draft-sidecar alias.
- Compatibility route and client tests for the sidecar are removed or replaced.
- The compatibility inventory has no live consumer of the legacy payload.

## Verification

Focused tests cover header parsing, lock-key derivation, receipt replay,
mismatched-key rejection, transaction rollback behavior, route responses,
client header propagation, and stable browser retry keys. Server and client
lint and production builds remain part of the component gate.

## Next Task

Proceed with **4R.2 Server Workflow Presentation Adapter**. It must consume the
authoritative read and write outcomes above without restoring a browser-owned
policy editor or exposing compatibility diagnostics as normal UI.
