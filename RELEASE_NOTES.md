# Classifarr Release Notes

## v0.38.4-alpha
**Title: Quality Profile UX and Discord Notification Fixes**

### What's Fixed

#### 1. Quality Profile Dropdown Not Loading When Editing Existing Configs

**Problem:** 
When you clicked "Change Settings" on an existing Radarr or Sonarr configuration, the Quality Profile dropdown showed "Select Profile..." with no options loaded. You had to manually click "Test Connection" every time to populate the dropdown, which was frustrating and unintuitive.

**Solution:**
- Quality profiles now automatically load when you click "Change Settings" on existing configs
- Added a loading indicator ("Loading profiles...") so you know it's working
- If the profile list fails to load, your saved profile ID is shown as a fallback option
- Static options (availability, series type, monitoring) are now hardcoded and always available

**Before:** Click "Change Settings" → See empty dropdown → Click "Test Connection" → Wait → Finally see profiles
**After:** Click "Change Settings" → Profiles automatically load → Ready to edit immediately

#### 2. Low-Confidence Items (e.g., 55%) Not Appearing on Discord

**Problem:**
Items with 55% confidence should fall into the "clarify" tier (50-69%) and trigger Discord notifications with clarification buttons. However, some items weren't appearing on Discord at all.

**Root Cause:**
- Decimal precision issues in tier lookup (55.4 vs 55)
- Missing fallback tier for edge cases
- Silent failures with no logging to diagnose issues

**Solution:**
- Confidence values are now rounded to avoid decimal precision issues
- Added fallback tier for low-confidence items (50-69%) when database lookup fails
- Enhanced logging throughout Discord notification pipeline
- Logs now show: tier lookup results, confidence values, initialization status, and skip reasons

**Impact:** 
55% confidence items now correctly appear on Discord with clarification buttons, making it easier to help improve classification accuracy.

#### 3. Warning for Incomplete Radarr/Sonarr Configurations

**Problem:**
Existing users who upgraded might have Radarr/Sonarr configs without `quality_profile_id` set (added in migration 053). Content won't route to \*arr without this required field, but there was no warning.

**Solution:**
- New warning banner appears on Dashboard when configs are incomplete
- Warning shows: "⚠️ Your [Radarr/Sonarr] configuration is missing a Quality Profile. Content won't be added until you select one."
- Direct "Configure Now" button links to the settings page
- Warning can be dismissed (but reappears on refresh if still incomplete)

**Impact:**
You'll now be notified immediately if your configuration is incomplete, preventing silent failures when trying to add content to Radarr/Sonarr.

### Technical Changes
- Fixed masked API key issue preventing quality profile lookup on edit
- Hardcoded static dropdown options to reduce dependency on test connection
- Improved error handling and logging in Discord notification system
- New API endpoint: `GET /api/settings/arr-config-status`

## v0.38.3-alpha
**Title: Automatic Rating Standardization**

### What's New

#### Problem: Rating Format Mismatch
Your library has items with mixed rating formats that don't match each other, even when they mean the same thing.

**Example from your library:**
```
Rating Distribution:
13: 15%    ← Age-based (Europe/Asia)
14: 15%    ← Age-based
15: 15%    ← Age-based
16: 15%    ← Age-based
PG-13: 3%  ← MPAA (US)
R: 5%      ← MPAA (US)
```

**The Impact:**
- Library profiles can't match "13" with "PG-13" even though they're equivalent
- Classification confidence is artificially low because ratings don't align
- Policy presets expecting "PG-13" don't match items rated "13"

#### Solution: Automatic Rating Normalization
We've implemented a comprehensive rating normalization system that standardizes all ratings to MPAA/TV standards.

**How It Works:**

1. **Priority System** (most reliable source wins):
   - First: OMDb `rated` field (US MPAA ratings directly from IMDb) 
   - Second: TMDB US certification
   - Third: Normalized age-based rating (13→PG-13, 16→R, etc.)
   - Fallback: "NR" for unknowns

2. **Automatic Processing**:
   - **On server startup**: Auto-queues first 1,000 items needing normalization
   - **Daily at 3 AM**: Checks for new items and auto-queues if found
   - **During OMDb enrichment**: Updates rating when enrichment succeeds
   - **During media sync**: Normalizes ratings from Plex/Emby/Jellyfin

3. **Original Ratings Preserved**:
   - Your original rating is saved in `original_rating` column
   - `content_rating` is updated to normalized value
   - Nothing is lost—you can always see what it was

**Rating Mappings:**
```
Age-based → MPAA:
13 → PG-13
14 → PG-13
15 → R
16 → R
17 → R
18 → NC-17

UK Ratings → MPAA:
U → G
PG → PG
12A → PG-13

German FSK → MPAA:
FSK 12 → PG-13
FSK 16 → R
FSK 18 → NC-17
```

**Admin UI Panel** (Settings → Metadata → Rating Normalization):
- View real-time statistics
- "Normalize All" button for immediate processing
- Progress bar shows completion percentage
- Auto-refreshes every 5 seconds during processing
- "Regenerate Profiles" button after completion

**What This Means for You:**
- Your library profiles will now correctly recognize equivalent ratings
- Classification confidence will increase for items with previously non-standard ratings
- Policy presets will match more items (PG-13 preset now matches "13", "14", "12A", etc.)
- More accurate library scoring and better routing decisions

---

## v0.38.2-alpha
**Title: Classification Accuracy Improvements**

### What's New

#### Fixed: Movies Incorrectly Classified as Anime
We identified and fixed a critical bug where mainstream movies like "Predator: Badlands" and "People We Meet on Vacation" were being incorrectly classified as "Anime Movies" with low confidence.

**The Problem:**
- The classification system wasn't using your library profiles at all
- Library profiles show what's *actually in* your libraries (e.g., "99% Comedy, 37% TV-MA")
- This valuable data was being completely ignored during classification
- The AI was also receiving biased examples that primed it to suggest "Anime"

**The Fix:**
- **Library profiles now contribute to classification** - if your Movies library has PG-13 Action movies, new PG-13 Action movies will get a confidence boost
- Signal collection now runs completely, gathering all available classification hints
- AI prompts no longer bias toward any specific library type
- Uncertain classifications now default to general-purpose libraries

#### How Library Profiles Work Now

**Before:** Only your policy presets determined where content went. If your presets didn't explicitly match, confidence was low.

**After:** The system now asks two questions:
1. **"Does this item match my policy presets?"** (your defined rules)
2. **"Does this item look like what's already in this library?"** (statistical match)

For example, if your Comedy library contains:
- 99% Comedy genre
- 37% TV-MA rating
- Top studios: Comedy Dynamics, HBO, Comedy Central

A new TV-MA Comedy special will get high confidence even without specific presets, because it *looks like* what's already there.

#### Better Debugging
If you're having classification issues, check your logs for new entries:
- `Profile score calculated` - Shows how well items match library profiles
- `RAG search initiated` - Shows RAG is being called
- `RAG search returned no results` - No similar items found

This helps you understand why classifications are making the decisions they are.

---

## v0.38.1-alpha
**Title: Streamlined Policy Configuration**

### What's New

#### Unified Policy Editor
The policy configuration experience has been completely redesigned into a single, streamlined modal:

- **Everything in one place**: No more nested popups - preset selection, customization, and settings are all in one scrollable view
- **See Combined Signals immediately**: When you select multiple presets, the Combined Signals summary shows instantly below your selections
- **Simpler button**: "Configure" replaces the confusing "Add Presets" and "Edit" buttons
- **Cleaner titles**: Modal now shows "[Library Name] Policy" (e.g., "Anime Movies Policy")
- **Advanced settings collapsed**: Scoring weights and combination mode are now tucked away under "Advanced Settings" to reduce clutter
- **Auto-generated names**: Policy name and description are automatically created from your library and selected presets if you don't provide them

#### Before vs After

| Before | After |
|--------|-------|
| Click "Add Presets" → Separate popup → Select presets → Close → Can't see Combined Signals | Click "Configure" → Select presets inline → Combined Signals visible immediately |
| "Add Presets" button + "Edit" button | Single "Configure" button |
| "Edit Policy" / "Create Policy" title | "[Library Name] Policy" title |
| Basic Information section with name/description inputs | Auto-generated from library and presets |
| Library dropdown (can change) | Read-only library header with lock icon 🔒 |

#### What This Means for You

**Faster workflow**: No more clicking through multiple modals. Everything you need is in one place.

**Better understanding**: With Combined Signals visible while selecting presets, you can immediately see how your choices work together.

**Less confusion**: One "Configure" button for all actions - whether you're adding presets or editing settings.

**Cleaner interface**: Advanced features are still available but hidden until you need them.

---

## v0.38.0-alpha
**Title: Enhanced Policy Setup Experience**

### What's New

#### Improved Preset Viewing
- **Cleaner System Preset Display**: When viewing system preset details, you'll now see a clean summary view with badges and chips instead of disabled form fields
  - Content ratings shown as badge pills
  - Genres displayed as preferred/excluded chips  
  - Keywords shown as tags
  - No more confusing "looks editable but isn't" interfaces

- **Customize System Presets**: Found a system preset that's almost what you need? Click "Customize" to create your own version
  - Creates a copy in your Custom Presets
  - Pre-populates all settings from the original
  - Modify anything you want and save as your own
  - Original system preset remains unchanged

- **Usage Indicator**: Each system preset now shows "Used in X policies" so you can see how popular it is

#### New Presets Page
- **Browse All Presets**: New dedicated page to browse all 168 system presets and manage your custom presets
  - Access via Classification → Presets in the sidebar
  - Tabbed interface: System Presets (read-only) vs Custom Presets (editable)
  - Grid view with preset cards showing icon, name, category, and signal summary
  - Search and category filtering to quickly find the presets you need
  - Create, edit, and delete your own custom presets

#### Improved Preset Creation
- **Emoji Dropdown Selector**: Select preset icons from a dropdown of 60+ categorized emojis instead of manually typing emojis
  - 8 organized categories: Movies, TV Shows, Genres, Themes/Seasonal, Quality/Awards, General, Regional, Special Interest
  - One-click selection for better user experience
  - Consistent with emojis used in system presets

#### Improved Policy Setup Experience
- **Clearer Empty States**: When a library has no presets configured, you'll now see a clean, intuitive interface with a dashed border container and centered plus icon guiding you to add presets
- **Library Header Display**: Each policy card now shows the associated library name with an icon at the top for better context
- **Smart Preset Suggestions**: The preset selection modal now shows AI-suggested presets based on your library name, with match percentages (e.g., "90% match") to help you choose the best presets
- **Better Visual Feedback**: Selected presets now show green checkmarks (✓) instead of blue highlights, making it easier to see what you've chosen at a glance
- **Quick Actions**: Added "Add All" button to quickly select all suggested presets at once

#### UI Polish
- **Consistent Color Scheme**: Updated throughout the policy configuration flow with standardized blue (#3b82f6) for primary actions and green (#22c55e) for success states
- **Improved Readability**: Enhanced contrast and spacing in preset selection cards
- **Lock Icon Indicator**: Read-only library field now shows a lock icon (🔒) to clearly indicate it cannot be changed
- **Category Filter Enhancement**: Selected category pills now display in blue, while unselected ones show in gray for better visual distinction
- **Modal Close Button**: Updated with blue accent for improved visual hierarchy

---

## v0.37.8e-alpha
**Title: Classification Status Constraint Fix**

### Bug Fixed
Fixed `classification_history_status_check` constraint violation. Added missing status values:
- `awaiting_decision` - Item pending user clarification
- `pending` - In queue, not yet processed

---

## v0.37.8d-alpha
**Title: Bug Fixes & Deprecated Code Cleanup**

### Bugs Fixed
1. **Classification Method Constraint Error** - Added missing methods to database check constraint
2. **Learned Corrections Query** - Fixed query using non-existent `updated_at` column
3. **Ollama Model Loading Timeout** - Extended initial timeout from 60s to 120s

### Code Cleanup
- Removed deprecated `checkLibraryRules()` and `matchRules()` code paths
- PolicyEngine now handles all rule-based classification
- Cleaned up legacy signal collection

### Classification Methods (Current)
| Method | Description |
|--------|-------------|
| `existing_media` | Already in library |
| `manual_correction` | User corrections |
| `exact_match` | Previously confirmed TMDB |
| `learned_pattern` | Pattern matching |
| `source_library` | From known source |
| `policy_auto` | PolicyEngine ≥85% |
| `policy_prompt` | PolicyEngine 60-84% |
| `ai_verified` / `ai_analysis` | AI paths |
| `signal_calculation` / `fallback` | Fallbacks |

---

## v0.37.8c-alpha
**Title: Enhanced Overseerr/Jellyseerr Webhook Payload**

### What Changed
The webhook JSON payload template has been enhanced to include explicit TMDb and TVDB IDs for better metadata enrichment.

### New Payload Format
```json
{
  "notification_type": "{{notification_type}}",
  "event": "{{event}}",
  "subject": "{{subject}}",
  "message": "{{message}}",
  "image": "{{image}}",
  "media": {
    "media_type": "{{media_type}}",
    "tmdbId": "{{media_tmdbid}}",
    "tvdbId": "{{media_tvdbid}}",
    "status": "{{media_status}}",
    "status4k": "{{media_status4k}}"
  },
  "request": {
    "request_id": "{{request_id}}",
    "requestedBy_email": "{{requestedBy_email}}",
    "requestedBy_username": "{{requestedBy_username}}",
    "requestedBy_avatar": "{{requestedBy_avatar}}"
  },
  "extra": []
}
```

### Benefits
- **Direct ID Lookup**: TMDb/TVDB IDs enable precise metadata lookup instead of title search
- **Faster Classification**: No need to search by title - direct API lookup
- **Better Accuracy**: Correct movie/show identification every time
- **Media Status**: Know if content is already available before processing

### Upgrade Notes
Existing Overseerr configurations will continue to work. For improved accuracy, update your webhook JSON payload in Overseerr to use the new template from Settings → Webhooks.

---

## v0.37.8b-alpha
**Title: Discord Configuration Save & Display Fix**

### What Was Broken
Users experienced multiple issues when configuring Discord notifications:
1. 💥 **Configuration not saving properly** - Settings would revert to "Unknown" after save
2. 📛 **"Connection Failed" error** - Shown immediately after saving valid configuration
3. ❓ **"Unable to fetch" display** - Server and channel names wouldn't load in view mode
4. ⚠️ **No success feedback** - Test connection wouldn't show success message in edit mode

### Root Cause
The backend `loadConfig()` method only retrieved Discord configuration when `enabled = true`. This caused:
- API calls (`getChannelDetails`, `getServers`, `getChannels`) to fail when config was disabled or being updated
- Frontend couldn't fetch channel details after save, showing "Unable to fetch"
- Test connection couldn't authenticate even with valid token

### What's Fixed
✅ **Configuration saves and persists correctly**
- Backend now fetches bot token for API calls regardless of enabled status
- Proper sequencing ensures database commits before fetching details

✅ **Server and channel names display correctly**
- View mode now shows actual server and channel names after save
- No more "Unable to fetch" or "Unknown" placeholders

✅ **Test Connection shows success**
- Clear success message displayed in edit mode
- Shows test notification delivery status and server/channel info
- Displays which permissions are granted or missing

✅ **Better user feedback**
- Save action shows confirmation with configured channel details
- Warning status for non-critical issues
- Error messages are more specific and actionable

### Technical Changes
**Backend (`server/src/services/discordBot.js`):**
- `loadConfig()` now accepts `ignoreEnabledStatus` parameter (default: false)
- `getChannelDetails()`, `getServers()`, `getChannels()`, `testConnection()` use `ignoreEnabledStatus=true`
- API authentication works even when bot notifications are disabled

**Frontend (`client/src/views/settings/Discord.vue`):**
- Improved save sequencing with small delay for database commit
- Enhanced success feedback with channel/server details
- Better test connection messages for edit mode

**Frontend (`client/src/components/common/ConnectionStatus.vue`):**
- Added 'warning' status support for non-critical issues

### Build & Test Improvements
- **Vite Upgrade**: Upgraded from v5.0.8 to v7.3.1 for improved build performance and latest features
- **Vue Plugin**: Upgraded @vitejs/plugin-vue from v4.5.2 to v6.0.3
- **Windows Test Compatibility**: Integration tests now work on Windows with cross-platform temp file paths

### Upgrade Notes
No breaking changes. Existing Discord configurations will work correctly after upgrade.

---

## v0.37.8a-alpha
**Title: Discord Channel Details Error Handling Fix**

### Fixed
- **Discord "Unknown" Display Issue**: Fixed issue where Discord settings page would show "Unknown" for server and channel names after saving configuration
  - ✅ **No more 500 errors** when fetching channel details
  - 🔄 **Graceful fallback** with clear error messages when Discord API is unavailable
  - ⏱️ **10-second timeout** prevents indefinite waiting on Discord client login
  - 📝 **Better error messages** help identify configuration problems
  - 🛡️ **Warning status** shows when fallback data is being used

### What This Fixes
- Previously, saving Discord configuration would result in browser console errors (`HTTP 500 Internal Server Error`)
- Server and channel names would display as "Unknown" even when properly configured
- Backend exceptions were unhandled, causing server errors
- Users couldn't tell what was wrong with their configuration

### What's Improved
- Backend now has detailed logging to help troubleshoot Discord connectivity issues
- Frontend displays helpful warning messages when channel details can't be fetched
- API returns structured error responses with fallback data instead of generic 500 errors
- Users can now see exactly what error occurred and take appropriate action

---

## v0.37.8-alpha
**Title: Discord Integration Improvements & Status Fix**

### Added
- **Enhanced Discord Test Connection**: Test your Discord bot setup more thoroughly
  - 🎯 **Sends actual test notification** to your Discord channel to verify setup
  - ✅ **Permission validation** - shows which permissions are granted or missing
  - 📊 **Detailed status feedback** - see exactly what's working and what needs attention
  - Required permissions: Send Messages, Embed Links, Attach Files, Read Message History, Use External Emojis, Add Reactions

### Fixed
- **Discord Service Status**: System tab now shows "not configured" instead of "error" when Discord is not set up
- **Discord Channel Names**: Fixed issue where server and channel names would display as "unknown" after saving configuration
  - Channel and server names now correctly appear in the Discord settings UI

---

## v0.37.7-alpha
**Title: Startup Profile Generation**

### Added
- **Library Profile Auto-Generation**: Library profiles now auto-generate on server startup for all libraries with items
  - No more waiting or manual refresh needed when viewing library details

### Improved
- **Discord Error Messages**: More helpful error messages when bot lacks required permissions
  - Clear indication of which specific permissions are missing
  - Separate warnings for critical vs. optional permissions
- **Test Notification**: Look for the green "✅ Classifarr Test Notification" message in your Discord channel when testing

---

## v0.37.6-alpha
**Title: Library Profile Auto-Generation Fix**

### Fixed
- Library profiles now auto-generate on first page load
- No longer requires clicking Refresh button when viewing a library for the first time

### Technical Details
- Catch block in `LibraryProfile.vue` now properly handles 404 response to trigger profile generation
- Added regression test to prevent future breakage

---

## v0.37.5a-alpha
**Title: Dependency Update**

### Changed
- Upgraded supertest from 7.1.4 to 7.2.2

---

## v0.37.5-alpha
**Title: Library Profiles & API Health Monitoring**

### New Features

#### Library Profile System
A new statistical system replacing Pattern Discovery:
- **Profile Generation**: Generates profiles based on rating, genre, and studio distributions
- **Automatic Exclusions**: Identifies what's *not* in your library
- **Policy Integration**: `PROFILE_SCORE` signal type for better classification accuracy
- **Profile Visualization**: New `LibraryProfile` component in Library Detail view

#### API Health Monitoring
New health check endpoints for external API services:
- `GET /api/settings/omdb/health` - OMDb status with SSL and rate limit info
- `GET /api/settings/tmdb/health` - TMDB status with SSL check
- `GET /api/settings/tavily/health` - Tavily status with SSL check
- **System Tab Integration**: OMDb now appears in System Health Status

### Fixes
- **Stats Alerts 500 Error**: Added defensive error handling to `/api/stats/alerts`
- **OMDb SSL Errors**: Graceful handling of SSL certificate expiration
- **Integration Tests**: Fixed preset scoring tests to match actual implementation

### Deprecated
- **Pattern Discovery**: Replaced by Library Profiles
- **Routes**: Removed `/patterns` and `/rule-builder` routes
- **Database**: `discovered_patterns` table is now legacy

---

## v0.37.2-alpha
**Title: Inline Preset Customization & Combined Signals**

### New Features

#### Inline Preset Customization
Customize preset signals directly in the Policy Builder without leaving the modal:
- **Customize Button**: Click to expand any selected preset
- **Editable Signals**: Remove base signals (✕), restore removed (↩), add new (+)
- **Multi-Preset Editing**: Expand and edit multiple presets simultaneously
- **Signal Types**: Content Ratings, Genres, Keywords

#### Combined Signals Summary
When you select 2+ presets, see the merged result:
- **Content Ratings** (included): Union of all preset ratings
- **Preferred/Excluded Genres**: Combined genre preferences
- **Preferred/Excluded Keywords**: Combined keyword signals
- Respects signal removals and custom additions per-preset

#### Library Dropdown Grouping
Libraries in Policy Builder now organized by media type:
- 🎬 Movies
- 📺 TV Shows
- 📁 Other

### Fixes
- **PresetCard Checkbox**: Fixed checkbox toggle when clicked directly
- **Pattern Mining**: Fixed null library_name error during pattern discovery

---

## v0.37.0-alpha

## 🎯 Overview

**Revolutionary Classification Redesign:** v0.37.0 shifts from "AI decides" to "Formula calculates + AI validates"

This release fundamentally reimagines classification to be:
- **Transparent** - Users see exactly why each item was classified
- **Configurable** - Adjust weights for presets, patterns, RAG, and history
- **Efficient** - AI only validates, doesn't make primary decisions (70-80% cost reduction)
- **Explainable** - Full breakdown of classification reasoning
- **Learning** - System improves from every user decision

---

## 🚀 Major Features

### Policy-Driven Classification Engine
The new Policy Engine replaces rule-based scoring with a hybrid policy system:
- **Presets**: 168 pre-built content type definitions (genres, ratings, themes)
- **Patterns**: Auto-discovered studio, collection, and keyword associations
- **RAG**: Embedding-based similarity matching
- **History**: Learning from past decisions and corrections

**How It Works:**
```
Item Arrives → Check Authoritative Signals (100% match)
            → Evaluate All Policies
            → Score: Presets + Patterns + RAG + History
            → Apply Weights → Rank Results
            → Determine Action (auto/prompt/manual)
```

### AI Skip Logic - 70-80% Faster Classifications
Classifarr now **skips expensive AI calls** when the PolicyEngine is confident:

- **≥85% confidence** → Auto-classify immediately (no AI call)
- **60-84% confidence** → Prompt user via Discord (no AI call)
- **<60% confidence** → Use AI to help choose (existing behavior)

**Benefits:**
- ⚡ **2-5 second latency improvement** per classification
- 💰 **70-80% reduction in AI API costs**
- 🎯 **More consistent results** from deterministic rules
- 📊 **Transparent scoring** - see full PolicyEngine breakdown

**Example:**
```
Before: PolicyEngine (300ms) → AI Verification (3s) = 3.3s total
After:  PolicyEngine (300ms) → Auto-classify = 0.3s total
```

### 168 Content Presets
Pre-built signal definitions organized into categories:
- **Genres** (35): Action, Comedy, Horror, Documentary, etc.
- **Ratings** (12): Family-friendly, Teen, Mature content
- **Themes** (28): Superhero, True Crime, Sports, Holiday, etc.
- **Studios** (18): Major studio content profiles
- **Eras** (8): Classic, Vintage, Modern, Contemporary
- **Languages** (15): Regional content definitions
- **Special** (52): Anime, Reality TV, Standup, etc.

### Event Detection Migrated to PolicyEngine
Event types are now handled by PolicyEngine presets instead of hardcoded logic:

**6 New Event Presets:**
- 🎄 **Holiday & Seasonal** - Christmas, Halloween, seasonal content
- 🏈 **Sports & Athletics** - NFL, NBA, Olympics, sports docs
- 🥊 **PPV & Combat Sports** - UFC, MMA, boxing, wrestling
- 🎵 **Concert & Live Music** - Concerts, festivals, live performances
- 🎤 **Stand-up Comedy** - Comedy specials and stand-up
- 🏆 **Awards & Ceremonies** - Oscars, Emmys, award shows

**Benefits:**
- ✅ **Unified system** - Events use same flow as all content
- ⚙️ **Configurable** - Adjust keywords, weights via UI
- 🔧 **Extensible** - Easy to add new event types
- 📈 **Better accuracy** - Can combine with other signals

### Feedback & Learning Loop
Every classification decision feeds back into the system:
- **Feedback Capture**: Full metadata, signals, user reason
- **Pattern Discovery**: Auto-detect recurring studios, keywords
- **Tuning Suggestions**: AI-generated policy improvements
- **Accuracy Tracking**: Before/after metrics for changes

### Enhanced Prompts
Context-rich prompts that explain uncertainty:
- Low confidence breakdown (✅ matching, ⚠️ conflicting, ❓ unknown)
- Close race comparisons
- New discovery handling (unknown studios)
- Pattern learning options ("Remember: A24 → Indie")

---

## 📊 New Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `library_policies` | Policy definitions per library |
| `content_presets` | 168 preset signal definitions |
| `policy_presets` | Junction: policies ↔ presets |
| `policy_overrides` | Manual include/exclude rules |
| `discovered_patterns` | Auto-learned patterns |

### Feedback & Learning Tables
| Table | Purpose |
|-------|---------|
| `policy_feedback_log` | Every classification decision |
| `policy_tuning_suggestions` | AI-generated improvements |
| `policy_learning_stats` | Accuracy metrics per policy |
| `policy_change_log` | Audit trail for changes |

---

## 🔌 New API Endpoints

### Policies
- `GET /api/policies` - List all policies
- `GET /api/policies/:id` - Policy with presets
- `POST /api/policies` - Create policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy

### Presets
- `GET /api/presets` - List all presets
- `GET /api/presets/categories` - Preset categories

### Suggestions
- `GET /api/suggestions` - List tuning suggestions
- `POST /api/suggestions/:id/apply` - Apply suggestion
- `POST /api/suggestions/:id/reject` - Reject suggestion

### Stats
- `GET /api/stats/overview` - Global statistics
- `GET /api/policies/:id/stats` - Policy statistics
- `GET /api/stats/live-feed` - Real-time activity
- `GET /api/stats/alerts` - Abnormal metrics

### Migration
- `GET /api/migration/status` - Migration progress
- `POST /api/migration/rules/:id/migrate` - Migrate legacy rule

---

## 🎨 New UI Components

### Policy Builder
- Visual preset picker with search and categories
- Weight adjustment per preset
- Threshold sliders (auto-classify, prompt)
- Combination mode selection

### Tuning Dashboard
- Pending suggestions with confidence scores
- Apply/reject with impact tracking
- Supporting evidence from feedback

### Stats Dashboard
- Overview cards (decisions, accuracy, trends)
- Per-policy stats with mini charts
- Live activity feed
- Alerts for declining accuracy

### Migration Wizard
- Libraries with legacy rules
- Preset suggestions for each rule
- Bulk migration option

---

## ⚠️ Breaking Changes

### Deprecated: Legacy Rules
- `library_custom_rules` table is deprecated
- Use Migration Wizard to convert to policies
- Legacy rules will be removed in v0.39.0

### Deprecated: Event Detection
- `event_detection_type` column in `libraries` table is deprecated
- Replaced by seasonal and genre content presets
- `detectEventContent()` is no longer called in classification flow (exists for backward compatibility with deprecation warning)
- Event detection will be removed in v0.39.0
- **Automatic Migration:** Libraries with `event_detection_type` will automatically get the corresponding event preset attached during migration
- **Migration:** Use seasonal presets (`christmas_holiday`, `halloween`, etc.) or genre presets (`sports_doc`, `concert`)
- See [Migration Guide](docs/migration/v037.md#example-4-event-detection-migration) for details

### Configuration Changes
- New config options for policy weights
- Default thresholds: auto=85%, prompt=60%
- AI validation now skipped for high-confidence classifications (≥85%)

---

## 🔧 Technical Details

### Services Added
- `policyEngine.js` - Core classification engine
- `feedbackAnalysis.js` - Learning loop service
- `promptBuilder.js` - Enhanced prompt generation
- `legacyMigration.js` - Rule migration service

### Scoring Formula
```
Final Score = (Preset × 0.40) + (Pattern × 0.25) + (RAG × 0.20) + (History × 0.15)
Maximum: 95% (100% reserved for authoritative signals)
```

### Authoritative Signals (100% confidence)
- `existing_media` - Already in media server
- `manual_correction` - User explicitly corrected
- `exact_match` - Previously confirmed TMDB ID

---

## 📈 Migration Guide

### From v0.36.x
1. Run database migrations (9 new tables)
2. Content presets auto-seed on first start
3. Existing libraries get default policies
4. Use Migration Wizard for custom rules
5. Migrate event detection to seasonal/genre presets
6. Review and tune policy thresholds

### Recommended Steps
1. Start with default presets
2. Monitor Stats Dashboard for accuracy
3. Apply suggested tunings
4. Migrate legacy rules gradually
5. Convert event detection libraries to seasonal presets

---

## 🐛 Known Issues

- RAG scoring requires embedding service (graceful fallback if unavailable)
- First classification after restart may be slower (cache warming)

---

## 📚 Documentation

- [Policy Engine Architecture](docs/architecture/policy-engine.md)
- [Preset Reference](docs/presets/README.md)
- [API Reference](docs/api/README.md)
- [Migration Guide](docs/migration/v037.md)

---

## 🙏 Contributors

Thanks to everyone who contributed to this major release!

---

## 🕰 Historical Release Notes

Release notes for versions prior to **v0.37.0** have been moved out of this file to keep it focused on the latest major changes.

- For the full historical release notes, see **`RELEASE_NOTES.md.backup`** in this repository.
- You can also browse all past release notes and changes through the project's version control history (e.g., Git log or tags).

---
