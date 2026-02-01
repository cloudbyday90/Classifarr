# Classification API

Classify media items using Classifarr's Policy Engine, view classification history, and manage the classification queue.

---

## Table of Contents

1. [Overview](#overview)
2. [Classification Endpoints](#classification-endpoints)
3. [Queue Management](#queue-management)
4. [Classification History](#classification-history)
5. [Policy-Based Classification](#policy-based-classification)
6. [Examples](#examples)

---

## Overview

The Classification API provides:

- **Manual classification** of media by TMDB ID
- **Classification history** tracking
- **Queue management** for batch processing
- **Policy-based routing** with confidence thresholds
- **Reclassification** of existing items

### Authentication

All endpoints require authentication via JWT token or API key.

**Write operations** require `read_write` permission.

---

## Classification Endpoints

### POST /api/classification/classify

Manually classify a media item by TMDB ID.

**Authentication:** Required (API Key or JWT)

**Request Body:**
```json
{
  "tmdb_id": 862,
  "media_type": "movie",
  "title": "Toy Story"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tmdb_id` | integer | Yes | TMDB ID of the media |
| `media_type` | string | Yes | `movie` or `tv` |
| `title` | string | No | Media title (optional, for display) |

**Success Response (200):**
```json
{
  "success": true,
  "library_id": 1,
  "library_name": "Kids Movies",
  "confidence": 92,
  "method": "policy",
  "signals": {
    "preset_score": 85,
    "pattern_score": 90,
    "rag_score": 95,
    "history_score": 88
  },
  "processing_time": 0.45
}
```

**Example:**
```bash
curl -X POST http://localhost:21324/api/classification/classify \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "tmdb_id": 862,
    "media_type": "movie",
    "title": "Toy Story"
  }'
```

---

### GET /api/classification/history

Get classification history with filtering and pagination.

**Authentication:** Required (API Key or JWT)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `50` | Items per page (max 100) |
| `media_type` | string | - | Filter by `movie` or `tv` |
| `library_id` | integer | - | Filter by library |
| `method` | string | - | Filter by classification method |
| `excludeMethod` | string | - | Exclude specific method (e.g., `source_library`) |

**Success Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "title": "Toy Story",
      "media_type": "movie",
      "tmdb_id": 862,
      "library_id": 1,
      "library_name": "Kids Movies",
      "confidence": 92,
      "method": "policy",
      "created_at": "2026-02-01T12:00:00Z",
      "metadata": {
        "signals": {
          "preset_score": 85,
          "pattern_score": 90
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 247,
    "totalPages": 5
  }
}
```

**Methods:**
- `policy` - Classified by policy engine
- `manual` - Manually classified by user
- `source_library` - Already in library (authoritative)
- `correction` - User correction/override
- `ai` - AI-based classification

**Example:**
```bash
# Get recent classifications (exclude source_library for "new" classifications)
curl -X GET "http://localhost:21324/api/classification/history?limit=20&excludeMethod=source_library" \
  -H "X-API-Key: clf_your_key"

# Get movie classifications for a specific library
curl -X GET "http://localhost:21324/api/classification/history?media_type=movie&library_id=1" \
  -H "X-API-Key: clf_your_key"
```

---

### GET /api/classification/history/:id

Get detailed information about a specific classification.

**Authentication:** Required (API Key or JWT)

**Success Response (200):**
```json
{
  "id": 1,
  "title": "Toy Story",
  "media_type": "movie",
  "tmdb_id": 862,
  "library_id": 1,
  "library_name": "Kids Movies",
  "confidence": 92,
  "method": "policy",
  "created_at": "2026-02-01T12:00:00Z",
  "metadata": {
    "signals": {
      "preset_score": 85,
      "pattern_score": 90,
      "rag_score": 95,
      "history_score": 88
    },
    "matched_presets": ["family_friendly", "animation"],
    "processing_time": 0.45
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/classification/history/1 \
  -H "X-API-Key: clf_your_key"
```

---

### POST /api/classification/corrections

Submit a correction/override for a classification.

**Authentication:** Required (`read_write` permission)

**Request Body:**
```json
{
  "classification_id": 1,
  "correct_library_id": 2,
  "reason": "Should be in 4K library"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "correction_id": 1
}
```

**Example:**
```bash
curl -X POST http://localhost:21324/api/classification/corrections \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "classification_id": 1,
    "correct_library_id": 2,
    "reason": "Should be in 4K library"
  }'
```

---

## Queue Management

### POST /api/queue/clear-and-resync

Clear the queue and resync all libraries.

**Authentication:** Required (`read_write` permission)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Queue cleared and resync started"
}
```

**Error Response (409):**
```json
{
  "error": "Sync already in progress"
}
```

**Example:**
```bash
curl -X POST http://localhost:21324/api/queue/clear-and-resync \
  -H "X-API-Key: clf_your_key"
```

---

### GET /api/queue/stats

Get queue statistics.

**Authentication:** Required (API Key or JWT)

**Success Response (200):**
```json
{
  "pending": 15,
  "processing": 1,
  "completed": 247,
  "failed": 2,
  "total": 265
}
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/queue/stats \
  -H "X-API-Key: clf_your_key"
```

---

## Policy-Based Classification

### Classification Flow

1. **Authoritative Signals** (100% confidence):
   - Media already in library
   - User manual correction
   - Exact TMDB match from history

2. **Policy Evaluation** (Formula-based scoring):
   - Preset matching (40% weight)
   - Pattern matching (25% weight)
   - RAG semantic search (20% weight)
   - Historical accuracy (15% weight)

3. **Action Determination** (by confidence):
   - ≥85%: Auto-classify
   - 60-84%: Prompt for confirmation
   - 40-59%: Prompt to select from top 3
   - <40%: Manual classification required

4. **AI Validation** (Optional for 60-90% scores):
   - AI confirms or adjusts suggestion

5. **Feedback & Learning**:
   - Record decision
   - Discover new patterns
   - Generate tuning suggestions

### Confidence Thresholds

**Auto-Classify Threshold (default: 85%):**

Media with confidence ≥85% is automatically classified without user intervention.

**Prompt Threshold (default: 60%):**

Media with confidence between 60-84% prompts the user to confirm the suggestion.

**Configure in Policies:**
```bash
curl -X PUT http://localhost:21324/api/policies/1 \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_classify_threshold": 85,
    "prompt_threshold": 60
  }'
```

---

## Examples

### Classify Media with Error Handling (JavaScript)

```javascript
async function classifyMedia(tmdbId, mediaType, title) {
  try {
    const response = await fetch('http://localhost:21324/api/classification/classify', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.CLASSIFARR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tmdb_id: tmdbId,
        media_type: mediaType,
        title: title
      })
    });
    
    if (!response.ok) {
      throw new Error(`Classification failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log(`Classified to: ${result.library_name}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`Method: ${result.method}`);
    
    return result;
  } catch (error) {
    console.error('Classification error:', error);
    throw error;
  }
}

// Usage
await classifyMedia(862, 'movie', 'Toy Story');
```

### Get Recent Classifications (Python)

```python
import requests
import os

API_URL = 'http://localhost:21324'
API_KEY = os.environ['CLASSIFARR_API_KEY']

def get_recent_classifications(limit=20):
    """Get recent classifications excluding source_library"""
    response = requests.get(
        f'{API_URL}/api/classification/history',
        headers={'X-API-Key': API_KEY},
        params={
            'limit': limit,
            'excludeMethod': 'source_library'
        }
    )
    response.raise_for_status()
    
    data = response.json()
    
    for item in data['items']:
        print(f"{item['title']} → {item['library_name']} ({item['confidence']}%)")
    
    return data['items']

# Usage
recent = get_recent_classifications(limit=10)
```

### Submit Correction

```javascript
async function correctClassification(classificationId, correctLibraryId, reason) {
  const response = await fetch('http://localhost:21324/api/classification/corrections', {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      classification_id: classificationId,
      correct_library_id: correctLibraryId,
      reason: reason
    })
  });
  
  if (!response.ok) {
    throw new Error(`Correction failed: ${response.status}`);
  }
  
  return await response.json();
}
```

### Monitor Queue Stats

```python
import time

def monitor_queue(interval=5):
    """Monitor queue statistics in real-time"""
    while True:
        response = requests.get(
            f'{API_URL}/api/queue/stats',
            headers={'X-API-Key': API_KEY}
        )
        
        if response.ok:
            stats = response.json()
            print(f"Pending: {stats['pending']}, "
                  f"Processing: {stats['processing']}, "
                  f"Completed: {stats['completed']}, "
                  f"Failed: {stats['failed']}")
        
        time.sleep(interval)
```

---

## Related Documentation

- [Policies API](./policies.md) - Configure classification policies
- [Authentication Guide](./authentication.md) - API keys and permissions
- [Error Handling Guide](./errors.md) - Error codes and patterns
- [Webhooks API](./webhooks.md) - Automatic classification via webhooks
