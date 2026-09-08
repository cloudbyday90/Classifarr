# Held-out semantic non-pending decision partition outcome

Status: implemented, unreleased. See the separate
[design](held-out-semantic-not-pending-decision-partition-design.md) for the
architecture, research, alternatives, and recommendation stack.

## Delivered

- Added an opt-in, ephemeral fixed evaluator-stage state to the restricted
  held-out path. Normal policy evaluation receives no new output or API
  surface.
- Added a pure ESM aggregate partition for valid
  `not_pending_policy_decision` contracts. Its counts reconcile exactly to the
  existing comparison-eligibility partition and a disagreement fails the audit
  closed.
- Advanced the read-only eligibility-audit receipt to v6. Earlier receipts are
  refreshed only by the existing source and evidence gates.
- Added focused tests for stage capture, fixed partition membership,
  contradictory observations, audit reconciliation, and the current receipt
  version.

## Measured local outcome

A no-cache local Compose rebuild completed on 8 September 2026. The rebuilt
private read-only audit completed with status `complete` over 6,641 canonical
candidates:

| Aggregate result | Count |
| --- | ---: |
| Valid policy-only comparisons | 0 |
| `not_pending_policy_decision` | 6,641 |
| `no_qualifying_policy_evaluations` | 6,641 |
| Other non-pending partition reasons | 0 |
| Eligible cases in every stratum | 0 |

The result explains the earlier `manual:none` observation precisely: after the
restricted evaluator excluded profile-derived purpose, compatible active
policies yielded no qualifying policy evaluation. It is not an identity
failure, a missing media-type policy, an AI/provider failure, a semantic
retrieval result, or an automatic-routing outcome.

The source screen independently reported ten active policies, 15
profile-derived purpose rules, zero retained declared-purpose rules, and the
fixed status `all_purpose_rules_excluded_as_inferred_profile`. The two
aggregate receipts agree without identifying a policy, library, provider,
configuration value, media item, rule, score, or human label.

No cohort was captured. No labels, readiness evaluation, frozen-study
preflight, semantic selection, provider call, policy change, or media routing
ran.

## Verification

Focused server tests cover the new partition and evaluation-stage behavior.
The no-cache Compose rebuild completed successfully; its service reached the
configured container health endpoint. The real audit output is retained only
in ignored local temporary storage. A final verified image rebuild follows the
commit so the image provenance can bind to the resulting revision.

The official repository has no open pull requests, so no random PR could be
implemented locally. [Open pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

## Next item

There is no safe automation that can manufacture the missing declared-purpose
evidence. The next platform event is a separately governed native-purpose
revision. The existing passive source-transition lifecycle gate will then
refresh the audit without case selection or configuration-specific operator
work. Only a future receipt with policy-only comparisons in every required
stratum may enter the existing 24–32-case capture and independent-label
workflow.
