import { WikiApi } from './src/services/wikiApi.js';
import { GraphView } from './src/graph/GraphView.js';
import { ArticleView } from './src/article/ArticleView.js';
import { SearchView } from './src/search/SearchView.js';
import { ThemeManager } from './src/theme/ThemeManager.js';

class WikipediaGraphExplorer {
    constructor() {
        this.currentQuery = '';
        this.currentArticleData = null;
        // Graph data is managed by GraphView; no local copy needed here.
        this.width = this.getGraphWidth();
        this.height = this.getGraphHeight();
        this.api = new WikiApi();
        this.graphView = null;
        this.articleView = null;
        this.themeManager = null;
        this.searchView = null;
        
        this.init();
    }

    init() {
        this.setupSearchView();
        this.setupGraphView();
        this.setupArticleView();
        this.setupThemeManager();
        window.addEventListener('resize', () => this.handleResize());
    }

    setupGraphView() {
        // Initialize GraphView which owns D3 rendering and interactions
        this.graphView = new GraphView({ el: '#graph', loadingEl: '#loading', width: this.width, height: this.height });
        // Forward node clicks to article preview loader
        this.graphView.on('node:select', async (title) => {
            await this.loadArticlePreview(title);
        });
    }

    setupArticleView() {
        this.articleView = new ArticleView({ el: '#article-content' });
    }

    setupThemeManager() {
        this.themeManager = new ThemeManager();
    }

    setupSearchView() {
        this.searchView = new SearchView({
            mainInput: '#search-input',
            mainButton: '#search-button',
            topInput: '#search-input-top',
            topButton: '#search-button-top',
            suggestionsMainEl: '#suggestions',
            suggestionsTopEl: '#suggestions-top',
            fetchSuggestions: (q) => this.api.fetchSuggestions(q),
            minChars: 2,
            debounceMs: 150,
        });
        this.searchView.on('submit', (q) => this.performSearch(q));
    }

    // Search input/suggestions moved to SearchView

    async performSearch(query) {
        if (!query.trim()) return;

        this.currentQuery = query.trim();
        console.log('Starting search for:', this.currentQuery);
        
        // Hide suggestions via view
        this.searchView?.hideSuggestions();

        // Show loading
        this.showLoading();

        // Transition UI
        this.transitionToGraphView();

        try {
            console.log('About to fetch Wikipedia graph...');
            // Fetch Wikipedia data via service
            const result = await this.api.fetchGraph(this.currentQuery);
            const graphData = { nodes: result.nodes, links: result.links };
            this.currentArticleData = result.pageData; // Store for article preview
            console.log('Graph data received:', graphData);
            
            // Validate graph data
            if (!graphData || !graphData.nodes || !Array.isArray(graphData.nodes)) {
                throw new Error('Invalid graph data structure received');
            }
            
            // Update graph
            console.log('Updating graph...');
            try {
                this.graphView.render(graphData);
                console.log('Graph updated successfully');
            } catch (updateError) {
                console.error('Error updating graph:', updateError);
                throw new Error(`Graph update failed: ${updateError.message}`);
            }
            
            // Display article preview for central node
            if (this.currentArticleData) {
                console.log('Displaying article preview...');
                try {
                    this.articleView?.show(this.currentArticleData);
                    console.log('Article preview displayed successfully');
                } catch (previewError) {
                    console.error('Error displaying article preview:', previewError);
                    // Don't throw here, preview is not critical
                }
            }
            
            console.log('Search completed successfully');
            
        } catch (error) {
            console.error('Error performing search:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error toString:', error.toString());
            console.error('Error type:', typeof error);
            console.error('Error constructor:', error.constructor.name);
            
            const errorMessage = error.message || error.toString() || 'Unknown error occurred';
            alert(`Error loading Wikipedia data: ${errorMessage}. Please try again.`);
        } finally {
            this.hideLoading();
        }
    }

    //This is where the related wikipedia articles get fetched

    transitionToGraphView() {
        const searchContainer = document.getElementById('search-container');
        const graphContainer = document.getElementById('graph-container');
        const searchBarTop = document.getElementById('search-bar-top');
        const appTitle = document.querySelector('.app-title');
        const searchInputTop = document.getElementById('search-input-top');

        // Fade out title
        appTitle.classList.add('fade-out');

        // Start the transition animation
        setTimeout(() => {
            // Move search container up and show graph background
            searchContainer.classList.add('moved-up');
            graphContainer.classList.remove('hidden');
            
            // After the move animation, switch to top search bar (collapsed)
            setTimeout(() => {
                searchContainer.style.display = 'none';
                searchBarTop.classList.add('visible');
                // Update the top search input via view
                this.searchView?.setQuery(this.currentQuery, { target: 'top' });
                
                // Start with collapsed state
                const topWrapper = searchBarTop.querySelector('.search-input-wrapper');
                topWrapper.classList.add('collapsed');
            }, 600); // Wait for move animation to complete
        }, 200);
    }


    showLoading() {
        this.graphView?.setLoading(true);
    }

    hideLoading() {
        this.graphView?.setLoading(false);
    }

    async fetchArticlePreview(title) {
        // Deprecated: kept for backward compatibility; use this.api.fetchSummary instead.
        return this.api.fetchSummary(title);
    }

    async loadArticlePreview(title) {
        try {
            const articleData = await this.api.fetchSummary(title);
            if (!articleData) {
                this.articleView?.showError(title);
            } else {
                this.articleView?.show(articleData);
            }
        } catch (error) {
            console.error('Error loading article preview:', error);
            this.articleView?.showError(title);
        }
    }

    getGraphWidth() {
        return window.innerWidth <= 768 ? window.innerWidth : window.innerWidth * 0.6;
    }

    getGraphHeight() {
        return window.innerWidth <= 768 ? window.innerHeight * 0.5 : window.innerHeight - 80;
    }

    handleResize() {
        this.width = this.getGraphWidth();
        this.height = this.getGraphHeight();
        
        if (this.graphView) {
            this.graphView.resize({ width: this.width, height: this.height });
        }
    }


}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WikipediaGraphExplorer();
});
