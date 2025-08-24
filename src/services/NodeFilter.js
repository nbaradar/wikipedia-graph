/**
 * NodeFilter - Provides different filtering strategies for selecting which Wikipedia links to include in the graph.
 * 
 * This abstraction allows the graph to display connected articles using different ordering/filtering modes:
 * - Alphabetical (current default)
 * - Link order (as they appear in source article) 
 * - Page popularity, etc.
 */
export default class NodeFilter {
  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  registerDefaultStrategies() {
    // Current implementation - alphabetical ordering (Wikipedia API default)
    this.strategies.set('alphabetical', {
      name: 'Alphabetical',
      description: 'Sort links alphabetically',
      filter: (links, maxCount) => {
        // Wikipedia API already returns alphabetically sorted links
        return links.slice(0, maxCount);
      }
    });

    // Future implementation - could fetch links in source order
    this.strategies.set('link-order', {
      name: 'Link Order', 
      description: 'Order by appearance in source article',
      filter: (links, maxCount) => {
        // For now, same as alphabetical - would need different API call to get source order
        return links.slice(0, maxCount);
      }
    });

    // Random selection
    this.strategies.set('random', {
      name: 'Random',
      description: 'Randomly select linked articles',
      filter: (links, maxCount) => {
        const shuffled = [...links].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, maxCount);
      }
    });
  }

  /**
   * Register a new filtering strategy
   * @param {string} id - Unique identifier for the strategy
   * @param {Object} strategy - Strategy object with name, description, and filter function
   */
  registerStrategy(id, strategy) {
    if (!strategy.name || !strategy.filter || typeof strategy.filter !== 'function') {
      throw new Error('Invalid strategy: must have name and filter function');
    }
    this.strategies.set(id, strategy);
  }

  /**
   * Get all available filtering strategies
   * @returns {Array<{id: string, name: string, description: string}>}
   */
  getAvailableStrategies() {
    return Array.from(this.strategies.entries()).map(([id, strategy]) => ({
      id,
      name: strategy.name,
      description: strategy.description
    }));
  }

  /**
   * Apply the specified filtering strategy to a list of links
   * @param {Array<string>} links - Array of link titles from Wikipedia
   * @param {number} maxCount - Maximum number of links to return
   * @param {string} strategyId - ID of the filtering strategy to use
   * @returns {Array<string>} Filtered array of link titles
   */
  applyFilter(links, maxCount, strategyId = 'alphabetical') {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      console.warn(`Unknown filtering strategy: ${strategyId}, falling back to alphabetical`);
      return this.applyFilter(links, maxCount, 'alphabetical');
    }

    try {
      return strategy.filter(links, maxCount);
    } catch (error) {
      console.error(`Error applying filter ${strategyId}:`, error);
      // Fallback to simple slice if strategy fails
      return links.slice(0, maxCount);
    }
  }

  /**
   * Check if a strategy exists
   * @param {string} strategyId - Strategy ID to check
   * @returns {boolean}
   */
  hasStrategy(strategyId) {
    return this.strategies.has(strategyId);
  }
}