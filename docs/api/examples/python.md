# Python Examples

Complete Python examples for all major Classifarr API operations using the requests library.

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
9. [Complete Examples](#complete-examples)

---

## Setup

### Install Dependencies

```bash
pip install requests
```

### Basic Configuration

```python
# config.py
import os

class Config:
    BASE_URL = os.getenv('CLASSIFARR_URL', 'http://localhost:21324')
    API_KEY = os.getenv('CLASSIFARR_API_KEY', 'clf_your_api_key_here')

config = Config()
```

### API Client Class

```python
# classifarr_client.py
import requests
from typing import Optional, Dict, Any
from urllib.parse import urljoin

class ClassifarrClient:
    """Classifarr API Client"""
    
    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        jwt_token: Optional[str] = None
    ):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.jwt_token = jwt_token
        self.session = requests.Session()
    
    def _get_headers(self) -> Dict[str, str]:
        """Build request headers with authentication"""
        headers = {'Content-Type': 'application/json'}
        
        if self.jwt_token:
            headers['Authorization'] = f'Bearer {self.jwt_token}'
        elif self.api_key:
            headers['X-API-Key'] = self.api_key
        
        return headers
    
    def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = urljoin(self.base_url, endpoint)
        headers = self._get_headers()
        
        if 'headers' in kwargs:
            headers.update(kwargs.pop('headers'))
        
        response = self.session.request(
            method=method,
            url=url,
            headers=headers,
            **kwargs
        )
        
        try:
            data = response.json()
        except ValueError:
            data = {}
        
        if not response.ok:
            error_msg = data.get('error', f'HTTP {response.status_code}')
            raise ClassifarrError(error_msg, response.status_code, data)
        
        return data
    
    def get(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """GET request"""
        return self._request('GET', endpoint, params=params)
    
    def post(self, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """POST request"""
        return self._request('POST', endpoint, json=data)
    
    def put(self, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """PUT request"""
        return self._request('PUT', endpoint, json=data)
    
    def delete(self, endpoint: str) -> Dict[str, Any]:
        """DELETE request"""
        return self._request('DELETE', endpoint)


class ClassifarrError(Exception):
    """Classifarr API Error"""
    
    def __init__(self, message: str, status_code: int, data: Dict[str, Any]):
        super().__init__(message)
        self.status_code = status_code
        self.data = data
```

---

## Authentication

### Login (Get JWT Token)

```python
from classifarr_client import ClassifarrClient
from config import config

def login(username: str, password: str) -> ClassifarrClient:
    """Login and get JWT token"""
    client = ClassifarrClient(config.BASE_URL)
    
    response = client.post('/api/auth/login', {
        'username': username,
        'password': password
    })
    
    print('Login successful')
    print(f"Token: {response['token']}")
    
    # Return new client with JWT token
    return ClassifarrClient(config.BASE_URL, jwt_token=response['token'])


# Usage
if __name__ == '__main__':
    client = login('admin', 'your-password')
```

### Create API Key (Requires JWT)

```python
from typing import Optional
from datetime import datetime

def create_api_key(
    client: ClassifarrClient,
    name: str,
    permissions: str = 'read_write',
    expires_at: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new API key"""
    key_data = {
        'name': name,
        'permissions': permissions
    }
    
    if expires_at:
        key_data['expires_at'] = expires_at
    
    response = client.post('/api/keys', key_data)
    
    print(f"API Key created: {response}")
    return response


# Usage
if __name__ == '__main__':
    client = login('admin', 'your-password')
    
    api_key = create_api_key(
        client,
        'Automation Script',
        'read_write',
        '2026-12-31T23:59:59Z'
    )
    
    print(f"API Key ID: {api_key['id']}")
```

### List API Keys

```python
def list_api_keys(client: ClassifarrClient) -> list:
    """List all API keys"""
    keys = client.get('/api/keys')
    
    print('API Keys:')
    for key in keys:
        print(f"- {key['name']} ({key['permissions']})")
        print(f"  Created: {key['created_at']}")
        print(f"  Expires: {key.get('expires_at', 'Never')}")
    
    return keys
```

### Reveal API Key

```python
def reveal_api_key(client: ClassifarrClient, key_id: int) -> str:
    """Reveal an API key"""
    response = client.get(f'/api/keys/{key_id}/reveal')
    
    print(f"API Key: {response['key']}")
    return response['key']
```

---

## System Health

### Get Overall Health

```python
from classifarr_client import ClassifarrClient
from config import config

client = ClassifarrClient(config.BASE_URL, api_key=config.API_KEY)

def get_health() -> Dict[str, Any]:
    """Get system health"""
    health = client.get('/api/system/health')
    
    print(f"Status: {health['status']}")
    print(f"Database: {'✓' if health['database'] else '✗'}")
    print(f"Plex: {'✓' if health['plex'] else '✗'}")
    
    return health
```

### Get Detailed Service Health

```python
def get_service_health() -> Dict[str, Any]:
    """Get detailed service health"""
    health = client.get('/api/system/health/services')
    
    print(f"Overall: {health['overall']}")
    print('Services:')
    
    for service in health['services']:
        icon = '✓' if service['status'] == 'healthy' else \
               '⚠' if service['status'] == 'degraded' else '✗'
        
        print(f"  {icon} {service['name']}: {service['status']}")
        print(f"    Success rate: {service['successRate']:.1f}%")
        print(f"    Avg response: {service['averageResponseTime']:.0f}ms")
        
        if service['trend'] != 'stable':
            print(f"    Trend: {service['trend']}")
    
    return health
```

### Force Refresh Health Checks

```python
def refresh_health_checks() -> Dict[str, Any]:
    """Force refresh health checks"""
    result = client.post('/api/system/health/refresh')
    
    print('Health checks refreshed')
    print(f"Status: {result['status']}")
    
    return result
```

### Liveness and Readiness Probes

```python
def check_liveness() -> bool:
    """Check liveness probe"""
    try:
        client.get('/api/system/health/live')
        print('Liveness: OK')
        return True
    except Exception:
        print('Liveness: Failed')
        return False


def check_readiness() -> bool:
    """Check readiness probe"""
    try:
        client.get('/api/system/health/ready')
        print('Readiness: OK')
        return True
    except Exception:
        print('Readiness: Failed')
        return False
```

### Get System Status

```python
def get_system_status() -> Dict[str, Any]:
    """Get system status"""
    status = client.get('/api/system/status')
    
    print(f"Version: {status['version']}")
    print(f"Uptime: {status['uptime'] // 3600} hours")
    print(f"Environment: {status['environment']}")
    
    return status
```

---

## Libraries

### List All Libraries

```python
def list_libraries() -> list:
    """List all libraries"""
    libraries = client.get('/api/libraries')
    
    print(f"Found {len(libraries)} libraries:")
    for lib in libraries:
        print(f"- [{lib['id']}] {lib['name']}")
        print(f"  Priority: {lib['priority']}")
        print(f"  Active: {'Yes' if lib['is_active'] else 'No'}")
        print(f"  Items: {lib.get('item_count', 0)}")
    
    return libraries
```

### Get Library Details

```python
def get_library(library_id: int) -> Dict[str, Any]:
    """Get library details"""
    library = client.get(f'/api/libraries/{library_id}')
    
    print(f"Library: {library['name']}")
    print(f"Type: {library['type']}")
    print(f"Plex Key: {library['plex_library_key']}")
    print(f"Items: {library['item_count']}")
    
    return library
```

### Update Library

```python
def update_library(library_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update library"""
    library = client.put(f'/api/libraries/{library_id}', updates)
    
    print(f"Library updated: {library['name']}")
    return library


# Usage
if __name__ == '__main__':
    update_library(1, {
        'name': 'Kids & Family Movies',
        'priority': 95,
        'is_active': True
    })
```

### Delete Library

```python
def delete_library(library_id: int) -> None:
    """Delete library"""
    client.delete(f'/api/libraries/{library_id}')
    print(f"Library {library_id} deleted")
```

### Get Libraries with Pending Suggestions

```python
def get_pending_suggestions() -> list:
    """Get libraries with pending suggestions"""
    libraries = client.get('/api/libraries/pending-suggestions')
    
    print('Libraries with pending suggestions:')
    for lib in libraries:
        print(f"- {lib['name']}: {lib['pending_count']} pending")
    
    return libraries
```

---

## Media Sync

### Trigger Library Sync

```python
def sync_library(
    library_id: int,
    incremental: bool = False,
    batch_size: int = 100
) -> Dict[str, Any]:
    """Trigger library sync"""
    sync_type = 'incremental' if incremental else 'full'
    print(f"Starting {sync_type} sync...")
    
    result = client.post(f'/api/media-sync/sync/{library_id}', {
        'incremental': incremental,
        'batchSize': batch_size
    })
    
    print('Sync completed:')
    print(f"- Added: {result['stats']['added']}")
    print(f"- Updated: {result['stats']['updated']}")
    print(f"- Removed: {result['stats']['removed']}")
    print(f"- Duration: {result['stats']['duration']}ms")
    
    return result


# Full sync
if __name__ == '__main__':
    sync_library(1, incremental=False, batch_size=100)

# Incremental sync
if __name__ == '__main__':
    sync_library(1, incremental=True)
```

### Get Library Items

```python
from typing import List

def get_library_items(
    library_id: int,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """Get library items with pagination"""
    result = client.get(f'/api/media-sync/items/{library_id}', {
        'limit': limit,
        'offset': offset
    })
    
    print(f"Items {offset + 1}-{offset + len(result['items'])} of {result['total']}")
    
    for item in result['items']:
        year = item.get('year', 'N/A')
        print(f"- {item['title']} ({year})")
        print(f"  TMDB: {item['tmdb_id']}, Type: {item['media_type']}")
    
    return result


def get_all_library_items(library_id: int) -> List[Dict[str, Any]]:
    """Get all library items (paginated)"""
    all_items = []
    limit = 100
    offset = 0
    
    while True:
        result = get_library_items(library_id, limit=limit, offset=offset)
        all_items.extend(result['items'])
        
        offset += limit
        if offset >= result['total']:
            break
    
    print(f"Fetched {len(all_items)} total items")
    return all_items
```

### Lookup Media by TMDB ID

```python
def lookup_media(tmdb_id: int, media_type: str) -> Dict[str, Any]:
    """Lookup media by TMDB ID"""
    result = client.get(f'/api/media-sync/lookup/{tmdb_id}', {
        'mediaType': media_type
    })
    
    if result['exists']:
        print(f"Found in library: {result['library']['name']}")
        print(f"Title: {result['item']['title']}")
    else:
        print('Not found in any library')
    
    return result


# Check if movie exists
if __name__ == '__main__':
    lookup_media(862, 'movie')  # Toy Story

# Check if TV show exists
if __name__ == '__main__':
    lookup_media(1399, 'tv')  # Game of Thrones
```

### Get Sync Status

```python
from typing import Union

def get_sync_status(library_id: Optional[int] = None) -> Union[Dict, List]:
    """Get sync status"""
    params = {'libraryId': library_id} if library_id else {}
    status = client.get('/api/media-sync/sync/status', params)
    
    if isinstance(status, list):
        # Multiple libraries
        for lib in status:
            print(f"Library {lib['library_id']}:")
            print(f"  Status: {lib['status']}")
            if lib.get('progress'):
                prog = lib['progress']
                print(f"  Progress: {prog['current']}/{prog['total']}")
    else:
        # Single library
        print(f"Status: {status['status']}")
        if status.get('progress'):
            prog = status['progress']
            print(f"Progress: {prog['current']}/{prog['total']}")
            print(f"Percentage: {prog['percentage']}%")
    
    return status
```

---

## Classification

### Classify Media

```python
def classify_media(tmdb_id: int, media_type: str, title: str) -> Dict[str, Any]:
    """Classify media"""
    result = client.post('/api/classification/classify', {
        'tmdb_id': tmdb_id,
        'media_type': media_type,
        'title': title
    })
    
    print('Classification Result:')
    print(f"- Library: {result['library']['name']}")
    print(f"- Confidence: {result['confidence']}%")
    print(f"- Method: {result['method']}")
    
    if result.get('reasoning'):
        print(f"- Reasoning: {result['reasoning']}")
    
    return result


# Usage
if __name__ == '__main__':
    classify_media(862, 'movie', 'Toy Story')
```

### Get Classification History

```python
def get_classification_history(
    limit: int = 20,
    offset: int = 0,
    exclude_method: Optional[str] = None,
    library_id: Optional[int] = None,
    media_type: Optional[str] = None
) -> Dict[str, Any]:
    """Get classification history"""
    params = {'limit': limit, 'offset': offset}
    
    if exclude_method:
        params['excludeMethod'] = exclude_method
    if library_id:
        params['library_id'] = library_id
    if media_type:
        params['media_type'] = media_type
    
    result = client.get('/api/classification/history', params)
    
    print(f"Classifications {offset + 1}-{offset + len(result['items'])} of {result['total']}")
    
    for item in result['items']:
        print(f"- {item['title']} → {item['library_name']}")
        print(f"  Confidence: {item['confidence']}%, Method: {item['method']}")
        print(f"  Date: {item['created_at']}")
    
    return result


# Recent classifications (exclude source_library)
if __name__ == '__main__':
    get_classification_history(limit=20, exclude_method='source_library')

# Filter by library
if __name__ == '__main__':
    get_classification_history(library_id=1)

# Filter by media type
if __name__ == '__main__':
    get_classification_history(media_type='movie')
```

### Get Classification Details

```python
def get_classification_details(classification_id: int) -> Dict[str, Any]:
    """Get classification details"""
    classification = client.get(f'/api/classification/history/{classification_id}')
    
    print('Classification Details:')
    print(f"Title: {classification['title']}")
    print(f"Library: {classification['library_name']}")
    print(f"Confidence: {classification['confidence']}%")
    print(f"Method: {classification['method']}")
    
    if classification.get('scores'):
        print('Scores:')
        for lib, score in classification['scores'].items():
            print(f"  {lib}: {score}")
    
    return classification
```

### Submit Correction

```python
def submit_correction(
    classification_id: int,
    correct_library_id: int,
    reason: str
) -> Dict[str, Any]:
    """Submit classification correction"""
    correction = client.post('/api/classification/corrections', {
        'classification_id': classification_id,
        'correct_library_id': correct_library_id,
        'reason': reason
    })
    
    print(f"Correction submitted: {correction['id']}")
    return correction


# Usage
if __name__ == '__main__':
    submit_correction(1, 2, 'Should be in 4K library')
```

---

## Policies

### List All Policies

```python
def list_policies() -> list:
    """List all policies"""
    policies = client.get('/api/policies')
    
    print(f"Found {len(policies)} policies:")
    for policy in policies:
        print(f"- [{policy['id']}] {policy['name']}")
        print(f"  Library: {policy['library_name']}")
        print(f"  Auto-classify threshold: {policy['auto_classify_threshold']}%")
        print(f"  Prompt threshold: {policy['prompt_threshold']}%")
    
    return policies
```

### Get Policy Details

```python
def get_policy(policy_id: int) -> Dict[str, Any]:
    """Get policy details"""
    policy = client.get(f'/api/policies/{policy_id}')
    
    print(f"Policy: {policy['name']}")
    print('Weights:')
    print(f"  Preset: {policy['preset_weight']}")
    print(f"  Pattern: {policy['pattern_weight']}")
    print(f"  RAG: {policy['rag_weight']}")
    print(f"  History: {policy['history_weight']}")
    
    return policy
```

### Create Policy

```python
def create_policy(library_id: int, policy_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create policy"""
    policy = client.post('/api/policies', {
        'library_id': library_id,
        **policy_data
    })
    
    print(f"Policy created: {policy['name']}")
    return policy


# Usage
if __name__ == '__main__':
    policy = create_policy(1, {
        'name': 'Kids Movies Policy',
        'auto_classify_threshold': 85,
        'prompt_threshold': 60,
        'preset_weight': 0.40,
        'pattern_weight': 0.25,
        'rag_weight': 0.20,
        'history_weight': 0.15,
        'preset_ids': [1, 2, 3],
        'preset_weights': {
            '1': 1.0,
            '2': 1.0,
            '3': 0.8
        }
    })
```

### Update Policy

```python
def update_policy(policy_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update policy"""
    policy = client.put(f'/api/policies/{policy_id}', updates)
    
    print(f"Policy updated: {policy['name']}")
    return policy


# Usage
if __name__ == '__main__':
    update_policy(1, {
        'auto_classify_threshold': 90,
        'prompt_threshold': 70
    })
```

### Delete Policy

```python
def delete_policy(policy_id: int) -> None:
    """Delete policy"""
    client.delete(f'/api/policies/{policy_id}')
    print(f"Policy {policy_id} deleted")
```

### List Presets

```python
def list_presets(
    category: Optional[str] = None,
    search: Optional[str] = None
) -> list:
    """List presets"""
    params = {}
    if category:
        params['category'] = category
    if search:
        params['search'] = search
    
    presets = client.get('/api/presets', params)
    
    print(f"Found {len(presets)} presets:")
    for preset in presets:
        print(f"- [{preset['id']}] {preset['name']}")
        print(f"  Category: {preset['category']}")
    
    return presets


# All presets
if __name__ == '__main__':
    list_presets()

# Filter by category
if __name__ == '__main__':
    list_presets(category='genre')

# Search presets
if __name__ == '__main__':
    list_presets(search='action')
```

---

## Error Handling

### Handle Specific Error Codes

```python
from classifarr_client import ClassifarrError

def handle_library_not_found(library_id: int) -> Optional[Dict[str, Any]]:
    """Handle library not found error"""
    try:
        library = client.get(f'/api/libraries/{library_id}')
        print(f"Library found: {library['name']}")
        return library
    except ClassifarrError as e:
        if e.status_code == 404:
            print('Error: Library not found')
            return None
        raise
```

### Handle Sync Already in Progress

```python
import time

def handle_sync_conflict(library_id: int) -> Dict[str, Any]:
    """Handle sync conflict (409)"""
    try:
        result = client.post(f'/api/media-sync/sync/{library_id}', {
            'incremental': False
        })
        
        print(f"Sync completed: {result['stats']}")
        return result
    except ClassifarrError as e:
        if e.status_code == 409:
            print('Sync already in progress')
            print(f"Progress: {e.data.get('progress')}")
            
            # Wait and check status
            time.sleep(5)
            
            status = client.get('/api/media-sync/sync/status', {
                'libraryId': library_id
            })
            
            print(f"Current status: {status}")
            return status
        raise
```

### Retry with Exponential Backoff

```python
import time
from typing import Callable, TypeVar

T = TypeVar('T')

def retry_with_backoff(
    func: Callable[[], T],
    max_retries: int = 3
) -> T:
    """Retry function with exponential backoff"""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            return func()
        except ClassifarrError as e:
            last_error = e
            
            # Don't retry 4xx errors (except 429)
            if 400 <= e.status_code < 500 and e.status_code != 429:
                raise
            
            # Retry 5xx errors and 429
            if e.status_code >= 500 or e.status_code == 429:
                if attempt < max_retries - 1:
                    delay = 2 ** attempt
                    print(f"Retry {attempt + 1}/{max_retries} after {delay}s...")
                    time.sleep(delay)
                    continue
            
            raise
    
    raise last_error


# Usage
if __name__ == '__main__':
    libraries = retry_with_backoff(lambda: client.get('/api/libraries'))
    print(f"Libraries: {libraries}")
```

### Comprehensive Error Handler

```python
import time
import logging
from typing import Callable, TypeVar, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

T = TypeVar('T')

def safe_api_call(
    func: Callable[[], T],
    max_retries: int = 3,
    retry_delay: int = 1,
    on_error: Optional[Callable[[Exception], None]] = None
) -> T:
    """Safe API call with retry logic and error handling"""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            return func()
        except ClassifarrError as e:
            last_error = e
            
            should_retry = (
                e.status_code >= 500 or
                e.status_code == 429
            )
            
            if should_retry and attempt < max_retries - 1:
                delay = retry_delay * (2 ** attempt)
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay}s...")
                time.sleep(delay)
                continue
            
            if on_error:
                on_error(e)
            
            raise
        except requests.exceptions.RequestException as e:
            last_error = e
            
            if attempt < max_retries - 1:
                delay = retry_delay * (2 ** attempt)
                logger.warning(f"Network error, retrying in {delay}s...")
                time.sleep(delay)
                continue
            
            raise
    
    raise last_error


# Usage
if __name__ == '__main__':
    def on_error(error):
        logger.error(f"API call failed: {error}")
    
    try:
        result = safe_api_call(
            lambda: client.get('/api/libraries'),
            max_retries=3,
            on_error=on_error
        )
        print(f"Success: {result}")
    except ClassifarrError as e:
        logger.error(f"API Error {e.status_code}: {e}")
        logger.error(f"Details: {e.data}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
```

---

## Complete Examples

### Health Monitoring Service

```python
import time
import threading
from datetime import datetime
from classifarr_client import ClassifarrClient
from config import config

class HealthMonitor:
    """Monitor system health"""
    
    def __init__(self, client: ClassifarrClient, interval: int = 30):
        self.client = client
        self.interval = interval
        self.running = False
        self.thread = None
    
    def check_health(self) -> Dict[str, Any]:
        """Check system health"""
        health = self.client.get('/api/system/health/services')
        
        print(f"=== Health Check at {datetime.now().isoformat()} ===")
        print(f"Overall Status: {health['overall']}")
        
        # Check for degrading services
        degrading = [s for s in health['services'] if s['trend'] == 'degrading']
        if degrading:
            print('⚠️  Degrading services:')
            for service in degrading:
                print(f"  - {service['name']}")
        
        # Check for unhealthy services
        unhealthy = [s for s in health['services'] if s['status'] == 'unhealthy']
        if unhealthy:
            print('❌ Unhealthy services:')
            for service in unhealthy:
                print(f"  - {service['name']}")
        
        print()
        return health
    
    def _run(self):
        """Run monitoring loop"""
        while self.running:
            try:
                self.check_health()
            except Exception as e:
                print(f"Health check failed: {e}")
            
            time.sleep(self.interval)
    
    def start(self):
        """Start monitoring"""
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
    
    def stop(self):
        """Stop monitoring"""
        self.running = False
        if self.thread:
            self.thread.join()


# Usage
if __name__ == '__main__':
    client = ClassifarrClient(config.BASE_URL, api_key=config.API_KEY)
    monitor = HealthMonitor(client, interval=30)
    
    monitor.start()
    
    # Run for 5 minutes
    time.sleep(5 * 60)
    monitor.stop()
```

### Sync All Libraries

```python
import time
from typing import List, Dict, Any

def sync_all_libraries(
    client: ClassifarrClient,
    incremental: bool = True
) -> List[Dict[str, Any]]:
    """Sync all active libraries"""
    libraries = client.get('/api/libraries')
    active_libraries = [lib for lib in libraries if lib['is_active']]
    
    print(f"Syncing {len(active_libraries)} active libraries...")
    
    results = []
    
    for lib in active_libraries:
        print(f"\nSyncing library: {lib['name']}")
        
        try:
            result = client.post(f"/api/media-sync/sync/{lib['id']}", {
                'incremental': incremental
            })
            
            print('✓ Sync completed:')
            print(f"  Added: {result['stats']['added']}")
            print(f"  Updated: {result['stats']['updated']}")
            print(f"  Removed: {result['stats']['removed']}")
            
            results.append({
                'library': lib['name'],
                'success': True,
                'stats': result['stats']
            })
        except Exception as e:
            print(f"✗ Sync failed: {e}")
            results.append({
                'library': lib['name'],
                'success': False,
                'error': str(e)
            })
        
        # Wait between syncs
        time.sleep(2)
    
    print('\n=== Sync Summary ===')
    successful = sum(1 for r in results if r['success'])
    print(f"Successful: {successful}/{len(results)}")
    
    return results


# Usage
if __name__ == '__main__':
    client = ClassifarrClient(config.BASE_URL, api_key=config.API_KEY)
    sync_all_libraries(client, incremental=True)
```

### Batch Classification

```python
import concurrent.futures
from typing import List, Dict, Any

def batch_classify(
    client: ClassifarrClient,
    items: List[Dict[str, Any]],
    max_workers: int = 3
) -> List[Dict[str, Any]]:
    """Classify multiple items with concurrency"""
    results = []
    
    def classify_item(item: Dict[str, Any]) -> Dict[str, Any]:
        """Classify a single item"""
        try:
            result = client.post('/api/classification/classify', {
                'tmdb_id': item['tmdb_id'],
                'media_type': item['media_type'],
                'title': item['title']
            })
            
            print(f"✓ {item['title']} → {result['library']['name']} ({result['confidence']}%)")
            
            return {
                **item,
                'success': True,
                'result': result
            }
        except Exception as e:
            print(f"✗ {item['title']}: {e}")
            return {
                **item,
                'success': False,
                'error': str(e)
            }
    
    # Process items with thread pool
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(classify_item, items))
    
    successful = sum(1 for r in results if r['success'])
    print(f"\nCompleted: {successful}/{len(items)}")
    
    return results


# Usage
if __name__ == '__main__':
    client = ClassifarrClient(config.BASE_URL, api_key=config.API_KEY)
    
    items = [
        {'tmdb_id': 862, 'media_type': 'movie', 'title': 'Toy Story'},
        {'tmdb_id': 863, 'media_type': 'movie', 'title': 'Toy Story 2'},
        {'tmdb_id': 10193, 'media_type': 'movie', 'title': 'Toy Story 3'}
    ]
    
    batch_classify(client, items, max_workers=3)
```

### Auto-Classification Workflow

```python
import time
from typing import List, Dict, Any

class AutoClassifier:
    """Auto-classification workflow"""
    
    def __init__(self, client: ClassifarrClient, library_id: int):
        self.client = client
        self.library_id = library_id
    
    def sync(self) -> int:
        """Sync library and return count of new items"""
        print('Step 1: Syncing library...')
        
        result = self.client.post(
            f'/api/media-sync/sync/{self.library_id}',
            {'incremental': True}
        )
        
        new_items = result['stats']['added']
        print(f"✓ Synced: {new_items} new items")
        return new_items
    
    def get_unclassified(self) -> List[Dict[str, Any]]:
        """Find unclassified items"""
        print('Step 2: Finding unclassified items...')
        
        items_result = self.client.get(f'/api/media-sync/items/{self.library_id}')
        
        # Filter items without classification (add your logic here)
        unclassified = [
            item for item in items_result['items']
            if not item.get('classification_id')
        ]
        
        print(f"✓ Found {len(unclassified)} unclassified items")
        return unclassified
    
    def classify_all(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Classify all items"""
        print('Step 3: Classifying items...')
        
        results = []
        
        for item in items:
            try:
                result = self.client.post('/api/classification/classify', {
                    'tmdb_id': item['tmdb_id'],
                    'media_type': item['media_type'],
                    'title': item['title']
                })
                
                auto_classified = result['confidence'] >= 80
                
                if auto_classified:
                    print(f"✓ {item['title']} → {result['library']['name']} ({result['confidence']}%)")
                else:
                    print(f"⚠ {item['title']}: Low confidence ({result['confidence']}%)")
                
                results.append({
                    'item': item,
                    'result': result,
                    'auto_classified': auto_classified
                })
            except Exception as e:
                print(f"✗ {item['title']}: {e}")
            
            # Rate limiting
            time.sleep(0.1)
        
        return results
    
    def run(self):
        """Run the workflow"""
        print('=== Auto-Classification Workflow ===\n')
        
        try:
            new_items = self.sync()
            
            if new_items == 0:
                print('No new items to classify')
                return
            
            unclassified = self.get_unclassified()
            results = self.classify_all(unclassified)
            
            print('\n=== Summary ===')
            auto_classified = sum(1 for r in results if r['auto_classified'])
            print(f"Auto-classified: {auto_classified}/{len(results)}")
            print(f"Needs review: {len(results) - auto_classified}")
        except Exception as e:
            print(f"Workflow failed: {e}")


# Usage
if __name__ == '__main__':
    client = ClassifarrClient(config.BASE_URL, api_key=config.API_KEY)
    classifier = AutoClassifier(client, library_id=1)
    classifier.run()
```

### Command-Line Tool

```python
#!/usr/bin/env python3
"""Classifarr CLI tool"""

import argparse
import sys
from classifarr_client import ClassifarrClient, ClassifarrError
from config import config

def main():
    parser = argparse.ArgumentParser(description='Classifarr API CLI')
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Health command
    health_parser = subparsers.add_parser('health', help='Check system health')
    health_parser.add_argument('--detailed', action='store_true', help='Show detailed health')
    
    # Libraries command
    libraries_parser = subparsers.add_parser('libraries', help='List libraries')
    
    # Sync command
    sync_parser = subparsers.add_parser('sync', help='Sync library')
    sync_parser.add_argument('library_id', type=int, help='Library ID')
    sync_parser.add_argument('--incremental', action='store_true', help='Incremental sync')
    
    # Classify command
    classify_parser = subparsers.add_parser('classify', help='Classify media')
    classify_parser.add_argument('tmdb_id', type=int, help='TMDB ID')
    classify_parser.add_argument('media_type', choices=['movie', 'tv'], help='Media type')
    classify_parser.add_argument('title', help='Title')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Create client
    client = ClassifarrClient(config.BASE_URL, api_key=config.API_KEY)
    
    try:
        if args.command == 'health':
            if args.detailed:
                health = client.get('/api/system/health/services')
                print(f"Overall: {health['overall']}")
                for service in health['services']:
                    print(f"  {service['name']}: {service['status']}")
            else:
                health = client.get('/api/system/health')
                print(f"Status: {health['status']}")
        
        elif args.command == 'libraries':
            libraries = client.get('/api/libraries')
            for lib in libraries:
                print(f"[{lib['id']}] {lib['name']}")
        
        elif args.command == 'sync':
            result = client.post(f'/api/media-sync/sync/{args.library_id}', {
                'incremental': args.incremental
            })
            print(f"Added: {result['stats']['added']}")
            print(f"Updated: {result['stats']['updated']}")
            print(f"Removed: {result['stats']['removed']}")
        
        elif args.command == 'classify':
            result = client.post('/api/classification/classify', {
                'tmdb_id': args.tmdb_id,
                'media_type': args.media_type,
                'title': args.title
            })
            print(f"Library: {result['library']['name']}")
            print(f"Confidence: {result['confidence']}%")
    
    except ClassifarrError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
```

---

## Related Documentation

- [Authentication Guide](../authentication.md)
- [cURL Examples](./curl.md)
- [JavaScript Examples](./javascript.md)
- [API Overview](../README.md)
