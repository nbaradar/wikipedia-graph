# Wikipedia Graph Viewer - Claude Code Configuration

## Project Overview
Wikipedia Graph Viewer is a modern, interactive web application that visualizes Wikipedia articles as connected graph nodes, similar to Obsidian's graph view. The application provides an intuitive interface for exploring relationships between Wikipedia articles through an interactive D3.js-powered graph visualization.

## Core Functionality
- **Search Interface**: Users search for Wikipedia articles with real-time autocomplete suggestions
- **Dual-Panel Layout**: Split view with graph visualization (left) and article preview (right)
- **Interactive Graph**: D3.js force-directed graph showing article connections
- **Dynamic Navigation**: Click nodes to explore related articles
- **Responsive Design**: Seamless experience across desktop and mobile devices

## Technical Stack
- **Frontend**: Vanilla JavaScript (ES6+), no frameworks
- **Visualization**: D3.js v7 for graph rendering and force simulation
- **Styling**: Pure CSS3 with modern features (gradients, animations, flexbox/grid)
- **APIs**: Wikipedia REST API, OpenSearch API, Query API
- **Hosting**: GitHub Pages static site deployment
- **Build**: No build process required - pure static files

## Project Structure
```
/
├── index.html              # Main HTML entry point
├── script.js              # Main application controller
├── styles.css             # Global styles
├── src/
│   ├── article/          # Article display components
│   │   └── ArticleView.js
│   ├── controls/         # UI control components
│   │   ├── GraphControlPanelController.js
│   │   ├── NodeCountController.js
│   │   ├── PanelController.js
│   │   └── SplitterController.js
│   ├── graph/           # Graph visualization
│   │   └── GraphView.js
│   ├── search/          # Search functionality
│   │   └── SearchView.js
│   ├── services/        # API and data services
│   │   ├── wikiApi.js
│   │   └── NodeFilter.js
│   ├── theme/           # Theme management
│   │   └── ThemeManager.js
│   └── utils/           # Utility classes
│       ├── Emitter.js
│       └── CacheManager.js
```

## Architecture Principles
1. **Modular Design**: Each component is self-contained with clear responsibilities
2. **Event-Driven**: Components communicate via event emitters for loose coupling
3. **No Framework Dependency**: Pure vanilla JavaScript for maximum performance and minimal overhead
4. **Progressive Enhancement**: Core functionality works without JavaScript, enhanced features layer on top
5. **Separation of Concerns**: Clear separation between data fetching (services), presentation (views), and control logic
6. **Integrated Controllers**: Panel functionality integrated directly into controllers for better maintainability

## Current Implementation Status

### Completed Features
- ✅ Interactive search with Wikipedia autocomplete
- ✅ Force-directed graph visualization with D3.js
- ✅ Dual-panel layout with article preview
- ✅ Click-to-navigate graph nodes
- ✅ Responsive design
- ✅ Smooth transitions between search and graph views
- ✅ CORS-compliant Wikipedia API integration
- ✅ Comprehensive caching system with CacheManager
- ✅ Node filtering strategies (Alphabetical, Random, Link Order)
- ✅ Graph control panel with drag/collapse functionality

### In Progress / Planned Features

#### Node Filtering Modes (Priority: High)
- **Alphabetical**: Current implementation - nodes sorted alphabetically
- **Link Order**: Sort by appearance order in source article
- **Page Weights**: Rank by number of outgoing links from each related page
- **Page Popularity**: Sort by page view statistics
- **Association Score**: Use LLM/semantic analysis for relevance ranking

#### Layer Control (Priority: Medium)
- Implement slider UI (1-5 layers initially, potentially up to 10)
- Smart node generation limits per layer to prevent exponential growth
- Progressive loading for performance
- Visual indicators for layer depth

#### Navigation Modes (Priority: High)
- **Standard Mode**: Click node → show article preview
- **Rabbit Hole Mode**: Click node → becomes new central node with regenerated graph

#### Animation Improvements (Priority: Medium)
- Simultaneous node and link animation (currently sequential)
- Smooth transitions when changing central node
- Loading states during data fetching

## API Integration Details

### Wikipedia APIs Used
- **REST API** (`https://en.wikipedia.org/api/rest_v1/`)
  - Page summaries: `/page/summary/{title}`
  - Mobile sections: `/page/mobile-sections/{title}`
  
- **OpenSearch API** (`https://en.wikipedia.org/w/api.php`)
  - Autocomplete: `action=opensearch`
  
- **Query API** (`https://en.wikipedia.org/w/api.php`)
  - Links extraction: `action=query&prop=links`
  - Page info: `action=query&prop=info`
  - Extracts: `action=query&prop=extracts`

### CORS Configuration
- All API calls include `origin=*` parameter
- Headers set for cross-origin requests
- Fallback strategies for rate limiting

## Code Style Guidelines

### JavaScript
- ES6+ features (arrow functions, destructuring, template literals)
- Async/await over promises where appropriate
- Descriptive variable names (camelCase)
- Constants in UPPER_SNAKE_CASE
- Classes for components, functions for utilities
- JSDoc comments for public methods

### CSS
- BEM methodology for class naming where applicable
- CSS custom properties for theming
- Mobile-first responsive design
- Smooth transitions (ease-in-out, 300ms default)
- Z-index scale: 1-10 (modals), 100+ (overlays)

### HTML
- Semantic HTML5 elements
- ARIA labels for accessibility
- Data attributes for JavaScript hooks

## Caching Strategy

### CacheManager Architecture
The application uses a comprehensive caching system built around the `CacheManager` utility class, providing efficient, configurable caching across all services.

#### Cache Manager Features
- **Multiple Strategies**: LRU (Least Recently Used), FIFO (First In First Out)
- **TTL Support**: Automatic expiration with configurable time-to-live
- **Memory Management**: Automatic cleanup and size limits with eviction policies
- **Namespacing**: Separate cache spaces per service to avoid key collisions
- **Metrics**: Hit/miss ratios, memory usage tracking, performance monitoring
- **Event System**: Observable cache operations for debugging and analytics
- **Fallback Support**: Optional localStorage persistence (gracefully handles disabled storage)

#### Cache Instances in WikiApi
```javascript
// Different caches with optimized settings per data type
summaryCache: 100 items, 5min TTL    // Article summaries
suggestionsCache: 50 items, 10min TTL // Search suggestions  
linksCache: 75 items, 10min TTL      // Article links (both alphabetical & source-order)
wikitextCache: 25 items, 15min TTL   // Raw wikitext (expensive to fetch)
```

#### Cache Key Strategies
- **Summaries**: `{title}` - Simple title-based caching
- **Suggestions**: `{query}` - Search query caching  
- **Links**: `{title}:{maxLinks}` - Includes limit for accurate caching
- **Source Links**: `source:{title}:{maxLinks}` - Separate namespace for source-order
- **Wikitext**: `{title}` - Raw wikitext content

#### Memory Management
- **Automatic Eviction**: When cache reaches maxSize, LRU items are removed
- **TTL Cleanup**: Periodic cleanup every 60 seconds removes expired items
- **Memory Estimation**: Rough byte-level tracking for monitoring
- **Event Monitoring**: Cache hits/misses/evictions are tracked and emitted

#### Usage Patterns
```javascript
// Simple get/set pattern
const data = await cache.get(key);
if (!data) {
  const newData = await fetchFromAPI();
  await cache.set(key, newData);
}

// Preferred getOrSet pattern (with factory function)
const data = await cache.getOrSet(key, async () => {
  return await fetchFromAPI();
});
```

#### Extending the Cache System
To add caching to new services:

1. **Create Cache Manager Instance**
```javascript
this.myCache = new CacheManager('my-service', {
  maxSize: 50,
  ttl: 300000, // 5 minutes
  strategy: 'lru',
  enableMetrics: true
});
```

2. **Use getOrSet Pattern**
```javascript
async fetchMyData(key) {
  return await this.myCache.getOrSet(key, async () => {
    return await this._actualFetch(key);
  });
}
```

3. **Monitor Performance**
```javascript
const stats = this.myCache.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

#### Cache Statistics & Debugging
- Access via `WikiApi.getCacheStats()` for comprehensive metrics
- Individual cache stats include hit rate, memory usage, item counts
- Event system allows real-time monitoring of cache operations
- Clear all caches with `WikiApi.clearAllCaches()` for testing

#### Best Practices
- **TTL Selection**: Longer for expensive operations (wikitext), shorter for frequently changing data
- **Size Limits**: Balance memory usage vs hit rates based on typical usage patterns  
- **Key Design**: Include relevant parameters in keys to avoid cache pollution
- **Error Handling**: Cache managers gracefully handle failures and continue operation
- **Monitoring**: Use metrics to optimize cache sizes and TTL values over time

## Performance Considerations
- Comprehensive caching system reduces API calls by 60-90%
- Lazy load graph nodes beyond initial view
- Debounce search input (300ms)
- Throttle graph physics calculations
- LRU cache eviction prevents memory bloat
- Limit concurrent API requests (max 5)
- Progressive rendering for large graphs

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Graceful degradation for older browsers

## Development Workflow
1. Test locally with `python -m http.server` or similar
2. Ensure CORS compliance with Wikipedia APIs
3. Test responsive design at key breakpoints (320px, 768px, 1024px, 1440px)
4. Validate accessibility with screen readers
5. Performance profile with Chrome DevTools

## Key Challenges & Solutions

### Challenge: Graph Performance with Many Nodes
**Solution**: Implement viewport culling, limit initial nodes, progressive loading

### Challenge: API Rate Limiting
**Solution**: Request batching, client-side caching, exponential backoff

### Challenge: Mobile Graph Interaction
**Solution**: Touch-friendly controls, pinch-to-zoom, simplified mobile view

### Challenge: Deep Layer Navigation
**Solution**: Breadcrumb trail, node highlighting, collapsible branches

## Testing Checklist
- [ ] Search functionality with various queries
- [ ] Graph generation with different article types
- [ ] Node interaction (hover, click, drag)
- [ ] Responsive behavior on mobile devices
- [ ] API error handling (offline, rate limits)
- [ ] Cross-browser compatibility
- [ ] Accessibility (keyboard navigation, screen readers)

## Future Enhancements
- Search history and bookmarks
- Graph export (PNG, SVG)
- Collaborative exploration (share graph state via URL)
- Multiple language support
- Custom node styling based on article categories
- Path finding between two articles
- Graph statistics and analytics

## Important Notes for Development
1. **No build process**: Keep it simple for GitHub Pages deployment
2. **API limits**: Wikipedia has rate limits - implement appropriate caching
3. **Mobile first**: Ensure touch interactions work smoothly
4. **Progressive enhancement**: Core features should work without advanced browser features
5. **Accessibility**: Follow WCAG 2.1 guidelines

## Error Handling Strategy
- Graceful degradation when APIs fail
- User-friendly error messages
- Retry logic with exponential backoff
- Fallback to cached data when available
- Console logging for debugging (remove in production)

## Deployment
- Host on GitHub Pages
- No server-side code required
- All assets served statically
- Use relative paths for resources
- Enable GitHub Pages in repository settings

---

When implementing new features or fixing bugs, please:
1. Maintain the modular architecture
2. Follow existing code patterns
3. Update relevant documentation
4. Test across different browsers
5. Consider mobile users
6. Preserve accessibility features