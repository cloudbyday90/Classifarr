# Optional gateway upstream TLS identity

Unreleased, 2026-10-15. Synthetic local prototype, not a production cutover guide.
No change to shared Ollama, Unraid, default application routing or AI consent.

## Configure a dedicated test endpoint

Use a separate PostgreSQL 18 gateway database with schema v5 and the restricted
roles in [offline recovery](ollama-gateway-offline-recovery.md). Back up and stop
existing gateways before upgrading. No application database migration is needed.

In the private gateway configuration, set `gateway.upstream` to the exact private
IPv4 **HTTPS** origin of the test endpoint and add:

```json
{
  "upstreamTls": {
    "ca": "REPLACE_WITH_PRIVATE_CA_PEM",
    "publicKeySha256": "REPLACE_WITH_64_LOWERCASE_HEX_CHARACTERS"
  }
}
```

This fragment is illustrative, not runnable. The endpoint needs a certificate
valid for its IP address and the matching private key. Establish the pin from an
administrator-trusted certificate, not an unverified live connection. The pin is
SHA-256 over the leaf certificate's DER SubjectPublicKeyInfo, not its PEM text or
whole-certificate fingerprint. The gateway never receives the provider private key.
Keep configuration outside source control and logs, mode 0600/private user ACLs.

The gateway verifies the CA chain, validity, IP SAN and public-key pin on every
new connection. It does not use ambient proxies, redirects, pooled connections,
resumed sessions, downgrade, or automatic retry. HTTPS without the two explicit
TLS fields is rejected; HTTP with TLS fields is rejected.

The HTTPS origin has a different provider hash from the HTTP origin. Client
`upstream` and the application binding's expected origin must match exactly.
Do not move an active/uncertain ledger to another origin or create a replacement
ledger to bypass it. Resolve the old boundary through the reviewed offline
procedure before commissioning a separate dedicated test provider/database.
Changing key/CA/origin requires stopping the gateway and a reviewed configuration
replacement, not credential-only SIGHUP. A configuration edit never heals old work.

## What evidence means

For compute, the request is admitted first. Once TLS is authenticated, an
append-only UUIDv7 observation is committed before any HTTP bytes are sent. If
that write fails or its acknowledgement is lost, no HTTP request is sent. The
existing claim remains counted and uncertain. A later timeout, cancellation or
disconnect is likewise not silently retried. Normal successful completion and
known busy responses retain existing completion/cooldown behavior.

Offline inspection includes `requestBinding.transportEvidence` with the public-key
hash, leaf-certificate hash and database observation time. No prompts, answers,
tokens or certificate/private-key contents are stored. Missing evidence is not
backfilled from current configuration. Inspection calls verify TLS but do not
create compute attempts or peer rows; `/gateway/status` performs no provider I/O.

TLS identity proves possession of a key only. It does **not** establish a Docker
container's identity, exclusive provider access, the destination behind a proxy,
whether inference started/completed, or whether workers have stopped. Reusing a
key across instances prevents distinguishing those instances. The existing Docker
pins and reviewed stop journal are not upgraded to automatic recovery authority.

Stock local Ollama does not supply this new deployment boundary. A future
dedicated provisioner must own the endpoint, exclusive per-instance key and
provider lifecycle before machine-authorized recovery is considered. No shared
provider restart, model pull, GPU/storage setup or automatic backfill is included.

## Classifarr work on a shared provider

Every compute request admitted through this gateway gets a unique UUIDv7 and an
installation reference derived from its gateway credential. Operation and model
are recorded before dispatch. Outbound `X-Classifarr-Application`,
`X-Classifarr-Request-Id` and `X-Classifarr-Installation` headers support correlation
at a controlled proxy. Incoming copies of these headers do not supply identity.

Optionally add `gateway.workIdentityKey`: a separate random 32-byte secret encoded
as canonical unpadded base64url (43 characters). Keep it in the same private file,
stable across restarts, never reuse a bearer token, and never put it in logs.
The gateway records an HMAC-SHA256 fingerprint of scoped exact serialized input,
plus the key identifier, without storing the prompt. No key means explicit null
fingerprints but still unique UUIDv7 request IDs. Key changes require offline
configuration replacement; they are refused by credential-only reload.

Offline `requestBinding.workIdentity` shows the installation, attempt reference,
operation, model, fingerprint and key identifier. Fingerprints are local only, not
sent to Ollama. Compare them only within the same provider/installation/key scope;
they are not semantic equivalence, completion, deduplication or retry permission.

Other applications' work is never imported into this ledger from loaded models,
resource pressure or headers. Classifarr may defer its own work when shared
resources are busy, but cannot cancel, retry or recover someone else's work.
Ollama's model list is not a job-ownership API. The IDs do not imply Ollama stores
them or supports per-ID cancellation. Direct Classifarr clients are not covered
until explicitly routed through the gateway; production routing is unchanged.

See the [work ownership design](../architecture/ollama-work-identity-design.md),
[transport design and tradeoffs](../architecture/ollama-upstream-identity-design.md)
and [verification outcome](../architecture/ollama-upstream-identity-outcome.md).
