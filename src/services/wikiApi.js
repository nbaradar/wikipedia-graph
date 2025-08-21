/**
 * Wikipedia API client for suggestions, summaries, and link graphs.
 *
 * Dev notes:
 * - UI-agnostic: no DOM or layout assumptions (safe for future resizable panes).
 * - Uses Wikipedia public APIs with CORS via `origin=*` where required.
 * - Keeps a tiny in-memory cache to reduce duplicate requests.
 *
 * Example:
 *   import { WikiApi } from './src/services/wikiApi.js';
 *   const api = new WikiApi();
 *   const { nodes, links, pageData } = await api.fetchGraph('Graph theory');
 *   const suggestions = await api.fetchSuggestions('graph');
 *   const summary = await api.fetchSummary('D3.js');
 */
export class WikiApi {
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

    /** @type {Map<string, any>} */
    this._summaryCache = new Map();
    /** @type {Map<string, Array<{title:string, description:string}>>} */
    this._suggestCache = new Map();
  }

  /**
   * Fetch autocomplete suggestions using OpenSearch API.
   * @param {string} query
   * @returns {Promise<Array<{title: string, description: string}>>}
   */
  async fetchSuggestions(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    if (this._suggestCache.has(q)) return this._suggestCache.get(q);

    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=${this.suggestionLimit}&namespace=0&format=json&origin=*`;
    try {
      const res = await this._fetch(url);
      if (!res.ok) throw new Error(`OpenSearch HTTP ${res.status}`);
      const data = await res.json();
      const suggestions = (data?.[1] || []).map((title, i) => ({
        title,
        description: data?.[2]?.[i] || 'Wikipedia article',
      }));
      this._suggestCache.set(q, suggestions);
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
  }

  /**
   * Fetch a page summary for an article title.
   * @param {string} title
   * @returns {Promise<{title:string, extract:string, url?:string, thumbnail?:any, originalimage?:any} | null>}
   */
  async fetchSummary(title) {
    const key = title.trim();
    if (!key) return null;
    if (this._summaryCache.has(key)) return this._summaryCache.get(key);

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
    try {
      const res = await this._fetch(url);
      if (!res.ok) throw new Error(`Summary HTTP ${res.status}`);
      const data = await res.json();
      const summary = {
        title: data.title,
        extract: data.extract,
        url: data.content_urls?.desktop?.page,
        thumbnail: data.thumbnail,
        originalimage: data.originalimage,
      };
      this._summaryCache.set(key, summary);
      return summary;
    } catch (err) {
      return null;
    }
  }

  /**
   * Fetch links from a page using the core API.
   * @param {string} title - Canonical page title to query for links.
   * @returns {Promise<string[]>}
   */
  async fetchLinks(title) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=${encodeURIComponent(title)}&pllimit=20&plnamespace=0&origin=*`;
    const res = await this._fetch(url);
    if (!res.ok) throw new Error(`Links HTTP ${res.status}`);
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    if (!page || page.missing) return [];
    const links = page.links || [];
    return links.slice(0, this.maxLinks).map(l => l.title).filter(t => !!t);
  }

  /**
   * Build a simple one-hop graph around `query`.
   * Returns nodes/links plus the central page summary for convenience.
   * Note: No positional data is added; layout belongs to the view.
   *
   * @param {string} query
   * @returns {Promise<{nodes: Array<any>, links: Array<{source:string,target:string}>, pageData: any}>}
   */
  async fetchGraph(query) {
    if (!query?.trim()) throw new Error('Empty query');

    // 1) Get central page summary to resolve canonical title
    const pageData = await this.fetchSummary(query);
    if (!pageData) throw new Error('Article not found');
    const actualTitle = pageData.title || query;

    // 2) Get up to maxLinks outgoing links
    let linkedTitles = [];
    try {
      linkedTitles = await this.fetchLinks(actualTitle);
    } catch (_) {
      linkedTitles = [];
    }

    // 3) Assemble graph
    const nodes = [
      {
        id: actualTitle,
        title: pageData.title,
        description: pageData.extract,
        url: pageData.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(actualTitle)}`,
        isCentral: true,
      },
      ...linkedTitles
        .filter(t => t !== actualTitle)
        .map(t => ({ id: t, title: t, description: '', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, isCentral: false })),
    ];

    const links = linkedTitles
      .filter(t => t !== actualTitle)
      .map(t => ({ source: actualTitle, target: t }));

    return { nodes, links, pageData };
  }
}
