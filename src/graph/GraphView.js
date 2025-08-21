/**
 * GraphView
 * Owns the D3 graph rendering, zoom/drag interactions, and resizing.
 * UI-only: no network calls. Emits 'node:select' when a node is clicked.
 *
 * Usage:
 *   const graph = new GraphView({ el: '#graph', loadingEl: '#loading', width, height });
 *   graph.render({ nodes, links });
 *   graph.on('node:select', title => console.log(title));
 *   graph.resize({ width, height });
 */
import Emitter from '../utils/Emitter.js';

export default class GraphView {
  /**
   * @param {Object} opts
   * @param {string|HTMLElement} opts.el - Container where an <svg> will be appended.
   * @param {string} [opts.loadingEl] - Selector for loading overlay element.
   * @param {number} [opts.width] - Initial width.
   * @param {number} [opts.height] - Initial height.
   */
  constructor({ el, loadingEl = '#loading', width = 800, height = 600 } = {}) {
    // Event emitter to communicate outward without DOM coupling.
    // The app orchestrator can subscribe via graphView.on('node:select', ...)
    this.emitter = new Emitter();
    this.containerEl = typeof el === 'string' ? document.querySelector(el) : el;
    if (!this.containerEl) throw new Error('GraphView: container element not found');
    this.loadingEl = typeof loadingEl === 'string' ? document.querySelector(loadingEl) : loadingEl;
    this.width = width;
    this.height = height;
    this.graphData = { nodes: [], links: [] };

    // Use global d3 from CDN. Fail fast if missing.
    this.d3 = globalThis.d3;
    if (!this.d3) throw new Error('GraphView: d3 not found on window. Ensure the d3 script loads before this module.');

    this._setupSvg();
    this._setupForces();
  }

  /**
   * Subscribe to GraphView events.
   * Events:
   * - 'node:select' => payload: string (article title)
   */
  on(type, handler) { return this.emitter.on(type, handler); }
  once(type, handler) { return this.emitter.once(type, handler); }
  emit(type, payload) { return this.emitter.emit(type, payload); }

  _setupSvg() {
    const d3 = this.d3;
    this.svg = d3.select(this.containerEl)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);

    // Container group for zoom/pan
    this.root = this.svg.append('g').attr('class', 'container');
    this.root.append('g').attr('class', 'links');
    this.root.append('g').attr('class', 'nodes');

    // Zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        this.root.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
  }

  _setupForces() {
    const d3 = this.d3;
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(50));
  }

  /**
   * Render or update the graph with smooth animations.
   * @param {{nodes: Array<any>, links: Array<{source:string|any,target:string|any}>}} data
   * @param {boolean} [animate=true] - Whether to animate the changes
   */
  render(data, animate = true) {
    const d3 = this.d3;
    this.graphData = data || { nodes: [], links: [] };

    // Reset zoom to identity only on first render
    if (this.svg && this.zoom && !this._hasRendered) {
      this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity);
      this._hasRendered = true;
    }

    // Links with smooth animations
    const link = this.root.select('.links')
      .selectAll('line')
      .data(this.graphData.links);

    const linkEnter = link.enter().append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 2);
    
    // Animate link entrance
    if (animate) {
      linkEnter.transition()
        .duration(500)
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr('stroke-opacity', 0.6);
    } else {
      linkEnter.attr('stroke-opacity', 0.6);
    }
    
    const linkUpdate = linkEnter.merge(link);
    
    // Animate link exit
    const linkExit = link.exit();
    if (animate) {
      linkExit.transition()
        .duration(300)
        .ease(d3.easeBackIn.overshoot(1.2))
        .attr('stroke-opacity', 0)
        .remove();
    } else {
      linkExit.remove();
    }

    // Nodes
    const node = this.root.select('.nodes')
      .selectAll('g')
      .data(this.graphData.nodes, d => d.id);

    const nodeEnter = node.enter().append('g')
      .attr('class', 'node')
      .style('opacity', 0)
      .attr('transform', d => `translate(${this.width / 2},${this.height / 2})`)
      .call(this.d3.drag()
        .on('start', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      )
      .on('mouseover', function () {
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', d => d.isCentral ? 28 : 22);
      })
      .on('mouseout', function () {
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', d => d.isCentral ? 25 : 20);
      })
      .on('click', (_, d) => {
        // Emit the semantic event for the app to react (load preview, etc.)
        this.emit('node:select', d.title);
      });

    // Add circles with initial scale of 0 for smooth entrance
    nodeEnter.append('circle')
      .attr('class', d => d.isCentral ? 'node-circle central' : 'node-circle')
      .attr('r', 0)
      .attr('fill', d => d.isCentral ? '#ff6b6b' : '#667eea')
      .attr('stroke', '#fff')
      .attr('stroke-width', d => d.isCentral ? 3 : 2);

    // Add text with initial scale of 0
    nodeEnter.append('text')
      .attr('class', d => d.isCentral ? 'node-text central' : 'node-text')
      .attr('dy', 4)
      .style('font-size', '0px')
      .text(d => d.title);

    // Animate node entrance
    if (animate) {
      nodeEnter.transition()
        .duration(600)
        .delay((d, i) => i * 50) // Stagger the animations
        .ease(d3.easeBackOut.overshoot(1.4))
        .style('opacity', 1);
      
      nodeEnter.select('circle')
        .transition()
        .duration(600)
        .delay((d, i) => i * 50)
        .ease(d3.easeBackOut.overshoot(1.4))
        .attr('r', d => d.isCentral ? 25 : 20);
      
      nodeEnter.select('text')
        .transition()
        .duration(400)
        .delay((d, i) => i * 50 + 200)
        .ease(d3.easeBackOut)
        .style('font-size', d => d.isCentral ? '14px' : '12px');
    } else {
      nodeEnter
        .style('opacity', 1)
        .select('circle')
        .attr('r', d => d.isCentral ? 25 : 20);
      
      nodeEnter.select('text')
        .style('font-size', d => d.isCentral ? '14px' : '12px');
    }

    const nodeUpdate = nodeEnter.merge(node);
    
    // Animate node exit with satisfying shrink effect
    const nodeExit = node.exit();
    if (animate) {
      nodeExit.transition()
        .duration(400)
        .ease(d3.easeBackIn.overshoot(1.4))
        .style('opacity', 0)
        .remove();
      
      nodeExit.select('circle')
        .transition()
        .duration(400)
        .ease(d3.easeBackIn.overshoot(1.4))
        .attr('r', 0);
      
      nodeExit.select('text')
        .transition()
        .duration(200)
        .ease(d3.easeBackIn)
        .style('font-size', '0px');
    } else {
      nodeExit.remove();
    }

    // Simulation binding
    this.simulation
      .nodes(this.graphData.nodes)
      .on('tick', () => {
        linkUpdate
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        nodeUpdate.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    this.simulation.force('link').links(this.graphData.links);
    this.simulation.alpha(1).restart();
  }

  /** Toggle loading overlay visibility. */
  setLoading(isLoading) {
    if (!this.loadingEl) return;
    this.loadingEl.classList.toggle('hidden', !isLoading);
  }

  /** Resize the SVG and re-center forces. */
  resize({ width, height }) {
    this.width = width ?? this.width;
    this.height = height ?? this.height;
    if (this.svg) {
      this.svg.attr('width', this.width).attr('height', this.height);
    }
    if (this.simulation) {
      this.simulation
        .force('center', this.d3.forceCenter(this.width / 2, this.height / 2))
        .alpha(0.3)
        .restart();
    }
  }
}
