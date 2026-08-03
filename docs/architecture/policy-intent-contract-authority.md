# Policy Intent Contract Authority

Date: 2026-08-02

## Outcome

5R.1 establishes `policy_intent_authority` as the server-owned read contract
for policy meaning. It is additive: the existing `policy_intent_contract`
remains available only as a version-1 compatibility projection while existing
clients and runtime consumers migrate.

The contract names the concepts an operator and downstream server components
need to reason about:

- declared intent,
- bounded observed-evidence reference,
- hard limits,
- avoid rules,
- ask rules,
- routing target,
- warnings, and
- validation status.

It does not expose an observed-profile payload, routing filesystem path,
client draft, preset payload, or provider trace. The native read service loads
only bounded routing and provenance metadata; the mapper strips its internal
authority context before serializing the response.

## Official Research

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): apply syntactic and semantic validation at the server trust boundary, use allow-lists, and treat client validation as UX rather than security.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): validate authorization server-side on every request, deny by default, and handle authorization failure safely.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html): bind the server decision to the operation and prevent client parameter changes from changing authorization results.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final): integrate secure design, implementation criteria, and verification into the software lifecycle.

## Source Classification

| Boundary | Classification | Decision |
| --- | --- | --- |
| `policyIntentContract.mjs` | Rewrite | Retain as a v1 compatibility projection; it is no longer the final authority contract. |
| `policyIntentSchema.mjs` | Keep | Continue validating the persisted v1 rule model while later storage migrations version it deliberately. |
| `policyIntentMapper.mjs` | Rewrite | Publish the new authority contract and retain the old projection as an explicit bridge. |
| `policyIntentRequestValidator.mjs` | Delete after migration | It is a bounded legacy draft-sidecar validator until 5R.2 establishes the admitted native write boundary. |
| `policiesRoutePolicyRead.mjs` | Keep with new projection | The detail read path now exposes the authority contract through the mapper. |
| `policiesRoutePolicyWrite.mjs` | Rewrite in 5R.2 | Create/update admission and response projection still have separate legacy and native branches. |
| Native read and provenance services | Keep | They now supply only routing and observed-evidence reference metadata to the authority projection. |
| `policyAuthoringServerAuthorityPreparation.mjs` | Delete | It had no runtime consumer and incorrectly asserted that native storage was disabled. Its focused coverage moved to the durable authority contract. |

## Contract Design

`server/src/services/policyIntentAuthorityContract.mjs` owns a pure,
versioned construction and validation boundary. `policyIntentAuthority` is
derived solely from server read data and server-owned persistence metadata.

The output has these rules:

- Native intent is authoritative only when the server read result is native and
  its policy validation is not invalid.
- Compatibility-derived rules are labelled `inferred_compatibility`; they are
  never represented as operator-declared intent.
- The legacy bridge is explicitly `read_only_compatibility_bridge` and
  `final_authority: false`.
- Evidence is a reference with source, capture, freshness, and expiry state.
  Snapshot payloads, projections, and fingerprints are excluded.
- Routing includes only target state and media-server type. It excludes config
  identifiers and root paths.
- Ask rules distinguish no declared rules from current server defaults. They do
  not infer operator intent from UI state.
- Warnings and validation issue codes are bounded. Validation messages are not
  copied into the authority contract.

## Options

### Replace the v1 contract in place

Pros: one response field immediately.

Cons: breaks current consumers and stored schema-version-1 native rows; makes
compatibility behavior indistinguishable from native authority.

### Keep the preparation metadata and add more flags

Pros: smaller immediate diff.

Cons: preserves an unused, contradictory authority model and leaves the
published read contract fragmented.

### Publish an additive authority contract and retain v1 as a read-only bridge

Pros: establishes product vocabulary now, keeps reads backwards compatible,
does not trust client draft data, and supports independently versioned native
storage migration.

Cons: consumers temporarily receive two related fields until 5R.2 and later
consumer migrations complete.

## Final Recommendation Stack

1. Use `policy_intent_authority` for new server, browser, Discord, and runtime
   integrations.
2. Treat `policy_intent_contract` as a compatibility-only v1 projection.
3. Use the 5R.2 server-authorized, idempotent boundary for native initial
   creation; legacy sidecars remain validation-only compatibility input.
4. Move each remaining v1 consumer to the authority contract before removing
   the bridge and its legacy draft-sidecar validator.

## Verification

Focused coverage:

- `server/src/__tests__/services/policyIntentAuthorityContract.test.mjs`
- `server/src/__tests__/services/policyIntentMapper.test.mjs`
- `server/src/__tests__/services/policyNativePolicyReadService.test.mjs`
- `server/src/__tests__/policies-routes.coverage.test.mjs`

The tests verify server-only metadata is stripped before response
serialization, observed evidence is bounded, compatibility cannot claim final
authority, native routing/provenance state is projected, and all existing
route behavior remains covered.

## Next Task

**5R.2 Write Preflight And Persistence Boundary and 5R.2a Proposal And
Lifecycle Admission Contract are complete.** Their admission, idempotency,
replay, lifecycle, and proposal decisions are recorded in [Policy Intent Write
Admission](policy-intent-write-admission.md) and [Policy Authoring Proposal
Lifecycle Admission](policy-authoring-proposal-lifecycle-admission.md). Proceed
with **4R.4a Library Lifecycle Entry** before adding the normal browser path.
