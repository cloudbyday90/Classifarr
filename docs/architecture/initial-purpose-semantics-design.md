# Preserve explicitly declared initial purpose semantics

Date: 2026-11-09 Eastern. Status: agreed and implemented; verification recorded
in the [outcome](initial-purpose-semantics-outcome.md).
Baseline: main 681012143, clean at intake. No release or deployment.

## Problem and proposed behavior

Initial establishment accepts identity or compatibility purpose semantics, but
its materializer replaces both with identity. Later native edits preserve the
explicit value. The same accepted declaration consequently acquires different
meaning depending on which authoring path first writes it.

Preserve explicit identity/compatibility for future successful initial writes.
Keep the existing identity default for omission/null. Change only the existing
mapRule leaf in policyInitialIntentEstablishmentContract.mjs; its purpose branch
becomes rule.semantics ?? 'identity'. Other collections retain their mappings.
Do not introduce another mapper or scoring matrix for this single expression.

The initial establishment writer and native create's pre-INSERT capability guard
already use this builder. Profile proposal admission delegates native create;
today's generated profile purpose explicitly uses identity and remains unchanged.
No new UI control is needed to preserve values the API already accepts.

## Meaning and material consequences

Compatibility is already a supported native purpose state. Persistence and native
loading preserve its value; the shared positive-purpose semantics leaf recognizes
it. This change does not introduce a new role or turn purpose into a helpful hint.

| Existing scorer behavior | Identity | Compatibility |
| --- | --- | --- |
| Required-any/content include match | 80 | 80 |
| Required-all full match | 100 | 100 |
| Preference miss/missing evidence | 0 | 50 |
| Media include with missing media type | 0 | 50 |
| Required specialized identity terms | Available for eligible content rules | None |

Compatibility can contribute a declared match and numeric support, with its
actual compatibility evidence mode. It cannot independently supply specialized
primary identity. A neutral 50 cannot independently meet the existing >50 purpose
admission condition, but can affect averages/weights beside other positive rules.
Existing insufficient-identity calibration and caps continue to apply.

Fresh explicit compatibility can therefore change eligibility, ranking, threshold
bands and downstream decisions relative to today's accidental identity mapping.
Keep scorer/calibration/threshold formulas, strict conflicts, media admission,
specialization, typed binding, routing and learning authorization unchanged.
No accuracy improvement or causal claim follows from this correction alone.

## Replay, history and authority

Do not change request schemas, parsing, normalization, fingerprints, array order,
receipt versions, SQL, lock order or key/actor checks. The existing fingerprint
records parsed requested semantics before materialization, including the existing
distinctions between omission, null and explicit values.

An older request asking for compatibility can have a valid receipt whose stored
rule is identity. Exact receipt recovery must still return that original outcome
before the mapper/guard, including after later native revisions. Do not rewrite
the stored rule, upgrade its proof or create another version. Changing semantics
under the same key remains an existing different-payload/key-reuse refusal.

Initial establishment keeps policy lock, exact receipt recovery and authority
checks before materialization/reservation. Native create keeps advisory lock and
exact create recovery before materialization and policy INSERT. Consumed profile
proposal recovery stays before expiry/current-profile checks. Fresh capability
validation remains after recovery and before first DML.

Keep old stored identity/null/compatibility values, version copying, reversion,
restores, immutable evaluation captures and historical statistics unchanged.
This batch performs no backfill, live configuration write or provider call.

## Existing post-choice projection limit

The operator-intent adapter maps purpose/identity to belongsHere and
helpful_hint/compatibility to helpfulMatches. It omits purpose/compatibility and
feeds post-choice destination-evidence learning guards. The candidate selector
also excludes that pair. This is a learning-provenance boundary; no selective
native-purpose provider-prompt projection was demonstrated. See the corrected
[consumer trace](compatibility-purpose-consumer-boundary.md).

Preserve this limit explicitly. Future prompt evidence and future learning
admission require separate contracts; do not silently relabel purpose or expand
identity-only coverage/inventory/preflight readers.

## Verification and delivery

Freeze the current production-module overwrite as the failing baseline, then
verify explicit identity/compatibility preservation across four signals and four
positive operators; omission/null retain identity. Preserve non-purpose roles,
strict limits, profile-generated identity and existing unsupported-rule refusal.

Use real PostgreSQL establishment/create persistence and native loading. Seed an
older compatibility request with identity stored and prove exact replay retains
it after later revisions. Verify key reuse for a semantics-only payload change,
concurrent same-key requests, rollback after receipt/audit failure and delayed or
lost acknowledgement after an actual COMMIT. No uncertain request is replayed
with a new key or interpreted as proven rollback.

Use the bound evaluator to compare freshly loaded compatibility with the existing
native-edit path: numeric contribution, evidence mode, neutral-50 aggregation,
no specialized identity, existing calibration and threshold/authorization gates.
Keep category/display names irrelevant. Verify initial/create HTTP admin, request,
key, error and exact-replay contracts through production services.

Run focused tests and fresh full backend coverage, normal quality/ownership and
dependency gates, full audits and the unchanged coverage ratchet. Reuse client
coverage/build/browser results only after verifying unchanged client source,
configuration, installed tree and report hashes. The independent server-runtime
PR must pass its own reviewed install and real-library controls.

Record actual outcomes separately, update Unreleased, perform scoped artifact
maintenance, commit/push all agreed changes on main and inspect source CI/scans.
No new page, endpoint, schema, capture, setting, job, operator CLI trigger,
automatic historical rewrite, release or deployment.

## Official research and trade-offs

Sources discovered/read through MCP on November 9, 2026:

- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes syntactic validity and operation meaning. Preserve the existing
  accepted enum and fresh capability boundary rather than invent a second parser.
- [HTTP semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
  distinguishes method semantics and safe retry reasoning. Existing POST receipt
  recovery is an application contract; this standard does not prescribe our
  receipt layout or permit changing a committed outcome.
- [W3C predictable input behavior](https://www.w3.org/WAI/WCAG22/Understanding/on-input)
  informs use of existing explicit controls. This backend correction adds no UI
  or conformance claim; preserving accepted business-rule meaning is our design
  inference, not a WCAG scoring requirement.

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Keep forced identity | No fresh behavior change | Silently contradicts accepted compatibility and later edits | Reject |
| Reject compatibility at initial validation | One meaning initially | Breaks accepted requests/recovery if shared parser changes; leaves path inconsistency | Reject |
| Preserve explicit semantics only for fresh writes | Consistent accepted meaning, minimal modular change | Fresh ranking/bands can change; requires replay and consumer proof | First batch |
| Rewrite older identity or expand other consumers too | Broader apparent alignment | Infers historical choices and combines distinct contracts | Separate decisions |

Recommendation stack: preserve fresh explicit semantics first; then choose a
category-neutral provider-prompt evidence contract separately from post-choice
learning provenance, using the consumer trace above. Address category-specific
prompt assumptions under that explicit scope. Keep historical review, existing
security-alert triage and Node/npm security independently bounded before release.
