# Classifarr Release Notes

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
