# Library *arr Settings Enhancement - Implementation Summary

## Overview
This implementation adds comprehensive Radarr and Sonarr integration settings to the library configuration system. Each library can now specify exactly how media should be added to the *arr services, including root folders, quality profiles, series types, availability, and monitoring options.

## What Was Changed

### Database Schema Changes
1. **libraries table**:
   - Added `radarr_settings` JSONB column (default: `{}`)
   - Added `sonarr_settings` JSONB column (default: `{}`)
   - Legacy fields retained for backward compatibility

2. **New arr_profiles_cache table**:
   - Caches root folders, quality profiles, and tags from Radarr/Sonarr
   - Improves UI performance by reducing API calls
   - Supports syncing profiles on-demand

### Backend Services

#### Radarr Service (`server/src/services/radarr.js`)
- ✅ Added `getTags()` method
- ✅ Normalized data structures for consistency
- ✅ Added `getMinimumAvailabilityOptions()` helper

#### Sonarr Service (`server/src/services/sonarr.js`)
- ✅ Added `getTags()` method
- ✅ Normalized data structures for consistency
- ✅ Added `getSeriesTypeOptions()` helper
- ✅ Added `getSeasonMonitoringOptions()` helper

#### Classification Service (`server/src/services/classification.js`)
- ✅ Added `suggestSeriesType()` method for intelligent detection
- ✅ Updated `routeToArr()` to use library-specific settings
- ✅ Integrated series type auto-suggestion into routing logic

### Backend API Routes (`server/src/routes/libraries.js`)

#### GET /api/libraries/:id/arr-options
Returns available options based on library media type:
- **Movie libraries**: Radarr root folders, quality profiles, tags, and availability options
- **TV libraries**: Sonarr root folders, quality profiles, tags, series types, and season monitoring options

#### PUT /api/libraries/:id/arr-settings
Saves *arr settings to the appropriate JSONB field based on media type.

#### POST /api/libraries/sync-arr-profiles
Syncs and caches all profiles from active Radarr/Sonarr configurations.

### Frontend Changes

#### API Client (`client/src/api/index.js`)
- Added `getLibraryArrOptions(id)` method
- Added `updateLibraryArrSettings(id, settings)` method
- Added `syncArrProfiles()` method

#### Library Detail View (`client/src/views/LibraryDetail.vue`)
Enhanced with comprehensive *arr settings forms:

**Radarr Settings (Movie Libraries)**:
- Root Folder dropdown with free space display
- Quality Profile dropdown
- Minimum Availability dropdown with descriptions
- Tags multi-select checkboxes
- Search on Add toggle
- Monitor toggle

**Sonarr Settings (TV Libraries)**:
- Root Folder dropdown with free space display
- Quality Profile dropdown
- Series Type dropdown with auto-suggestion
- Season Monitoring dropdown with descriptions
- Tags multi-select checkboxes
- Search on Add toggle
- Monitor New Items dropdown
- Season Folder toggle

## Configuration Examples

### Movie Library (Radarr)
```json
{
  "radarr_settings": {
    "root_folder_path": "/movies/family",
    "quality_profile_id": 4,
    "minimum_availability": "released",
    "tags": [1, 5],
    "search_on_add": true,
    "monitor": true
  }
}
```

### TV Library (Sonarr) - Anime
```json
{
  "sonarr_settings": {
    "root_folder_path": "/tv/anime",
    "quality_profile_id": 5,
    "series_type": "anime",
    "season_monitoring": "all",
    "tags": [3],
    "search_on_add": true,
    "monitor_new_items": "all",
    "season_folder": true
  }
}
```

### TV Library (Sonarr) - Daily Shows
```json
{
  "sonarr_settings": {
    "root_folder_path": "/tv/talkshows",
    "quality_profile_id": 3,
    "series_type": "daily",
    "season_monitoring": "recent",
    "tags": [],
    "search_on_add": true,
    "monitor_new_items": "all",
    "season_folder": false
  }
}
```

## Series Type Auto-Suggestion Logic

The system intelligently suggests series types based on:

| Content Type | Suggested Series Type | Detection Method |
|--------------|----------------------|------------------|
| Anime | `anime` | Japanese animation with 'anime' label |
| Talk Shows | `daily` | 'late_night', 'talk' labels or genres |
| News Programs | `daily` | 'news' label or genre |
| Game Shows | `daily` | 'game_show' label |
| Soap Operas | `daily` | 'soap_opera' label |
| Everything else | `standard` | Default fallback |

## Migration Path

For existing installations:

1. Run the migration script:
   ```bash
   psql -U classifarr -d classifarr -f database/migrations/001_add_arr_settings.sql
   ```

2. Access the library detail page for each library

3. Configure the new *arr settings

4. The system will use the new settings for all new media additions

5. Legacy fields remain functional for backward compatibility

## Security Review
✅ **CodeQL Analysis**: No security vulnerabilities detected
✅ **SQL Injection**: All queries use parameterized statements
✅ **XSS**: No user-generated content rendered without escaping
✅ **Data Validation**: Settings validated on backend before saving

## Testing Checklist

- [ ] Database migration applies successfully
- [ ] Radarr settings load for movie libraries
- [ ] Sonarr settings load for TV libraries
- [ ] Settings can be saved and retrieved
- [ ] Series type auto-suggestion works correctly
- [ ] Media routing uses new settings
- [ ] Backward compatibility maintained
- [ ] Profile sync endpoint works correctly

## Files Modified

### Database
- `database/init.sql` - Added new columns and table
- `database/migrations/001_add_arr_settings.sql` - Migration script
- `database/migrations/README.md` - Migration documentation

### Backend
- `server/src/services/radarr.js` - Enhanced with new methods
- `server/src/services/sonarr.js` - Enhanced with new methods
- `server/src/services/classification.js` - Added series type detection
- `server/src/routes/libraries.js` - Added new API endpoints

### Frontend
- `client/src/api/index.js` - Added new API methods
- `client/src/views/LibraryDetail.vue` - Added *arr settings UI

## Future Enhancements

Potential improvements for future iterations:
1. Add visual profile sync button in UI
2. Implement profile caching refresh schedule
3. Add series type override on per-media basis
4. Enhance auto-suggestion with ML-based predictions
5. Add bulk settings update for multiple libraries
6. Implement settings templates/presets
