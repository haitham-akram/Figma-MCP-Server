# Cache System

In-memory L1 cache for Figma API responses.

## Features

- **TTL-based expiration** - Automatic cleanup of stale entries
- **LRU eviction** - Removes least recently used entries when cache is full
- **Pattern-based invalidation** - Clear related cache entries with glob patterns
- **Type-specific TTLs** - Different cache durations for different data types
- **Zero dependencies** - Pure in-memory implementation

## Configuration

Set these environment variables to configure caching:

```bash
# Enable/disable caching (default: true)
CACHE_ENABLED=true

# Maximum cache size in entries (default: 100)
CACHE_MAX_SIZE=100

# Default TTL in seconds (default: 300 = 5 minutes)
CACHE_DEFAULT_TTL=300

# Type-specific TTLs in seconds
CACHE_FILE_TTL=600        # 10 minutes (file data changes rarely)
CACHE_COMPONENTS_TTL=300  # 5 minutes
CACHE_TOKENS_TTL=300      # 5 minutes
CACHE_PLAN_TTL=180        # 3 minutes (cheapest to regenerate)
```

## How It Works

### 1. Cache Keys

Keys are structured as: `{fileKey}:{version}:{operation}:{filters}`

Examples:

- `abc123:1234567890:file` - File data
- `abc123:latest:file` - Latest version
- `abc123:1234567890:components:pageId=xyz` - Filtered components

### 2. Automatic Caching

The FigmaClient automatically caches `getFile()` responses:

```typescript
const client = new FigmaClient(config, httpClient, cacheManager)

// First call - cache miss, hits Figma API
const file1 = await client.getFile('abc123')

// Second call - cache hit, instant response
const file2 = await client.getFile('abc123')
```

### 3. Cache Invalidation

Invalidate cache when file changes:

```typescript
const cacheManager = getCacheManager()

// Invalidate all data for a specific file
await cacheManager.invalidate('abc123:*')

// Invalidate specific operation
await cacheManager.invalidate('abc123:*:components')

// Clear entire cache
await cacheManager.clear()
```

### 4. Cache Statistics

Monitor cache performance:

```typescript
const stats = await cacheManager.getStats()
console.log({
  hits: stats.hits,
  misses: stats.misses,
  hitRate: stats.hitRate, // 0.0 to 1.0
  size: stats.size,
})
```

## Architecture

```
┌─────────────────────────────────────────┐
│  MCP Tool Handler                       │
│  (get-figma-page-overview-handler.ts)   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  FigmaClient                            │
│  ├─ Check cache first                  │
│  ├─ Cache miss → fetch from API        │
│  └─ Cache response                     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  CacheManager                           │
│  ├─ Abstraction layer                  │
│  ├─ Type-specific TTLs                 │
│  └─ Key generation helpers             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  MemoryCacheProvider (L1)              │
│  ├─ Map<key, CacheEntry>               │
│  ├─ TTL expiration                     │
│  ├─ LRU eviction                       │
│  └─ Pattern matching                   │
└─────────────────────────────────────────┘
```

## Benefits

### Rate Limit Protection

- Figma API: 2 requests/second limit
- Cache prevents hitting rate limits with repeated requests

### Performance

- **Cache hit**: <1ms (in-memory)
- **Cache miss**: 1-3s (API call)
- **80%+ hit rate typical** for common workflows

### Cost Reduction

- Fewer API calls = less Figma API usage
- Important if Figma adds pricing tiers

## Future: Redis L2 Cache

To add Redis for persistence and multi-instance support:

1. Install Redis client:

```bash
npm install redis
```

2. Create `src/cache/redis-provider.ts`:

```typescript
import { createClient } from 'redis'
import { CacheProvider } from './types.js'

export class RedisCacheProvider implements CacheProvider {
  // Implementation
}
```

3. Update `docker-compose.yml`:

```yaml
services:
  mcp-server:
    environment:
      REDIS_URL: redis://redis:6379
  redis:
    image: redis:7-alpine
```

4. Use hybrid approach:

```typescript
const l1 = new MemoryCacheProvider(100)
const l2 = new RedisCacheProvider(redisUrl)
const cacheManager = new CacheManager(config, new HybridProvider(l1, l2))
```

## Testing

Disable cache for testing:

```bash
CACHE_ENABLED=false npm test
```

Or mock the cache manager:

```typescript
const mockCache = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
  // ...
}
const client = new FigmaClient(config, httpClient, mockCache)
```
