/**
 * NodeCountController
 * Manages the node count slider and input controls, syncing their values
 * and emitting events when the node count changes.
 *
 * Features:
 * - Bidirectional sync between slider and number input
 * - Range validation (0-100)
 * - Debounced updates to prevent excessive API calls
 * - Emits 'nodeCount:change' events for the app to react to
 */
import Emitter from '../utils/Emitter.js';

export default class NodeCountController {
  /**
   * @param {Object} opts
   * @param {string} [opts.sliderSelector='#node-count-slider'] - Slider element selector
   * @param {string} [opts.inputSelector='#node-count-input'] - Number input selector
   * @param {number} [opts.defaultValue=10] - Default node count
   * @param {number} [opts.debounceMs=300] - Debounce delay for updates
   */
  constructor(opts = {}) {
    this.emitter = new Emitter();
    this.sliderSelector = opts.sliderSelector || '#node-count-slider';
    this.inputSelector = opts.inputSelector || '#node-count-input';
    this.defaultValue = opts.defaultValue ?? 10;
    this.debounceMs = opts.debounceMs ?? 50;
    
    this.slider = document.querySelector(this.sliderSelector);
    this.input = document.querySelector(this.inputSelector);
    this.currentValue = this.defaultValue;
    this.debounceTimeout = null;
    
    if (!this.slider || !this.input) {
      throw new Error('NodeCountController: slider or input element not found');
    }
    
    this._init();
  }
  
  _init() {
    // Set initial values
    this.slider.value = this.defaultValue;
    this.input.value = this.defaultValue;
    
    // Bind event listeners
    this.slider.addEventListener('input', (e) => this._handleSliderChange(e));
    this.input.addEventListener('input', (e) => this._handleInputChange(e));
    this.input.addEventListener('blur', (e) => this._handleInputBlur(e));
  }
  
  _handleSliderChange(event) {
    const value = parseInt(event.target.value, 10);
    this._updateValue(value, 'slider');
  }
  
  _handleInputChange(event) {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
      this._updateValue(value, 'input');
    }
  }
  
  _handleInputBlur(event) {
    // Ensure input has a valid value on blur
    const value = parseInt(event.target.value, 10);
    if (isNaN(value) || value < 0) {
      this.input.value = 0;
      this._updateValue(0, 'input');
    } else if (value > 100) {
      this.input.value = 100;
      this._updateValue(100, 'input');
    }
  }
  
  _updateValue(newValue, source) {
    // Clamp value to valid range
    const clampedValue = Math.max(0, Math.min(100, newValue));
    
    if (clampedValue === this.currentValue) return;
    
    this.currentValue = clampedValue;
    
    // Sync the other control
    if (source === 'slider') {
      this.input.value = clampedValue;
    } else if (source === 'input') {
      this.slider.value = clampedValue;
    }
    
    // Immediate UI update for responsiveness
    this.emitter.emit('nodeCount:change', clampedValue);
    
    // Optional: Still debounce for expensive operations like API calls
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.emitter.emit('nodeCount:debounced', clampedValue);
    }, this.debounceMs);
  }
  
  /**
   * Get current node count value
   * @returns {number}
   */
  getValue() {
    return this.currentValue;
  }
  
  /**
   * Set node count value programmatically
   * @param {number} value
   */
  setValue(value) {
    this._updateValue(value, 'programmatic');
  }
  
  /**
   * Subscribe to node count change events
   * @param {string} type - Event type ('nodeCount:change')
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
   * Clean up event listeners
   */
  destroy() {
    clearTimeout(this.debounceTimeout);
    // Note: We don't remove DOM event listeners as they'll be cleaned up
    // when elements are removed from DOM
  }
}
