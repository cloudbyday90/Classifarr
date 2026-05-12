# SmartRuleForm Deprecation - Implementation Plan

## Objective
Retire legacy `SmartRuleForm` safely, without regressions in active Policy Engine workflows.

Primary safety requirement:
- Keep Policy Builder, Presets, and Tuning Suggestions fully intact.

## Scope

In scope:
- Deprecate and remove orphan `client/src/components/SmartRuleForm.vue`.
- Remove stale references/comments that imply active Rule Builder usage.
- Validate active policy UX and APIs remain unchanged.

Out of scope:
- Reintroducing Rule Builder routes.
- Changing policy scoring semantics or schema.
- Large UI redesign.

## Current Reality (Source of Truth)

1. No active Rule Builder route:
- `client/src/router/index.js` contains explicit comment that `/rule-builder/:libraryId` was removed.

2. No backend Rule Builder service/route remains:
- `server/src/routes/ruleBuilder.mjs` does not exist.
- `server/src/services/ruleBuilder.mjs` does not exist.

3. `SmartRuleForm.vue` exists but is not imported by active screens.

4. Active user workflows are:
- Policies: `client/src/views/PolicyList.vue` + `client/src/components/policies/PolicyBuilderModal.vue`
- Tuning: `client/src/views/TuningSuggestionsDashboard.vue`
- Library guidance: `client/src/views/LibraryDetail.vue`

## Capability Migration Matrix

| Legacy SmartRuleForm Capability | Current Replacement | Coverage | Deprecation Action | Enhancement Needed |
|---|---|---|---|---|
| Manual rule name/description/active editing | `PolicyBuilderModal` policy metadata + thresholds | Partial | Remove legacy surface | Optional: richer policy metadata UX in builder if users request rule-like labels |
| Condition builder (field/operator/value) | Policy preset signal customization in `PolicyBuilderModal` | Partial | Remove legacy condition UI | Optional: add advanced manual signal editor panel in Policy Builder |
| Preview matches (`previewLibraryRules`) | No direct policy-level preview UI | Gap | Keep API for now, remove only UI dependency | Add "Policy Impact Preview" (sample matches) in Policy Builder or Library detail |
| AI smart suggestions for rules | `PolicyBuilderModal` suggested presets + `LibraryDetail` rule suggestions + Tuning suggestions | Partial/Distributed | Remove duplicate legacy AI panel | Unify suggestion provenance messaging across Policy and Library screens |
| Pattern discovery and "Use selected conditions" | `LibraryDetail` suggestions and rule apply flow | Partial | Remove legacy pattern modal/card | Optional: bring dismiss/restore pattern controls into LibraryDetail if still needed |
| Dismiss/restore pattern filters | No clear active UI equivalent | Gap | Remove legacy-only controls | If this is still valuable, add to `LibraryDetail` suggestions panel before API cleanup |
| Create/update/delete library rules | `LibraryDetail` currently supports apply/delete from suggestions | Partial | Remove orphan create/edit form | Optional: add explicit edit/toggle actions in LibraryDetail only if legacy behavior is required |
| Rule analysis stats and "run analysis" utility | No direct UI equivalent | Gap (non-critical) | Remove legacy-only button | If required operationally, move to LibraryDetail tools or System diagnostics |

## API Impact Matrix

| API Method (client/src/api/index.js) | Used by Active UX | Used by SmartRuleForm | Initial Action |
|---|---|---|---|
| `getLibraryRules`, `addLibraryRule`, `deleteLibraryRule` | Yes (`LibraryDetail`) | Yes | Keep |
| `previewLibraryRules` | No known active consumer | Yes | Keep until post-removal validation, then re-evaluate |
| `getSmartSuggestions`, `getPatternSuggestions`, `getAvailablePatterns`, `dismissPattern`, `restorePattern`, `getDismissedPatterns` | No known active consumer | Yes | Keep in phase 1; candidate cleanup in phase 2 |

## Safe Execution Phases

### Phase 0 - Baseline Gate (No Removals)
Run baseline tests/build:
1. `npm --prefix client test -- src/__tests__/PolicyBuilderModal.test.js`
2. `npm --prefix client test -- src/__tests__/PolicyCard.test.js`
3. `npm --prefix client test -- src/__tests__/PresetSelectionModal.test.js`
4. `npm --prefix server test -- policies-routes.coverage.test.js`
5. `npm --prefix server test -- policies-api.test.js`
6. `npm --prefix server test -- presets-api.test.js`
7. `npm --prefix server test -- suggestions-api.test.js`
8. `npm --prefix client run build`

Phase 0 status (2026-02-25):
- `PolicyBuilderModal.test.js` passed (2/2)
- `PolicyCard.test.js` passed (29/29)
- `PresetSelectionModal.test.js` passed (21/21)
- Server policy/preset/suggestions gate passed (25/25 in targeted suite invocation)
- Client production build passed
- Result: ✅ Baseline green, safe to proceed to Phase 1

### Phase 1 - Remove Orphan UI Only
1. Remove `client/src/components/SmartRuleForm.vue`.
2. Confirm no import/reference remains.
3. Re-run full baseline gate.

Stop condition:
- Any policy/preset/tuning regression blocks merge.

Phase 1 status (2026-02-25):
- Removed `client/src/components/SmartRuleForm.vue`
- Runtime dependency check:
  - No `SmartRuleForm` imports/usages remain in `client/src` or `server/src`
  - Only non-functional legacy comments remain for rule-builder wording
- Post-removal baseline gate:
  - `PolicyBuilderModal.test.js` passed (2/2)
  - `PolicyCard.test.js` passed (29/29)
  - `PresetSelectionModal.test.js` passed (21/21)
  - Server policy/preset/suggestions gate passed (25/25)
  - Client production build passed
- Result: ✅ Phase 1 complete with no policy-flow regressions

### Phase 2 - Reference Cleanup
1. Replace stale comments that mention "Smart Rule Builder" in services/docs where misleading.
2. Keep behavior unchanged.

Phase 2 status (2026-02-25):
- Updated stale Smart Rule Builder comments in:
  - `server/src/services/scheduler.mjs`
  - `server/src/services/classification.mjs`
- Updated changelog deprecation record to include orphan `SmartRuleForm.vue` removal.
- Behavior impact: none (comment/documentation-only changes).

### Phase 3 - API Cleanup Candidates (Optional)
Only after real usage check and stakeholder sign-off:
1. Remove SmartRuleForm-only API wrappers from `client/src/api/index.js`.
2. Consider server endpoint cleanup only if confirmed unused by active workflows and external automation.

Phase 3 status (2026-02-25):
- Removed SmartRuleForm-only wrappers from `client/src/api/index.js`:
  - `getLibraryRule`
  - `updateLibraryRule`
  - `previewLibraryRules`
  - `getSmartSuggestions`
  - `getPatternSuggestions`
  - `getAvailablePatterns`
  - `refreshPatterns`
  - `dismissPattern`
  - `restorePattern`
  - `getDismissedPatterns`
  - `autoGenerateRules`
  - `autoGenerateAllRules`
  - `getLabelPresets`
- Verified no remaining client call sites for removed wrappers.
- Kept server endpoints intact for compatibility (no external automation break risk).
- Regression verification after cleanup:
  - `PolicyBuilderModal.test.js` passed (2/2)
  - `PolicyCard.test.js` passed (29/29)
  - `PresetSelectionModal.test.js` passed (21/21)
  - Server policy/preset/suggestions gate passed (25/25)
  - Client production build passed
- Result: ✅ Optional Phase 3 cleanup complete

## Regression Guardrails

Do not change during deprecation:
1. `PolicyBuilderModal` save payload structure.
2. Policy routes and policy schema behavior.
3. Preset selection/customization logic.
4. Tuning suggestion apply/reject flow.

## Verification Checklist (Post-Removal)

1. Create new policy from `PolicyList`.
2. Edit existing policy and save.
3. Add/remove presets and update custom signals.
4. Open Tuning Suggestions and apply/reject one suggestion.
5. Open Library detail and verify suggestions/rules panel loads.
6. Confirm no navigation path references Rule Builder.

## Rollback Plan

If regressions appear:
1. Restore `SmartRuleForm.vue` from previous commit.
2. Re-run baseline gate.
3. Re-attempt in smaller diff (UI removal only, then cleanup separately).

## Deliverables

1. Removal PR: orphan UI + tests/build proof.
2. Cleanup PR: stale comments/docs.
3. Optional API cleanup PR after usage validation.
