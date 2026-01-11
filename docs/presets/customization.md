# Preset Customization Guide

## Overview

Classifarr v0.37.2 introduces **inline preset customization**, allowing you to modify preset signals directly within the Policy Builder without navigating away from the modal.

## How It Works

### Selecting Presets

1. Open the **Policy Builder** modal (create or edit a policy)
2. Browse or search available presets
3. Click a preset card or its checkbox to select it
4. Selected presets appear in the "Selected Presets" section

### Customizing a Preset

Each selected preset has a **"▼ Customize"** button:

1. Click **"▼ Customize"** to expand the customization panel
2. You can expand multiple presets simultaneously
3. Click **"▲ Close"** to collapse

### Editing Signals

#### Content Ratings
- **View**: See all content ratings from the base preset (e.g., G, PG, PG-13)
- **Remove**: Click the **✕** on any rating to exclude it
- **Restore**: Removed ratings show crossed-out with **↩** to restore
- **Add**: Use the "+ Add" dropdown to add custom ratings

#### Genres
- **Preferred Genres**: Genres that increase match score
- **Excluded Genres**: Genres that decrease match score
- **Add/Remove**: Same controls as content ratings

#### Keywords
- **Excluded Keywords**: Keywords that should flag content
- **Add Custom**: Type a keyword and press Enter
- **Remove**: Click ✕ on any keyword

### Visual Indicators

| Icon | Meaning |
|------|---------|
| `✕` | Click to remove/exclude |
| `↩` | Click to restore removed signal |
| `+` | Custom addition (not from base preset) |
| Blue tag | Custom addition |
| Crossed-out | Removed from base preset |

## Combined Signals Summary

When you select **2 or more presets**, a "Combined Signals" section appears showing the merged result:

- **Content Ratings (included)**: Union of all ratings across presets
- **Preferred Genres**: All preferred genres combined
- **Excluded Genres**: All excluded genres combined  
- **Preferred Keywords**: Keywords to favor
- **Excluded Keywords**: All keywords to flag
- **Required Keywords**: Keywords that must match

This combined view respects:
- Signal removals you've made on individual presets
- Custom additions you've added

## Data Persistence

Custom signal configurations are stored:
- **In-memory**: While editing in the Policy Builder
- **Database**: Saved to `policy_presets.custom_signals` (JSONB) when you save the policy
- **Format**: 
  ```json
  {
    "certifications": { "include": ["G", "PG"] },
    "genres": { "exclude": ["Horror"] },
    "keywords": { "exclude": ["gore", "violence"] },
    "removed": {
      "certifications": { "include": ["R"] },
      "genres": { "prefer": ["Action"] }
    }
  }
  ```

## Best Practices

1. **Start with a base preset** that closely matches your needs
2. **Remove unwanted signals** rather than starting from scratch
3. **Use combined view** to verify multiple presets work together
4. **Add custom keywords** specific to your library's naming conventions
5. **Test with a few items** before applying to entire library

## Troubleshooting

### Changes not saving?
- Ensure you click **"Save"** on the Policy Builder modal
- Check browser console for API errors

### Preset not showing custom signals?
- Verify the preset is selected (checkbox checked)
- Expand the customization panel with "▼ Customize"

### Combined signals missing items?
- Check if items were removed from individual presets
- Verify base preset contains the expected signals
