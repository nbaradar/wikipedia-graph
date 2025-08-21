import { WikiApi } from './src/services/wikiApi.js';

class WikipediaGraphExplorer {
    constructor() {
        this.currentQuery = '';
        this.currentArticleData = null;
        this.graphData = { nodes: [], links: [] };
        this.svg = null;
        this.simulation = null;
        this.width = this.getGraphWidth();
        this.height = this.getGraphHeight();
        this.api = new WikiApi();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupGraph();
        this.setupThemeSwitcher();
        window.addEventListener('resize', () => this.handleResize());
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
                this.updateGraph(graphData);
                console.log('Graph updated successfully');
            } catch (updateError) {
                console.error('Error updating graph:', updateError);
                throw new Error(`Graph update failed: ${updateError.message}`);
            }
            
            // Display article preview for central node
            if (this.currentArticleData) {
                console.log('Displaying article preview...');
                try {
                    this.displayArticlePreview(this.currentArticleData);
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

    setupGraph() {
        const graphElement = document.getElementById('graph');
        
        this.svg = d3.select(graphElement)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        // Create container group for zoom/pan
        this.container = this.svg.append('g').attr('class', 'container');

        // Create groups for links and nodes inside container
        this.container.append('g').attr('class', 'links');
        this.container.append('g').attr('class', 'nodes');

        // Setup zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.3, 3]) // Min zoom: 30%, Max zoom: 300%
            .on('zoom', (event) => {
                this.container.attr('transform', event.transform);
            });

        // Apply zoom to SVG
        this.svg.call(this.zoom);

        // Setup force simulation
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(50));
    }

    updateGraph(data) {
        this.graphData = data;

        // Clear existing graph elements
        this.container.select('.links').selectAll('*').remove();
        this.container.select('.nodes').selectAll('*').remove();

        // Reset zoom to default position
        if (this.svg && this.zoom) {
            this.svg.transition()
                .duration(750)
                .call(this.zoom.transform, d3.zoomIdentity);
        }

        // Update links
        const link = this.container.select('.links')
            .selectAll('line')
            .data(data.links);

        const linkEnter = link.enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2);

        const linkUpdate = linkEnter.merge(link);
        link.exit().remove();

        // Update nodes
        const node = this.container.select('.nodes')
            .selectAll('g')
            .data(data.nodes, d => d.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                })
            );

        // Add circles to nodes
        nodeEnter.append('circle')
            .attr('class', d => `node-circle ${d.isCentral ? 'central' : ''}`)
            .attr('r', d => d.isCentral ? 25 : 20);

        // Add text labels
        nodeEnter.append('text')
            .attr('class', d => `node-text ${d.isCentral ? 'central' : ''}`)
            .attr('dy', '0.35em');

        const nodeUpdate = nodeEnter.merge(node);

        // Update text for all nodes (both new and existing)
        nodeUpdate.select('text')
            .attr('class', d => `node-text ${d.isCentral ? 'central' : ''}`)
            .text(d => this.truncateText(d.title, d.isCentral ? 15 : 12));

        // Add hover effects using D3
        nodeUpdate
            .on('mouseenter', function(event, d) {
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', d.isCentral ? 30 : 25);
            })
            .on('mouseleave', function(event, d) {
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', d.isCentral ? 25 : 20);
            })
            .on('click', async (event, d) => {
                // Load article preview for clicked node
                await this.loadArticlePreview(d.title);
            });

        // Update simulation
        this.simulation
            .nodes(data.nodes)
            .on('tick', () => {
                linkUpdate
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                nodeUpdate
                    .attr('transform', d => `translate(${d.x},${d.y})`);
            });

        this.simulation.force('link').links(data.links);
        this.simulation.alpha(1).restart();
    }

    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    async fetchArticlePreview(title) {
        // Deprecated: kept for backward compatibility; use this.api.fetchSummary instead.
        return this.api.fetchSummary(title);
    }

    async loadArticlePreview(title) {
        try {
            const articleData = await this.api.fetchSummary(title);
            if (!articleData) {
                this.displayArticleError(title);
            } else {
                this.displayArticlePreview(articleData);
            }
        } catch (error) {
            console.error('Error loading article preview:', error);
            this.displayArticleError(title);
        }
    }

    displayArticlePreview(articleData) {
        const articleContent = document.getElementById('article-content');
        
        console.log('Full article data:', articleData); // Debug log
        
        // Check if thumbnail exists and extract URL properly
        let imageUrl = null;
        if (articleData.thumbnail && articleData.thumbnail.source) {
            imageUrl = articleData.thumbnail.source;
        } else if (articleData.originalimage && articleData.originalimage.source) {
            imageUrl = articleData.originalimage.source;
        }
        
        console.log('Extracted image URL:', imageUrl); // Debug log
        
        const imageHtml = imageUrl ? 
            `<div class="article-image">
                <img src="${imageUrl}" alt="${this.escapeHtml(articleData.title)}" />
            </div>` : '';
        
        articleContent.innerHTML = `
            <div class="article-title">${this.escapeHtml(articleData.title)}</div>
            ${imageHtml}
            <div class="article-extract">${this.escapeHtml(articleData.extract || 'No description available.')}</div>
            <a href="${articleData.url}" target="_blank" class="article-link">
                Read full article on Wikipedia
            </a>
        `;
    }

    displayArticleError(title) {
        const articleContent = document.getElementById('article-content');
        
        articleContent.innerHTML = `
            <div class="article-title">${this.escapeHtml(title)}</div>
            <div class="article-extract">Sorry, we couldn't load the preview for this article.</div>
            <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank" class="article-link">
                View on Wikipedia
            </a>
        `;
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
        
        if (this.svg) {
            this.svg
                .attr('width', this.width)
                .attr('height', this.height);
            
            if (this.simulation) {
                this.simulation
                    .force('center', d3.forceCenter(this.width / 2, this.height / 2))
                    .alpha(0.3)
                    .restart();
            }
        }
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
