# Classifarr API Reference

**Version:** v0.41.0-alpha

Comprehensive REST API for Classifarr's policy-driven media classification platform.

---

## Overview

The Classifarr API provides complete programmatic access to all platform features:

- **Policy-based classification** with 168 content presets
- **System health monitoring** with trend indicators
- **Media library management** and synchronization
- **Webhook integrations** for Overseerr/Jellyseerr/Seer
- **API key management** for secure integrations
- **Comprehensive error handling** with consistent response formats

**Base URL:** `http://localhost:21324/api`

**Current Version:** v0.41.0-alpha

---

## Quick Start

### Authentication

Classifarr supports two authentication methods:

**1. JWT Tokens (Web UI):**
```bash
curl -X POST http://localhost:21324/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

**2. API Keys (Integrations - Recommended):**
```bash
curl -X GET http://localhost:21324/api/libraries \
  -H "X-API-Key: clf_your_api_key_here"
```

See [Authentication Guide](./authentication.md) for complete details.

### Example Request

```bash
# Get system health
curl -X GET http://localhost:21324/api/system/health/services \
  -H "X-API-Key: clf_your_api_key_here"
```

---

## API Categories

### Core APIs

| API | Description | Documentation |
|-----|-------------|---------------|
| **[Authentication](./authentication.md)** | JWT tokens, API keys, permissions | Essential for all API access |
| **[System Health](./system.md)** | Service monitoring, trends, K8s probes | v0.41.0: Trend indicators added |
| **[Libraries](./libraries.md)** | Manage Radarr/Sonarr libraries | Includes 404 handling |
| **[Media Sync](./media-sync.md)** | Sync items from media servers | v0.41.0: Atomic operations |
| **[Classification](./classification.md)** | Classify media, view history | Policy-based routing |
| **[Policies](./policies.md)** | Configure classification rules | 168 content presets |
| **[Webhooks](./webhooks.md)** | Overseerr/Jellyseerr integration | Auto-classification |

### Supporting APIs

| API | Description | Status |
|-----|-------------|--------|
| **Presets** | Content preset discovery | Covered in Policies API |
| **Suggestions** | Policy tuning suggestions | Coming soon |
| **Stats** | Policy statistics | Coming soon |
| **Migration** | Legacy rule migration | Coming soon |

### Error Handling

**[Error Handling Guide](./errors.md)** - **NEW in v0.41.0**
- Standard error response format: `{ "error": "Description" }`
- HTTP status codes and meanings
- Retry strategies for 5xx errors
- Common error scenarios and solutions

---

## API Documentation

### Comprehensive Guides

- **[Authentication Guide](./authentication.md)** - JWT & API keys, permissions, security best practices
- **[System Health API](./system.md)** - Health monitoring with trends (v0.41.0)
- **[Libraries API](./libraries.md)** - Manage library configurations
- **[Media Sync API](./media-sync.md)** - Sync with atomic operations (v0.41.0)
- **[Classification API](./classification.md)** - Classify media and manage queue
- **[Policies API](./policies.md)** - Configure classification policies
- **[Webhooks API](./webhooks.md)** - Integrate with request managers
- **[Error Handling Guide](./errors.md)** - Error codes and best practices (v0.41.0)

### Code Examples

- **[cURL Examples](./examples/curl.md)** - Complete bash/shell examples
- **[JavaScript Examples](./examples/javascript.md)** - Node.js with async/await
- **[Python Examples](./examples/python.md)** - Python with type hints

---

---

## Response Formats

### Standard Success Response (200, 201)

Most endpoints return data directly:
```json
{
  "id": 1,
  "name": "Kids Movies",
  "is_active": true
}
```

Or as an array:
```json
[
  { "id": 1, "name": "Kids Movies" },
  { "id": 2, "name": "4K Movies" }
]
```

### Standard Error Response (v0.41.0+)

**NEW:** Consistent error format across all endpoints:
```json
{
  "error": "Description of what went wrong"
}
```

**Legacy format** (being phased out):
```json
{
  "success": false,
  "error": "Error message"
}
```

See [Error Handling Guide](./errors.md) for details.

---

## HTTP Status Codes

| Code | Status | Meaning |
|------|--------|---------|
| **200** | OK | Success |
| **201** | Created | Resource created |
| **400** | Bad Request | Invalid parameters |
| **401** | Unauthorized | Missing/invalid authentication |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource conflict (e.g., sync running) |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **503** | Service Unavailable | Service temporarily unavailable |

---

## Pagination

List endpoints support pagination via query parameters:

**Query Parameters:**
- `page` - Page number (default: 1, min: 1)
- `limit` - Items per page (default: 50, max: 100)

**Response Format:**
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 247,
    "totalPages": 5
  }
}
```

**Example:**
```bash
# Get page 2 with 100 items per page
curl "http://localhost:21324/api/classification/history?page=2&limit=100" \
  -H "X-API-Key: clf_your_key"
```

---

## Filtering

Many endpoints support filtering via query parameters:

**Common Filters:**
- `library_id` - Filter by library
- `media_type` - Filter by `movie` or `tv`
- `active` - Filter by active status (`true`/`false`)
- `search` - Text search
- `category` - Filter by category

**Examples:**
```bash
# Get active movie libraries
GET /api/libraries?media_type=movie&is_active=true

# Search presets for "action"
GET /api/presets?search=action

# Get classifications for library 1
GET /api/classification/history?library_id=1
```

---

## Rate Limiting

**Limits:**
- **Default:** 100 requests per 15 minutes per IP
- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **Webhook endpoint:** 100 requests per 15 minutes per IP
- **API key operations:** 20 requests per 15 minutes

**Response Headers:**
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)

**Rate Limited Response (429):**
```json
{
  "error": "Too many requests, please try again later"
}
```

---

## Versioning

**Current Version:** v0.41.0-alpha

**Breaking Changes in v0.41.0:**
- Error responses now use `{ "error": "..." }` format
- System health endpoints return trend indicators
- Media sync operations are atomic (409 on conflict)

**Deprecation Notice:**
- `POST /api/libraries/:id/sync` → Use `POST /api/media-sync/sync/:libraryId`
- Legacy error format `{ "success": false, "error": "..." }` → Use `{ "error": "..." }`

---

## Key Features by Version

### v0.41.0-alpha (Current)
- ✅ System health trend indicators (`improving`, `degrading`, `stable`)
- ✅ Atomic sync operations (prevents race conditions)
- ✅ Consistent 404 error handling (#226)
- ✅ Enhanced error response format
- ✅ `lastSuccessfulCheck` tracking for services

### v0.40.6-alpha
- Service connection locking
- Instance protection
- Heartbeat monitoring

### v0.40.0-alpha
- Classification transparency (signal breakdown)
- Dashboard performance improvements (SWR caching)

### v0.37.0-alpha
- Policy Engine with 168 presets
- AI Skip Logic (70-80% faster)
- Pattern discovery and RAG semantic search

---

## Best Practices

### Security

1. **Use API Keys for integrations** - Prefer API keys over JWT tokens for automation
2. **Use HTTPS in production** - Always encrypt API traffic
3. **Rotate API keys regularly** - Create new keys and revoke old ones
4. **Set appropriate permissions** - Use `read_only` when write access isn't needed
5. **Validate webhook signatures** - Use secret keys for webhook endpoints

### Performance

1. **Cache responses** - Cache library lists, policies, presets
2. **Use pagination** - Don't fetch all records at once
3. **Batch operations** - Group related API calls
4. **Monitor rate limits** - Track remaining requests
5. **Use incremental syncs** - Only sync changed items when possible

### Error Handling

1. **Check status codes** - Don't just parse JSON
2. **Implement retry logic** - Use exponential backoff for 5xx errors
3. **Handle 409 conflicts** - Poll sync status and retry
4. **Distinguish error types** - Retry 5xx, don't retry 4xx (except 429)
5. **Log errors with context** - Include request details in logs

See [Error Handling Guide](./errors.md) for complete examples.

---

## Getting Help

### Documentation
- [GitHub Repository](https://github.com/cloudbyday90/Classifarr)
- [Issue Tracker](https://github.com/cloudbyday90/Classifarr/issues)
- [API Documentation](https://github.com/cloudbyday90/Classifarr/tree/main/docs/api)

### Community
- [Discord Community](https://discord.gg/classifarr)
- [GitHub Discussions](https://github.com/cloudbyday90/Classifarr/discussions)

### Reporting Issues
- [Report a Bug](https://github.com/cloudbyday90/Classifarr/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/cloudbyday90/Classifarr/issues/new?template=feature_request.md)
