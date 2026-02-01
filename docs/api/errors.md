# Error Handling Guide

This guide documents Classifarr's error handling standards, common error scenarios, and best practices for handling errors in your integrations.

---

## Table of Contents

1. [Error Response Format](#error-response-format)
2. [HTTP Status Codes](#http-status-codes)
3. [Common Error Scenarios](#common-error-scenarios)
4. [Error Handling Best Practices](#error-handling-best-practices)
5. [Retry Strategies](#retry-strategies-for-5xx-errors)
6. [Logging Behavior](#logging-behavior)
7. [Code Examples](#code-examples)

---

## Error Response Format

All API errors follow a **consistent JSON format** (implemented in v0.41.0):

```json
{
  "error": "Description of what went wrong"
}
```

### Standard Error Response

**Format:**
- Single `error` field with a human-readable message
- No nested structures or complex error objects
- Consistent across all endpoints

**Example:**
```json
{
  "error": "Library not found"
}
```

### Legacy Format (Being Phased Out)

Some endpoints may still return the older format:
```json
{
  "success": false,
  "error": "Error message"
}
```

Both formats are supported, but new code should expect the simplified format.

---

## HTTP Status Codes

Classifarr uses standard HTTP status codes to indicate success or failure.

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| **200** | OK | Request successful | Use response data |
| **201** | Created | Resource created successfully | Use response data, resource ID returned |
| **400** | Bad Request | Invalid request parameters | Fix request and retry |
| **401** | Unauthorized | Authentication required or invalid | Check API key/token |
| **403** | Forbidden | Insufficient permissions | Use key with appropriate permissions |
| **404** | Not Found | Resource doesn't exist | Verify resource ID, may have been deleted |
| **409** | Conflict | Resource conflict (e.g., sync already running) | Wait and retry, or check resource state |
| **429** | Too Many Requests | Rate limit exceeded | Wait and retry after delay |
| **500** | Internal Server Error | Unexpected server error | Retry with exponential backoff |
| **503** | Service Unavailable | Service temporarily unavailable | Retry after delay, check health endpoint |

---

## Common Error Scenarios

### 404 - Library Not Found

**Scenario:** Attempting to access a library that doesn't exist.

**Endpoints Affected:**
- `GET /api/libraries/:id`
- `PUT /api/libraries/:id`
- `DELETE /api/libraries/:id`
- `POST /api/media-sync/sync/:libraryId`
- `GET /api/media-sync/items/:libraryId`

**Response:**
```json
{
  "error": "Library not found"
}
```

**Example:**
```bash
curl -X GET http://localhost:21324/api/libraries/999 \
  -H "X-API-Key: clf_your_key"

# Response: 404
{
  "error": "Library not found"
}
```

**Handling:**
```javascript
try {
  const response = await fetch(`${API_URL}/api/libraries/${libraryId}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  if (response.status === 404) {
    console.error('Library no longer exists');
    // Handle gracefully - maybe refresh library list
    return null;
  }
  
  return await response.json();
} catch (error) {
  console.error('Network error:', error);
}
```

### 404 - Media Sync Items Not Found

**Scenario:** Requesting sync items for a library that hasn't been synced yet.

**Endpoints Affected:**
- `GET /api/media-sync/items/:libraryId`

**Response:**
```json
{
  "error": "Library not found"
}
```

**Note:** This returns 404 if the library itself doesn't exist. If the library exists but has no items, it returns 200 with an empty array.

### 409 - Sync Already in Progress

**Scenario:** Attempting to start a sync while another sync is running (atomic sync operations prevent race conditions).

**Endpoints Affected:**
- `POST /api/media-sync/sync/:libraryId`
- `POST /api/queue/clear-and-resync`

**Response:**
```json
{
  "error": "Sync already in progress",
  "message": "Library sync is already running",
  "progress": {
    "processed": 450,
    "total": 1000,
    "percentage": 45
  }
}
```

**Handling:**
```javascript
try {
  const response = await fetch(`${API_URL}/api/media-sync/sync/${libraryId}`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ incremental: false })
  });
  
  if (response.status === 409) {
    const data = await response.json();
    console.log(`Sync already running: ${data.progress.percentage}% complete`);
    // Poll sync status or wait for completion
    return data.progress;
  }
  
  return await response.json();
} catch (error) {
  console.error('Sync error:', error);
}
```

### 401 - Unauthorized

**Scenario:** Missing or invalid authentication credentials.

**Endpoints Affected:** All protected endpoints (everything except `/health/live`, `/health/ready`)

**Response:**
```json
{
  "error": "Unauthorized"
}
```

**Common Causes:**
1. Missing `X-API-Key` or `Authorization` header
2. Invalid or expired API key
3. Revoked API key
4. Expired JWT token

**Handling:**
```python
import requests

def make_api_call(endpoint):
    response = requests.get(
        f'{API_URL}{endpoint}',
        headers={'X-API-Key': API_KEY}
    )
    
    if response.status_code == 401:
        print('Authentication failed - check your API key')
        # Refresh credentials or alert user
        return None
    
    response.raise_for_status()
    return response.json()
```

### 400 - Bad Request

**Scenario:** Invalid request parameters or malformed request body.

**Response:**
```json
{
  "error": "tmdb_id and media_type are required"
}
```

**Common Causes:**
1. Missing required fields
2. Invalid data types
3. Out-of-range values
4. Malformed JSON

**Example:**
```bash
# Missing required field
curl -X POST http://localhost:21324/api/classification/classify \
  -H "X-API-Key: clf_your_key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Inception"}'

# Response: 400
{
  "error": "tmdb_id and media_type are required"
}
```

### 500 - Internal Server Error

**Scenario:** Unexpected server error (database failure, service crash, etc.).

**Response:**
```json
{
  "error": "Failed to sync library"
}
```

**Handling:** Implement retry logic with exponential backoff (see [Retry Strategies](#retry-strategies-for-5xx-errors)).

### 503 - Service Unavailable

**Scenario:** System is temporarily unavailable (database not ready, startup in progress).

**Endpoints Affected:**
- `GET /api/system/health/ready`
- Any endpoint during system startup

**Response:**
```json
{
  "status": "not_ready",
  "database": "disconnected",
  "timestamp": "2026-02-01T12:00:00Z"
}
```

---

## Error Handling Best Practices

### 1. Always Check Status Codes

Don't just parse JSON - check the HTTP status code first:

```javascript
const response = await fetch(url, options);

if (!response.ok) {
  // Handle error based on status
  if (response.status === 404) {
    // Resource not found
  } else if (response.status === 409) {
    // Conflict - handle appropriately
  } else if (response.status >= 500) {
    // Server error - retry
  }
  
  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
}

const data = await response.json();
```

### 2. Handle Expected Failures Gracefully

Some errors are **expected** and should not trigger alarms:

**Expected Errors (Warnings):**
- 404 when checking if media exists (`/api/media-sync/lookup/:tmdbId`)
- 409 when sync is already running
- 404 when library is deleted between list and access

**Unexpected Errors (Alerts):**
- 500 Internal Server Error
- Database connection failures
- Repeated 401/403 errors

### 3. Parse Error Messages

Extract the error message from the response:

```python
def handle_error_response(response):
    """Extract error message from API response"""
    try:
        data = response.json()
        return data.get('error', 'Unknown error')
    except:
        return response.text()

# Usage
if not response.ok:
    error_msg = handle_error_response(response)
    logger.error(f'API error: {error_msg}')
```

### 4. Provide Context in Logs

Include context when logging errors:

```javascript
logger.error('Failed to sync library', {
  libraryId: 123,
  status: response.status,
  error: errorMessage,
  timestamp: new Date().toISOString()
});
```

### 5. Distinguish Between Retriable and Non-Retriable Errors

**Retriable Errors (Retry with backoff):**
- 408 Request Timeout
- 429 Too Many Requests
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout

**Non-Retriable Errors (Don't retry):**
- 400 Bad Request (fix the request first)
- 401 Unauthorized (fix credentials first)
- 403 Forbidden (need different permissions)
- 404 Not Found (resource doesn't exist)
- 409 Conflict (resolve conflict first)

---

## Retry Strategies for 5xx Errors

### Exponential Backoff

For transient server errors (500, 503), use exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success - return response
      if (response.ok) {
        return response;
      }
      
      // Don't retry 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      // Retriable error - wait and retry
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status}`);
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
          console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Usage
const response = await fetchWithRetry(
  'http://localhost:21324/api/libraries',
  { headers: { 'X-API-Key': API_KEY } }
);
```

### Python Example

```python
import time
import requests

def fetch_with_retry(url, headers, max_retries=3):
    """Fetch with exponential backoff retry"""
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers)
            
            # Success
            if response.ok:
                return response
            
            # Don't retry client errors (except 429)
            if 400 <= response.status_code < 500 and response.status_code != 429:
                response.raise_for_status()
            
            # Retriable error
            if response.status_code >= 500 or response.status_code == 429:
                if attempt < max_retries - 1:
                    delay = min(2 ** attempt, 30)  # Max 30s
                    print(f'Retry {attempt + 1} after {delay}s')
                    time.sleep(delay)
                    continue
            
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    
    raise Exception('Max retries exceeded')

# Usage
response = fetch_with_retry(
    'http://localhost:21324/api/libraries',
    headers={'X-API-Key': API_KEY}
)
```

---

## Logging Behavior

### Server-Side Logging (v0.41.0+)

Classifarr's logging behavior distinguishes between expected and unexpected failures to **reduce log noise**.

#### Expected Failures (Warnings)

**Logged as WARNINGS** (not errors):
- 404 Library not found
- 409 Sync already in progress
- 404 Media not found during lookup

**Example Log:**
```
[WARN] Library not found: id=123
```

#### Unexpected Failures (Errors)

**Logged as ERRORS**:
- 500 Internal Server Error
- Database connection failures
- Service crashes
- Unhandled exceptions

**Example Log:**
```
[ERROR] Failed to sync library: Database connection timeout
  at mediaSyncService.syncLibrary (mediaSync.js:123)
```

### Client-Side Logging

**Recommendations:**

1. **Log all errors** but categorize by severity:
   ```javascript
   if (response.status === 404) {
     logger.warn('Resource not found', { url });
   } else if (response.status >= 500) {
     logger.error('Server error', { status: response.status, url });
   }
   ```

2. **Include request context**:
   ```javascript
   logger.error('API request failed', {
     method: 'POST',
     url: '/api/media-sync/sync/1',
     status: response.status,
     error: await response.text()
   });
   ```

3. **Track error rates** for monitoring:
   ```javascript
   metrics.increment('api.errors', {
     endpoint: '/api/libraries',
     status_code: response.status
   });
   ```

---

## Code Examples

### Complete Error Handling (JavaScript)

```javascript
class ClassifarrClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'X-API-Key': this.apiKey,
      ...options.headers
    };
    
    try {
      const response = await fetch(url, { ...options, headers });
      
      // Success
      if (response.ok) {
        return await response.json();
      }
      
      // Parse error
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${response.status}`;
      
      // Handle specific errors
      if (response.status === 404) {
        throw new NotFoundError(errorMessage);
      } else if (response.status === 409) {
        throw new ConflictError(errorMessage, errorData.progress);
      } else if (response.status === 401) {
        throw new UnauthorizedError(errorMessage);
      } else if (response.status >= 500) {
        throw new ServerError(errorMessage, response.status);
      }
      
      throw new APIError(errorMessage, response.status);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      // Network error
      throw new NetworkError(error.message);
    }
  }
}

// Custom error classes
class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'APIError';
  }
}

class NotFoundError extends APIError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends APIError {
  constructor(message, progress) {
    super(message, 409);
    this.name = 'ConflictError';
    this.progress = progress;
  }
}

// Usage
const client = new ClassifarrClient('http://localhost:21324', 'clf_your_key');

try {
  const library = await client.request('/api/libraries/1');
  console.log('Library:', library);
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Library not found');
  } else if (error instanceof ConflictError) {
    console.log(`Conflict: ${error.progress.percentage}% complete`);
  } else if (error instanceof ServerError) {
    console.error('Server error - will retry');
  }
}
```

### Complete Error Handling (Python)

```python
import requests
import time
from typing import Optional, Dict, Any

class ClassifarrError(Exception):
    """Base exception for Classifarr API errors"""
    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class NotFoundError(ClassifarrError):
    pass

class ConflictError(ClassifarrError):
    def __init__(self, message: str, progress: Dict = None):
        super().__init__(message, 409)
        self.progress = progress

class UnauthorizedError(ClassifarrError):
    pass

class ClassifarrClient:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url
        self.api_key = api_key
    
    def request(self, endpoint: str, method: str = 'GET', 
                data: Optional[Dict] = None) -> Any:
        """Make API request with error handling"""
        url = f'{self.api_url}{endpoint}'
        headers = {'X-API-Key': self.api_key}
        
        try:
            response = requests.request(
                method, url, headers=headers, json=data
            )
            
            # Success
            if response.ok:
                return response.json()
            
            # Parse error
            try:
                error_data = response.json()
                error_msg = error_data.get('error', f'HTTP {response.status_code}')
            except:
                error_msg = response.text or f'HTTP {response.status_code}'
            
            # Raise specific errors
            if response.status_code == 404:
                raise NotFoundError(error_msg)
            elif response.status_code == 409:
                progress = error_data.get('progress')
                raise ConflictError(error_msg, progress)
            elif response.status_code == 401:
                raise UnauthorizedError(error_msg)
            elif response.status_code >= 500:
                raise ClassifarrError(error_msg, response.status_code)
            
            raise ClassifarrError(error_msg, response.status_code)
            
        except requests.exceptions.RequestException as e:
            raise ClassifarrError(f'Network error: {str(e)}')
    
    def get_library(self, library_id: int) -> Optional[Dict]:
        """Get library with graceful error handling"""
        try:
            return self.request(f'/api/libraries/{library_id}')
        except NotFoundError:
            print(f'Library {library_id} not found')
            return None
        except UnauthorizedError:
            print('Authentication failed')
            raise
        except ClassifarrError as e:
            print(f'API error: {e.message}')
            raise

# Usage
client = ClassifarrClient('http://localhost:21324', 'clf_your_key')

try:
    library = client.get_library(1)
    if library:
        print(f'Library: {library["name"]}')
except ClassifarrError as e:
    print(f'Error: {e.message}')
```

---

## Related Documentation

- [Authentication Guide](./authentication.md)
- [System Health API](./system.md)
- [Media Sync API](./media-sync.md)
- [Libraries API](./libraries.md)
