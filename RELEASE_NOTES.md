# Classifarr Release Notes

## v0.39.0-alpha
**Title: AI Prompt Enrichment + RAG Settings Dashboard + Hybrid Backfill System + Queue & Priority + Embedding Provider Expansion**

### New Features

#### AI Prompt Enrichment 🎯

AI classification decisions are now informed by your library's actual content distribution (#142).

**What's Included in AI Prompts:**
When classifying new media, the AI now sees:
- **Rating Distribution**: What content ratings are already in your library (e.g., "TV-MA: 45%, TV-14: 30%")
- **Genre Mix**: Your library's genre composition with percentages
- **Top Studios**: Most common studios/networks  
- **Languages**: Primary languages in your library

This helps the AI make better decisions by understanding what kind of content is already in each library, leading to more accurate classification suggestions that better match your library's existing profile.

**History Transparency:**
Each classification now shows a "Library Profile Used in Decision" panel in the classification history detail view. This new panel includes:
- Visual distribution bars for content ratings (blue bars)
- Genre distribution with percentages (purple bars)
- Top studios list with percentages
- Language distribution tags

The profile statistics are captured at the time of classification and stored as a snapshot in the database (`profile_snapshot` column), so you can see the historical context even as your library composition changes over time.

**Automatic Updates:**
Profile statistics are automatically refreshed when:
- Library sync completes
- New content is added to your library
- You manually refresh the library profile via API

The AI always sees current data to ensure the best classification decisions aligned with your library's actual content.

**Benefits:**
- More accurate AI classifications based on actual library content
- Complete transparency into what influenced each decision
- Historical record of library composition at decision time
- Better consistency with existing library content
- Improved classification quality over time as library grows

#### RAG Settings Dashboard 🎛️

All RAG configuration is now consolidated in one comprehensive page: **Settings → RAG Settings**

Access via the new "RAG & Embeddings" section in Settings or navigate directly to `/settings/rag`.

**5 Dedicated Tabs:**

**1. Overview Tab 📊**
Quick dashboard showing:
- **Status Cards**: Provider status (online/offline), total embeddings, pending items, failed count (24h)
- **Quick Stats**: Provider mode, current model, average generation time, last embedding timestamp
- **Recent Activity**: Live feed of the last 5 RAG operations with level indicators

**2. Provider Tab 🔌**
Configure your embedding provider:
- **Same as Classification**: Use the same Ollama instance (default)
- **Separate Ollama Instance**: Dedicated server for embeddings (configure host, port, model)
- **Cloud Providers**: OpenAI, Gemini, Voyage AI, OpenRouter, or Cohere
- Test connection button to verify configuration
- Supports all embedding models per provider

**3. Queue & Scheduling Tab ⏱️**
Complete control over embedding generation:
- **Heartbeat Configuration**: Fine-tune resource locking (timeout, interval, max wait)
- **Current Lock Status**: Real-time display of lock state and duration
- **Real-time Embeddings**: Toggle immediate generation during classification
- **Idle Backfill**: Configure opportunistic processing during quiet periods
- **Scheduled Backfill**: Set daily schedule with time/day picker, batch size, max duration
- **Manual Backfill**: Full controls (start/pause/resume/clear) with real-time progress bar and ETA

**4. Advanced Tab ⚙️**
Fine-tune performance and debugging:
- **Retry Settings**: Configure max retries, retry delay, request timeout
- **Caching**: Enable embedding cache with configurable TTL (hours)
- **Debug Options**: Verbose logging, log embedding content (with warnings)
- **Danger Zone**: Clear all embeddings, reset configuration to defaults (with confirmations)

**5. Monitoring Tab 📈**
Keep track of your RAG system:
- **Live Status Bar**: Real-time indicators for provider, heartbeat, queue length, lock status
- **24-Hour Metrics**: Embeddings generated, avg generation time, success rate, errors, cache hits, total requests
- **Activity Log Viewer**: Filterable logs by level (info/warning/error) and type (embedding/backfill/provider)
- **Backfill Run History**: Table showing type, status, start time, duration, processed count
- **Export Tools**: Download configuration, logs, or metrics as JSON for debugging

**Benefits:**
- Single source of truth for all RAG configuration
- Live monitoring without leaving the UI
- Easy troubleshooting with detailed logs and metrics
- Export capabilities for external analysis
- Clear visual feedback on system health

#### Hybrid Backfill System 🔄

Embedding generation is now fully configurable with **four complementary modes** to fit your workflow:

**1. Real-Time Mode ⚡**
- Embeddings generated immediately when items are classified
- Best for keeping RAG data current
- Adds ~100-300ms to classification time
- Toggle on/off in Settings → AI → Backfill

**2. Idle Backfill Mode 🌙**
- Automatically processes pending embeddings during quiet periods
- Starts after configurable idle threshold (default: 30 seconds of no classifications)
- Pauses instantly when new classifications arrive
- Small batch size (default: 10 items) for gentle background processing
- Perfect for catching up without impacting active use

**3. Scheduled Backfill Mode 📅**
- Large batch processing at configured times
- Set daily schedule with:
  - Time picker (e.g., 2:00 AM)
  - Day selector (run on specific days of the week)
  - Batch size (default: 100 items)
  - Max duration limit (default: 1 hour)
- Perfect for overnight processing without impacting daytime performance

**4. Manual Backfill Mode 🎮**
- Take full control with on-demand backfill
- Features:
  - **Start/Pause/Resume/Clear** controls
  - Real-time **progress bar** with percentage
  - **ETA calculation** based on processing speed
  - Configurable batch size
  - Status persists through page navigation
- Perfect for when you want to immediately catch up on pending embeddings

**Backfill Status Dashboard:**
- Pending embeddings count display
- Current status for each mode
- Run history table showing:
  - Type (idle/scheduled/manual)
  - Status (running/paused/completed/failed)
  - Items processed
  - Start and completion timestamps

**Configuration:**
All modes are configured in **Settings → AI → Embedding Backfill**:
- Enable/disable each mode independently
- Adjust timing and batch sizes for your environment
- View real-time status and history

**Technical Implementation:**
- New database migration (056) for configuration and run history
- New services: `idleBackfillService`, `scheduledBackfillService`, `manualBackfillService`
- `backfillOrchestrator` coordinates all modes and prevents conflicts
- `idleDetector` utility monitors classification activity
- Comprehensive API endpoints for all modes
- New BackfillSettings.vue component with full UI controls

#### Queue & Priority System ⏱️

Classifarr now intelligently manages Ollama resources to prevent contention between classification and embedding operations.

**Classification Priority:**
When using the same Ollama instance for both classification and embeddings, classification always takes priority. Embedding jobs will wait or pause to ensure your downloads are classified quickly.

**How It Works:**
- Classification requests acquire a lock with high priority
- Embedding requests wait if classification is active
- Heartbeat mechanism prevents deadlocks (automatic timeout release)
- Configurable timing parameters for your environment

**Parallel Processing:**
If you've configured a separate embedding provider (different Ollama instance or cloud), both operations can run simultaneously for maximum throughput.

**Configuration:**
Adjust timing in **Settings → General → Heartbeat**:
- **Heartbeat Timeout**: How long before a stale lock is released (default: 30s)
- **Heartbeat Interval**: How often heartbeat signals are sent (default: 5s)
- **Max Wait Time**: Maximum time to wait for a lock (default: 60s)

**Lock Status Monitor:**
The UI shows real-time lock status:
- Current lock state (locked/unlocked)
- Which operation holds the lock (classification/embedding)
- Lock duration
- Last heartbeat timestamp

**Technical Implementation:**
- New `providerLock` service with heartbeat-based locking
- Database migration (055) for configuration storage
- API endpoints for configuration and status monitoring
- Automatic integration with classification and embedding services

#### Embedding Provider Options 🚀

You can now choose where embeddings are generated, separate from your AI classification provider. This provides flexibility for performance optimization and cost management.

**Three Provider Modes:**

1. **Same as Classification (Default)**
   - Uses the same provider configured for AI classification
   - No additional setup needed - works exactly as before
   - Perfect for most users who want simplicity

2. **Separate Ollama Instance**
   - Run embeddings on a dedicated Ollama server
   - Configure different host/port (e.g., a more powerful machine for embeddings)
   - Use a specialized embedding model (e.g., `nomic-embed-text`, `mxbai-embed-large`)
   - Parallelize embedding generation with classification for better performance
   - **Use Case:** You have one server for LLM inference and another optimized for embeddings

3. **Cloud Providers**
   - Use cloud embedding APIs for higher quality or faster processing
   - Supported providers:
     - **OpenAI**: `text-embedding-3-small` (best value), `text-embedding-3-large` (highest quality)
     - **Google Gemini**: `text-embedding-004` (latest)
     - **Voyage AI**: `voyage-2`, `voyage-large-2` (optimized for retrieval tasks)
     - **OpenRouter**: Access multiple embedding providers through one API
     - **Cohere**: `embed-english-v3.0`, `embed-multilingual-v3.0`
   - **Use Case:** You want higher quality embeddings or your local machine isn't powerful enough

**Configuration Location:**
Settings → AI Provider → Embedding Provider (new section)

**Features:**
- Provider-specific model selection with smart defaults
- Test connection button for all modes
- API key masking for security
- Backward compatible - existing configurations work without changes

**Technical Details:**
- New database migration adds 7 columns to `ai_provider_config` table
- New `embeddingProvider` service handles routing to appropriate provider
- API endpoints for configuration and testing
- Supports parallel embedding generation when using different providers

### Removed Features

#### Custom Rules Page Retired 🎯

The dedicated Rules page in Settings has been removed. Classification is now fully AI-driven using the enhanced Policy Engine.

**What Changed:**
- Settings → Rules page removed from navigation
- Rules.vue component deleted from codebase
- All rule functionality now handled through Library Profiles and Policy Engine

**Migration Path:**
Classification rules are now managed through:
1. **Library Profiles**: Configure content types, genres, ratings, and keywords in each library
2. **Policy Engine**: AI evaluates items based on library profiles with weighted scoring
3. **Smart Patterns**: System learns from your corrections and improves over time

**Why This Change:**
- Simplifies the UI by removing redundant configuration
- Policy Engine provides more flexible and powerful rule-based classification
- AI-driven approach adapts to your preferences automatically
- Library-specific rules are easier to manage within library settings

**Impact:**
No data loss - existing library rules and policies continue to work. The removal only affects the standalone Rules page in Settings.

### Bug Fixes

#### 1. Pending Items Now Display Correctly (API Crash Fixed)

**Problem:** 
When you navigated to the "Awaiting Decision" queue, the page crashed with a 500 error: `"[object Object] is not valid JSON"`. The `/api/classification/pending` endpoint was broken, preventing you from seeing items that needed your decision.

**Root Cause:**
The `policy_question` column in PostgreSQL is stored as JSONB (a native JSON object type). The PostgreSQL driver automatically parses JSONB columns into JavaScript objects. However, the code was calling `JSON.parse()` on an already-parsed object, which caused the error.

**Solution:**
- Added type checking: `typeof item.policy_question === 'string'` before calling `JSON.parse()`
- Now handles both formats: legacy string data (parsed) and current JSONB data (already objects)
- Ensures backward compatibility while preventing crashes

**Impact:** 
Your "Awaiting Decision" queue now loads correctly, showing all pending items that need your input.

#### 2. No More Premature Library Assignment  

**Problem:** 
When the AI returned a CLARIFY response (needing your decision), the classification history showed "Classified To: Anime Movies" even though the item was still awaiting your decision. This was confusing because it looked like the item was already classified when it wasn't.

**Example:**
- AI suggests "Anime Movies" but needs clarification
- History shows: "✓ Classified To: Anime Movies" (misleading)
- Queue page showed "Awaiting Decision" (correct, but inconsistent)

**Root Cause:**
The database was storing the fallback/suggested library in `library_id` and `library_name` columns even when `status = 'awaiting_decision'`. This caused the UI to display the library as if classification was complete.

**Solution:**
- When `status = 'awaiting_decision'`, set `library_id = NULL` and `library_name = NULL` in database
- Library only assigned after you make a decision via Discord or Queue UI
- Discord notifications still show the AI's suggestion for context
- History UI now correctly shows "Awaiting Decision" instead of a library name

**Impact:** 
The UI is now consistent - items awaiting your decision clearly show "Awaiting Decision" status until you actually make a choice.

#### 3. Discord Notifications Now Always Appear for Clarification Items

**Problem:**
Some items requiring clarification were not appearing in Discord, even though they showed up in the "Awaiting Decision" queue on the platform. This meant you might miss items that need your input if you rely on Discord notifications.

**Root Cause:**
Multiple issues prevented Discord notifications from appearing reliably:
- Errors during notification sending were being silently swallowed (no logging)
- Missing tier configuration for certain confidence ranges would cause notifications to fail
- No comprehensive logging to diagnose why notifications didn't appear

**Solution:**
- Added enhanced logging: Every notification attempt is now logged with classification ID, title, confidence, and status
- Discord notification errors are now caught and logged with full error details (instead of crashing the classification)
- Added fallback tiers for ALL confidence ranges (50-70: clarify, 70-100: auto) to ensure no item is missed
- Comprehensive error logging shows exactly why a notification failed (channel issues, tier lookup failures, etc.)

**Impact:**
All items needing clarification now reliably appear in Discord with action buttons. If a notification fails for any reason, the error is logged in server logs for debugging, and the platform queue remains accurate.

#### 4. Awaiting Decision Queue Always Shows Correct Count

**Problem:**
The "Awaiting Decision" queue might not accurately reflect all pending items, especially if Discord notifications failed to send.

**Root Cause:**
This was already working correctly, but we've added documentation to clarify: The queue is based purely on database `status = 'awaiting_decision'`, completely independent of Discord notification success.

**Solution:**
- Verified that `/api/classification/pending` queries directly from `classification_history.status = 'awaiting_decision'`
- Queue count matches actual database records, regardless of Discord state
- Items display correctly even when Discord notifications fail

**Impact:**
The platform queue is the source of truth for pending items. Even if Discord is down or notifications fail, you can always see and resolve pending items from the queue page.

#### 5. RAG Embeddings Now Work with Remote Ollama (Configuration Cache Bug)

**Problem:**
Users with Ollama running on a remote host (e.g., `192.168.50.95:11434`) found that embeddings were still being sent to `localhost:11434` even after configuring the remote host in Settings → AI Provider. This caused:
- ✅ `curl http://192.168.50.95:11434/api/embeddings` → Works (external Ollama)
- ❌ `curl http://localhost:11434/api/embeddings` → Fails (nothing inside container)
- ❌ RAG status shows 0 embeddings despite thousands of classifications

**Root Cause:**
The `OllamaService.getConfig()` method cached the `baseUrl` on first call:
```javascript
async getConfig() {
    if (this.baseUrl) {
      return { host: this.host, port: this.port, baseUrl: this.baseUrl }; // Returns cached value!
    }
    // ... fetch from database ...
}
```

**What Happened:**
1. On container startup, if `ollama_config` table is empty and `ai_provider_config.ollama_host` is NULL
2. First call caches `localhost:11434` into `this.baseUrl`
3. User then configures `192.168.50.95` in the UI
4. All subsequent calls return the cached `localhost` value!
5. Embeddings fail silently because Ollama isn't running inside the container

**Solution:**
- Added `ollamaService.resetConfig()` call to ai_provider_config update endpoint
- Cache is now properly invalidated when you update Ollama settings
- Maintains performance benefits of caching (avoids repeated DB queries)
- Configuration changes take effect immediately after saving

**Impact:** 
RAG embeddings now correctly use your configured Ollama host. When you update the Ollama host in Settings → AI Provider, the change takes effect immediately. Performance is maintained through intelligent caching with proper invalidation.

#### 4. Discord Clarification Prompts Now Working

**Problem:**
Items with `needs_clarification: true` should trigger Discord prompts with clarification buttons, but **you weren't getting any Discord notifications** for items needing clarification.

**Root Cause:**
When the AI returns a CLARIFY response (or when AI response is malformed), the result object was missing the `libraries` array. The Discord notification code creates two components:
1. Clarification buttons from `result.clarification.options`
2. Library dropdown menu from `result.libraries`

Without the `libraries` array, the dropdown creation at line 739 would fail the check `if (libraries && libraries.length > 1)`. While the clarification buttons were created correctly, the missing dropdown likely caused the entire component creation to fail silently.

**Solution:**
- Added `libraries: libraries` to CLARIFY response objects (lines 1500 and 1521)
- Both AI clarification responses and fallback cases now include the libraries array
- Discord can now create both the clarification buttons AND the library dropdown

**Impact:** 
Discord notifications now appear for items needing clarification, with both AI-suggested options as buttons and a manual library dropdown as fallback.

### Technical Notes
- Bug #1 fix location: `server/src/routes/classification.js` line 444
- Bug #2 fix location: `server/src/services/classification.js` lines 1537-1540
- Bug #3 fix location: `server/src/services/ollama.js` lines 102-107 (cache with invalidation), `server/src/routes/settings.js` line 2394 (reset cache on update)
- Bug #4 fix location: `server/src/services/classification.js` lines 1500, 1521

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
