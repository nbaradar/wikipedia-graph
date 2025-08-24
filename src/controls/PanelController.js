/**
 * PanelController - Handles drag and collapse functionality for movable panels
 */
class PanelController {
  constructor(panelElement, emitter) {
    this.panel = panelElement;
    this.emitter = emitter;
    this.isDragging = false;
    this.isCollapsed = false;
    this.dragOffset = { x: 0, y: 0 };
    
    this.dragHandle = this.panel.querySelector('.graph-control-drag-handle');
    this.collapseButton = this.panel.querySelector('.graph-control-collapse');
    this.content = this.panel.querySelector('.graph-control-content');
    
    this.init();
  }
  
  init() {
    if (this.dragHandle) {
      this.setupDragFunctionality();
    }
    
    if (this.collapseButton) {
      this.setupCollapseFunctionality();
    }
    
    // Load saved state from localStorage
    this.loadState();
  }
  
  setupDragFunctionality() {
    this.dragHandle.addEventListener('mousedown', this.handleDragStart.bind(this));
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    
    // Prevent text selection during drag
    this.dragHandle.addEventListener('selectstart', (e) => e.preventDefault());
  }
  
  setupCollapseFunctionality() {
    this.collapseButton.addEventListener('click', this.toggleCollapse.bind(this));
  }
  
  handleDragStart(e) {
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
  
  handleDragMove(e) {
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
  
  handleDragEnd() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.panel.classList.remove('dragging');
    
    // Save position to localStorage
    this.saveState();
  }
  
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.panel.classList.add('collapsed');
    } else {
      this.panel.classList.remove('collapsed');
    }
    
    // Save state
    this.saveState();
    
    // Emit event for other components to react
    this.emitter.emit('panel:collapse', { collapsed: this.isCollapsed });
  }
  
  saveState() {
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
  
  loadState() {
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
  
  // Public method to reset panel to default position
  resetPosition() {
    this.panel.style.position = 'absolute';
    this.panel.style.left = '20px';
    this.panel.style.top = '20px';
    this.panel.style.right = 'auto';
    this.saveState();
  }
  
  // Public method to expand panel
  expand() {
    if (this.isCollapsed) {
      this.toggleCollapse();
    }
  }
  
  // Public method to collapse panel
  collapse() {
    if (!this.isCollapsed) {
      this.toggleCollapse();
    }
  }
}

export default PanelController;
