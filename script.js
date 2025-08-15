class WikipediaGraphExplorer {
    constructor() {
        this.currentQuery = '';
        this.graphData = { nodes: [], links: [] };
        this.svg = null;
        this.simulation = null;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupGraph();
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
        searchInputTop.addEventListener('input', (e) => this.handleSearchInput(e, 'suggestions-top'));
        searchInputTop.addEventListener('keydown', (e) => this.handleKeyDown(e, true));
        searchButtonTop.addEventListener('click', () => this.performSearch(searchInputTop.value));

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
            const suggestions = await this.fetchWikipediaSuggestions(query);
            console.log('Got suggestions:', suggestions); // Debug log
            this.displaySuggestions(suggestions, suggestionsContainer, event.target);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    async fetchWikipediaSuggestions(query) {
        console.log('Fetching suggestions for query:', query);
        
        // Use OpenSearch API which is more reliable for suggestions
        const openSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json&origin=*`;
        
        try {
            console.log('Making request to:', openSearchUrl);
            const response = await fetch(openSearchUrl);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API response data:', data);
            
            if (data && data[1] && data[2]) {
                const suggestions = data[1].map((title, index) => ({
                    title: title,
                    description: data[2][index] || 'Wikipedia article'
                }));
                console.log('Processed suggestions:', suggestions);
                return suggestions;
            }
        } catch (error) {
            console.error('OpenSearch API error:', error);
        }

        // Fallback: return some test data if API fails
        console.log('Using fallback test data');
        return [
            { title: `${query} (Test)`, description: 'Test suggestion - API may be blocked' },
            { title: `${query} Article`, description: 'Another test suggestion' },
            { title: `${query} Page`, description: 'Third test suggestion' }
        ];
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

        if (!searchWrapper.contains(event.target)) {
            suggestions.classList.remove('visible');
        }
        
        if (!searchBarTop.contains(event.target)) {
            suggestionsTop.classList.remove('visible');
        }
    }

    async performSearch(query) {
        if (!query.trim()) return;

        this.currentQuery = query.trim();
        
        // Hide suggestions
        document.getElementById('suggestions').classList.remove('visible');
        document.getElementById('suggestions-top').classList.remove('visible');

        // Show loading
        this.showLoading();

        // Transition UI
        this.transitionToGraphView();

        try {
            // Fetch Wikipedia data
            const graphData = await this.fetchWikipediaGraph(this.currentQuery);
            
            // Update graph
            this.updateGraph(graphData);
            
        } catch (error) {
            console.error('Error performing search:', error);
            alert('Error loading Wikipedia data. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async fetchWikipediaGraph(query) {
        try {
            // Get the main article content
            const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const pageResponse = await fetch(pageUrl);
            
            if (!pageResponse.ok) {
                throw new Error('Article not found');
            }

            const pageData = await pageResponse.json();
            
            // Get links from the article
            const linksUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=${encodeURIComponent(query)}&pllimit=20&plnamespace=0&origin=*`;
            const linksResponse = await fetch(linksUrl);
            const linksData = await linksResponse.json();

            const pages = linksData.query.pages;
            const pageId = Object.keys(pages)[0];
            const links = pages[pageId].links || [];

            // Create nodes and links
            const nodes = [
                {
                    id: query,
                    title: pageData.title,
                    description: pageData.extract,
                    url: pageData.content_urls.desktop.page,
                    isCentral: true,
                    x: this.width / 2,
                    y: this.height / 2
                }
            ];

            const graphLinks = [];
            const maxLinks = 12; // Limit to prevent overcrowding

            for (let i = 0; i < Math.min(links.length, maxLinks); i++) {
                const link = links[i];
                const linkedTitle = link.title;
                
                // Skip if it's the same as central node
                if (linkedTitle === query) continue;

                nodes.push({
                    id: linkedTitle,
                    title: linkedTitle,
                    description: '',
                    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(linkedTitle)}`,
                    isCentral: false
                });

                graphLinks.push({
                    source: query,
                    target: linkedTitle
                });
            }

            return { nodes, links: graphLinks };

        } catch (error) {
            console.error('Error fetching Wikipedia graph:', error);
            throw error;
        }
    }

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
            
            // After the move animation, switch to top search bar
            setTimeout(() => {
                searchContainer.style.display = 'none';
                searchBarTop.classList.add('visible');
                searchInputTop.value = this.currentQuery;
            }, 600); // Wait for move animation to complete
        }, 200);
    }

    setupGraph() {
        const graphElement = document.getElementById('graph');
        
        this.svg = d3.select(graphElement)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        // Create groups for links and nodes
        this.svg.append('g').attr('class', 'links');
        this.svg.append('g').attr('class', 'nodes');

        // Setup force simulation
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(50));
    }

    updateGraph(data) {
        this.graphData = data;

        // Update links
        const link = this.svg.select('.links')
            .selectAll('.link')
            .data(data.links);

        link.exit().remove();

        const linkEnter = link.enter()
            .append('line')
            .attr('class', 'link');

        const linkUpdate = linkEnter.merge(link);

        // Update nodes
        const node = this.svg.select('.nodes')
            .selectAll('.node')
            .data(data.nodes);

        node.exit().remove();

        const nodeEnter = node.enter()
            .append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)));

        // Add circles
        nodeEnter.append('circle')
            .attr('class', d => `node-circle ${d.isCentral ? 'central' : ''}`)
            .attr('r', d => d.isCentral ? 25 : 20);

        // Add text labels
        nodeEnter.append('text')
            .attr('class', d => `node-text ${d.isCentral ? 'central' : ''}`)
            .text(d => this.truncateText(d.title, d.isCentral ? 15 : 12))
            .attr('dy', '0.35em');

        const nodeUpdate = nodeEnter.merge(node);

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
            .on('click', (event, d) => {
                window.open(d.url, '_blank');
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

    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        if (this.svg) {
            this.svg.attr('width', this.width).attr('height', this.height);
            this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
            this.simulation.alpha(0.3).restart();
        }
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
