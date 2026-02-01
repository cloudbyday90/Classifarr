# Libraries API

Manage Radarr and Sonarr library configurations. Libraries are the core organizational unit in Classifarr, representing different media collections (e.g., "Kids Movies", "4K Movies", "TV Shows").

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoints](#endpoints)
3. [Library Object](#library-object)
4. [Error Handling](#error-handling)
5. [Examples](#examples)

---

## Overview

The Libraries API provides endpoints to:

- **List** all configured libraries
- **Get** detailed library information with sync status
- **Update** library configuration
- **Delete** libraries
- **Trigger** library syncs (see [Media Sync API](./media-sync.md))

### Authentication

All library endpoints require authentication via JWT token or API key.

**Write operations** (PUT, DELETE, POST sync) require `read_write` permission.

---

## Endpoints

### GET /api/libraries

List all libraries with media server information.

**Authentication:** Required (API Key or JWT)

**Query Parameters:** None

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Kids Movies",
    "media_type": "movie",
    "arr_type": "radarr",
    "arr_id": 1,
    "media_server_id": 1,
    "media_server_name": "Plex",
    "media_server_type": "plex",
    "root_folder": "/movies/kids",
    "quality_profile_id": 4,
    "is_active": true,
    "priority": 100,
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T10:00:00Z"
  },
  {
    "id": 2,
    "name": "4K Movies",
    "media_type": "movie",
    "arr_type": "radarr",
    "arr_id": 2,
    "media_server_id": 1,
    "media_server_name": "Plex",
    "media_server_type": "plex",
    "root_folder": "/movies/4k",
    "quality_profile_id": 7,
    "is_active": true,
    "priority": 90,
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T10:00:00Z"
  }
]
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_your_key"
```

---

### GET /api/libraries/:id

Get detailed information about a specific library, including item count and sync status.

**Authentication:** Required (API Key or JWT)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | integer | Yes | Library ID |

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Kids Movies",
  "media_type": "movie",
  "arr_type": "radarr",
  "arr_id": 1,
  "media_server_id": 1,
  "root_folder": "/movies/kids",
  "quality_profile_id": 4,
  "is_active": true,
  "priority": 100,
  "item_count": 247,
  "sync_status": {
    "status": "completed",
    "items_processed": 247,
    "items_total": 247
  },
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

**Error Responses:**

- `404 Not Found` - Library doesn't exist
  ```json
  {
    "error": "Library not found"
  }
  ```

**Example:**
```bash
curl -X GET http://localhost:21324/api/libraries/1 \
  -H "X-API-Key: clf_your_key"
```

**Error Handling:**
```javascript
async function getLibrary(id) {
  const response = await fetch(`${API_URL}/api/libraries/${id}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  if (response.status === 404) {
    console.log('Library not found - may have been deleted');
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}
```

---

### PUT /api/libraries/:id

Update library configuration.

**Authentication:** Required (`read_write` permission)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | integer | Yes | Library ID |

**Request Body:**

All fields are optional. Only provided fields will be updated.

```json
{
  "name": "Kids & Family Movies",
  "priority": 95,
  "arr_type": "radarr",
  "arr_id": 1,
  "root_folder": "/movies/kids",
  "quality_profile_id": 5,
  "is_active": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Library display name |
| `priority` | integer | Priority for classification (higher = preferred) |
| `arr_type` | string | `radarr` or `sonarr` |
| `arr_id` | integer | ID of the Radarr/Sonarr instance |
| `root_folder` | string | Path to root folder in *arr |
| `quality_profile_id` | integer | Quality profile ID in *arr |
| `is_active` | boolean | Whether library is active for classification |

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Kids & Family Movies",
  "media_type": "movie",
  "arr_type": "radarr",
  "arr_id": 1,
  "media_server_id": 1,
  "root_folder": "/movies/kids",
  "quality_profile_id": 5,
  "is_active": true,
  "priority": 95,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-02-01T12:30:00Z"
}
```

**Error Responses:**

- `404 Not Found` - Library doesn't exist
  ```json
  {
    "error": "Library not found"
  }
  ```

- `401 Unauthorized` - Missing authentication or insufficient permissions

**Example:**
```bash
curl -X PUT http://localhost:21324/api/libraries/1 \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kids & Family Movies",
    "priority": 95
  }'
```

---

### DELETE /api/libraries/:id

Delete a library.

**Authentication:** Required (`read_write` permission)

**Note:** This is typically a soft delete or may fail if the library has associated data. Check your implementation.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | integer | Yes | Library ID |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Library deleted successfully"
}
```

**Error Responses:**

- `404 Not Found` - Library doesn't exist
  ```json
  {
    "error": "Library not found"
  }
  ```

**Example:**
```bash
curl -X DELETE http://localhost:21324/api/libraries/1 \
  -H "X-API-Key: clf_your_key"
```

---

### POST /api/libraries/:id/sync

**Deprecated:** Use `POST /api/media-sync/sync/:libraryId` instead.

See [Media Sync API](./media-sync.md) for details.

---

### GET /api/libraries/pending-suggestions

Get libraries with pending pattern suggestions (for dashboard widgets).

**Authentication:** Required (API Key or JWT)

**Success Response (200):**
```json
{
  "totalPending": 15,
  "libraries": [
    {
      "library_id": 1,
      "library_name": "Kids Movies",
      "pending_count": 8,
      "detected_patterns": ["Disney", "Pixar", "DreamWorks"],
      "last_analyzed": "2026-02-01T10:00:00Z"
    },
    {
      "library_id": 2,
      "library_name": "TV Shows",
      "pending_count": 7,
      "detected_patterns": ["NBC", "HBO"],
      "last_analyzed": "2026-02-01T09:30:00Z"
    }
  ]
}
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/libraries/pending-suggestions \
  -H "X-API-Key: clf_your_key"
```

---

## Library Object

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique library identifier |
| `name` | string | Display name (e.g., "Kids Movies") |
| `media_type` | string | `movie` or `tv` |
| `arr_type` | string | `radarr` or `sonarr` |
| `arr_id` | integer | Foreign key to Radarr/Sonarr instance |
| `media_server_id` | integer | Foreign key to media server (Plex/Emby/Jellyfin) |
| `media_server_name` | string | Media server name (from join) |
| `media_server_type` | string | `plex`, `emby`, or `jellyfin` |
| `root_folder` | string | Root folder path in *arr |
| `quality_profile_id` | integer | Quality profile ID in *arr |
| `is_active` | boolean | Whether library is enabled for classification |
| `priority` | integer | Higher priority = preferred for classification |
| `item_count` | integer | Number of items synced from media server (only in GET /:id) |
| `sync_status` | object | Current sync status (only in GET /:id) |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |

### Priority System

Libraries with **higher priority** values are preferred during classification when multiple libraries match.

**Default Priority:** `100`

**Example:**
- Kids Movies: priority `100`
- 4K Movies: priority `90`
- General Movies: priority `80`

If a kids movie matches both "Kids Movies" and "General Movies", it will be classified to "Kids Movies" due to higher priority.

---

## Error Handling

### 404 - Library Not Found

**Scenario:** Accessing a library that doesn't exist or was deleted.

**Affected Endpoints:**
- `GET /api/libraries/:id`
- `PUT /api/libraries/:id`
- `DELETE /api/libraries/:id`

**Response:**
```json
{
  "error": "Library not found"
}
```

**Best Practice:**

Handle 404 gracefully - the library may have been deleted by another user/process:

```javascript
async function updateLibrary(id, updates) {
  try {
    const response = await fetch(`${API_URL}/api/libraries/${id}`, {
      method: 'PUT',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (response.status === 404) {
      // Library no longer exists - refresh library list
      console.warn('Library was deleted');
      await refreshLibraryList();
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to update library:', error);
    throw error;
  }
}
```

### 401 - Unauthorized

Missing or invalid authentication. See [Authentication Guide](./authentication.md).

### 403 - Forbidden

Attempting a write operation with `read_only` API key.

**Solution:** Use an API key with `read_write` permission.

---

## Examples

### List All Libraries (JavaScript)

```javascript
async function listLibraries() {
  const response = await fetch('http://localhost:21324/api/libraries', {
    headers: {
      'X-API-Key': process.env.CLASSIFARR_API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const libraries = await response.json();
  
  // Group by media type
  const movies = libraries.filter(lib => lib.media_type === 'movie');
  const tv = libraries.filter(lib => lib.media_type === 'tv');
  
  console.log(`Found ${movies.length} movie libraries and ${tv.length} TV libraries`);
  
  return { movies, tv };
}
```

### Get Library Details (Python)

```python
import requests
import os

CLASSIFARR_URL = 'http://localhost:21324'
API_KEY = os.environ['CLASSIFARR_API_KEY']

def get_library(library_id):
    """Get library details with error handling"""
    response = requests.get(
        f'{CLASSIFARR_URL}/api/libraries/{library_id}',
        headers={'X-API-Key': API_KEY}
    )
    
    if response.status_code == 404:
        print(f'Library {library_id} not found')
        return None
    
    response.raise_for_status()
    library = response.json()
    
    print(f"Library: {library['name']}")
    print(f"Items: {library['item_count']}")
    print(f"Sync Status: {library['sync_status']['status']}")
    
    return library

# Usage
library = get_library(1)
```

### Update Library Priority (cURL)

```bash
# Increase priority for preferred library
curl -X PUT http://localhost:21324/api/libraries/1 \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": 100
  }'
```

### Deactivate Library Temporarily

```bash
# Disable library without deleting it
curl -X PUT http://localhost:21324/api/libraries/3 \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

### Check Sync Status Before Classification

```javascript
async function ensureLibrarySynced(libraryId) {
  const library = await fetch(
    `http://localhost:21324/api/libraries/${libraryId}`,
    { headers: { 'X-API-Key': API_KEY } }
  ).then(r => r.json());
  
  const syncStatus = library.sync_status?.status;
  
  if (!syncStatus || syncStatus === 'failed') {
    console.warn(`Library ${library.name} not synced - triggering sync`);
    // Trigger sync (see Media Sync API)
    await fetch(
      `http://localhost:21324/api/media-sync/sync/${libraryId}`,
      { 
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      }
    );
    return false;
  }
  
  if (syncStatus === 'in_progress') {
    console.log(`Library ${library.name} sync in progress`);
    return false;
  }
  
  return true; // Synced and ready
}
```

---

## Related Documentation

- [Media Sync API](./media-sync.md) - Sync library items from media server
- [Authentication Guide](./authentication.md) - API keys and permissions
- [Error Handling Guide](./errors.md) - Error codes and retry strategies
- [Policies API](./policies.md) - Associate policies with libraries
