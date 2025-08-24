/**
 * CacheManager - A comprehensive caching system with configurable strategies
 * 
 * Features:
 * - Multiple cache strategies (LRU, TTL, size-based)
 * - Automatic memory management and cleanup
 * - Namespace support for different services
 * - Statistics and monitoring
 * - Fallback to localStorage when needed
 * - Event-driven architecture for debugging
 * 
 * Usage:
 *   const cache = new CacheManager('wikipedia-api', {
 *     maxSize: 100,
 *     ttl: 300000, // 5 minutes
 *     strategy: 'lru'
 *   });
 * 
 *   await cache.set('key', data);
 *   const data = await cache.get('key');
 */
import Emitter from './Emitter.js';

export default class CacheManager {
  /**
   * @param {string} namespace - Unique namespace for this cache instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxSize=100] - Maximum number of items to store
   * @param {number} [options.ttl=null] - Time to live in milliseconds (null = no expiration)
   * @param {string} [options.strategy='lru'] - Eviction strategy: 'lru', 'fifo'
   * @param {boolean} [options.useLocalStorage=false] - Fallback to localStorage for persistence
   * @param {boolean} [options.enableMetrics=true] - Enable hit/miss tracking
   */
  constructor(namespace, options = {}) {
    this.namespace = namespace;
    this.options = {
      maxSize: 100,
      ttl: null,
      strategy: 'lru',
      useLocalStorage: false,
      enableMetrics: true,
      ...options
    };
    
    // Main cache storage
    this.cache = new Map();
    
    // Access order tracking for LRU
    this.accessOrder = [];
    
    // Metrics tracking
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      errors: 0
    };
    
    // Event emitter for debugging and monitoring
    this.emitter = new Emitter();
    
    this._init();
  }
  
  _init() {
    // Load from localStorage if enabled
    if (this.options.useLocalStorage) {
      this._loadFromLocalStorage();
    }
    
    // Set up periodic cleanup for TTL
    if (this.options.ttl) {
      this._setupTTLCleanup();
    }
  }
  
  /**
   * Get an item from the cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} The cached value or null if not found/expired
   */
  async get(key) {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this._recordMiss(key);
        return null;
      }
      
      // Check TTL expiration
      if (this._isExpired(entry)) {
        this.cache.delete(key);
        this._removeFromAccessOrder(key);
        this._recordMiss(key);
        this.emitter.emit('cache:expired', { namespace: this.namespace, key });
        return null;
      }
      
      // Update access time and order for LRU
      entry.lastAccessed = Date.now();
      this._updateAccessOrder(key);
      
      this._recordHit(key);
      return entry.value;
      
    } catch (error) {
      this.metrics.errors++;
      this.emitter.emit('cache:error', { namespace: this.namespace, key, error });
      return null;
    }
  }
  
  /**
   * Set an item in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [customTTL] - Custom TTL for this item (overrides default)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, customTTL = null) {
    try {
      const now = Date.now();
      const ttl = customTTL || this.options.ttl;
      
      const entry = {
        value,
        createdAt: now,
        lastAccessed: now,
        expiresAt: ttl ? now + ttl : null
      };
      
      // Check if we need to evict items first
      if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
        this._evictItems(1);
      }
      
      this.cache.set(key, entry);
      this._updateAccessOrder(key);
      
      // Save to localStorage if enabled
      if (this.options.useLocalStorage) {
        this._saveToLocalStorage(key, entry);
      }
      
      this.metrics.sets++;
      this.emitter.emit('cache:set', { namespace: this.namespace, key, size: this.cache.size });
      
      return true;
      
    } catch (error) {
      this.metrics.errors++;
      this.emitter.emit('cache:error', { namespace: this.namespace, key, error });
      return false;
    }
  }
  
  /**
   * Check if a key exists in the cache (without updating access time)
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    return entry && !this._isExpired(entry);
  }
  
  /**
   * Delete an item from the cache
   * @param {string} key - Cache key
   * @returns {boolean} Whether the item was deleted
   */
  delete(key) {
    const existed = this.cache.delete(key);
    if (existed) {
      this._removeFromAccessOrder(key);
      if (this.options.useLocalStorage) {
        this._deleteFromLocalStorage(key);
      }
      this.emitter.emit('cache:delete', { namespace: this.namespace, key });
    }
    return existed;
  }
  
  /**
   * Clear all items from the cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    
    if (this.options.useLocalStorage) {
      this._clearLocalStorage();
    }
    
    this.emitter.emit('cache:clear', { namespace: this.namespace, clearedItems: size });
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache metrics and information
   */
  getStats() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 
      : 0;
      
    return {
      namespace: this.namespace,
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      ...this.metrics,
      memoryEstimate: this._estimateMemoryUsage()
    };
  }
  
  /**
   * Get or set a value (convenience method)
   * @param {string} key - Cache key
   * @param {Function} factory - Function to generate value if not cached
   * @param {number} [customTTL] - Custom TTL for this item
   * @returns {Promise<any>} The cached or newly generated value
   */
  async getOrSet(key, factory, customTTL = null) {
    let value = await this.get(key);
    
    if (value === null) {
      try {
        value = await factory();
        await this.set(key, value, customTTL);
      } catch (error) {
        this.metrics.errors++;
        this.emitter.emit('cache:factory_error', { namespace: this.namespace, key, error });
        throw error;
      }
    }
    
    return value;
  }
  
  /**
   * Subscribe to cache events
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    return this.emitter.on(event, handler);
  }
  
  // Private methods
  
  _isExpired(entry) {
    return entry.expiresAt && Date.now() > entry.expiresAt;
  }
  
  _updateAccessOrder(key) {
    this._removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }
  
  _removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  
  _evictItems(count) {
    const toEvict = [];
    
    if (this.options.strategy === 'lru') {
      // Evict least recently used items
      for (let i = 0; i < Math.min(count, this.accessOrder.length); i++) {
        toEvict.push(this.accessOrder[i]);
      }
    } else if (this.options.strategy === 'fifo') {
      // Evict oldest items by creation time
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)
        .slice(0, count);
      toEvict.push(...entries.map(([key]) => key));
    }
    
    for (const key of toEvict) {
      this.cache.delete(key);
      this._removeFromAccessOrder(key);
      this.metrics.evictions++;
      this.emitter.emit('cache:evict', { namespace: this.namespace, key });
    }
  }
  
  _recordHit(key) {
    if (this.options.enableMetrics) {
      this.metrics.hits++;
      this.emitter.emit('cache:hit', { namespace: this.namespace, key });
    }
  }
  
  _recordMiss(key) {
    if (this.options.enableMetrics) {
      this.metrics.misses++;
      this.emitter.emit('cache:miss', { namespace: this.namespace, key });
    }
  }
  
  _estimateMemoryUsage() {
    // Rough estimate of memory usage in bytes
    let totalSize = 0;
    for (const [key, entry] of this.cache) {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Estimated overhead per entry
    }
    return totalSize;
  }
  
  _setupTTLCleanup() {
    // Run cleanup every minute
    setInterval(() => {
      this._cleanupExpired();
    }, 60000);
  }
  
  _cleanupExpired() {
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache) {
      if (this._isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      this.emitter.emit('cache:cleanup', { 
        namespace: this.namespace, 
        expiredItems: keysToDelete.length 
      });
    }
  }
  
  // localStorage integration methods
  
  _getLocalStorageKey(key) {
    return `cache:${this.namespace}:${key}`;
  }
  
  _loadFromLocalStorage() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`cache:${this.namespace}:`)) {
          keys.push(key);
        }
      }
      
      for (const storageKey of keys) {
        const data = localStorage.getItem(storageKey);
        if (data) {
          const entry = JSON.parse(data);
          const cacheKey = storageKey.replace(`cache:${this.namespace}:`, '');
          
          if (!this._isExpired(entry)) {
            this.cache.set(cacheKey, entry);
            this._updateAccessOrder(cacheKey);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to load cache from localStorage for ${this.namespace}:`, error);
    }
  }
  
  _saveToLocalStorage(key, entry) {
    try {
      const storageKey = this._getLocalStorageKey(key);
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      // localStorage might be full or disabled, fail silently
      console.debug(`Failed to save to localStorage for ${this.namespace}:`, error);
    }
  }
  
  _deleteFromLocalStorage(key) {
    try {
      const storageKey = this._getLocalStorageKey(key);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.debug(`Failed to delete from localStorage for ${this.namespace}:`, error);
    }
  }
  
  _clearLocalStorage() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`cache:${this.namespace}:`)) {
          keys.push(key);
        }
      }
      
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.debug(`Failed to clear localStorage for ${this.namespace}:`, error);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.clear();
    this.emitter.removeAllListeners();
  }
}