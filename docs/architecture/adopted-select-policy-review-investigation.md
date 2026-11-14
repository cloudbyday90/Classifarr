# Adopted select-policy review investigation

November 14, 2026 (America/New_York). Read-only findings at main
`1bfe27f4991d98d95f1d1236f02b9365c9cf3f00`. These are pre-change findings.
The user subsequently confirmed the complete select-only v2 batch, explicit
destination choice and prospective clearing of inherited verification status.
See the separate [design](adopted-select-policy-review-design.md) and
[observed outcome](adopted-select-policy-review-outcome.md).

## Reproduced source mismatch

Production gate, candidate, comparison/resolution, apply, question and answer
contract helpers reproduce this using synthetic data without database/provider
calls:

| Field | Current value |
| --- | --- |
| Fresh adopted policy action | `prompt_select` |
| Finally retained destination | B / 101 |
| Retained outcome confidence | 80 |
| Fresh overall policy confidence | 75 |
| Fresh leading policy score | B / 70 |
| Saved current-policy frame | Absent |
| Pending recommendation/score | Original A / 2001 / 80 |
| Decision status | `destination_selection_required` |
| Automatic route | Blocked |

The selected policy candidate is current, but review falls back to original
metadata because there is no attempted frame. The source and actual-stage guards
in `adoptedRagCurrentPolicyReview.mjs` admit prompt-confirm only. The existing seed
already captures select mechanics, but the recorded-frame validator also accepts
prompt-confirm only.

Same-action select reevaluation can pass the existing significant-improvement
gate. A true adopted gate constructs a `policy_recheck` candidate. The AI stage
then takes its existing policy-only short circuit and returns the same object
without a new AI invocation. Final comparison/conflict checks and exact apply
selection after rollout still govern publication.

## Evidence versus explicit selection

Admitting the select frame alone is insufficient. The shared review reference
can turn a unique positive numeric leader into a primary recommendation without
inspecting the select action. Decision presentation independently reports that
selection is required, so a primary Confirm shortcut can contradict that status.

The proposed first boundary retains the fresh leader as technical policy
evidence while withholding the primary destination and bulk-confirm shortcut.
Missing/changed proof becomes an explicit gap instead of reviving original or
question metadata. Existing tie, invalid-source, permitted-question membership
and route-safety safeguards remain applicable.

The generic `confirm_destination` command already means an explicit choice of
a permitted candidate ID, including when there is no primary recommendation.
Disabling it wholesale would change existing selection and Discord semantics.
Keep that command separate from the primary shortcut, with its normal server-side
validation and completed-answer recovery. No evidence frame supplies missing
operator intent or permits automatic routing.

## Version and lifecycle decision

Version 1's recorded definition accepts `prompt_confirm`. Expanding its action
enum would make previously unsupported v1 select payloads become valid. A new
select-only version can preserve v1 exactly, with recorded select restricted to
the actual `policy_recheck` method. Old runtimes reject the unfamiliar version;
the present-frame reader then treats it as unavailable rather than using original
policy evidence. There is no observed need for a global version bump that changes
new prompt-confirm frames too. The user confirmed the select-only v2 contract.

Reuse the existing immutable seed, live numeric witness, exact stage/gate/
candidate association, final apply publisher, owner-copy transfers and row-bound
INSERT. Preserve complete ranking up to 64 candidates, five detailed projections,
64-KiB frame and 64-candidate/64-library/16-KiB live proof. Keep History lifetime,
restore behavior, deletion and portable-backup boundaries unchanged.

Select result context/advisory ownership is a separate change. The user separately
confirmed clearing inherited candidate-bound verification status on new select
candidates: that prevents an earlier confirmation beside fresh evidence and
removes those inherited statuses from future History verification aggregates.
Historical rows, genuine provider observations and restrictive authority remain
unchanged. Initial,
non-adopted, generic, legacy, automatic/manual actions and historical rows should
remain outside this first evidence batch. Scoring, provider calls/accounting,
comparison/rollout and routing/learning authorization retain their existing rules.

## Verification requirements

Positive tests must produce select before the live evaluation capture finishes.
The existing recovery fixture hardcodes confirm; mutating its result action
afterward invalidates the genuine witness and only proves a gap. Use real
two-candidate close-score evaluation or a fixture decision injected before capture,
then the actual stage/owner flow.

Cover native/compatibility sources, same/different destination, unique/tied/rounded
leaders, duplicate-library policies, question membership, bounds, copied/offline/
action-mutated sources, latched loss, apply/shadow/conflict rejection and rollout/
writer mutations. Verify current technical evidence with no primary/bulk shortcut,
explicit candidate actions and zero extra AI calls. Exercise actual PostgreSQL
INSERT/load, BIGINT binding, concurrency/rollback/lost acknowledgement, stale web/
Discord fingerprints and completed-answer replay. Preserve existing confirm,
forced-gap and fulfilled-verification controls.

## Official research and trade-offs

Sources were rediscovered and read through GitHub/web MCP on November 14.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes source usage, generated
output and derivation. Provenance can associate a recommendation with its inputs;
it does not establish the user's later choice or permission. This is an
application-specific inference from those distinctions.

[OWASP output handling](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html)
requires matching subject/action/resource/context and controlled reuse.
[OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
supports understandable significant action data and server-side enforcement.
These sources do not prescribe an additional confirmation ceremony or choose
Classifarr's defaults. Current evidence, explicit destination choice and actual
authorization should remain distinct.

[W3C's WCAG 2.2 keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard)
supports preserving keyboard operation through the existing disclosure and
destination buttons. The browser controls exercise focus and keyboard activation
at narrow widths; this is scoped evidence, not a claim of full WCAG conformance.

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep absent-frame behavior | No new action contract | Review can recommend original A after B is retained |
| Admit select without primary-reference handling | Shows current mechanics | Can expose a Confirm shortcut despite required selection |
| Bound current select evidence with explicit selection | Current evidence and action meaning agree | New version handling, fingerprints and compatibility tests |

Recommended stack: successful live select evaluation, exact private association,
action-specific bounded frame or gap, apply-only publication, transactional row
binding, shared technical review reference without a primary shortcut, explicit
server-validated destination choice and completed-answer replay.

## PR intake

At 14:38 UTC / 9:38 a.m. Eastern, the current open-PR collection is empty.
There is no eligible random selection or applicable stale Dependabot branch.
Closed PRs are not reused. Shared scope is confirmed; implementation adds no
release, deployment, new page or operator CLI trigger.
