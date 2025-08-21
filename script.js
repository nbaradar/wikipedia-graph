import { WikiApi } from './src/services/wikiApi.js';
import { GraphView } from './src/graph/GraphView.js';
import { ArticleView } from './src/article/ArticleView.js';

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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupGraphView();
        this.setupArticleView();
        this.setupThemeSwitcher();
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

    setupEventListeners() {
        // Main search functionality
        const searchInput = document.getElementById('search-input');
        const searchButton = document.getElementById('search-button');
        const searchInputTop = document.getElementById('search-input-top');
        const searchButtonTop = document.getElementById('search-button-top');

        // Search input events
        searchInput.addEventListener('input', (e) => this.handleSearchInput(e, 'suggestions'));
        searchInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        searchButton.addEventListener('click', () => this.performSearch(searchInput.value));

        // Top search bar events
        if (searchInputTop) {
            searchInputTop.addEventListener('input', (e) => this.handleSearchInput(e, 'suggestions-top'));
            searchInputTop.addEventListener('keydown', (e) => this.handleKeyDown(e, true));
            searchInputTop.addEventListener('focus', () => {
                console.log('Top search input focused');
                const wrapper = searchInputTop.closest('.search-input-wrapper');
                if (wrapper && wrapper.classList.contains('collapsed')) {
                    wrapper.classList.remove('collapsed');
                }
            });
        }
        if (searchButtonTop) {
            searchButtonTop.addEventListener('click', () => this.performSearch(searchInputTop.value));
        }

        // Click outside to hide suggestions
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    async handleSearchInput(event, suggestionsId) {
        const query = event.target.value.trim();
        const suggestionsContainer = document.getElementById(suggestionsId);

        console.log('Search input:', query, 'Container:', suggestionsContainer); // Debug log

        if (query.length < 2) {
            suggestionsContainer.classList.remove('visible');
            return;
        }

        try {
            console.log('Fetching suggestions for:', query); // Debug log
            const suggestions = await this.api.fetchSuggestions(query);
            console.log('Got suggestions:', suggestions); // Debug log
            this.displaySuggestions(suggestions, suggestionsContainer, event.target);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    displaySuggestions(suggestions, container, inputElement) {
        container.innerHTML = '';
        
        if (suggestions.length === 0) {
            container.classList.remove('visible');
            return;
        }

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div class="suggestion-title">${this.escapeHtml(suggestion.title)}</div>
                <div class="suggestion-description">${this.escapeHtml(suggestion.description)}</div>
            `;
            
            item.addEventListener('click', () => {
                inputElement.value = suggestion.title;
                container.classList.remove('visible');
                this.performSearch(suggestion.title);
            });
            
            container.appendChild(item);
        });

        container.classList.add('visible');
    }

    handleKeyDown(event, isTopSearch = false) {
        if (event.key === 'Enter') {
            const input = isTopSearch ? 
                document.getElementById('search-input-top') : 
                document.getElementById('search-input');
            this.performSearch(input.value);
        } else if (event.key === 'Escape') {
            const suggestions = isTopSearch ? 
                document.getElementById('suggestions-top') : 
                document.getElementById('suggestions');
            suggestions.classList.remove('visible');
        }
    }

    handleOutsideClick(event) {
        const suggestions = document.getElementById('suggestions');
        const suggestionsTop = document.getElementById('suggestions-top');
        const searchWrapper = document.querySelector('.search-wrapper');
        const searchBarTop = document.getElementById('search-bar-top');

        if (searchWrapper && !searchWrapper.contains(event.target)) {
            suggestions.classList.remove('visible');
        }
        
        if (searchBarTop && !searchBarTop.contains(event.target)) {
            suggestionsTop.classList.remove('visible');
        }
    }

    async performSearch(query) {
        if (!query.trim()) return;

        this.currentQuery = query.trim();
        console.log('Starting search for:', this.currentQuery);
        
        // Hide suggestions
        document.getElementById('suggestions').classList.remove('visible');
        document.getElementById('suggestions-top').classList.remove('visible');

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
                searchInputTop.value = this.currentQuery;
                
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

    setupThemeSwitcher() {
        const themeButton = document.getElementById('theme-button');
        const themeDropdown = document.getElementById('theme-dropdown');
        const themeOptions = document.querySelectorAll('.theme-option');

        // Toggle dropdown on button click
        themeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            themeDropdown.classList.toggle('visible');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!document.getElementById('theme-switcher').contains(e.target)) {
                themeDropdown.classList.remove('visible');
            }
        });

        // Handle theme selection
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.setTheme(theme);
                themeDropdown.classList.remove('visible');
            });
        });

        // Load saved theme or default
        const savedTheme = localStorage.getItem('wikipedia-graph-theme') || 'default';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        const body = document.body;
        
        // Remove existing theme classes
        body.classList.remove('dark-theme');
        
        // Apply new theme
        if (theme === 'dark') {
            body.classList.add('dark-theme');
        }
        
        // Save theme preference
        localStorage.setItem('wikipedia-graph-theme', theme);
        
        // Update theme button icon based on theme
        this.updateThemeIcon(theme);
    }

    updateThemeIcon(theme) {
        const themeButton = document.getElementById('theme-button');
        const svg = themeButton.querySelector('svg');
        
        if (theme === 'dark') {
            // Moon icon for dark theme
            svg.innerHTML = `
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            `;
        } else {
            // Sun icon for light theme
            svg.innerHTML = `
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            `;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WikipediaGraphExplorer();
});
