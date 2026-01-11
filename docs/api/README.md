# API Documentation

## PolicyEngine API

### Overview

The PolicyEngine API provides endpoints for managing policies, presets, and analyzing classification results.

## Core Classification

### Classify Media Item

Classify a media item using the PolicyEngine.

**Endpoint:** `POST /api/classify`

**Request Body:**
```json
{
  "title": "Elf",
  "year": 2003,
  "media_type": "movie",
  "tmdb_id": 10719,
  "overview": "When young Buddy falls into Santa's gift sack...",
  "genres": ["Comedy", "Family", "Fantasy"],
  "keywords": ["christmas", "santa", "elf", "holiday"]
}
```

**Response (High Confidence - AI Skipped):**
```json
{
  "library": {
    "id": 5,
    "name": "Christmas Movies",
    "media_type": "movie"
  },
  "confidence": 95,
  "method": "policy_auto",
  "reason": "Policy: Christmas Policy",
  "policyResult": {
    "action": "auto_classify",
    "library": {
      "library_id": 5,
      "library_name": "Christmas Movies",
      "policy_id": 12,
      "policy_name": "Christmas Policy"
    },
    "confidence": 95,
    "scores": {
      "preset": 95,
      "pattern": 0,
      "rag": 0,
      "history": 0
    },
    "weights": {
      "preset": 1.0,
      "pattern": 0.0,
      "rag": 0.0,
      "history": 0.0
    }
  }
}
```

**Response (Medium Confidence - User Prompt):**
```json
{
  "library": {
    "id": 5,
    "name": "Christmas Movies"
  },
  "confidence": 72,
  "method": "policy_prompt",
  "reason": "Policy suggests: Christmas Policy",
  "needs_clarification": true,
  "clarification": {
    "problem_summary": "Confirm: Christmas Policy",
    "why_uncertain": "Confidence 72% - below auto-classify threshold",
    "question": "Should \"Elf\" go to Christmas Movies?",
    "options": [
      {
        "label": "Yes, Christmas Movies",
        "value": "confirm",
        "library_id": 5
      },
      {
        "label": "Family Movies",
        "value": "alt_3",
        "library_id": 3
      }
    ],
    "signal_breakdown": {
      "preset": 72,
      "pattern": 0,
      "rag": 0,
      "history": 0
    },
    "calculated_confidence": 72
  }
}
```

**Response (Low Confidence - AI Used):**
```json
{
  "library": {
    "id": 8,
    "name": "General Movies"
  },
  "confidence": 65,
  "method": "ai_verified",
  "reason": "AI analysis - uncertain match",
  "needs_clarification": false
}
```

## Policy Management

### List Policies

Get all active policies.

**Endpoint:** `GET /api/policies`

**Response:**
```json
{
  "policies": [
    {
      "id": 12,
      "library_id": 5,
      "library_name": "Christmas Movies",
      "name": "Christmas Policy",
      "enabled": true,
      "auto_classify_threshold": 85,
      "prompt_threshold": 60,
      "preset_weight": 0.40,
      "pattern_weight": 0.30,
      "rag_weight": 0.20,
      "history_weight": 0.10,
      "presets": [
        {
          "id": 145,
          "key": "event_holiday",
          "name": "Holiday & Seasonal",
          "weight": 1.5
        }
      ]
    }
  ]
}
```

### Get Policy Details

Get details for a specific policy.

**Endpoint:** `GET /api/policies/:id`

**Response:**
```json
{
  "id": 12,
  "library_id": 5,
  "name": "Christmas Policy",
  "enabled": true,
  "auto_classify_threshold": 85,
  "prompt_threshold": 60,
  "trust_patterns": true,
  "trust_rag": true,
  "trust_history": true,
  "preset_weight": 0.40,
  "pattern_weight": 0.30,
  "rag_weight": 0.20,
  "history_weight": 0.10,
  "presets": [
    {
      "id": 145,
      "key": "event_holiday",
      "name": "Holiday & Seasonal",
      "category": "events",
      "weight": 1.5,
      "signals": {
        "keywords": {
          "require_any": ["christmas", "santa", "holiday"],
          "weight": 2.0
        }
      }
    }
  ],
  "stats": {
    "total_decisions": 523,
    "accuracy": 94.5,
    "auto_classify_rate": 78.2
  }
}
```

### Update Policy

Update policy configuration.

**Endpoint:** `PUT /api/policies/:id`

**Request Body:**
```json
{
  "auto_classify_threshold": 90,
  "prompt_threshold": 70,
  "preset_weight": 0.50,
  "pattern_weight": 0.25,
  "rag_weight": 0.15,
  "history_weight": 0.10
}
```

**Response:**
```json
{
  "success": true,
  "policy": {
    "id": 12,
    "auto_classify_threshold": 90,
    "prompt_threshold": 70
  }
}
```

## Content Presets

### List Presets

Get all content presets, optionally filtered by category.

**Endpoint:** `GET /api/presets?category=events`

**Response:**
```json
{
  "presets": [
    {
      "id": 145,
      "key": "event_holiday",
      "name": "Holiday & Seasonal",
      "category": "events",
      "icon": "🎄",
      "description": "Christmas, Halloween, and seasonal content",
      "is_system": true,
      "signals": {
        "keywords": {
          "require_any": ["christmas", "santa", "holiday"],
          "weight": 2.0
        },
        "base_confidence": 95
      }
    },
    {
      "id": 146,
      "key": "event_sports",
      "name": "Sports & Athletics",
      "category": "events",
      "icon": "🏈",
      "description": "Sports events, documentaries, and athletics",
      "is_system": true,
      "signals": {
        "keywords": {
          "require_any": ["nfl", "nba", "super bowl"],
          "weight": 2.0
        },
        "genres": {
          "prefer": ["Sport", "Documentary"],
          "weight": 0.5
        },
        "base_confidence": 92
      }
    }
  ]
}
```

### Attach Preset to Policy

Add a preset to a policy.

**Endpoint:** `POST /api/policies/:policyId/presets`

**Request Body:**
```json
{
  "preset_id": 145,
  "weight": 1.5
}
```

**Response:**
```json
{
  "success": true,
  "policy_preset": {
    "id": 89,
    "policy_id": 12,
    "preset_id": 145,
    "weight": 1.5
  }
}
```

### Remove Preset from Policy

Remove a preset from a policy.

**Endpoint:** `DELETE /api/policies/:policyId/presets/:presetId`

**Response:**
```json
{
  "success": true
}
```

## Statistics

### Policy Statistics

Get statistics for a policy.

**Endpoint:** `GET /api/stats/policies/:id`

**Query Parameters:**
- `days` - Number of days to analyze (default: 30)

**Response:**
```json
{
  "policy_id": 12,
  "policy_name": "Christmas Policy",
  "stats": {
    "total_decisions": 523,
    "auto_classify_count": 409,
    "prompt_confirm_count": 87,
    "prompt_select_count": 27,
    "auto_classify_rate": 78.2,
    "accuracy": 94.5,
    "avg_confidence": 87.3,
    "avg_response_time_ms": 310
  },
  "signal_breakdown": {
    "preset": {
      "decisions": 409,
      "accuracy": 96.1,
      "avg_score": 92.3
    },
    "pattern": {
      "decisions": 87,
      "accuracy": 89.7,
      "avg_score": 71.2
    },
    "rag": {
      "decisions": 45,
      "accuracy": 84.4,
      "avg_score": 68.9
    },
    "history": {
      "decisions": 31,
      "accuracy": 80.6,
      "avg_score": 65.1
    }
  },
  "trend": {
    "direction": "improving",
    "accuracy_change": 2.3
  }
}
```

### Global Statistics

Get overall classification statistics.

**Endpoint:** `GET /api/stats/overview`

**Response:**
```json
{
  "total_policies": 15,
  "total_decisions": 8947,
  "avg_accuracy": 91.2,
  "auto_classify_rate": 74.8,
  "ai_skip_rate": 79.3,
  "avg_response_time_ms": 425,
  "stats_by_method": {
    "policy_auto": {
      "count": 6694,
      "percentage": 74.8,
      "avg_confidence": 91.5
    },
    "policy_prompt": {
      "count": 1341,
      "percentage": 15.0,
      "avg_confidence": 72.3
    },
    "ai_verified": {
      "count": 912,
      "percentage": 10.2,
      "avg_confidence": 68.7
    }
  }
}
```

## Feedback

### Submit Feedback

Submit user correction/confirmation feedback.

**Endpoint:** `POST /api/feedback`

**Request Body:**
```json
{
  "tmdb_id": 10719,
  "media_type": "movie",
  "suggested_library_id": 5,
  "actual_library_id": 5,
  "was_correct": true,
  "confidence": 95,
  "method": "policy_auto",
  "policy_id": 12
}
```

**Response:**
```json
{
  "success": true,
  "feedback_id": 1523
}
```

## Error Responses

All endpoints may return error responses in the following format:

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "message": "Missing required field: title"
}
```

**404 Not Found:**
```json
{
  "error": "Not found",
  "message": "Policy with id 999 not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Classification endpoint:** 60 requests per minute per IP
- **Other endpoints:** 120 requests per minute per IP

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## See Also

- [PolicyEngine Architecture](../architecture/policy-engine.md)
- [Preset Reference](../presets/README.md)
- [Migration Guide](../migration/v037.md)
