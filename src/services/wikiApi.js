/**
 * Wikipedia API client for suggestions, summaries, and link graphs.
 *
 * Dev notes:
 * - UI-agnostic: no DOM or layout assumptions (safe for future resizable panes).
 * - Uses Wikipedia public APIs with CORS via `origin=*` where required.
 * - Comprehensive caching system with CacheManager for optimal performance.
 * - Supports pluggable node filtering strategies via NodeFilter.
 *
 * Example:
 *   import { WikiApi } from './src/services/wikiApi.js';
 *   const api = new WikiApi();
 *   const { nodes, links, pageData } = await api.fetchGraph('Graph theory');
 *   const suggestions = await api.fetchSuggestions('graph');
 *   const summary = await api.fetchSummary('D3.js');
 */
import NodeFilter from './NodeFilter.js';
import CacheManager from '../utils/CacheManager.js';

export default class WikiApi {
  /**
   * @param {Object} [opts]
   * @param {typeof fetch} [opts.fetchImpl] - Inject custom fetch (e.g., for tests).
   * @param {number} [opts.suggestionLimit] - Max suggestions to return.
   * @param {number} [opts.maxLinks] - Max links to include in graph.
   */
  constructor(opts = {}) {
    // Bind fetch to the global to avoid "Illegal invocation" in some browsers
    this._fetch = opts.fetchImpl || ((...args) => globalThis.fetch(...args));
    this.suggestionLimit = opts.suggestionLimit ?? 8;
    this.maxLinks = opts.maxLinks ?? 12;
    this.nodeFilter = new NodeFilter();

    // Initialize cache managers for different data types
    this.summaryCache = new CacheManager('wiki-summaries', {
      maxSize: 100,
      ttl: 300000, // 5 minutes
      strategy: 'lru',
      enableMetrics: true
    });
    
    this.suggestionsCache = new CacheManager('wiki-suggestions', {
      maxSize: 50,
      ttl: 600000, // 10 minutes
      strategy: 'lru',
      enableMetrics: true
    });
    
    this.linksCache = new CacheManager('wiki-links', {
      maxSize: 75,
      ttl: 600000, // 10 minutes
      strategy: 'lru',
      enableMetrics: true
    });
    
    this.wikitextCache = new CacheManager('wiki-wikitext', {
      maxSize: 25,
      ttl: 900000, // 15 minutes (longer since wikitext is expensive to fetch)
      strategy: 'lru',
      enableMetrics: true
    });
  }

  /**
   * Fetch autocomplete suggestions using OpenSearch API.
   * @param {string} query
   * @returns {Promise<Array<{title: string, description: string}>>}
   */
  async fetchSuggestions(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    
    // Use cache manager's getOrSet method
    return await this.suggestionsCache.getOrSet(q, async () => {
      const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=${this.suggestionLimit}&namespace=0&format=json&origin=*`;
      
      try {
        const res = await this._fetch(url);
        if (!res.ok) throw new Error(`OpenSearch HTTP ${res.status}`);
        const data = await res.json();
        const suggestions = (data?.[1] || []).map((title, i) => ({
          title,
          description: data?.[2]?.[i] || 'Wikipedia article',
        }));
        return suggestions;
      } catch (err) {
        console.debug('[WikiApi.fetchSuggestions] error', { query: q, url, error: err });
        // Fallback: provide deterministic local suggestions on failure
        return [
          { title: `${q} (Test)`, description: 'Test suggestion - API may be blocked' },
          { title: `${q} Article`, description: 'Another test suggestion' },
          { title: `${q} Page`, description: 'Third test suggestion' },
        ];
      }
    });
  }

  /**
   * Fetch a page summary for an article title.
   * @param {string} title
   * @returns {Promise<{title:string, extract:string, url?:string, thumbnail?:any, originalimage?:any} | null>}
   */
  async fetchSummary(title) {
    const key = title.trim();
    if (!key) return null;
    
    return await this.summaryCache.getOrSet(key, async () => {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
      
      try {
        const res = await this._fetch(url);
        if (!res.ok) throw new Error(`Summary HTTP ${res.status}`);
        const data = await res.json();
        return {
          title: data.title,
          extract: data.extract,
          url: data.content_urls?.desktop?.page,
          thumbnail: data.thumbnail,
          originalimage: data.originalimage,
        };
      } catch (err) {
        // Return null for failed fetches - cache manager will handle this gracefully
        throw err;
      }
    });
  }

  /**
   * Fetch links from a page using the core API.
   * @param {string} title - Canonical page title to query for links.
   * @param {number} [maxLinks=100] - Maximum number of links to fetch
   * @returns {Promise<string[]>}
   */
  async fetchLinks(title, maxLinks = 100) {
    const key = `${title}:${maxLinks}`;
    
    return await this.linksCache.getOrSet(key, async () => {
      // Use the higher of maxLinks or 100 to ensure we can fetch enough links
      const apiLimit = Math.max(maxLinks, 100);
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=${encodeURIComponent(title)}&pllimit=${apiLimit}&plnamespace=0&origin=*`;
      
      const res = await this._fetch(url);
      if (!res.ok) throw new Error(`Links HTTP ${res.status}`);
      const data = await res.json();
      const pages = data?.query?.pages;
      if (!pages) return [];
      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];
      if (!page || page.missing) return [];
      const links = page.links || [];
      return links.slice(0, maxLinks).map(l => l.title).filter(t => !!t);
    });
  }

  /**
   * Fetch wikitext for a page (used for source-order link extraction)
   * @param {string} title - Page title
   * @returns {Promise<string>} Raw wikitext content
   */
  async fetchWikitext(title) {
    return await this.wikitextCache.getOrSet(title, async () => {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&page=${encodeURIComponent(title)}&prop=wikitext&origin=*`;
      
      const res = await this._fetch(url);
      if (!res.ok) throw new Error(`Wikitext HTTP ${res.status}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(`Wikitext API error: ${data.error.info}`);
      }
      
      return data.parse?.wikitext?.['*'] || '';
    });
  }

  /**
   * Extract links from wikitext in source order
   * @param {string} wikitext - Raw wikitext content
   * @param {number} maxLinks - Maximum number of links to return
   * @returns {Array<string>} Array of link titles in source order
   */
  _extractLinksFromWikitext(wikitext, maxLinks = 100) {
    const links = [];
    const seen = new Set();
    
    // Regex to match [[Article Title]] and [[Article Title|Display Text]] patterns
    // This regex captures the main article title before any | or # characters
    const linkRegex = /\[\[([^|\]#]+)(?:[|\]#][^\]]*)?]\]/g;
    
    let match;
    while ((match = linkRegex.exec(wikitext)) && links.length < maxLinks) {
      let title = match[1].trim();
      
      // Skip if we've already seen this link
      if (seen.has(title)) continue;
      
      // Basic filtering to exclude non-article links
      if (this._isValidArticleLink(title)) {
        links.push(title);
        seen.add(title);
      }
    }
    
    return links;
  }
  
  /**
   * Check if a link title represents a valid article link
   * @param {string} title - Link title to validate
   * @returns {boolean} Whether the link is valid
   */
  _isValidArticleLink(title) {
    // Skip common non-article prefixes
    const excludePrefixes = [
      'File:', 'Image:', 'Category:', 'Template:', 'Help:', 'Wikipedia:',
      'User:', 'Talk:', 'Special:', 'Media:', 'Portal:', 'Book:', 'Draft:'
    ];
    
    // Skip if title starts with excluded prefix
    for (const prefix of excludePrefixes) {
      if (title.startsWith(prefix)) return false;
    }
    
    // Skip if title is too short or contains invalid characters
    if (title.length < 2) return false;
    if (title.includes('\n') || title.includes('\t')) return false;
    
    return true;
  }

  /**
   * Fetch links in source order by parsing wikitext
   * @param {string} title - Page title
   * @param {number} maxLinks - Maximum number of links to return
   * @returns {Promise<Array<string>>} Links in source order
   */
  async fetchLinksInSourceOrder(title, maxLinks = 100) {
    const cacheKey = `source:${title}:${maxLinks}`;
    
    return await this.linksCache.getOrSet(cacheKey, async () => {
      try {
        // Fetch the wikitext
        const wikitext = await this.fetchWikitext(title);
        
        // Extract links in source order
        return this._extractLinksFromWikitext(wikitext, maxLinks);
        
      } catch (error) {
        console.warn(`Failed to fetch source-order links for ${title}:`, error);
        // Fallback to alphabetical links
        return await this.fetchLinks(title, maxLinks);
      }
    });
  }

  /**
   * Build a simple one-hop graph around `query`.
   * Returns nodes/links plus the central page summary for convenience.
   * Note: No positional data is added; layout belongs to the view.
   *
   * @param {string} query
   * @param {number} [maxNodes=12] - Maximum number of connected nodes to include
   * @param {string} [filterStrategy='alphabetical'] - Node filtering strategy to use
   * @returns {Promise<{nodes: Array<any>, links: Array<{source:string,target:string}>, pageData: any}>}
   */
  async fetchGraph(query, maxNodes = 12, filterStrategy = 'alphabetical') {
    if (!query?.trim()) throw new Error('Empty query');

    // 1) Get central page summary to resolve canonical title
    const pageData = await this.fetchSummary(query);
    if (!pageData) throw new Error('Article not found');
    const actualTitle = pageData.title || query;

    // 2) Get outgoing links and apply filtering strategy
    let linkedTitles = [];
    try {
      if (filterStrategy === 'link-order') {
        // Use source-order method for link-order strategy
        linkedTitles = await this.fetchLinksInSourceOrder(actualTitle, maxNodes);
      } else {
        // Use standard method for other strategies
        const fetchCount = Math.max(maxNodes * 2, 50); // Fetch extra for filtering
        const allLinks = await this.fetchLinks(actualTitle, fetchCount);
        linkedTitles = this.nodeFilter.applyFilter(allLinks, maxNodes, filterStrategy);
      }
    } catch (error) {
      console.warn(`Failed to fetch links with strategy ${filterStrategy}:`, error);
      linkedTitles = [];
    }

    // If maxNodes is 0, only show the central node
    const limitedLinkedTitles = maxNodes > 0 ? linkedTitles : [];

    // 3) Assemble graph
    const nodes = [
      {
        id: actualTitle,
        title: pageData.title,
        description: pageData.extract,
        url: pageData.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(actualTitle)}`,
        isCentral: true,
      },
      ...limitedLinkedTitles
        .filter(t => t !== actualTitle)
        .map(t => ({ id: t, title: t, description: '', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, isCentral: false })),
    ];

    const links = limitedLinkedTitles
      .filter(t => t !== actualTitle)
      .map(t => ({ source: actualTitle, target: t }));

    return { nodes, links, pageData };
  }

  /**
   * Get available node filtering strategies
   * @returns {Array<{id: string, name: string, description: string}>}
   */
  getAvailableFilteringStrategies() {
    return this.nodeFilter.getAvailableStrategies();
  }

  /**
   * Register a custom node filtering strategy
   * @param {string} id - Unique identifier for the strategy
   * @param {Object} strategy - Strategy object with name, description, and filter function
   */
  registerFilteringStrategy(id, strategy) {
    this.nodeFilter.registerStrategy(id, strategy);
  }

  /**
   * Get comprehensive cache statistics
   * @returns {Object} Cache statistics for all cache managers
   */
  getCacheStats() {
    return {
      summaries: this.summaryCache.getStats(),
      suggestions: this.suggestionsCache.getStats(),
      links: this.linksCache.getStats(),
      wikitext: this.wikitextCache.getStats(),
      totalMemoryEstimate: 
        this.summaryCache.getStats().memoryEstimate +
        this.suggestionsCache.getStats().memoryEstimate +
        this.linksCache.getStats().memoryEstimate +
        this.wikitextCache.getStats().memoryEstimate
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.summaryCache.clear();
    this.suggestionsCache.clear();
    this.linksCache.clear();
    this.wikitextCache.clear();
  }
}
