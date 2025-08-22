/**
 * SplitterController - Handles resizable panel splitter functionality
 */
class SplitterController {
  constructor(splitterElement, leftPanel, rightPanel, emitter) {
    this.splitter = splitterElement;
    this.leftPanel = leftPanel;
    this.rightPanel = rightPanel;
    this.emitter = emitter;
    this.isDragging = false;
    this.startX = 0;
    this.startLeftWidth = 0;
    this.containerWidth = 0;
    
    this.init();
  }
  
  init() {
    console.log('SplitterController init - elements:', {
      splitter: !!this.splitter,
      leftPanel: !!this.leftPanel,
      rightPanel: !!this.rightPanel
    });
    
    if (!this.splitter || !this.leftPanel || !this.rightPanel) {
      console.warn('SplitterController: Required elements not found', {
        splitter: this.splitter,
        leftPanel: this.leftPanel,
        rightPanel: this.rightPanel
      });
      return;
    }
    
    this.setupEventListeners();
    this.loadState();
  }
  
  setupEventListeners() {
    console.log('Setting up splitter event listeners');
    this.splitter.addEventListener('mousedown', (e) => {
      console.log('Splitter mousedown event');
      this.handleMouseDown(e);
    });
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    
    // Prevent text selection during drag
    this.splitter.addEventListener('selectstart', (e) => e.preventDefault());
    
    // Handle window resize
    window.addEventListener('resize', this.handleWindowResize.bind(this));
  }
  
  handleMouseDown(e) {
    console.log('handleMouseDown called');
    this.isDragging = true;
    this.startX = e.clientX;
    
    const container = this.leftPanel.parentElement;
    this.containerWidth = container.getBoundingClientRect().width;
    this.startLeftWidth = this.leftPanel.getBoundingClientRect().width;
    
    console.log('Container width:', this.containerWidth, 'Start left width:', this.startLeftWidth);
    
    this.splitter.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Disable transitions during drag for instant response
    this.leftPanel.style.transition = 'none';
    this.rightPanel.style.transition = 'none';
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  handleMouseMove(e) {
    if (!this.isDragging) return;
    
    // Direct, immediate update - no requestAnimationFrame or debouncing
    const deltaX = e.clientX - this.startX;
    const newLeftWidth = this.startLeftWidth + deltaX;
    
    // Calculate percentages
    const leftPercent = (newLeftWidth / this.containerWidth) * 100;
    const rightPercent = 100 - leftPercent;
    
    // Enforce minimum sizes (20% each panel)
    if (leftPercent < 20 || rightPercent < 20) return;
    
    // Direct pixel-based updates for zero delay
    const leftPixelWidth = Math.round((leftPercent / 100) * this.containerWidth);
    const rightPixelWidth = this.containerWidth - leftPixelWidth;
    
    // Use width for immediate response
    this.leftPanel.style.width = `${leftPixelWidth}px`;
    this.leftPanel.style.flexBasis = 'auto';
    this.rightPanel.style.width = `${rightPixelWidth}px`;
    this.rightPanel.style.flexBasis = 'auto';
  }
  
  handleMouseUp() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.splitter.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Convert back to flex-basis percentages for responsive behavior
    const leftWidth = parseFloat(this.leftPanel.style.width);
    const leftPercent = (leftWidth / this.containerWidth) * 100;
    const rightPercent = 100 - leftPercent;
    
    this.leftPanel.style.width = '';
    this.rightPanel.style.width = '';
    this.leftPanel.style.flexBasis = `${leftPercent}%`;
    this.rightPanel.style.flexBasis = `${rightPercent}%`;
    
    // Re-enable transitions after drag
    this.leftPanel.style.transition = '';
    this.rightPanel.style.transition = '';
    
    this.saveState();
  }
  
  handleWindowResize() {
    // Maintain proportions on window resize
    const container = this.leftPanel.parentElement;
    const newContainerWidth = container.getBoundingClientRect().width;
    
    if (newContainerWidth !== this.containerWidth) {
      this.containerWidth = newContainerWidth;
      // The flex-basis percentages will automatically maintain proportions
    }
  }
  
  saveState() {
    const leftPercent = parseFloat(this.leftPanel.style.flexBasis) || 60;
    const state = {
      leftPercent,
      rightPercent: 100 - leftPercent
    };
    
    localStorage.setItem('panelSplitter:state', JSON.stringify(state));
  }
  
  loadState() {
    try {
      const savedState = localStorage.getItem('panelSplitter:state');
      if (!savedState) return;
      
      const state = JSON.parse(savedState);
      
      this.leftPanel.style.flexBasis = `${state.leftPercent}%`;
      this.rightPanel.style.flexBasis = `${state.rightPercent}%`;
    } catch (error) {
      console.warn('Failed to load splitter state:', error);
    }
  }
  
  // Public method to reset to default layout
  resetLayout() {
    this.leftPanel.style.flexBasis = '60%';
    this.rightPanel.style.flexBasis = '40%';
    this.saveState();
  }
  
  // Public method to set specific layout
  setLayout(leftPercent) {
    const rightPercent = 100 - leftPercent;
    
    // Enforce minimum sizes
    if (leftPercent < 20 || rightPercent < 20) return false;
    
    this.leftPanel.style.flexBasis = `${leftPercent}%`;
    this.rightPanel.style.flexBasis = `${rightPercent}%`;
    this.saveState();
    
    return true;
  }
}

export default SplitterController;
