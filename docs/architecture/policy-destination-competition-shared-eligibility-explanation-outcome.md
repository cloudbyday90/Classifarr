# Policy Destination Competition Shared-Eligibility Explanation Outcome

Implemented: 2026-08-29.

## Delivered

The existing destination-competition preview now includes a **Why shared
eligibility may occur** card. When the bounded cohort contains shared eligible
items, it can list an allow-listed declared-purpose category found in the draft
and in anonymous active competitor configurations.

The card returns category labels and anonymous configuration counts only. It
does not reveal names, IDs, rule values, operators, weights, titles, media
records, individual evaluator outcomes, or AI/provider state.

## Interpretation

- “Genre-based declared purpose in two anonymous active competitor
  configurations” means that category exists on both sides; it does **not**
  prove matching genre values or identify a destination.
- No categories are returned when no shared eligibility exists.
- A shared result without a common listed category remains possible when the
  draft and an active competitor use different purpose categories to match the
  same historic item.
- The explanation is advisory only. It cannot rank policies, select a route,
  persist a draft, change learning, or call AI.

## Operator Workflow

1. Run **Preview destination competition** on the current unsaved draft.
2. If shared eligibility is non-zero, read the explanation card as a review
   prompt—not proof of a configuration conflict.
3. Narrow the draft's declared purpose or add an appropriate constraint only
   when that reflects the intended destination.
4. Rerun the preview after changing the draft; stale explanatory output clears
   with the existing preview result.
5. Save only after the policy intent is correct. Normal policy selection and
   routing remain unchanged.

## Verification

Dedicated pure-module, preview-service, integration, Vue component, and
inventory tests verify the allow-list, no-shared suppression, anonymous counts,
raw-data omission, accessibility structure, and maintenance-only presentation
cutline. Final quality-gate and security-review results are recorded with the
implementation commit.

## Follow-up

The next high-value item is to make the shared-eligibility explanation
**coverage-aware**: add one aggregate note that distinguishes a full
competitor comparison from a capped comparison, while still revealing no
destination, rule, or media identity.
