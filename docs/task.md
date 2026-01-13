# v0.38.0-alpha Task Checklist

## Phase 1: Current Implementation Analysis ✅
- [x] Document current PolicyList.vue structure
- [x] Document current PolicyBuilderModal.vue structure
- [x] Document current library creation flow
- [x] Identify all files requiring modification

## Phase 2: Database Migration ✅
- [x] Create `051_custom_presets.sql` migration
  - [x] custom_presets table
  - [x] Unique constraint on library_policies.library_id
  - [x] Auto-create policies for existing libraries
- [x] Note: content_presets is in migrations, so custom_presets follows same pattern

## Phase 3: Backend - Auto-Create Policy ✅
- [x] Modify library creation to auto-create blank policy (`mediaServer.js`)
- [x] Modify policy delete to auto-recreate blank policy (`policies.js`)
- [x] Unit tests (`policies-api.test.js` - 17 passed)

## Phase 3a: Backend - Startup Policy Generation ✅
- [x] Add startup hook to check libraries without policies (`index.js`)
- [x] Auto-create blank policies on Docker restart
- [x] Log policy generation activity

## Phase 4: Backend - Preset Suggestions API ✅
- [x] GET /api/policies/presets/suggest/:libraryId
- [x] Fuzzy matching algorithm (key, name, genres, description)
- [x] Unit tests (4 new tests - all passed)

## Phase 5: Backend - Custom Presets API ✅
- [x] CRUD endpoints for custom presets (`routes/presets.js`)
- [x] Unit tests (15 new tests - all passed)

## Phase 6: Frontend - Policy Card & Preset Selection Modal (Completed)
  - [x] Create `PresetSelectionModal.vue` (`client/src/components/policies/PresetSelectionModal.vue`)
    - [x] Show read-only library context
    - [x] Implement "Suggested" section (call new API)
    - [x] Implement "Browse" with category tabs
    - [x] Search & Multi-select grid
    - [x] Add info pop-out tooltip with usage hints
  - [x] Display Combined Preset Signals with attribution:
    - [x] Update `PolicyBuilderModal.vue` to show `(Preset Name)` next to signals in individual view
    - [x] Update `PolicyBuilderModal.vue` to show `(Count)` and tooltip source list in combined summary view
    - [x] Refactor `combinedSignals` to support attribution tracking

## Phase 7: Frontend - Policy UX Changes (Completed)
  - [x] Modify `PolicyList.vue`:
    - [x] Remove manual "Create/Add Policy" buttons (policies are auto-managed)
    - [x] Integrate `PresetSelectionModal` for "Add Presets" action
    - [x] Update Delete handler to "Reset Policy"
  - [x] Modify `PolicyCard.vue`:
    - [x] Add empty state with "Add Presets" CTA
    - [x] Rename "Delete" to "Reset"
  - [x] Modify `PolicyBuilderModal.vue`:
    - [x] Replace inline preset grid with "Add Presets" button launching `PresetSelectionModal`
    - [x] Implement `addPresets` handler

## Phase 8: Backend Integration & Verification (Completed)
  - [x] Ensure `PresetSelectionModal` uses `GET /api/policies/presets/suggest/:libraryId` correctly
  - [x] Ensure correct filtering of existing presets
  - [x] Verify "Reset" flow matches backend `DELETE` logic (auto-recreate)

## Phase 9: Frontend - Custom Presets Manager
  - [x] Create `PresetsManager.vue` (list view for custom presets)
  - [x] Create `CustomPresetForm.vue` (create/edit custom preset)
  - [x] Add "Presets" to Sidebar navigation
  - [x] Integrate with `PresetSelectionModal` (allow creating new preset from selector?)

- [x] Phase 9.5: Pre-Release Testing (Completed)
  - [x] Run full integration test suite (Verified relevant tests: policies, presets, suggestions)
  - [x] Verify no regressions (Passes on relevant modules)
  - [x] Fix race condition in library sync (FK violation)
  - [x] Fix crash in Clear & Resync (Removed deprecated `runPatternAnalysis` call)
  - [ ] Rebuild Docker and verify startup (User to perform)

## Phase 10: RAG Visualization
- [ ] Store RAG matches in classification metadata
- [ ] Create `RagMatchesPanel.vue`
- [ ] Integrate into history detail

## Phase 10: Documentation & Release
- [ ] CHANGELOG.md (technical)
- [ ] RELEASE_NOTES.md (high-level)
- [ ] Version bump to 0.38.0
- [ ] Docker build
- [ ] Git tag, push, release
