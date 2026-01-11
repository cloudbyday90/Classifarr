# Classifarr v0.37.0 Release Notes

## 🎯 Overview

**Revolutionary Classification Redesign:** v0.37.0 shifts from "AI decides" to "Formula calculates + AI validates"

This release fundamentally reimagines classification to be:
- **Transparent** - Users see exactly why each item was classified
- **Configurable** - Adjust weights for presets, patterns, RAG, and history
- **Efficient** - AI only validates, doesn't make primary decisions
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

### 168 Content Presets
Pre-built signal definitions organized into categories:
- **Genres** (35): Action, Comedy, Horror, Documentary, etc.
- **Ratings** (12): Family-friendly, Teen, Mature content
- **Themes** (28): Superhero, True Crime, Sports, Holiday, etc.
- **Studios** (18): Major studio content profiles
- **Eras** (8): Classic, Vintage, Modern, Contemporary
- **Languages** (15): Regional content definitions
- **Special** (52): Anime, Reality TV, Standup, etc.

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
- Event detection will be removed in v0.39.0
- **Migration:** Use seasonal presets (`christmas_holiday`, `halloween`, etc.) or genre presets (`sports_doc`, `concert`)
- See [Migration Guide](docs/migration/v037.md#example-4-event-detection-migration) for details

### Configuration Changes
- New config options for policy weights
- Default thresholds: auto=85%, prompt=60%

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
