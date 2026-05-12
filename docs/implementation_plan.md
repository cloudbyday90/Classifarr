# implementation_plan.md - Phases 9 & 9.6

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

---

# Phase 9.6: Preset Viewer UX Improvements

## Goal
Reimagine the system preset viewing experience to eliminate UX confusion. Replace the confusing "View Details" modal (which showed disabled form inputs that looked editable) with a clean, read-only summary display using badges and chips.

## User Story
> As a user browsing system presets, when I click "View Details", I want to see a clean, read-only summary of the preset's configuration with clear visual indicators (not disabled form fields), so I can quickly understand what the preset does without confusion about whether I can edit it.

## Problem Statement
The current system preset "View Details" modal reuses `CustomPresetForm.vue` with `readonly=true`, which:
- Displays disabled checkboxes that appear clickable but aren't
- Shows dropdown menus that look interactive but are locked
- Creates user confusion: "Why can't I click this?"
- Doesn't communicate that system presets are immutable

## Solution: New PresetSummaryModal Component

### Component: `PresetSummaryModal.vue` (NEW)

**Purpose**: Read-only display of system preset configuration

**Layout**:
```
┌──────────────────────────────────────────────────────────┐
│  📺 Documentary                                      X   │
│  Documentaries and non-fiction.                          │
│  ─────────────────────────────────────────────────────── │
│  📊 Used in 3 policies                                   │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ┌─ Content Ratings ────────────────────────────────┐    │
│  │  Mode: Include                                   │    │
│  │  Allowed: [G] [PG] [PG-13] [TV-G] [TV-PG]       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ Genres ─────────────────────────────────────────┐    │
│  │  ✅ Preferred: [Documentary] [History]           │    │
│  │  ❌ Excluded:   (none)                           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ Keywords ───────────────────────────────────────┐    │
│  │  🔑 Preferred: [documentary] [real] [true story] │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  [Close]                              [✏️ Customize]     │
└──────────────────────────────────────────────────────────┘
```

**Features**:
- Header: Preset icon (large), name, description
- "Used in X policies" badge (queries `policy_presets` table)
- Content Ratings: Display mode + badges (not checkboxes)
- Genres: Chips with ✅ (preferred) and ❌ (excluded) icons
- Keywords: Tag-style chips (not input fields)
- Footer: "Close" (left) + "Customize" button (right)

**Props**:
- `modelValue: Boolean` - v-model for open/close
- `preset: Object` - the preset to display

**Events**:
- `@customize` - Emitted when user clicks "Customize" button

### Component Modifications

#### `CustomPresetForm.vue` (MODIFY)

**New Prop**:
- `sourcePreset: Object` - When provided, pre-populate form with this preset's data (for customization flow)

**Modal Title Logic**:
```javascript
const modalTitle = computed(() => {
  if (readonly) return 'Preset Details'
  if (sourcePreset) return `${sourcePreset.name} (Custom Preset)`
  if (isEditing) return 'Edit Custom Preset'
  return 'Create Custom Preset'
})
```

**Form Pre-population**:
When `sourcePreset` is provided and modal opens, copy all fields:
- `name`, `description`, `icon`, `category`
- All `signals` (certifications, genres, keywords)

**Save Button Text**:
- When customizing: "Create Preset" (not "Update")
- When editing: "Update Preset"
- When creating: "Create Preset"

#### `PresetsManager.vue` (MODIFY)

**New State**:
```javascript
const showSummaryModal = ref(false)
const viewingPreset = ref(null)
const customizingPreset = ref(null)
```

**Handler Changes**:
```javascript
// For system presets
function openViewModal(preset) {
  viewingPreset.value = preset
  showSummaryModal.value = true
}

// Handle customize action
function handleCustomize(preset) {
  // Close summary modal
  showSummaryModal.value = false
  viewingPreset.value = null
  
  // Open form with sourcePreset
  customizingPreset.value = preset
  showPresetForm.value = true
}
```

**Save Handler Enhancement**:
```javascript
async function handleSavePreset(presetData) {
  const isCustomizing = !!customizingPreset.value
  
  // ... save logic ...
  
  if (isCustomizing) {
    toast.success(`Custom preset '${presetData.name}' created!`)
    activeTab.value = 'custom' // Auto-switch tab
  }
}
```

### Backend API

**New Endpoint**: `GET /api/policies/presets/:presetId/usage`

**Purpose**: Return count of policies using this preset

**Query**:
```sql
SELECT COUNT(*) FROM policy_presets WHERE preset_id = $1
```

**Response**:
```json
{ "count": 3 }
```

## UI Flow Diagram

```
System Preset Card
     │
     ├─→ [View Details] Button
     │        │
     │        ▼
     │   PresetSummaryModal
     │        │
     │        ├─→ [Close] Button → Close modal
     │        │
     │        └─→ [Customize] Button
     │                 │
     │                 ▼
     │        CustomPresetForm
     │        (sourcePreset populated)
     │                 │
     │                 ├─→ [Cancel] → Close form
     │                 │
     │                 └─→ [Create Preset]
     │                          │
     │                          ▼
     │                    Save to database
     │                          │
     │                          ├─→ Show success toast
     │                          ├─→ Switch to "Custom Presets" tab
     │                          └─→ Refresh custom presets list
```

## Verification Plan

### Manual Testing Checklist
1. ✅ Navigate to Presets → System Presets tab
2. ✅ Click "View Details" on any system preset
3. ✅ Verify summary modal shows:
   - Clean read-only display (badges, chips - NOT form inputs)
   - "Used in X policies" count in header
   - Content ratings as badges
   - Genres as chips with ✅/❌ icons
   - Keywords as tag chips
4. ✅ Click "Customize" button
5. ✅ Verify form opens with:
   - Modal title: "[Preset Name] (Custom Preset)"
   - All fields pre-populated from system preset
   - Save button text: "Create Preset"
6. ✅ Modify the name (e.g., add "My " prefix)
7. ✅ Click "Create Preset"
8. ✅ Verify:
   - Success toast: "Custom preset 'My [Name]' created!"
   - Auto-redirected to "Custom Presets" tab
   - New custom preset appears in list
9. ✅ Verify system preset remains unchanged

### Regression Testing
- Verify custom preset edit flow still works
- Verify custom preset create flow still works
- Verify custom preset delete flow still works
- Verify preset selection in policies still works

## Implementation Files

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/presets/PresetSummaryModal.vue` | CREATE | New read-only summary modal |
| `client/src/components/presets/CustomPresetForm.vue` | MODIFY | Add sourcePreset prop and customization logic |
| `client/src/views/PresetsManager.vue` | MODIFY | Add summary modal and customize handler |
| `client/src/api/presets.js` | MODIFY | Add getPresetUsageCount() method |
| `server/src/routes/policies.mjs` | MODIFY | Add GET /presets/:id/usage endpoint |
| `docs/task.md` | MODIFY | Add Phase 9.6 checklist |
| `docs/implementation_plan.md` | MODIFY | Add this Phase 9.6 section |
| `CHANGELOG.md` | MODIFY | Document Phase 9.6 changes |
| `RELEASE_NOTES.md` | MODIFY | Add user-facing description |
| `client/package.json` | MODIFY | Bump version to 0.38.0 |
| `server/package.json` | MODIFY | Bump version to 0.38.0 |
| `client/src/components/layout/Sidebar.vue` | MODIFY | Update version display |
