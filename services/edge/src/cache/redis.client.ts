import { createClient, RedisClientType } from "redis";

export interface CacheEntry {
  value: any; // The actual cached data
  metadata: {
    version: number; // Track versions for cache updates
    cachedAt: number; // Timestamp when data was cached
    expiresAt: number; // Timestamp when data should expire
    stale: boolean; // Whether data is stale/outdated
    tags?: string[]; // Optional tags for grouping cache entries
  };
}

export class CacheClient {
  private client: RedisClientType; // Redis client instance
  private connected: boolean = false; // Tracks connection
  private readonly redisUrl: string; // Store the redis URL

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
    //Create new redis client with the provided url
    this.client = createClient({ url: redisUrl });

    this.client.on("error", (err) => {
      console.error("Redis Client Error", err);
    });

    this.client.on("connect", (err) => {
      console.log("Redis connected", this.redisUrl);
      this.connected = true;
    });

    this.client.on("disconnect", () => {
      console.log("Redis disconnected");
      this.connected = false;
    });
  }

  //Connect to Redis before cache operations

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log("Redis connection established");
    } catch (error) {
      console.error("Failed to connect to Redis", error);
      throw error;
    }
  }

  //Disconnect from Redis when app is shutting down
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      console.log("Redis connection closed");
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * GET - Retrieve a value from cache
   *
   * 1. Ask Redis for the value at this key
   * 2. If nothing found, return null
   * 3. If found, parse the JSON strinf back to and Object
   * 4. If error, log it and return null(fail gracefully)
   */

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      //Redis stores everything as strings, so parse JSON
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Cache GET error for key ${key}`, error);
      return null; // treat as cache miss
    }
  }

  /**
   * SET - Store a value in cache with expiration
   *
   * 1.Convert the value to a JSON string (Redis only stores strings)
   * 2. Store it with a TTL (time-to-live) in seconds
   * 3. After TTL seconds, Redis automatically deltes the key
   */

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      //Convert object to JSON string
      const serialized = JSON.stringify(value);
      //Set with expiration and ttl is in seconds
      await this.client.setEx(key, ttl, serialized);
    } catch (error) {
      console.error(`Cache SET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * DELETE - Remove a key from cache
   *
   * 1. Tell Redis to delete this key
   * 2. Redis removes it immediately
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Cache DEL error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * EXISTS - Check if a key exists
   *
   * 1. Ask Redis if this key exists
   * 2. Redis returns 1 if exists, 0 if not
   * 3. Convert to boolean (true/false)
   */

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1; //Convert 1/0 to true/false
    } catch (error) {
      console.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * GET WITH METADATA - Retrieve value and its metadata
   *
   * 1. Get the actual value from the key
   * 2. Get the metadata from a separate key (meta:originalKey)
   * 3. If metadata doesn't exist, create basic metadata
   * 4. Return both together
   *
   * - Keeps data and metadata separate
   * - Can query metadata without loading large data
   */

  async getWithMetaData(key: string): Promise<CacheEntry | null> {
    try {
      //Get main val
      const value = await this.get(key);
      if (!value) return null;

      //Get metadata from sepertae key with "meta:" prefix
      const metaKey = `meta:${key}`;
      const metadata = await this.get<CacheEntry["metadata"]>(metaKey);

      if (!metadata) {
        return {
          value,
          metadata: {
            version: 1,
            cachedAt: Date.now(),
            expiresAt: Date.now() + 3600000, // +1 hour in milliseconds
            stale: false,
          },
        };
      }
      return { value, metadata };
    } catch (error) {
      console.error(`Cache GET_WITH_METADATA error for key ${key}:`, error);
      return null;
    }
  }

  async setWithMetadata(
    key: string,
    data: CacheEntry,
    ttl: number
  ): Promise<void> {
    try {
      // Store actual value
      await this.set(key, data.value, ttl);
      // Store metadata separately with same TTL
      const metaKey = `meta:${key}`;
      await this.set(metaKey, data.metadata, ttl);

      //If tags exist, add this key to each tag's set
      if (data.metadata.tags && data.metadata.tags.length > 0) {
        for (const tag of data.metadata.tags) {
          const tagKey = `tag:${tag}`;
          await this.client.sAdd(tagKey, key);
        }
      }

      //If tags exist, add this key to each tag's set
    } catch (error) {
      console.error(`Cache SET_WITH_METADATA error for key ${key}:`, error);
      throw error;
    }
  }

  //Stale Data Handling(Lazy Invalidation)

  /**
   * MARK STALE - Mark data as outdated without deleting it
   * 1. Create a separate "stale:key" entry
   * 2. When checking data, also check if marked stale
   * 3. If stale, you can choose to use old data while refreshing
   *
   * -Serve stale data while fetching fresh data
   * - Avoid cache stampede (many requests fetching at once)
   */

  async markStale(key: string): Promise<void> {
    try {
      const staleKey = `stale:${key}`;
      await this.set(staleKey, true, 3600);
    } catch (error) {
      console.error(`Cache MARK_STALE error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * IS STALE - Check if data is marked as stale
   */
  async isStale(key: string): Promise<boolean> {
    try {
      const staleKey = `stale:${key}`;
      return await this.exists(staleKey);
    } catch (error) {
      console.error(`Cache IS_STALE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * CLEAR STALE - Remove the stale marker
   * Call after refreshing the data
   */
  async clearStale(key: string): Promise<void> {
    try {
      const staleKey = `stale:${key}`;
      await this.del(staleKey);
    } catch (error) {
      console.error(`Cache CLEAR_STALE error for key ${key}:`, error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const keys: string[] = [];

      // Use correct option format for scanIterator
      for await (const key of this.client.scanIterator({
        MATCH: pattern,
      })) {
        keys.push(...key);
      }

      return keys;
    } catch (error) {
      console.error(`Cache KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }
  /**
   * SMEMBERS - Get all members of a set
   *
   * 1. Redis SETs are unordered collections of unique strings
   * 2. We use sets for tag indexing (see setWithMetadata)
   * 3. This retrieves all keys with a specific tag
   *
   * - Get all cache entries tagged with "user:123"
   * - Invalidate all entries with a specific tag
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      console.error(`Cache SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }
}
