# Content Presets Reference

## Overview

Content presets are reusable signal definitions that describe what type of content should go into a library. They are the building blocks of the PolicyEngine classification system.

## Preset Categories

Presets are organized into categories for easy browsing:

- **Audience** - Target demographic (family, kids, mature, date night)
- **Genre** - Genre-based matching (action, comedy, horror, sci-fi)
- **Events** - Special event content (holidays, sports, concerts)
- **Quality** - Content quality filters (acclaimed, cult classics, popular)
- **Era** - Time-period based (classic, modern, golden age)
- **Format** - Content format (anthology, miniseries, standalone)

## Event Presets (v0.37.0)

Event presets replace the legacy `detectEventContent()` system, integrating event detection into the PolicyEngine.

### event_holiday
**Holiday & Seasonal Content**

Matches Christmas, Halloween, and other seasonal content.

```json
{
  "keywords": {
    "require_any": [
      "christmas", "xmas", "santa", "santa claus", "north pole",
      "reindeer", "rudolph", "frosty", "snowman", "christmas eve",
      "yuletide", "noel", "nativity", "scrooge", "grinch", "krampus",
      "nutcracker", "polar express", "mistletoe", "candy cane",
      "gingerbread", "halloween", "trick or treat", "haunted",
      "hanukkah", "chanukah", "kwanzaa", "thanksgiving", "easter",
      "valentines day", "new years eve"
    ],
    "weight": 2.0
  },
  "base_confidence": 95
}
```

**Examples:**
- "Elf" (2003)
- "A Christmas Story" (1983)
- "The Nightmare Before Christmas" (1993)
- "Hocus Pocus" (1993)

### event_sports
**Sports & Athletics**

Matches sports events, documentaries, and athletic competitions.

```json
{
  "keywords": {
    "require_any": [
      "nfl", "nba", "mlb", "nhl", "mls", "fifa", "uefa",
      "premier league", "super bowl", "world series", "stanley cup",
      "world cup", "championship", "playoffs", "tournament",
      "olympics", "olympic games", "espn", "sports documentary",
      "football game", "basketball game", "baseball game",
      "hockey game", "soccer match", "tennis match",
      "golf tournament", "motorsports", "nascar", "formula 1",
      "f1", "grand prix", "marathon", "30 for 30"
    ],
    "weight": 2.0
  },
  "genres": {
    "prefer": ["Sport", "Documentary"],
    "weight": 0.5
  },
  "base_confidence": 92
}
```

**Examples:**
- "The Last Dance" (2020)
- "30 for 30" series
- "Icarus" (2017)
- "Drive to Survive" (2019-)

### event_ppv
**PPV & Combat Sports**

Matches UFC, MMA, boxing, and wrestling events.

```json
{
  "keywords": {
    "require_any": [
      "ufc", "mma", "ultimate fighting", "bellator", "pride fc",
      "one championship", "mixed martial arts", "cage fight", "octagon",
      "boxing", "heavyweight", "middleweight", "welterweight",
      "title fight", "championship bout", "knockout",
      "wwe", "wrestling", "wrestlemania", "royal rumble", "summerslam",
      "aew", "pro wrestling", "smackdown", "pay per view", "ppv",
      "fight night", "main event"
    ],
    "weight": 2.0
  },
  "base_confidence": 93
}
```

**Examples:**
- "UFC 300: Pereira vs. Hill"
- "Tyson vs. Jones Jr."
- "WrestleMania 39"

### event_concert
**Concert & Live Music**

Matches live concerts, music festivals, and performances.

```json
{
  "keywords": {
    "require_any": [
      "concert", "live performance", "live tour", "world tour",
      "music festival", "coachella", "lollapalooza", "glastonbury",
      "rock concert", "pop concert", "symphony", "orchestra",
      "unplugged", "acoustic session", "mtv unplugged",
      "live album", "concert film", "tour documentary"
    ],
    "weight": 2.0
  },
  "genres": {
    "prefer": ["Music", "Documentary"],
    "weight": 0.5
  },
  "base_confidence": 90
}
```

**Examples:**
- "Taylor Swift: The Eras Tour" (2023)
- "Metallica: Some Kind of Monster" (2004)
- "Homecoming: A Film by Beyoncé" (2019)

### event_standup
**Stand-up Comedy**

Matches comedy specials and stand-up performances.

```json
{
  "keywords": {
    "require_any": [
      "stand-up", "standup", "comedy special", "netflix special",
      "hbo special", "live at the apollo", "def comedy jam",
      "comedian", "comedy tour", "comedy central", "roast",
      "just for laughs", "improv", "one-man show", "one-woman show"
    ],
    "weight": 2.0
  },
  "genres": {
    "prefer": ["Comedy"],
    "weight": 0.8
  },
  "base_confidence": 90
}
```

**Examples:**
- "Dave Chappelle: Sticks & Stones" (2019)
- "Bo Burnham: Inside" (2021)
- "John Mulaney: Kid Gorgeous" (2018)

### event_awards
**Awards & Ceremonies**

Matches award shows, galas, and red carpet events.

```json
{
  "keywords": {
    "require_any": [
      "oscars", "academy awards", "emmys", "golden globes", "grammys",
      "tony awards", "bafta", "mtv awards", "vma", "ama",
      "billboard awards", "peoples choice", "critics choice",
      "sag awards", "bet awards", "award ceremony", "award show",
      "red carpet"
    ],
    "weight": 2.0
  },
  "base_confidence": 88
}
```

**Examples:**
- "The 96th Academy Awards" (2024)
- "The Oscars Red Carpet Show"
- "Grammy Awards 2024"

## Using Event Presets

### Automatic Migration

If your library has `event_detection_type` set (from v0.36.x), the migration will automatically:

1. Create a policy for your library (if none exists)
2. Attach the corresponding event preset
3. Set a high weight (1.5) to prioritize event matching

```sql
-- Example: Library with event_detection_type='holiday'
-- Automatically gets event_holiday preset attached
```

### Manual Configuration

To add event presets to a library:

1. Go to **Libraries** → Select your library → **Edit**
2. Click **Policy** tab
3. Under **Content Presets**, click **Add Preset**
4. Search for "event_" to see all event presets
5. Select the preset and set weight (recommended: 1.5-2.0)
6. Click **Save**

### Combining Event Presets

You can attach multiple event presets to the same library:

**Example: Sports & Holiday Library**
```
Policy: "Sports & Specials"
├─ event_sports (weight: 1.5)
├─ event_holiday (weight: 1.5)
└─ event_awards (weight: 1.0)
```

The policy will match any content that triggers **any** of these presets.

### Adjusting Confidence

Event presets have a `base_confidence` that represents their typical confidence level. You can adjust the final confidence by:

1. **Preset Weight** - Multiply the preset score
   - 2.0 = Very important, strongly prioritize
   - 1.5 = Important, prioritize
   - 1.0 = Normal priority
   - 0.5 = Low priority, only as tiebreaker

2. **Policy Thresholds**
   - `auto_classify_threshold` (default: 85) - Auto-classify if score ≥ this
   - `prompt_threshold` (default: 60) - Prompt user if score ≥ this

## Preset Signal Configuration

All event presets use keyword-based matching with the `require_any` mode, which means:

- **require_any**: At least one keyword must match
- Keywords are matched case-insensitively
- Searches in: title, overview, keywords, genres

### Scoring Logic

```javascript
// Pseudo-code for keyword scoring
const itemText = [title, overview, ...keywords, ...genres].join(' ').toLowerCase();
const matchingKeywords = preset.keywords.require_any.filter(keyword =>
  itemText.includes(keyword.toLowerCase())
);

if (matchingKeywords.length > 0) {
  score = base_confidence;  // 88-95% depending on preset
} else {
  score = 0;  // No match
}
```

## Migration from detectEventContent()

### Before (v0.36.x)
```javascript
// Hardcoded in classification.js
const eventMatch = await this.detectEventContent(metadata, libraries);
if (eventMatch) {
  return {
    library: eventMatch.library,
    confidence: eventMatch.confidence,
    method: 'event_detection',
    eventType: eventMatch.eventType
  };
}
```

### After (v0.37.0)
```javascript
// Evaluated via PolicyEngine
const policyResult = await policyEngine.evaluateItem(metadata);
if (policyResult.action === 'auto_classify') {
  return {
    library: matchedLibrary,
    confidence: policyResult.confidence,
    method: 'policy_auto',
    reason: `Policy: ${policyResult.library.policy_name}`
  };
}
```

### Benefits

1. **Unified System** - Events use same flow as all other classifications
2. **Configurable** - Adjust keywords, weights, thresholds via UI
3. **Extensible** - Easy to add new event types or modify existing
4. **Transparent** - See full scoring breakdown in logs

## Creating Custom Event Presets

You can create your own event presets via the UI:

1. Go to **Settings** → **Content Presets**
2. Click **Create Preset**
3. Set:
   - **Name**: "Custom Event"
   - **Category**: "events"
   - **Icon**: Choose an emoji
   - **Description**: What it matches
4. Configure signals:
```json
{
  "keywords": {
    "require_any": ["keyword1", "keyword2", "keyword3"],
    "weight": 2.0
  },
  "genres": {
    "prefer": ["Documentary"],
    "weight": 0.5
  },
  "base_confidence": 90
}
```
5. Click **Save**
6. Attach to your library's policy

## Troubleshooting

### Event not being detected

**Check:**
1. Is the preset attached to the library's policy?
2. Is the preset weight high enough? (Try 1.5-2.0)
3. Are the keywords in the title, overview, or metadata keywords?
4. Is the policy enabled and active?

**Debug:**
```sql
-- Check if preset is attached
SELECT lp.name, cp.name, pp.weight
FROM library_policies lp
JOIN policy_presets pp ON pp.policy_id = lp.id
JOIN content_presets cp ON cp.id = pp.preset_id
WHERE lp.library_id = YOUR_LIBRARY_ID
  AND cp.category = 'events';
```

### Multiple events matching

If multiple event presets match (e.g., "Super Bowl Christmas Special"), the PolicyEngine will:
1. Evaluate all policies
2. Rank by final score
3. Return the highest-scoring library

You can control priority via:
- Preset weights (higher weight = higher priority)
- Policy priority (libraries table)

## See Also

- [PolicyEngine Architecture](../architecture/policy-engine.md)
- [Migration Guide](../migration/v037.md)
- [API Documentation](../api/README.md)
