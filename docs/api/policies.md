# Policies API

Manage classification policies, including CRUD operations and preset attachments.

---

## Endpoints

### List All Policies

**GET** `/api/policies`

Get all policies with their associated presets.

**Query Parameters:**
- `library_id` (optional) - Filter by library ID
- `active` (optional) - Filter by active status (true/false)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "library_id": 123,
      "name": "Kids Movies Policy",
      "auto_classify_threshold": 85,
      "prompt_threshold": 60,
      "ai_validation_threshold": 90,
      "preset_weight": 0.40,
      "pattern_weight": 0.25,
      "rag_weight": 0.20,
      "history_weight": 0.15,
      "combination_mode": "weighted_average",
      "is_active": true,
      "preset_count": 5,
      "created_at": "2025-01-11T10:00:00Z",
      "updated_at": "2025-01-11T10:00:00Z"
    }
  ]
}
```

---

### Get Policy Details

**GET** `/api/policies/:id`

Get a specific policy with full preset details.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "library_id": 123,
    "name": "Kids Movies Policy",
    "auto_classify_threshold": 85,
    "prompt_threshold": 60,
    "preset_weight": 0.40,
    "pattern_weight": 0.25,
    "rag_weight": 0.20,
    "history_weight": 0.15,
    "combination_mode": "weighted_average",
    "is_active": true,
    "presets": [
      {
        "preset_id": 1,
        "key": "family_friendly",
        "name": "Family Friendly",
        "category": "audience",
        "weight": 1.0,
        "signals": {
          "certifications": {
            "mode": "include",
            "values": ["G", "PG"]
          },
          "genres": {
            "mode": "require_any",
            "values": ["Animation", "Family"],
            "weight": 0.8
          }
        }
      }
    ]
  }
}
```

---

### Create Policy

**POST** `/api/policies`

Create a new policy.

**Request Body:**

```json
{
  "library_id": 123,
  "name": "Kids Movies Policy",
  "auto_classify_threshold": 85,
  "prompt_threshold": 60,
  "ai_validation_threshold": 90,
  "preset_weight": 0.40,
  "pattern_weight": 0.25,
  "rag_weight": 0.20,
  "history_weight": 0.15,
  "combination_mode": "weighted_average",
  "trust_patterns": true,
  "trust_rag": true,
  "trust_history": true,
  "preset_ids": [1, 2, 3],
  "preset_weights": {
    "1": 1.0,
    "2": 0.8,
    "3": 1.2
  }
}
```

**Note:** `preset_ids` is an array of numeric preset IDs, while `preset_weights` is an object keyed by those IDs. In JSON, object keys are always strings, so the IDs appear as `"1"`, `"2"`, `"3"` in `preset_weights` even though they correspond to the numeric IDs in `preset_ids`.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "library_id": 123,
    "name": "Kids Movies Policy",
    ...
  }
}
```

---

### Update Policy

**PUT** `/api/policies/:id`

Update an existing policy.

**Request Body:** Same as Create Policy

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    ...
  }
}
```

---

### Delete Policy

**DELETE** `/api/policies/:id`

Delete a policy (soft delete - marks as inactive).

**Response:**

```json
{
  "success": true,
  "message": "Policy deleted successfully"
}
```

---

### Get Policy Presets

**GET** `/api/policies/:id/presets`

Get all presets attached to a policy.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "preset_id": 1,
      "key": "family_friendly",
      "name": "Family Friendly",
      "category": "audience",
      "weight": 1.0,
      "signals": {...}
    }
  ]
}
```

---

### Attach Preset to Policy

**POST** `/api/policies/:id/presets`

Attach a preset to a policy.

**Request Body:**

```json
{
  "preset_id": 5,
  "weight": 1.2
}
```

**Response:**

```json
{
  "success": true,
  "message": "Preset attached successfully"
}
```

---

### Remove Preset from Policy

**DELETE** `/api/policies/:id/presets/:presetId`

Remove a preset from a policy.

**Response:**

```json
{
  "success": true,
  "message": "Preset removed successfully"
}
```

---

## Validation Rules

### Policy Creation/Update

- `name`: Required, 1-100 characters
- `auto_classify_threshold`: 0-100
- `prompt_threshold`: 0-100
- `ai_validation_threshold`: 0-100
- Weights are configurable per policy; for `weighted_average` mode it is recommended (but not required) that `preset_weight + pattern_weight + rag_weight + history_weight` is approximately 1.0
- `combination_mode`: One of `best_match`, `average`, `weighted_average`, `require_all`

### Preset Attachment

- `preset_id`: Must exist in `content_presets` table
- `weight`: 0.0-2.0 (allows boosting/reducing individual presets)
- Cannot attach same preset twice to same policy

---

## Examples

### Create a Kids Policy

```bash
curl -X POST http://localhost:21324/api/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "library_id": 123,
    "name": "Kids Movies",
    "auto_classify_threshold": 90,
    "prompt_threshold": 70,
    "preset_ids": [1, 2, 3],
    "preset_weights": {
      "1": 1.0,
      "2": 1.0,
      "3": 0.8
    }
  }'
```

### Update Thresholds

```bash
curl -X PUT http://localhost:21324/api/policies/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_classify_threshold": 85,
    "prompt_threshold": 65
  }'
```

### Add Preset to Policy

```bash
curl -X POST http://localhost:21324/api/policies/1/presets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preset_id": 10,
    "weight": 1.2
  }'
```
