# Media Sync API

Synchronize media items from your media server (Plex/Emby/Jellyfin) to Classifarr's database. The Media Sync API provides atomic operations to prevent race conditions and comprehensive error handling.

**Version:** v0.41.0-alpha includes atomic sync operations and consistent 404 handling (#226).

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoints](#endpoints)
3. [Atomic Sync Operations](#atomic-sync-operations)
4. [Error Handling](#error-handling)
5. [Examples](#examples)

---

## Overview

The Media Sync API enables:

- **Syncing** library items from media servers
- **Querying** synced media items
- **Looking up** whether media exists
- **Monitoring** sync progress
- **Atomic operations** to prevent concurrent sync conflicts

### Authentication

All endpoints require authentication via JWT token or API key.

**Write operations** (POST sync) require `read_write` permission.

### Key Features

**Atomic Sync (v0.41.0+):**
- Prevents multiple syncs from running simultaneously
- Returns 409 Conflict if sync already in progress
- Includes progress information in conflict response

**404 Handling (#226):**
- Consistent error responses when library not found
- Clear distinction between "library doesn't exist" and "library has no items"

---

## Endpoints

### POST /api/media-sync/sync/:libraryId

Trigger a library sync from the media server.

**Authentication:** Required (`read_write` permission)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `libraryId` | integer | Yes | Library ID to sync |

**Request Body:**

```json
{
  "incremental": false,
  "batchSize": 100
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `incremental` | boolean | `false` | If true, only sync new/changed items |
| `batchSize` | integer | `100` | Number of items to process per batch |

**Success Response (200):**
```json
{
  "success": true,
  "libraryId": 1,
  "itemsProcessed": 247,
  "itemsAdded": 5,
  "itemsUpdated": 12,
  "itemsRemoved": 0,
  "duration": 3.2,
  "timestamp": "2026-02-01T12:00:00Z"
}
```

**Error Responses:**

**404 Not Found** - Library doesn't exist:
```json
{
  "error": "Library not found"
}
```

**409 Conflict** - Sync already in progress (atomic operation prevents race condition):
```json
{
  "error": "Sync already in progress",
  "message": "Library sync is already running",
  "progress": {
    "processed": 150,
    "total": 247,
    "percentage": 60
  }
}
```

**500 Internal Server Error** - Sync failed:
```json
{
  "success": false,
  "error": "Failed to connect to media server"
}
```

**Example:**
```bash
# Full sync
curl -X POST http://localhost:21324/api/media-sync/sync/1 \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "incremental": false,
    "batchSize": 100
  }'

# Incremental sync (only new/changed items)
curl -X POST http://localhost:21324/api/media-sync/sync/1 \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "incremental": true
  }'
```

---

### GET /api/media-sync/items/:libraryId

Get synced media items for a library with pagination.

**Authentication:** Required (API Key or JWT)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `libraryId` | integer | Yes | Library ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `50` | Items per page (max 1000) |
| `offset` | integer | `0` | Offset for pagination |

**Success Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "library_id": 1,
      "title": "Toy Story",
      "year": 1995,
      "tmdb_id": 862,
      "media_type": "movie",
      "rating_key": "12345",
      "guid": "plex://movie/5d776b6c9077ba001f1e6f8e",
      "added_at": "2025-12-01T10:00:00Z",
      "synced_at": "2026-02-01T12:00:00Z"
    },
    {
      "id": 2,
      "library_id": 1,
      "title": "Finding Nemo",
      "year": 2003,
      "tmdb_id": 12,
      "media_type": "movie",
      "rating_key": "12346",
      "guid": "plex://movie/5d776b6c9077ba001f1e6f90",
      "added_at": "2025-12-05T14:30:00Z",
      "synced_at": "2026-02-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 247,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Empty Library Response (200):**

If library exists but has no synced items:
```json
{
  "items": [],
  "pagination": {
    "total": 0,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Error Response:**

**404 Not Found** - Library doesn't exist:
```json
{
  "error": "Library not found"
}
```

**Example:**
```bash
# Get first 50 items
curl -X GET http://localhost:21324/api/media-sync/items/1 \
  -H "X-API-Key: clf_your_key"

# Pagination - get next 50 items
curl -X GET "http://localhost:21324/api/media-sync/items/1?limit=50&offset=50" \
  -H "X-API-Key: clf_your_key"

# Get all items (large limit)
curl -X GET "http://localhost:21324/api/media-sync/items/1?limit=1000&offset=0" \
  -H "X-API-Key: clf_your_key"
```

---

### GET /api/media-sync/lookup/:tmdbId

Check if media already exists in any library (used to prevent duplicate requests).

**Authentication:** Required (API Key or JWT)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tmdbId` | integer | Yes | TMDB ID of the media |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mediaType` | string | `movie` | Media type: `movie` or `tv` |

**Success Response (200) - Media Found:**
```json
{
  "exists": true,
  "item": {
    "id": 1,
    "library_id": 1,
    "library_name": "Kids Movies",
    "title": "Toy Story",
    "year": 1995,
    "tmdb_id": 862,
    "media_type": "movie",
    "rating_key": "12345",
    "added_at": "2025-12-01T10:00:00Z"
  }
}
```

**Success Response (200) - Media Not Found:**
```json
{
  "exists": false
}
```

**Note:** This endpoint returns 200 even when media is not found. Check the `exists` field.

**Example:**
```bash
# Check if movie exists
curl -X GET "http://localhost:21324/api/media-sync/lookup/862?mediaType=movie" \
  -H "X-API-Key: clf_your_key"

# Check if TV show exists
curl -X GET "http://localhost:21324/api/media-sync/lookup/1399?mediaType=tv" \
  -H "X-API-Key: clf_your_key"
```

**Use Case:**

Prevent requesting media that's already in your library:

```javascript
async function checkMediaExists(tmdbId, mediaType) {
  const response = await fetch(
    `${API_URL}/api/media-sync/lookup/${tmdbId}?mediaType=${mediaType}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  
  const data = await response.json();
  
  if (data.exists) {
    console.log(`Media already in library: ${data.item.library_name}`);
    return true;
  }
  
  return false;
}
```

---

### GET /api/media-sync/sync/status

Get sync status for libraries.

**Authentication:** Required (API Key or JWT)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|---------|-------------|
| `libraryId` | integer | No | Filter by specific library ID |

**Success Response (200):**

**All Libraries:**
```json
{
  "syncs": [
    {
      "library_id": 1,
      "library_name": "Kids Movies",
      "status": "completed",
      "items_processed": 247,
      "items_total": 247,
      "started_at": "2026-02-01T11:55:00Z",
      "completed_at": "2026-02-01T12:00:00Z",
      "duration": 5.2
    },
    {
      "library_id": 2,
      "library_name": "4K Movies",
      "status": "in_progress",
      "items_processed": 150,
      "items_total": 300,
      "percentage": 50,
      "started_at": "2026-02-01T12:00:00Z"
    }
  ],
  "timestamp": "2026-02-01T12:05:00Z"
}
```

**Single Library:**
```json
{
  "library_id": 1,
  "library_name": "Kids Movies",
  "status": "completed",
  "items_processed": 247,
  "items_total": 247,
  "started_at": "2026-02-01T11:55:00Z",
  "completed_at": "2026-02-01T12:00:00Z",
  "duration": 5.2,
  "last_sync": "2026-02-01T12:00:00Z"
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `not_started` | Library has never been synced |
| `in_progress` | Sync is currently running |
| `completed` | Last sync completed successfully |
| `failed` | Last sync failed with error |

**Example:**
```bash
# Get status for all libraries
curl -X GET http://localhost:21324/api/media-sync/sync/status \
  -H "X-API-Key: clf_your_key"

# Get status for specific library
curl -X GET "http://localhost:21324/api/media-sync/sync/status?libraryId=1" \
  -H "X-API-Key: clf_your_key"
```

---

## Atomic Sync Operations

**New in v0.41.0-alpha:** Sync operations are atomic to prevent race conditions.

### The Problem

Without atomic operations:
1. User A triggers sync for Library 1
2. User B triggers sync for Library 1 (while A's sync is running)
3. Both syncs process items concurrently
4. Database corruption, duplicate records, or crashes

This is a **TOCTOU (Time-of-Check-Time-of-Use) race condition**.

### The Solution

**Atomic Sync Check:**

```javascript
// In mediaSyncService
const startResult = syncStatus.tryStart('library_sync');
if (!startResult.started) {
  return {
    error: 'Sync already in progress',
    progress: startResult.progress
  };
}

// Sync proceeds...
syncStatus.stop();
```

**Flow:**
1. Check if sync is running **and** acquire lock in single atomic operation
2. If lock acquired → proceed with sync
3. If lock not acquired (sync already running) → return 409 with progress
4. When sync completes → release lock

### Benefits

- **No race conditions:** Only one sync can run at a time
- **Progress visibility:** Concurrent requests get current progress
- **Graceful degradation:** Clear error message instead of crash
- **Automatic cleanup:** Lock released even if sync fails

### Handling 409 Conflicts

```javascript
async function syncLibrary(libraryId) {
  const response = await fetch(
    `${API_URL}/api/media-sync/sync/${libraryId}`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ incremental: false })
    }
  );
  
  if (response.status === 409) {
    const data = await response.json();
    console.log(`Sync already running: ${data.progress.percentage}% complete`);
    
    // Option 1: Poll until complete
    await pollSyncStatus(libraryId);
    
    // Option 2: Show progress to user
    showSyncProgress(data.progress);
    
    // Option 3: Return and let user retry later
    return { inProgress: true, progress: data.progress };
  }
  
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
  
  return await response.json();
}
```

---

## Error Handling

### 404 - Library Not Found (#226)

**Scenario:** Library ID doesn't exist in the database.

**Affected Endpoints:**
- `POST /api/media-sync/sync/:libraryId`
- `GET /api/media-sync/items/:libraryId`

**Response:**
```json
{
  "error": "Library not found"
}
```

**Handling:**

```python
def sync_library(library_id):
    response = requests.post(
        f'{API_URL}/api/media-sync/sync/{library_id}',
        headers={'X-API-Key': API_KEY},
        json={'incremental': False}
    )
    
    if response.status_code == 404:
        print(f'Library {library_id} not found - may have been deleted')
        # Refresh library list or remove from cache
        refresh_library_cache()
        return None
    
    response.raise_for_status()
    return response.json()
```

### 409 - Sync Already in Progress

See [Atomic Sync Operations](#atomic-sync-operations) for detailed handling.

**Best Practice:** Poll sync status and retry after completion:

```javascript
async function waitForSyncComplete(libraryId, maxWaitMs = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const status = await fetch(
      `${API_URL}/api/media-sync/sync/status?libraryId=${libraryId}`,
      { headers: { 'X-API-Key': API_KEY } }
    ).then(r => r.json());
    
    if (status.status === 'completed') {
      return true;
    }
    
    if (status.status === 'failed') {
      throw new Error('Sync failed');
    }
    
    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Sync timeout');
}
```

### 500 - Sync Failed

**Possible Causes:**
- Media server unreachable
- Database connection lost
- Invalid library configuration (missing media_server_id)
- API key expired for media server

**Handling:** Retry with exponential backoff (see [Error Handling Guide](./errors.md)).

---

## Examples

### Full Sync with Error Handling (JavaScript)

```javascript
async function performLibrarySync(libraryId) {
  try {
    const response = await fetch(
      `http://localhost:21324/api/media-sync/sync/${libraryId}`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.CLASSIFARR_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          incremental: false,
          batchSize: 100
        })
      }
    );
    
    // Handle 404
    if (response.status === 404) {
      console.error('Library not found');
      return null;
    }
    
    // Handle 409 - sync already running
    if (response.status === 409) {
      const data = await response.json();
      console.log(`Sync in progress: ${data.progress.percentage}%`);
      
      // Wait for completion
      await waitForSyncComplete(libraryId);
      
      // Get final results
      return await getSyncStatus(libraryId);
    }
    
    // Handle other errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`Sync complete: ${result.itemsProcessed} items in ${result.duration}s`);
    
    return result;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}
```

### Incremental Sync (Python)

```python
import requests
import time

def incremental_sync(library_id, max_retries=3):
    """Perform incremental sync with retry logic"""
    for attempt in range(max_retries):
        try:
            response = requests.post(
                f'http://localhost:21324/api/media-sync/sync/{library_id}',
                headers={'X-API-Key': os.environ['CLASSIFARR_API_KEY']},
                json={'incremental': True, 'batchSize': 100}
            )
            
            # Success
            if response.ok:
                result = response.json()
                print(f"Synced: {result['itemsAdded']} new, {result['itemsUpdated']} updated")
                return result
            
            # Library not found - don't retry
            if response.status_code == 404:
                print('Library not found')
                return None
            
            # Sync already running - wait and check status
            if response.status_code == 409:
                data = response.json()
                print(f"Sync in progress: {data['progress']['percentage']}%")
                time.sleep(5)
                continue
            
            # Server error - retry with backoff
            if response.status_code >= 500:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt
                    print(f'Server error - retrying in {wait}s')
                    time.sleep(wait)
                    continue
            
            response.raise_for_status()
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    
    raise Exception('Max retries exceeded')
```

### Check if Media Exists Before Requesting

```javascript
async function requestMedia(tmdbId, mediaType) {
  // Check if already in library
  const lookup = await fetch(
    `http://localhost:21324/api/media-sync/lookup/${tmdbId}?mediaType=${mediaType}`,
    { headers: { 'X-API-Key': API_KEY } }
  ).then(r => r.json());
  
  if (lookup.exists) {
    console.log(`Already in library: ${lookup.item.library_name}`);
    return {
      alreadyExists: true,
      library: lookup.item.library_name
    };
  }
  
  // Not in library - proceed with classification
  console.log('Media not found - proceeding with request');
  return { alreadyExists: false };
}
```

### Sync All Libraries Sequentially

```python
def sync_all_libraries():
    """Sync all libraries one by one"""
    # Get all libraries
    response = requests.get(
        'http://localhost:21324/api/libraries',
        headers={'X-API-Key': API_KEY}
    )
    libraries = response.json()
    
    results = []
    for library in libraries:
        if not library['is_active']:
            print(f"Skipping inactive library: {library['name']}")
            continue
        
        print(f"Syncing {library['name']}...")
        
        try:
            result = incremental_sync(library['id'])
            results.append({
                'library': library['name'],
                'success': True,
                'result': result
            })
        except Exception as e:
            print(f"Failed to sync {library['name']}: {e}")
            results.append({
                'library': library['name'],
                'success': False,
                'error': str(e)
            })
    
    return results
```

---

## Related Documentation

- [Libraries API](./libraries.md) - Manage library configurations
- [Error Handling Guide](./errors.md) - Error codes and retry strategies
- [Authentication Guide](./authentication.md) - API keys and permissions
- [System Health API](./system.md) - Monitor media server connectivity
