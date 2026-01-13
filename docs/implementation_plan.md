# implementation_plan.md - Phase 9

# Phase 9: Frontend - Custom Presets Manager

## Goal
Implement a dedicated user interface for managing Custom Presets. This allows users to create, unlimited custom presets with specific signal weighting configurations (Content Ratings, Genres, Keywords) that can then be applied to any policy.

## User Review Required
> [!NOTE]
> The Backend API for Custom Presets (`GET/POST/PUT/DELETE /api/presets/custom`) was already implemented in Phase 6. This phase is purely Frontend.

## Proposed Changes

### Frontend Components

#### [NEW] `src/views/PresetsManager.vue`
- **Purpose**: Main list view for all presets (System + Custom).
- **Features**:
  - Tabbed interface: "System Presets" (read-only) vs "Custom Presets" (editable).
  - "Create New Preset" button.
  - Cards/Grid showing preset icon, name, and summary of signals.
  - Edit/Delete actions for custom presets.

#### [NEW] `src/components/presets/CustomPresetForm.vue`
- **Purpose**: Form to create/edit a custom preset.
- **Fields**:
  - Name (required)
  - Description
  - Icon (emoji picker or select)
  - **Signal Configuration**:
    - Weight Sliders (Comfort, Plot, Visuals, etc.)
    - Content Rating Rules (Allow/Block items)
    - Genre Rules (Prefer/Exclude)
    - Keyword Rules (Must Contain/Must Not Contain)

#### [MODIFY] `src/components/layout/Sidebar.vue`
- Add "Presets" navigation item under "Configuration" or top-level.
- Icon: `SwatchIcon` or similar.
- Route: `/presets`

#### [MODIFY] `src/router/index.js`
- Register `/presets` route pointing to `PresetsManager.vue`.

## Verification Plan

### Automated Tests
- **E2E (Cypress)**:
  - Create a new custom preset "My Family Safe".
  - Verify it appears in `PresetSelectionModal`.
  - Edit the preset.
  - Delete the preset.

### Manual Verification
1. Navigate to "Presets".
2. Click "Create".
3. Fill details and save.
4. Go to "Policies".
5. Open a policy, click "Add Presets".
6. Verify the new custom preset appears in the selector.
