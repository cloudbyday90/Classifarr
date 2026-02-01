# Webhooks API

Integrate Classifarr with request management platforms (Overseerr, Jellyseerr, Seer) for automatic media classification.

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoints](#endpoints)
3. [Webhook Configuration](#webhook-configuration)
4. [Webhook Payload Format](#webhook-payload-format)
5. [Event Types](#event-types)
6. [Security Considerations](#security-considerations)
7. [Examples](#examples)

---

## Overview

Classifarr's webhook integration enables **automatic classification** when users request media through Overseerr/Jellyseerr/Seer.

### How It Works

1. User requests media in Overseerr
2. Overseerr sends webhook to Classifarr
3. Classifarr classifies the media using the Policy Engine
4. Classifarr adds media to the appropriate Radarr/Sonarr library
5. Radarr/Sonarr downloads the media

### Features

- **Universal webhook handler** for all request managers
- **Automatic classification** using policies
- **Secret key authentication** for security
- **Specials handling** (optional filtering)
- **Rate limiting** (100 requests per 15 minutes per IP)

---

## Endpoints

### POST /api/webhook/request

Universal webhook endpoint for request managers.

**Authentication:** Optional (webhook secret key)

**Request Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `X-Webhook-Key` | Conditional | Webhook secret key (if configured) |
| `Content-Type` | Yes | `application/json` |

**Request Body:**

Accepts Overseerr/Jellyseerr/Seer webhook payload format.

```json
{
  "notification_type": "MEDIA_PENDING",
  "subject": "Toy Story",
  "media": {
    "media_type": "movie",
    "tmdbId": 862,
    "tvdbId": null,
    "status": "PENDING",
    "status4k": null
  },
  "request": {
    "request_id": 123,
    "requestedBy_username": "john.doe",
    "requestedBy_email": "john@example.com"
  },
  "extra": []
}
```

**Success Response (200):**
```json
{
  "success": true,
  "classification": {
    "library_id": 1,
    "library_name": "Kids Movies",
    "confidence": 92,
    "method": "policy"
  },
  "message": "Media classified and added to library"
}
```

**Error Responses:**

**403 Forbidden** - Webhook processing disabled:
```json
{
  "success": false,
  "error": "Webhook processing is disabled"
}
```

**401 Unauthorized** - Invalid webhook key:
```json
{
  "success": false,
  "error": "Invalid webhook key"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "success": false,
  "error": "Too many webhook requests, please try again later"
}
```

**500 Internal Server Error** - Classification failed:
```json
{
  "success": false,
  "error": "Classification failed: [reason]"
}
```

**Example:**
```bash
# With secret key in header
curl -X POST http://localhost:21324/api/webhook/request \
  -H "X-Webhook-Key: your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "notification_type": "MEDIA_PENDING",
    "subject": "Toy Story",
    "media": {
      "media_type": "movie",
      "tmdbId": 862
    }
  }'

# With secret key in query parameter
curl -X POST "http://localhost:21324/api/webhook/request?key=your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

### POST /api/webhook/overseerr

**Legacy endpoint.** Use `/api/webhook/request` instead.

This endpoint is maintained for backwards compatibility and functions identically to `/api/webhook/request`.

---

## Webhook Configuration

### In Classifarr

Configure webhook settings in the Classifarr UI or via API:

**Settings → Webhooks:**

| Setting | Description | Default |
|---------|-------------|---------|
| **Enabled** | Enable/disable webhook processing | `true` |
| **Secret Key** | Authentication key for webhooks | Auto-generated |
| **Include Specials** | Process TV specials (episode S00Exx) | `false` |

### In Overseerr/Jellyseerr

1. Go to **Settings** → **Notifications** → **Webhook**
2. Enable Webhook notifications
3. Set **Webhook URL:**
   ```
   http://classifarr:21324/api/webhook/request?key=YOUR_SECRET_KEY
   ```
   
   Or use header-based authentication:
   ```
   http://classifarr:21324/api/webhook/request
   ```
   And add custom header: `X-Webhook-Key: YOUR_SECRET_KEY`

4. Select **Notification Types:**
   - ✅ Media Pending
   - ✅ Media Approved
   - ✅ Media Auto-Approved

5. **JSON Payload:** (default Overseerr payload)

**Example Configuration:**

![Overseerr Webhook Configuration](https://via.placeholder.com/800x400?text=Overseerr+Webhook+Settings)

---

## Webhook Payload Format

Classifarr supports the standard Overseerr webhook payload format.

### Complete Payload Example

```json
{
  "notification_type": "MEDIA_PENDING",
  "subject": "Breaking Bad",
  "message": "A new request has been made",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "email": "user@example.com",
  "username": "john.doe",
  "avatar": "https://example.com/avatar.jpg",
  "media": {
    "media_type": "tv",
    "tmdbId": 1396,
    "tvdbId": 81189,
    "status": "PENDING",
    "status4k": null
  },
  "request": {
    "request_id": 456,
    "requestedBy_email": "john@example.com",
    "requestedBy_username": "john.doe",
    "requestedBy_avatar": "https://example.com/avatar.jpg"
  },
  "issue": null,
  "comment": null,
  "extra": [
    {
      "name": "Requested Seasons",
      "value": "Season 1, Season 2"
    }
  ]
}
```

### Required Fields

Classifarr extracts these minimum required fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `media.media_type` | string | Yes | `movie` or `tv` |
| `media.tmdbId` | integer | Yes | TMDB ID |
| `subject` | string | No | Media title (for logging) |

### TV Shows - Specials Handling

For TV shows, if `include_specials` is `false` (default), Classifarr **filters out** special episodes (S00Exx) from the request.

**Payload with specials:**
```json
{
  "media": {
    "media_type": "tv",
    "tmdbId": 1396
  },
  "extra": [
    {
      "name": "Requested Seasons",
      "value": "Season 0, Season 1, Season 2"
    }
  ]
}
```

**After filtering (include_specials = false):**
```json
{
  "extra": [
    {
      "name": "Requested Seasons",
      "value": "Season 1, Season 2"
    }
  ]
}
```

---

## Event Types

Classifarr processes these Overseerr notification types:

| Notification Type | Description | Action |
|-------------------|-------------|--------|
| `MEDIA_PENDING` | Media request is pending approval | Classify and add |
| `MEDIA_APPROVED` | Media request was approved | Classify and add |
| `MEDIA_AUTO_APPROVED` | Media was auto-approved | Classify and add |
| `MEDIA_AVAILABLE` | Media is now available | Log only |
| `MEDIA_FAILED` | Media download failed | Log only |

**Recommended:** Configure only `MEDIA_PENDING`, `MEDIA_APPROVED`, and `MEDIA_AUTO_APPROVED` in Overseerr.

---

## Security Considerations

### Authentication Methods

**1. Secret Key (Recommended):**

Generate a strong random key and configure it in both Classifarr and Overseerr.

```bash
# Generate a secure key
openssl rand -hex 32
```

**2. Network-Level Security:**

If running on the same Docker network, you can disable secret key and rely on network isolation:

```yaml
services:
  classifarr:
    networks:
      - internal
  overseerr:
    networks:
      - internal
networks:
  internal:
    internal: true  # No external access
```

### Best Practices

1. **Use Secret Keys:** Always configure a webhook secret in production
2. **HTTPS in Production:** Use reverse proxy with SSL termination
3. **Rate Limiting:** Built-in rate limiting prevents abuse (100 req/15min)
4. **Validate Payloads:** Classifarr validates required fields
5. **Monitor Logs:** Check webhook logs for unauthorized access attempts
6. **Rotate Keys:** Periodically regenerate webhook secret keys

### Rate Limiting

**Limits:**
- 100 requests per 15 minutes per IP address
- Applies to all webhook endpoints

**Headers:**
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 95`
- `X-RateLimit-Reset: 1706788800` (Unix timestamp)

**Response when rate limited (429):**
```json
{
  "success": false,
  "error": "Too many webhook requests, please try again later"
}
```

---

## Examples

### Example Webhook Payloads

**Movie Request:**
```json
{
  "notification_type": "MEDIA_PENDING",
  "subject": "Inception",
  "media": {
    "media_type": "movie",
    "tmdbId": 27205,
    "status": "PENDING"
  },
  "request": {
    "request_id": 789,
    "requestedBy_username": "jane.smith",
    "requestedBy_email": "jane@example.com"
  }
}
```

**TV Show Request:**
```json
{
  "notification_type": "MEDIA_AUTO_APPROVED",
  "subject": "The Office (US)",
  "media": {
    "media_type": "tv",
    "tmdbId": 2316,
    "tvdbId": 73244,
    "status": "PROCESSING"
  },
  "request": {
    "request_id": 790,
    "requestedBy_username": "mike.jones",
    "requestedBy_email": "mike@example.com"
  },
  "extra": [
    {
      "name": "Requested Seasons",
      "value": "Season 1, Season 2, Season 3"
    }
  ]
}
```

### Testing Webhooks

**cURL Test:**
```bash
curl -X POST http://localhost:21324/api/webhook/request \
  -H "X-Webhook-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "notification_type": "MEDIA_PENDING",
    "subject": "Test Movie",
    "media": {
      "media_type": "movie",
      "tmdbId": 550
    },
    "request": {
      "request_id": 999,
      "requestedBy_username": "test.user",
      "requestedBy_email": "test@example.com"
    }
  }'
```

**Python Test Script:**
```python
import requests

def test_webhook(tmdb_id, media_type, title):
    """Test webhook endpoint"""
    payload = {
        "notification_type": "MEDIA_PENDING",
        "subject": title,
        "media": {
            "media_type": media_type,
            "tmdbId": tmdb_id
        },
        "request": {
            "request_id": 999,
            "requestedBy_username": "test.user",
            "requestedBy_email": "test@example.com"
        }
    }
    
    response = requests.post(
        'http://localhost:21324/api/webhook/request',
        headers={
            'X-Webhook-Key': 'your-secret-key',
            'Content-Type': 'application/json'
        },
        json=payload
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.json()

# Test
test_webhook(550, 'movie', 'Fight Club')
```

**JavaScript Test:**
```javascript
async function testWebhook(tmdbId, mediaType, title) {
  const payload = {
    notification_type: 'MEDIA_PENDING',
    subject: title,
    media: {
      media_type: mediaType,
      tmdbId: tmdbId
    },
    request: {
      request_id: 999,
      requestedBy_username: 'test.user',
      requestedBy_email: 'test@example.com'
    }
  };
  
  const response = await fetch('http://localhost:21324/api/webhook/request', {
    method: 'POST',
    headers: {
      'X-Webhook-Key': 'your-secret-key',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const result = await response.json();
  console.log('Classification:', result.classification);
  
  return result;
}

// Test
await testWebhook(550, 'movie', 'Fight Club');
```

---

## Troubleshooting

### 401 Unauthorized

**Cause:** Invalid or missing webhook secret key

**Solutions:**
1. Check secret key in Classifarr settings
2. Verify key is correctly configured in Overseerr
3. Ensure no extra spaces or line breaks in key
4. Check header name is `X-Webhook-Key` (case-sensitive)

### 403 Forbidden

**Cause:** Webhook processing is disabled

**Solution:** Enable webhooks in Classifarr Settings → Webhooks

### 429 Too Many Requests

**Cause:** Rate limit exceeded (100 requests in 15 minutes)

**Solutions:**
1. Wait for rate limit window to reset
2. Check for webhook loops or duplicate configurations
3. Review Overseerr notification settings (disable unnecessary types)

### 500 Internal Server Error

**Cause:** Classification failed

**Possible Issues:**
1. No libraries configured
2. Media server unreachable
3. Radarr/Sonarr connection failed
4. Invalid TMDB ID

**Debugging:**
1. Check Classifarr logs for detailed error
2. Verify library configurations
3. Test media server connectivity
4. Check system health: `GET /api/system/health`

---

## Related Documentation

- [Classification API](./classification.md) - Manual classification
- [Policies API](./policies.md) - Configure classification policies
- [Authentication Guide](./authentication.md) - Webhook security
- [Error Handling Guide](./errors.md) - Error codes and patterns
