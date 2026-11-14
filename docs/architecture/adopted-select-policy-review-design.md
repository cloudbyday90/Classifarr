# Adopted select-policy review design

November 14, 2026 (America/New_York). Agreed complete batch after the two
confirmed behavior decisions and final shared-scope agreement. Base:
main `1bfe27f4991d98d95f1d1236f02b9365c9cf3f00`. See the separate
[investigation and official research](adopted-select-policy-review-investigation.md).

## First consumer

Cover new, genuinely adopted `prompt_select` policy candidates that win final
apply selection and enter the existing normalized pending-review flow. Their
current policy evaluation supplies technical destination, score, thresholds,
cards and comparison evidence. Their selection-required action must not become
a primary Confirm offer or a bulk-confirm default.

The generic explicit candidate command remains available under its existing
server-validated destination-ID contract. Choosing a permitted candidate is
distinct from accepting a primary recommendation. Preserve normal manual
selection, authorization, stale-answer rejection and completed-receipt recovery.
Add no new operator workflow, page or CLI trigger.

## Versioned evidence and private ownership

Keep existing `policy.current_review.v1` production and validation unchanged for
prompt-confirm frames and existing gaps. Introduce select-only
`policy.current_review.v2` for the new consumer, including its explicit gaps.
Recorded v2 requires action `prompt_select` and method `policy_recheck`; v1 select,
v2 confirm/automatic/manual and unknown versions remain unsupported. This avoids
reinterpreting formerly rejected stored v1 bytes. Older readers reject v2 as a
present invalid frame and do not revive original-policy or question fallback.

Reuse the existing review-only live witness, seed and actual-stage association
at successful reevaluation completion, before adoption callbacks. Capture the
primitive source action and recheck it with exact policy result, typed item,
native/compatibility provenance, revision, loaded active/media-compatible pool,
actual successful gate and retained candidate library/method/confidence.
The frozen seed's action must agree with that source. Do not infer proof from
equal public objects, imported/replayed metadata or current configuration.

Register a version-bound attempted receipt before fallible candidate inspection.
Missing, copied, offline, overflowing or changed proof yields a v2 gap. Bind the
version in private receipt state, preserving it through publication and the
existing owner copies; do not choose a version later from mutable metadata.
Observed source loss remains latched even if values are restored.

Preserve the complete 64-candidate ranking, five closed detail projections, six
score components and 64-KiB frame. The live witness remains bounded to 64
candidates / 64 libraries / 16 KiB. Keep existing unknown purpose categories when
genuine immutable purpose evidence is absent. Add no raw rule, diagnostic body,
provider prose, credential or new private-data disclosure.

Use small existing ESM contract/live/reference leaves and a small dedicated
helper if version/action dispatch warrants it. Do not grow the orchestration
singleton or mix this evidence ownership with invocation authority.

## Publication, storage and retention

The existing AI-stage select short circuit stays unchanged: no verification,
provider permission, profile lookup, cap bypass or additional AI call is added.
Existing weak-anchor/conflict/comparison/rollout gates still decide final apply.
Only exact selected-candidate publication after fulfilled rollout can produce the
current frame; shadow, rejected and failed owner processing cannot publish it.

Reuse current copy transfers, writer entry/post-derivation/pre-INSERT checks and
canonical row-ID binding in the existing INSERT transaction. Version remains
bound to its receipt even when inspection or binding fails. Keep History-row
lifetime, configuration-restore behavior, deletion and portable-backup exclusion.
Preserve original `metadata.policyResult`; add no query, schema, retention job,
saved aggregate or historical rewrite.

## Technical reference and explicit choice

Suppress the primary destination in the shared review reference only for a
validated current select source. Retain coherent technical policy reference and
score; preserve existing tie, duplicate-library, unavailable-source and
permitted-question-membership behavior. A present gap/invalid frame cannot fall
back to original or question evidence.

Use the existing manual-selection recommendation shape and a fixed bounded
selection-required reason. Add that reason to the client's primary-recommendation
rejection rules so an inconsistent primary response is not accepted. Keep public
answer/recommendation versions and fields unchanged; the new frame version is
server metadata. The existing decision status remains
`destination_selection_required`.

Existing web controls offer destination choices without the primary Confirm
button; Confirm All skips an item without a leading destination. Both Discord
paths retain explicit destination buttons without a promoted primary. Do not
disable the generic candidate command or change its confirm/change semantics.
Preserve native-question behavior and other action paths outside this consumer.

Fresh mechanics and presentation change new answer fingerprints and Discord
custom IDs. Recover an exact completed receipt before current validation; do not
upgrade receipts, add another vote or replay an uncertain outcome.

## Prospective verification status

When constructing a new adopted select policy candidate, clear only inherited
`candidate_bound_verification`, as separately confirmed. No verification ran for
this candidate. Future History verification counts and abstention telemetry must
therefore exclude the old status. Preserve historical rows, original baseline,
genuine provider observations, invocation counts, restrictive authority and all
other support fields.

Select `signalContext` and `ai_advisory` ownership remains unchanged. Prompt-confirm
construction cleanup, current fulfilled verification outputs and existing forced
gaps retain their own contracts. Do not clear authority or broaden route/learning
permission. Outcome maximum confidence, policy scoring/ranking, thresholds,
selection and retry/cancellation/budget/ownership rules remain unchanged.

## Verification and delivery

Pin v1 select rejection before extending readers; verify select-only v2 recorded
and gap payloads, cross-version/action/method rejection, old-reader fail-closed
behavior, row/typed-item/BIGINT binding, unknown versions, bounds, inspection
failures and no legacy fallback. Positive select fixtures must mint that action
before evaluation capture completes, not mutate a confirm result afterward.

Exercise real native/compatibility evaluation and owner paths: current leader
versus original, same/different destination, unique/rounded-tied leaders,
duplicate-library policies, copied/offline/action-mutated sources, restoration
after observed loss, apply/shadow/conflict rejection and rollout/writer waits.
Prove zero new AI calls and unchanged provider accounting and route/learning
authorization. Keep prompt-confirm, automatic/manual exclusions, native questions
and construction-owned context controls.

Use production-factory isolated PostgreSQL for actual INSERT/load, preserved
original evidence, CBV aggregate exclusion, concurrency/rollback/delayed or lost
acknowledgement, stale HTTP answers and exact completed replay. Test client
normalization, forged-primary refusal, no primary/bulk shortcut, explicit choice
of permitted alternatives, both Discord paths and keyboard/mobile behavior.

Run fresh backend and client coverage, normal type/lint/dependency/ownership/
security gates, client build and affected browser checks. Keep assertions,
deadlines, review caps and scanner policy intact. Maintain verified development
artifacts, keep design/observed outcome separate, update Unreleased, commit/push
all intended changes on main and inspect exact-source CI.

No release, deployment, live configuration write, new provider call, endpoint,
public field, setting, scheduled job, operator CLI trigger or historical inference
is included. No open PR is available at intake; recheck at delivery without
reusing closed PRs or unnecessarily rebasing fresh branches.

## Trade-offs and recommendation stack

Current select evidence removes the original/current destination mismatch while
preserving an explicit operator choice. A select-only version preserves old v1
meaning and gives older readers a safe unavailable state. Costs are version
dispatch, new fingerprints, intentional prospective verification-count changes
and compatibility tests. Broader select support cleanup and automatic-action
frames remain separate follow-ups.

Recommended stack: genuine live select evaluation, exact private action-bound
receipt, bounded v2 frame or gap, apply-only publication, transactional row
binding, shared technical reference without a primary shortcut, explicit
server-validated destination choice and completed-answer recovery. All behavior
decisions were confirmed before runtime implementation.
