/**
 * GraphControlPanelController
 * Main orchestrator for the graph control panel that manages various graph settings.
 * 
 * Features:
 * - Contains and manages NodeCountController for node count settings
 * - Provides framework for adding additional controls (filters, layers, etc.)
 * - Coordinates between different control components
 * - Maintains consistent event API for the main application
 * 
 * Architecture:
 * - Modular design where each control type has its own focused controller
 * - Event-driven communication between components
 * - Extensible for future control additions
 */
import Emitter from '../utils/Emitter.js';
import NodeCountController from './NodeCountController.js';

export default class GraphControlPanelController {
  /**
   * @param {Object} opts
   * @param {string} [opts.panelSelector='#graph-control'] - Main panel selector
   * @param {Object} [opts.nodeCountOpts] - Options to pass to NodeCountController
   */
  constructor(opts = {}) {
    this.emitter = new Emitter();
    this.panelSelector = opts.panelSelector || '#graph-control';
    this.nodeCountOpts = opts.nodeCountOpts || {};
    
    // Sub-controllers
    this.nodeCountController = null;
    
    // Panel elements
    this.panel = document.querySelector(this.panelSelector);
    
    if (!this.panel) {
      throw new Error(`GraphControlPanelController: panel element '${this.panelSelector}' not found`);
    }

    // Panel drag/collapse elements
    this.dragHandle = null;
    this.collapseButton = null;
    this.content = null;
    
    // Filter dropdown elements
    this.filterButton = null;
    this.filterDropdown = null;
    this.filterText = null;
    
    // Panel state
    this.isDragging = false;
    this.isCollapsed = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isFilterDropdownOpen = false;
    this.currentFilterStrategy = 'alphabetical';
    
    this._init();
  }
  
  _init() {
    this._initializePanelElements();
    this._initializeFilterElements();
    this._initializeNodeCountController();
    this._setupPanelFunctionality();
    this._setupFilterFunctionality();
    this._setupEventDelegation();
    this._loadPanelState();
  }
  
  /**
   * Initialize panel drag/collapse elements
   */
  _initializePanelElements() {
    this.dragHandle = this.panel.querySelector('.graph-control-drag-handle');
    this.collapseButton = this.panel.querySelector('.graph-control-collapse');
    this.content = this.panel.querySelector('.graph-control-content');
    
    if (!this.dragHandle || !this.collapseButton || !this.content) {
      console.warn('GraphControlPanelController: Some panel elements not found', {
        dragHandle: !!this.dragHandle,
        collapseButton: !!this.collapseButton,
        content: !!this.content
      });
    }
  }
  
  /**
   * Initialize filter dropdown elements
   */
  _initializeFilterElements() {
    this.filterButton = this.panel.querySelector('#node-filter-button');
    this.filterDropdown = this.panel.querySelector('#node-filter-dropdown');
    this.filterText = this.panel.querySelector('.filter-dropdown-text');
    
    if (!this.filterButton || !this.filterDropdown || !this.filterText) {
      console.warn('GraphControlPanelController: Some filter elements not found', {
        filterButton: !!this.filterButton,
        filterDropdown: !!this.filterDropdown,
        filterText: !!this.filterText
      });
    }
  }
  
  /**
   * Set up panel drag and collapse functionality
   */
  _setupPanelFunctionality() {
    if (this.dragHandle) {
      this._setupDragFunctionality();
    }
    
    if (this.collapseButton) {
      this._setupCollapseFunctionality();
    }
  }
  
  /**
   * Set up drag functionality
   */
  _setupDragFunctionality() {
    this.dragHandle.addEventListener('mousedown', this._handleDragStart.bind(this));
    document.addEventListener('mousemove', this._handleDragMove.bind(this));
    document.addEventListener('mouseup', this._handleDragEnd.bind(this));
    
    // Prevent text selection during drag
    this.dragHandle.addEventListener('selectstart', (e) => e.preventDefault());
  }
  
  /**
   * Set up collapse functionality  
   */
  _setupCollapseFunctionality() {
    this.collapseButton.addEventListener('click', this._toggleCollapse.bind(this));
  }
  
  /**
   * Set up filter dropdown functionality
   */
  _setupFilterFunctionality() {
    if (!this.filterButton || !this.filterDropdown) return;
    
    // Toggle dropdown on button click
    this.filterButton.addEventListener('click', this._toggleFilterDropdown.bind(this));
    
    // Handle filter selection
    this.filterDropdown.addEventListener('click', this._handleFilterSelection.bind(this));
    
    // Close dropdown when clicking outside
    document.addEventListener('click', this._handleDocumentClick.bind(this));
    
    // Close dropdown on escape key
    document.addEventListener('keydown', this._handleKeyDown.bind(this));
  }
  
  /**
   * Handle drag start
   */
  _handleDragStart(e) {
    this.isDragging = true;
    this.panel.classList.add('dragging');
    
    const rect = this.panel.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    // Switch to fixed positioning for dragging
    this.panel.style.position = 'fixed';
    this.panel.style.left = `${rect.left}px`;
    this.panel.style.top = `${rect.top}px`;
    this.panel.style.right = 'auto';
    
    e.preventDefault();
  }
  
  /**
   * Handle drag move
   */
  _handleDragMove(e) {
    if (!this.isDragging) return;
    
    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;
    
    // Constrain to viewport bounds
    const panelRect = this.panel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width;
    const maxY = window.innerHeight - panelRect.height;
    
    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));
    
    // Direct position update for immediate response
    this.panel.style.left = `${constrainedX}px`;
    this.panel.style.top = `${constrainedY}px`;
  }
  
  /**
   * Handle drag end
   */
  _handleDragEnd() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.panel.classList.remove('dragging');
    
    // Save position to localStorage
    this._savePanelState();
  }
  
  /**
   * Toggle panel collapse state
   */
  _toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.panel.classList.add('collapsed');
    } else {
      this.panel.classList.remove('collapsed');
    }
    
    // Save state
    this._savePanelState();
    
    // Emit event for other components to react
    this.emitter.emit('panel:collapse', { collapsed: this.isCollapsed });
  }
  
  /**
   * Save panel state to localStorage
   */
  _savePanelState() {
    const state = {
      collapsed: this.isCollapsed,
      position: {
        left: this.panel.style.left,
        top: this.panel.style.top,
        right: this.panel.style.right,
        position: this.panel.style.position
      }
    };
    
    localStorage.setItem('graphControlPanel:state', JSON.stringify(state));
  }
  
  /**
   * Toggle filter dropdown visibility
   */
  _toggleFilterDropdown(e) {
    e.stopPropagation();
    
    this.isFilterDropdownOpen = !this.isFilterDropdownOpen;
    
    if (this.isFilterDropdownOpen) {
      this._openFilterDropdown();
    } else {
      this._closeFilterDropdown();
    }
  }
  
  /**
   * Open filter dropdown
   */
  _openFilterDropdown() {
    this.filterButton.setAttribute('aria-expanded', 'true');
    this.filterDropdown.classList.add('show');
    this.isFilterDropdownOpen = true;
  }
  
  /**
   * Close filter dropdown
   */
  _closeFilterDropdown() {
    this.filterButton.setAttribute('aria-expanded', 'false');
    this.filterDropdown.classList.remove('show');
    this.isFilterDropdownOpen = false;
  }
  
  /**
   * Handle filter selection from dropdown
   */
  _handleFilterSelection(e) {
    const item = e.target.closest('.filter-dropdown-item');
    if (!item) return;
    
    const filterStrategy = item.dataset.filter;
    const filterName = item.querySelector('.filter-name').textContent;
    
    if (filterStrategy && filterStrategy !== this.currentFilterStrategy) {
      // Update active state
      this.filterDropdown.querySelectorAll('.filter-dropdown-item').forEach(el => {
        el.classList.remove('active');
      });
      item.classList.add('active');
      
      // Update button text
      this.filterText.textContent = filterName;
      
      // Update current strategy
      this.currentFilterStrategy = filterStrategy;
      
      // Close dropdown
      this._closeFilterDropdown();
      
      // Emit filter change event
      this.emitter.emit('filterStrategy:change', filterStrategy);
    }
  }
  
  /**
   * Handle document clicks (close dropdown when clicking outside)
   */
  _handleDocumentClick(e) {
    if (!this.isFilterDropdownOpen) return;
    
    // Don't close if clicking inside the dropdown
    if (this.filterButton.contains(e.target) || this.filterDropdown.contains(e.target)) {
      return;
    }
    
    this._closeFilterDropdown();
  }
  
  /**
   * Handle keyboard events
   */
  _handleKeyDown(e) {
    if (e.key === 'Escape' && this.isFilterDropdownOpen) {
      this._closeFilterDropdown();
      this.filterButton.focus();
    }
  }
  
  /**
   * Load panel state from localStorage
   */
  _loadPanelState() {
    try {
      const savedState = localStorage.getItem('graphControlPanel:state');
      if (!savedState) return;
      
      const state = JSON.parse(savedState);
      
      // Restore collapse state
      if (state.collapsed) {
        this.isCollapsed = true;
        this.panel.classList.add('collapsed');
      }
      
      // Restore position if it was moved
      if (state.position && state.position.position === 'fixed') {
        this.panel.style.position = state.position.position;
        this.panel.style.left = state.position.left;
        this.panel.style.top = state.position.top;
        this.panel.style.right = state.position.right;
      }
    } catch (error) {
      console.warn('Failed to load panel state:', error);
    }
  }
  
  /**
   * Initialize the node count controller with updated selectors
   */
  _initializeNodeCountController() {
    try {
      // Initialize NodeCountController with the new selectors
      const nodeCountOpts = {
        sliderSelector: '#node-count-slider',
        inputSelector: '#node-count-input',
        ...this.nodeCountOpts
      };
      
      this.nodeCountController = new NodeCountController(nodeCountOpts);
      
      // Forward node count events to the main application
      this.nodeCountController.on('nodeCount:change', (count) => {
        this.emitter.emit('nodeCount:change', count);
      });
      
      this.nodeCountController.on('nodeCount:debounced', (count) => {
        this.emitter.emit('nodeCount:debounced', count);
      });
      
    } catch (error) {
      console.error('Failed to initialize NodeCountController:', error);
      throw error;
    }
  }
  
  /**
   * Set up event delegation for panel-wide events
   */
  _setupEventDelegation() {
    // Future: This is where we'd add event handling for other control types
    // For now, most events are handled by the sub-controllers
  }
  
  /**
   * Get current node count value
   * @returns {number}
   */
  getNodeCount() {
    return this.nodeCountController ? this.nodeCountController.getValue() : 10;
  }
  
  /**
   * Get current filter strategy
   * @returns {string}
   */
  getFilterStrategy() {
    return this.currentFilterStrategy;
  }
  
  /**
   * Set node count value programmatically
   * @param {number} value
   */
  setNodeCount(value) {
    if (this.nodeCountController) {
      this.nodeCountController.setValue(value);
    }
  }
  
  /**
   * Set filter strategy programmatically
   * @param {string} strategy - The filter strategy ID
   */
  setFilterStrategy(strategy) {
    const item = this.filterDropdown.querySelector(`[data-filter="${strategy}"]`);
    if (item) {
      // Simulate a click on the item
      this._handleFilterSelection({ target: item });
    }
  }
  
  /**
   * Subscribe to control panel events
   * Available events:
   * - 'nodeCount:change' - Node count changed
   * - 'nodeCount:debounced' - Debounced node count change
   * - 'filterStrategy:change' - Filter strategy changed
   * 
   * @param {string} type - Event type
   * @param {Function} handler - Event handler
   * @returns {Function} - Unsubscribe function
   */
  on(type, handler) {
    return this.emitter.on(type, handler);
  }
  
  once(type, handler) {
    return this.emitter.once(type, handler);
  }
  
  /**
   * Get all current control values for state management
   * @returns {Object} Current control state
   */
  getState() {
    return {
      nodeCount: this.getNodeCount(),
      filterStrategy: this.getFilterStrategy()
    };
  }
  
  /**
   * Set multiple control values from state
   * @param {Object} state - State object with control values
   */
  setState(state) {
    if (state.nodeCount !== undefined) {
      this.setNodeCount(state.nodeCount);
    }
    if (state.filterStrategy !== undefined) {
      this.setFilterStrategy(state.filterStrategy);
    }
  }
  
  /**
   * Panel control methods
   */
  
  /**
   * Reset panel to default position
   */
  resetPanelPosition() {
    this.panel.style.position = 'absolute';
    this.panel.style.left = '20px';
    this.panel.style.top = '20px';
    this.panel.style.right = 'auto';
    this._savePanelState();
  }
  
  /**
   * Expand the panel if collapsed
   */
  expandPanel() {
    if (this.isCollapsed) {
      this._toggleCollapse();
    }
  }
  
  /**
   * Collapse the panel if expanded
   */
  collapsePanel() {
    if (!this.isCollapsed) {
      this._toggleCollapse();
    }
  }
  
  /**
   * Check if panel is collapsed
   * @returns {boolean}
   */
  isPanelCollapsed() {
    return this.isCollapsed;
  }
  
  /**
   * Add future control methods here:
   * 
   * setFilterStrategy(strategy) { ... }
   * getFilterStrategy() { ... }
   * setLayerCount(layers) { ... }
   * etc.
   */
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.nodeCountController) {
      this.nodeCountController.destroy();
    }
    
    // Remove event listeners
    if (this.dragHandle) {
      this.dragHandle.removeEventListener('mousedown', this._handleDragStart.bind(this));
      this.dragHandle.removeEventListener('selectstart', (e) => e.preventDefault());
    }
    
    if (this.collapseButton) {
      this.collapseButton.removeEventListener('click', this._toggleCollapse.bind(this));
    }
    
    if (this.filterButton) {
      this.filterButton.removeEventListener('click', this._toggleFilterDropdown.bind(this));
    }
    
    if (this.filterDropdown) {
      this.filterDropdown.removeEventListener('click', this._handleFilterSelection.bind(this));
    }
    
    document.removeEventListener('mousemove', this._handleDragMove.bind(this));
    document.removeEventListener('mouseup', this._handleDragEnd.bind(this));
    document.removeEventListener('click', this._handleDocumentClick.bind(this));
    document.removeEventListener('keydown', this._handleKeyDown.bind(this));
    
    // Clean up any other sub-controllers
    this.emitter.removeAllListeners();
  }
}