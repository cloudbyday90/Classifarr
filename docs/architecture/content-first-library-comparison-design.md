# Content-first library comparison design

## Previous work and purpose

Commit `30e67cc1` compared 57 placement disagreements and 57 matching controls.
Removing library names recovered agreement on 21 cases but lost six controls;
changing retrieved examples alone recovered nine and lost four. That selected
case/control result cannot establish performance across all 300 sampled titles.

The next component evaluates ordinary named and anonymous-label prompts for
every title in the same cohort, regardless of its baseline result. This tests
whether Classifarr can understand library contents without depending on naming
conventions. It does not remove explicit user policies from production.

## Research and alternatives

Official sources were discovered through online search and opened September 12,
2026. August 2026 is the requested baseline; live pages are not claimed to be
archived August versions. The cited versioned grouping documentation predates it.

- Preserve groups across training/test boundaries, as described in the official
  [GroupKFold documentation](https://scikit-learn.org/1.5/modules/generated/sklearn.model_selection.GroupKFold.html).
  Here the group is an identical description, not an entire library; the existing
  library-balanced fold planner is retained, not replaced with a Python library.
- Keep retrieved strings untrusted, bound context and calls, validate outputs and
  separate model proposals from authorization, following
  [OWASP RAG guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html).
- Avoid adding a noisy status panel. If results later appear in Command Center,
  use concise, programmatically identifiable updates without moving focus, per
  [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

| Option | Pros | Cons |
| --- | --- | --- |
| Globally hide names now | Immediately removes name dependence | Selected controls already regressed; not justified |
| Add more retrieved examples | Simple configuration change | Previous 30/100-example trials showed no aggregate benefit |
| Full-cohort paired comparison | Measures all gains/losses and small-library effects | Additional local inference; still measures placement agreement, not truth |
| Add a settings toggle or declaration form | Manual control | More user involvement without resolving the evidence gap |

Choose the full-cohort paired comparison, keeping the nine-example baseline and
current runtime behavior. No additional dependency, UI, migration or model is needed.

## Design

Add `--content-first-comparison` to the existing benchmark CLI. Require grouped
folds and reject combination with either investigation mode before loading
configuration. Reuse the existing snapshot, shortlist, metadata learning, prompt,
strict proposal parser and local-only model client.

Run both arms for every requested case, alternating which arm runs first. Freeze
candidate IDs/order, query, examples and model parameters within each pair.
The only prompt change is replacing library names with numbered labels. Never
include observed placement, previous answers or evaluation results in prompts.
Maximum generation work is two calls per case, 600 for 300 cases. No retries,
paid fallback or model downloads. Cancellation interrupts later work.

Extract the existing contrastive runner's single-comparison execution into a
small shared ESM module, retaining its statuses and reporting behavior. Keep the
new paired report and runner in separate modules. Reject malformed candidate
scope or held-out description leakage before any generation call.

Report total and per-media/per-library agreement, paired gains, losses, unchanged
agreements/disagreements, changed proposals, abstentions, failures and missing
pairs. Technical failures cannot count as semantic gains or losses. Per-library
rows use membership: shared items can appear in multiple rows, while the total
counts each case once. Incomplete or zero-sample rows remain explicit.

Add optional canonical snapshot component digests for descriptions/memberships,
libraries, vectors and candidate metadata. Hash each sorted record with stable
object-key ordering. Do not change the legacy snapshot fingerprint or expose
individual content hashes, names, descriptions or raw vectors. These digests
localize future mismatches; they cannot reconstruct the cause of a past mismatch.

## Security, measurement and recommendation stack

Keep database reads bounded and repeatable-read/read-only. All provider calls
remain on the configured installed local model. Model text stays private and is
accepted only as a valid listed candidate number or abstention. No routing,
policy writes, verified labels, media moves or user questions are introduced.

This cohort has already informed the proposed treatment; it is a development
evaluation, not an untouched final test set. Observed placement is weak evidence,
not independent ground truth. Do not present its agreement rate as accuracy or
automatically train on the model's answers.

Recommendation stack: **learned inventory profiles + bounded retrieval → paired
content-first evaluation → fresh held-out and trustworthy outcome validation
→ evidence-backed production adoption**. Document actual measurements in the
separate outcome document before choosing the following component.

Tests cover paired accounting, all-case selection, rotating order, scope/holdout
validation, failure/cancellation handling, bounded calls, report privacy,
canonical digests, unchanged legacy behavior and read-only PostgreSQL integration.
