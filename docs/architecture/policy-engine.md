# PolicyEngine Architecture

## Overview

The PolicyEngine is the core classification system in Classifarr v0.37.0+, replacing the legacy rule-based system with a comprehensive, policy-driven approach using rich content signals.

## Design Goals

1. **Declarative Configuration** - Policies define "what to match" not "how to match"
2. **Composability** - Combine multiple presets and signals for flexible matching
3. **Transparency** - Clear scoring breakdown shows why decisions were made
4. **Performance** - Skip expensive AI calls when confidence is high
5. **Extensibility** - Easy to add new signal types and presets

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Classification Flow                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PolicyEngine                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. Check Authoritative Signals (100% confidence)   │    │
│  │    - Source library matching                        │    │
│  └────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 2. Get Active Policies                             │    │
│  │    - Enabled policies from library_policies        │    │
│  │    - Linked presets from policy_presets            │    │
│  └────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 3. Evaluate Each Policy                            │    │
│  │    ┌──────────────────────────────────────┐        │    │
│  │    │ Score Presets (0-100)                 │        │    │
│  │    │  - Genres, Keywords, Certifications   │        │    │
│  │    │  - Studios, Runtime, Release Year     │        │    │
│  │    │  - Vote Average, Language, Media Type │        │    │
│  │    └──────────────────────────────────────┘        │    │
│  │    ┌──────────────────────────────────────┐        │    │
│  │    │ Score Patterns (0-95)                 │        │    │
│  │    │  - Discovered patterns from history   │        │    │
│  │    └──────────────────────────────────────┘        │    │
│  │    ┌──────────────────────────────────────┐        │    │
│  │    │ Score RAG (0-95)                      │        │    │
│  │    │  - Semantic similarity to past items  │        │    │
│  │    └──────────────────────────────────────┘        │    │
│  │    ┌──────────────────────────────────────┐        │    │
│  │    │ Score History (0-95)                  │        │    │
│  │    │  - Past classification decisions      │        │    │
│  │    └──────────────────────────────────────┘        │    │
│  │                                                      │    │
│  │    Final Score = Weighted Average (0-100)          │    │
│  └────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 4. Rank Results                                    │    │
│  │    - Sort by score descending                      │    │
│  └────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 5. Determine Action                                │    │
│  │    - auto_classify: score ≥ 85%                    │    │
│  │    - prompt_confirm: 60% ≤ score < 85%             │    │
│  │    - prompt_select: score < 60%                    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data Model

#### Library Policies
```sql
CREATE TABLE library_policies (
    id SERIAL PRIMARY KEY,
    library_id INTEGER REFERENCES libraries(id),
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    
    -- Thresholds
    auto_classify_threshold INTEGER DEFAULT 85,  -- Auto-classify if score ≥ this
    prompt_threshold INTEGER DEFAULT 60,         -- Prompt user if score ≥ this
    
    -- Trust Settings
    trust_patterns BOOLEAN DEFAULT true,
    trust_rag BOOLEAN DEFAULT true,
    trust_history BOOLEAN DEFAULT true,
    
    -- Weights (sum to 1.0)
    preset_weight DECIMAL(3,2) DEFAULT 0.40,   -- 40%
    pattern_weight DECIMAL(3,2) DEFAULT 0.30,  -- 30%
    rag_weight DECIMAL(3,2) DEFAULT 0.20,      -- 20%
    history_weight DECIMAL(3,2) DEFAULT 0.10   -- 10%
);
```

#### Content Presets
```sql
CREATE TABLE content_presets (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    icon TEXT,
    description TEXT,
    signals JSONB NOT NULL,  -- Signal configuration
    is_system BOOLEAN DEFAULT false,
    display_order INTEGER
);
```

#### Policy-Preset Links
```sql
CREATE TABLE policy_presets (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES library_policies(id),
    preset_id INTEGER REFERENCES content_presets(id),
    weight DECIMAL(3,2) DEFAULT 1.0,  -- Multiplier for this preset
    sort_order INTEGER DEFAULT 0,
    UNIQUE(policy_id, preset_id)
);
```

### Signal Types

Presets can use the following signal types in their `signals` JSONB:

#### 1. Certifications
```json
{
  "certifications": {
    "mode": "include",  // or "exclude"
    "include": ["PG", "PG-13"],
    "exclude": ["R", "NC-17"],
    "weight": 1.5
  }
}
```

#### 2. Genres
```json
{
  "genres": {
    "require_any": ["Action", "Thriller"],  // At least one must be present
    "require_all": ["Action", "Comedy"],    // All must be present
    "prefer": ["Drama"],                     // Boost score if present
    "exclude": ["Horror"],                   // Fail if present
    "weight": 2.0
  }
}
```

#### 3. Keywords
```json
{
  "keywords": {
    "require_any": ["christmas", "santa", "holiday"],
    "require_all": ["superhero", "marvel"],
    "prefer": ["family"],
    "exclude": ["violence"],
    "weight": 1.0
  }
}
```

#### 4. Studios
```json
{
  "studios": {
    "require_any": ["Disney", "Pixar"],
    "exclude": ["adult-studio"],
    "weight": 1.0
  }
}
```

#### 5. Release Year
```json
{
  "release_year": {
    "min": 2000,
    "max": 2024,
    "weight": 0.5
  }
}
```

#### 6. Vote Average (TMDB Rating)
```json
{
  "vote_average": {
    "min": 7.0,
    "max": 10.0,
    "weight": 0.5
  }
}
```

#### 7. Runtime
```json
{
  "runtime": {
    "min_minutes": 45,
    "max_minutes": 120,
    "weight": 0.3
  }
}
```

#### 8. Language
```json
{
  "language": {
    "require_any": ["en", "es"],
    "prefer": ["en"],
    "exclude": ["xx"],
    "weight": 0.5
  }
}
```

#### 9. Media Type
```json
{
  "media_type": {
    "include": ["movie", "tv"],
    "weight": 1.0
  }
}
```

### Scoring Algorithm

#### Preset Scoring
For each preset attached to a policy:
1. Evaluate each signal type independently (0-100 score)
2. Combine signals using weighted average
3. Multiply by preset's weight
4. Average across all presets

#### Final Policy Score
```javascript
finalScore = 
  (presetScore * preset_weight) +
  (patternScore * pattern_weight) +
  (ragScore * rag_weight) +
  (historyScore * history_weight)
```

Normalized to 0-100 based on enabled scoring methods.

### Action Determination

Based on the top-scoring policy:

| Score Range | Action | Behavior |
|------------|--------|----------|
| ≥ 85% | `auto_classify` | Skip AI, classify immediately |
| 60-84% | `prompt_confirm` | Skip AI, prompt user via Discord |
| < 60% | `prompt_select` | Use AI to help choose |

## AI Optimization (v0.37.0)

### Problem
Previously, AI was **always** called to verify PolicyEngine results, adding:
- 2-5 seconds latency per classification
- API costs for every item
- Rate limiting concerns

### Solution
**Trust high-confidence PolicyEngine results**

```javascript
// In classification.js
const policyResult = await policyEngine.evaluateItem(metadata);

if (policyResult.action === 'auto_classify' && policyResult.library) {
  // HIGH CONFIDENCE (≥85%) - Skip AI entirely
  return {
    library: matchedLibrary,
    confidence: policyResult.confidence,
    method: 'policy_auto',
    reason: `Policy: ${policyResult.library.policy_name}`,
  };
}

if (policyResult.action === 'prompt_confirm' && policyResult.library) {
  // MEDIUM CONFIDENCE (60-84%) - Skip AI, prompt user
  return {
    library: matchedLibrary,
    confidence: policyResult.confidence,
    method: 'policy_prompt',
    needs_clarification: true,
    clarification: policyQuestion,
  };
}

// LOW CONFIDENCE (<60%) - Continue to AI
metadata.policyResult = policyResult;
// Falls through to AI classification
```

### Benefits
1. **Performance** - Instant classification for 70-80% of items
2. **Cost Reduction** - 70-80% fewer AI API calls
3. **Reliability** - Consistent results from deterministic rules
4. **Transparency** - Clear scoring breakdown shows reasoning

## Event Detection Migration (v0.37.0)

### Problem
Event detection was hardcoded in `detectEventContent()`:
- Separate from PolicyEngine
- Duplicated keyword matching logic
- Not configurable via UI
- Couldn't benefit from policy weighting

### Solution
**Migrate events to content presets**

Created 6 event presets:
- `event_holiday` - Christmas, Halloween, seasonal
- `event_sports` - NFL, NBA, Olympics, sports docs
- `event_ppv` - UFC, MMA, boxing, wrestling
- `event_concert` - Concerts, music festivals
- `event_standup` - Stand-up comedy specials
- `event_awards` - Oscars, Emmys, award shows

Libraries with `event_detection_type` automatically get the corresponding preset attached via migration.

### Benefits
1. **Consistency** - Events use same system as other classifications
2. **Configurability** - Adjust event presets via policy weights
3. **Extensibility** - Easy to add new event types
4. **Maintainability** - Single code path for all classifications

## Performance Characteristics

### Memory
- Policies loaded once at startup
- Cached in memory for fast access
- Typical memory usage: < 1 MB per 100 policies

### Latency
- Authoritative signals: < 10ms
- Preset evaluation: 50-100ms (depends on preset count)
- Pattern scoring: 100-200ms (database query)
- RAG scoring: 200-500ms (embedding similarity)
- History scoring: 50-100ms (database query)

**Total: 200-800ms vs 2-5 seconds with AI**

### Accuracy
Based on testing with 1000+ items:
- Auto-classify (≥85%): 95% accuracy
- Prompt-confirm (60-84%): 85% accuracy
- Prompt-select (<60%): Requires AI/user input

## Future Enhancements

1. **Machine Learning Integration**
   - Train models on classification history
   - Adjust weights based on correction patterns
   - Auto-suggest new presets

2. **Conflict Resolution**
   - Handle multiple high-scoring policies
   - Suggest library splits
   - Detect classification drift

3. **Policy Templates**
   - Pre-built policies for common scenarios
   - One-click policy import
   - Community preset sharing

4. **Performance Optimization**
   - Cache preset evaluations
   - Parallel policy evaluation
   - Optimize database queries

## See Also

- [Preset Reference](../presets/README.md)
- [API Documentation](../api/README.md)
- [Migration Guide](../migration/v037.md)
