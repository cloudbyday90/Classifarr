# Initial verification advice provenance design

Research: November 11, 2026 Eastern. Baseline main
`b039b2b4a45ef3ccbc297fc2fd9b8c98d55a3408`. The operator confirmed the first
consumer in Q1 and the complete contract in Q2 before implementation. See the separate
[investigation](verification-advice-provenance-investigation.md) for source
traces, official guidance, alternatives and PR assessment.

## Confirmed consumer and authority

Qualify only optional policy-signal advice and the recommendation-selected
profile attachment for the initial policy owner's verification request. Missing
or changed proof omits those optional sections. Preserve the separately built
verification target, candidate-bound instructions, provider capability admission,
overall confidence used by parsing, deterministic mode, calls, retries and route
and learning authority.

The verification instructions still name the selected target. This batch does
not make live provenance a prerequisite for verification admission, or claim
that the complete verification prompt has private provenance.

Keep adjudication, its fallback request and purpose sidecar, RAG rechecks,
legacy/generic/direct callers and offline replay unchanged. Do not alter the
shared informational context builder or impose proof on all AI callers.

## Proposed field contract

Use a dedicated small adapter over the existing genuine live selection evidence.
Do not extend the meaning of diagnostic captures or claim the recovery-only
reader proves all advisory fields. The existing same-object, typed-item,
policy/library/native-revision, retained decision and original-pool checks
remain prerequisites. Preserve native and compatibility source handling and
the existing 64-candidate, 64-library, 16-KiB selection-reference limits.

For this consumer only, replace the ordinary policy section with a closed
projection containing the held library display label and original overall
confidence. The label is a presentation value, never a category/purpose rule.
Require a nonempty string of at most 160 UTF-16 units and no control characters;
do not coerce, truncate, or infer a name. Freeze it and reject changed label proof.
Do not substitute the top candidate score for overall confidence.

Do not include raw breakdown, scores/weights, candidate/decision diagnostics or
related-evidence text in this first qualified section. Those values are outside
the selection witness. Their omission changes optional explanatory context and
can influence the model's assessment; numeric scoring and parsing authority
remain unchanged. A complete qualified signal packet is a separate follow-up.

An explicit `options.policySignals` override must not bypass this scoped boundary.
Keep the ordinary override/fallback behavior for excluded callers. An unavailable
qualified section must not fall back to the original raw context. Retain the
original signal context separately for verification instructions and parsing.

## Profile association and bounds

After existing provider admission, read selection proof before invoking the
existing profile lookup. Use the proven destination ID, captured independently of
the mutable context. Missing proof skips the lookup. Bind its exact invocation
and accepted result in the adapter's private lifecycle, and recheck selection
after it settles before attaching any data.

Use own data properties only when projecting the result; reject proxies,
accessors, unsupported objects and malformed values without coercion. Carry only
the fields already displayed by the profile formatter: nonnegative safe-integer
item count, coverage for its fixed five traits, and the existing displayed
prefixes of five ratings, five genres and three studios. Retain finite 0–100
percentages and existing normalized labels of at most 160 UTF-16 units. Validate
the fixed coverage version/population and known-plus-missing denominators.
Do not add languages, keywords, item titles, raw metadata or new profile fields.

Projection uses the existing display prefixes; it does not claim the full
distribution was transmitted. Invalid/oversized profile material omits that
profile without invalidating independently valid selection advice. Empty
profiles remain absent. Freeze accepted projected values and cap the combined
added advice/profile data at 16 KiB encoded UTF-8; on overflow omit the profile,
or both sections if the advice itself cannot fit. Do not add semantic truncation.

The profile is a later inventory observation, not part of the earlier policy
evaluation. Its existing coverage/observational wording remains. Association
proves which lookup supplied the data, not verified labels or profile accuracy.
The existing underlying inventory query/resource behavior remains unchanged;
projection limits are not a new bound on database rows or query duration.
They apply after the trusted lookup resolves; JavaScript's native Promise
assimilation of a returned thenable is not replaced or bounded by this projection.

Keep current local/remote disclosure behavior for these existing fields. Add no
declared-purpose terms, prompts, revisions, internal IDs or private evidence to
provider requests, persisted metadata or logs. Purpose terms remain restricted
to the existing adjudication-only projection.

## Private lifecycle

1. Hold the dedicated private selection adapter immediately after the initial
   policy owner constructs its context, before asynchronous support work.
2. Pass an explicit internal scoped request to the first AI call only when its
   selected mode is verification. The scoped path remains identifiable even if
   the optional handle is unavailable. Missing/copied/serialized/altered proof
   cannot silently fall through to the legacy raw-data behavior.
3. Recheck the held selection after provider/config/admission awaits, before
   profile access, and after the profile lookup. Reject changed typed item,
   retained decision, selected object or original loaded-pool evidence.
   Once invalidation is observed, this session cannot refill the gap by restoring
   fields later in the same request.
4. Build optional sections from immutable projections. Recheck after asynchronous
   prompt assembly and the provider-lock wait, at each existing generation
   attempt's entry. If proof is lost, rebuild without the optional sections;
   do not regenerate evidence or add a provider attempt. Keep rebuilding bounded
   to a qualified build plus an omission build for an attempt.
   Assembly failures release the existing provider lock and propagate without
   becoming transport retries, provider-refusal observations or capability
   invalidations.
5. Preserve original candidate admission and parse inputs. Do not retain the new
   adapter in consensus/replay objects, history, HTTP responses, logs or caches.

This is loaded-snapshot consistency at the application prompt/generation
boundary. There is no new database freshness read. A database configuration
change not reflected in the loaded objects, or a change after generation entry,
is not detected by this witness. Existing downstream action checks remain
responsible for authorization. No provenance claim establishes accuracy,
uniqueness or correct classification.

## Verification and delivery

Use modular ESM contract/projection and adapter leaves. Verify genuine native and
compatibility results, copied/cross-item/changed/overflow proof, original
confidence preservation, label rules, hostile descriptors, exact display/byte
bounds and safe omission. Exercise mutation during provider/config/admission,
profile, prompt-builder and lock waits, including existing transient retries.

Use actual evaluator/production owner controls, production-factory isolated
PostgreSQL profile/evaluation reads and loopback HTTP with valid verification
provider capabilities. Assert existing unsupported-provider early refusal,
candidate-bound prompt/schema/response parsing, provider-call bounds and
route/learning safeguards. Demonstrate excluded caller behavior remains intact;
do not use paid providers or a live database.

Run focused tests first, fresh backend coverage and normal affected quality
gates. Reuse client coverage only after unchanged relevant source/config,
installed tree and report hashes are verified; keep meaningful existing
web/Discord/replay controls where affected. Apply local artifact maintenance
before heavy verification and at handoff, preserving current/recovery evidence.

Retain selected PR 589's settled compiler deferral while its artifact remains
unchanged. Refresh open PR state at delivery and rebase only a genuinely stale
applicable branch. Keep other dependency/security findings visible.

Record actual results and limitations in a separate outcome document, update
Unreleased, inspect the complete intended diff, then commit/push on main under
the user's existing authorization and inspect that commit's CI. Do not create
a branch, release or deployment. Add no UI, endpoint, schema, setting, job,
operator CLI trigger, provider call, live configuration write or historical
backfill.

## Recommendation stack

1. Deliver the bounded selection-only section and exact profile association.
   Benefit: genuine existing proof and minimal disclosure. Cost: less optional
   explanatory context, with model outcomes requiring regression controls.
2. Assess RAG recheck provenance next: fresh evaluation currently can coexist
   with an earlier context's breakdown/diagnostics. Do not solve that implicitly
   through this initial-call adapter.
3. Assess complete numeric signal/diagnostic provenance and adjudication advice
   separately before claiming the rest of the shared prompt is qualified.
4. Keep stronger verification admission/freshness policies separate from advice
   association, with their own call/resource/availability decisions.
