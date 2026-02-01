# cURL Examples

Complete cURL examples for all major Classifarr API operations.

---

## Table of Contents

1. [Setup](#setup)
2. [Authentication](#authentication)
3. [System Health](#system-health)
4. [Libraries](#libraries)
5. [Media Sync](#media-sync)
6. [Classification](#classification)
7. [Policies](#policies)
8. [Error Handling](#error-handling)

---

## Setup

Set your API base URL and key as environment variables:

```bash
export CLASSIFARR_URL="http://localhost:21324"
export CLASSIFARR_API_KEY="clf_your_api_key_here"
```

---

## Authentication

### Login (Get JWT Token)

```bash
# Login and extract token
TOKEN=$(curl -s -X POST "$CLASSIFARR_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

### Create API Key (Requires JWT)

```bash
curl -X POST "$CLASSIFARR_URL/api/keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Automation Script",
    "permissions": "read_write",
    "expires_at": "2026-12-31T23:59:59Z"
  }' | jq '.'
```

### List API Keys

```bash
curl -X GET "$CLASSIFARR_URL/api/keys" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Reveal API Key

```bash
curl -X GET "$CLASSIFARR_URL/api/keys/1/reveal" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## System Health

### Get Overall Health

```bash
curl -X GET "$CLASSIFARR_URL/api/system/health" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Get Detailed Service Health

```bash
curl -X GET "$CLASSIFARR_URL/api/system/health/services" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Force Refresh Health Checks

```bash
curl -X POST "$CLASSIFARR_URL/api/system/health/refresh" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Liveness Probe (Kubernetes)

```bash
curl -X GET "$CLASSIFARR_URL/api/system/health/live"
```

### Readiness Probe (Kubernetes)

```bash
curl -X GET "$CLASSIFARR_URL/api/system/health/ready"
```

### Get System Status

```bash
curl -X GET "$CLASSIFARR_URL/api/system/status" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

---

## Libraries

### List All Libraries

```bash
curl -X GET "$CLASSIFARR_URL/api/libraries" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Get Library Details

```bash
curl -X GET "$CLASSIFARR_URL/api/libraries/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Update Library

```bash
curl -X PUT "$CLASSIFARR_URL/api/libraries/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kids & Family Movies",
    "priority": 95,
    "is_active": true
  }' | jq '.'
```

### Delete Library

```bash
curl -X DELETE "$CLASSIFARR_URL/api/libraries/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Get Libraries with Pending Suggestions

```bash
curl -X GET "$CLASSIFARR_URL/api/libraries/pending-suggestions" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

---

## Media Sync

### Trigger Library Sync

```bash
# Full sync
curl -X POST "$CLASSIFARR_URL/api/media-sync/sync/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "incremental": false,
    "batchSize": 100
  }' | jq '.'

# Incremental sync
curl -X POST "$CLASSIFARR_URL/api/media-sync/sync/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "incremental": true
  }' | jq '.'
```

### Get Library Items

```bash
# First 50 items
curl -X GET "$CLASSIFARR_URL/api/media-sync/items/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# With pagination
curl -X GET "$CLASSIFARR_URL/api/media-sync/items/1?limit=50&offset=50" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Lookup Media by TMDB ID

```bash
# Check if movie exists
curl -X GET "$CLASSIFARR_URL/api/media-sync/lookup/862?mediaType=movie" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Check if TV show exists
curl -X GET "$CLASSIFARR_URL/api/media-sync/lookup/1399?mediaType=tv" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Get Sync Status

```bash
# All libraries
curl -X GET "$CLASSIFARR_URL/api/media-sync/sync/status" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Specific library
curl -X GET "$CLASSIFARR_URL/api/media-sync/sync/status?libraryId=1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

---

## Classification

### Classify Media

```bash
curl -X POST "$CLASSIFARR_URL/api/classification/classify" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tmdb_id": 862,
    "media_type": "movie",
    "title": "Toy Story"
  }' | jq '.'
```

### Get Classification History

```bash
# Recent classifications
curl -X GET "$CLASSIFARR_URL/api/classification/history?limit=20" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Exclude source_library (new classifications only)
curl -X GET "$CLASSIFARR_URL/api/classification/history?limit=20&excludeMethod=source_library" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Filter by library
curl -X GET "$CLASSIFARR_URL/api/classification/history?library_id=1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Filter by media type
curl -X GET "$CLASSIFARR_URL/api/classification/history?media_type=movie" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Get Classification Details

```bash
curl -X GET "$CLASSIFARR_URL/api/classification/history/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Submit Correction

```bash
curl -X POST "$CLASSIFARR_URL/api/classification/corrections" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "classification_id": 1,
    "correct_library_id": 2,
    "reason": "Should be in 4K library"
  }' | jq '.'
```

---

## Policies

### List All Policies

```bash
curl -X GET "$CLASSIFARR_URL/api/policies" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Get Policy Details

```bash
curl -X GET "$CLASSIFARR_URL/api/policies/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### Create Policy

```bash
curl -X POST "$CLASSIFARR_URL/api/policies" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "library_id": 1,
    "name": "Kids Movies Policy",
    "auto_classify_threshold": 85,
    "prompt_threshold": 60,
    "preset_weight": 0.40,
    "pattern_weight": 0.25,
    "rag_weight": 0.20,
    "history_weight": 0.15,
    "preset_ids": [1, 2, 3],
    "preset_weights": {
      "1": 1.0,
      "2": 1.0,
      "3": 0.8
    }
  }' | jq '.'
```

### Update Policy

```bash
curl -X PUT "$CLASSIFARR_URL/api/policies/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_classify_threshold": 90,
    "prompt_threshold": 70
  }' | jq '.'
```

### Delete Policy

```bash
curl -X DELETE "$CLASSIFARR_URL/api/policies/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

### List Presets

```bash
# All presets
curl -X GET "$CLASSIFARR_URL/api/presets" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Filter by category
curl -X GET "$CLASSIFARR_URL/api/presets?category=genre" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'

# Search presets
curl -X GET "$CLASSIFARR_URL/api/presets?search=action" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
```

---

## Error Handling

### Handle 404 Library Not Found

```bash
#!/bin/bash

LIBRARY_ID=999

response=$(curl -s -w "\n%{http_code}" -X GET "$CLASSIFARR_URL/api/libraries/$LIBRARY_ID" \
  -H "X-API-Key: $CLASSIFARR_API_KEY")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "404" ]; then
  echo "Error: Library not found"
  exit 1
elif [ "$http_code" == "200" ]; then
  echo "Library found:"
  echo "$body" | jq '.'
else
  echo "Error: HTTP $http_code"
  echo "$body"
  exit 1
fi
```

### Handle 409 Sync Already in Progress

```bash
#!/bin/bash

response=$(curl -s -w "\n%{http_code}" -X POST "$CLASSIFARR_URL/api/media-sync/sync/1" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"incremental": false}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" == "409" ]; then
  echo "Sync already in progress:"
  echo "$body" | jq '.progress'
  
  # Wait and check status
  sleep 5
  curl -X GET "$CLASSIFARR_URL/api/media-sync/sync/status?libraryId=1" \
    -H "X-API-Key: $CLASSIFARR_API_KEY" | jq '.'
elif [ "$http_code" == "200" ]; then
  echo "Sync completed:"
  echo "$body" | jq '.'
else
  echo "Error: HTTP $http_code"
  echo "$body"
  exit 1
fi
```

### Retry with Exponential Backoff

```bash
#!/bin/bash

function api_call_with_retry() {
  local url="$1"
  local max_retries=3
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    response=$(curl -s -w "\n%{http_code}" -X GET "$url" \
      -H "X-API-Key: $CLASSIFARR_API_KEY")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    # Success
    if [ "$http_code" == "200" ]; then
      echo "$body"
      return 0
    fi
    
    # Don't retry 4xx errors (except 429)
    if [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ] && [ "$http_code" != "429" ]; then
      echo "Error: HTTP $http_code" >&2
      echo "$body" >&2
      return 1
    fi
    
    # Retry 5xx errors and 429
    if [ "$http_code" -ge 500 ] || [ "$http_code" == "429" ]; then
      retry=$((retry + 1))
      if [ $retry -lt $max_retries ]; then
        delay=$((2 ** retry))
        echo "Retry $retry/$max_retries after ${delay}s..." >&2
        sleep $delay
        continue
      fi
    fi
    
    echo "Error: HTTP $http_code" >&2
    echo "$body" >&2
    return 1
  done
  
  echo "Max retries exceeded" >&2
  return 1
}

# Usage
api_call_with_retry "$CLASSIFARR_URL/api/libraries" | jq '.'
```

---

## Complete Examples

### Health Monitoring Script

```bash
#!/bin/bash

# Monitor system health and alert on issues

while true; do
  echo "=== Health Check at $(date) ==="
  
  # Get service health
  health=$(curl -s -X GET "$CLASSIFARR_URL/api/system/health/services" \
    -H "X-API-Key: $CLASSIFARR_API_KEY")
  
  overall=$(echo "$health" | jq -r '.overall')
  
  echo "Overall Status: $overall"
  
  # Check for degrading services
  degrading=$(echo "$health" | jq -r '.services[] | select(.trend == "degrading") | .name')
  if [ -n "$degrading" ]; then
    echo "⚠️  Degrading services:"
    echo "$degrading"
  fi
  
  # Check for unhealthy services
  unhealthy=$(echo "$health" | jq -r '.services[] | select(.status == "unhealthy") | .name')
  if [ -n "$unhealthy" ]; then
    echo "❌ Unhealthy services:"
    echo "$unhealthy"
  fi
  
  echo ""
  sleep 30
done
```

### Sync All Libraries

```bash
#!/bin/bash

# Sync all active libraries sequentially

libraries=$(curl -s -X GET "$CLASSIFARR_URL/api/libraries" \
  -H "X-API-Key: $CLASSIFARR_API_KEY" | jq -r '.[] | select(.is_active == true) | .id')

for lib_id in $libraries; do
  echo "Syncing library $lib_id..."
  
  response=$(curl -s -X POST "$CLASSIFARR_URL/api/media-sync/sync/$lib_id" \
    -H "X-API-Key: $CLASSIFARR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"incremental": true}')
  
  echo "$response" | jq '.'
  
  sleep 2
done
```

---

## Related Documentation

- [Authentication Guide](../authentication.md)
- [JavaScript Examples](./javascript.md)
- [Python Examples](./python.md)
- [API Overview](../README.md)
