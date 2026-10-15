# Classifarr-owned work on shared Ollama

Design addition requested 2026-10-15: distinguish Classifarr work from unrelated
consumers without taking ownership of the shared provider.

## Contract

Every gateway-admitted compute attempt already has a durable, native PostgreSQL
UUIDv7 request ID and credential-derived installation. Extend that immutable
binding with operation and model. Send the reference and installation as fixed
`X-Classifarr-Request-Id` and `X-Classifarr-Installation` headers, plus the constant
`X-Classifarr-Application: classifarr`. Never accept these headers as incoming
ownership claims or relay caller-supplied values.

For repeat-work comparison, optionally configure a separate, persistent random
32-byte base64url `workIdentityKey` in the private gateway configuration. HMAC-SHA256
fingerprints cover a versioned namespace, provider hash, installation, operation
and exact JSON-serialized outbound body. The digest and key identifier are stored
with the binding, never the prompt or key. Do not send the content fingerprint
upstream. Legacy configurations without a key still receive unique request IDs;
they do not fabricate content fingerprints. Keep the key stable across restarts;
rotation requires a stopped, reviewed configuration replacement.

Fingerprints identify identical serialized input within one installation/provider/
key scope, not semantically equivalent requests or immutable model weights behind
a mutable tag. They do not authorize result reuse, retry, deduplication, cancellation
or recovery. Each attempt gets its own UUIDv7 even when its fingerprint matches.
No operation resets existing attempt, cooldown, ownership or uncertainty rules.

External Ollama consumers have no Classifarr admission record and are never
adopted from `/api/ps`, model name, resource usage or a supplied header. Loaded-model
information remains capacity information only. Shared pressure can defer our work
without marking another consumer's work failed or attempting to cancel it.

The [official Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md?file=api.md)
documents `/api/ps` as loaded models, not per-request ownership. Discovered/read via
MCP on 2026-10-15. There is no documented job lookup/cancel-by-Classifarr-reference
contract here. These headers are correlation metadata, not proof Ollama stores or
echoes them. The gateway ledger is authoritative for Classifarr's own admissions.

[Node.js HMAC documentation](https://nodejs.org/download/release/v24.16.0/docs/api/crypto.html)
describes keyed SHA hashing and `KeyObject` support. This implementation uses a
separate random key, never the bearer credential; its identifier fences live
reload changes without serializing the secret.

## Tradeoffs and completion

UUIDv7 alone is automatic, private and sufficient for attempt ownership. Optional
keyed fingerprints support comparison without unkeyed hashes of low-entropy prompt
content, but introduce a secret to retain and rotate. Choose both layers where
configured; do not make TLS peer authentication a substitute for work ownership.

The schema-v5 standalone upgrade adds nullable fields to preserve historical
bindings without invented context. No application DB or production routing change.
Tests must cover separate installations, changed body/model/route/key, identical
payloads with different attempt IDs, spoofed headers, untracked external activity,
no payload/key persistence, migration preservation, and existing interrupted work.

Next: explicit propagation from application task/source references and reviewed
gateway rollout. All direct clients remain outside this prototype until routed
through the gateway. Shared-provider lifecycle control remains forbidden; a
dedicated provisioner is a separate future prerequisite for automatic stops.
