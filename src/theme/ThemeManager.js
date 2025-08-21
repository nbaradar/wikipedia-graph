/**
 * ThemeManager
 * Manages theme state (light/dark), dropdown UI, and icon updates.
 *
 * Dev notes:
 * - UI-scoped: attaches listeners to the theme button/dropdown; no app logic.
 * - Persists theme in localStorage under 'wikipedia-graph-theme'.
 * - Exposes set/get for programmatic control. Call destroy() to remove listeners if needed.
 */
import Emitter from '../utils/Emitter.js';

export default class ThemeManager {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.button='#theme-button'] - Button that opens the dropdown.
   * @param {string} [opts.dropdown='#theme-dropdown'] - Dropdown container.
   * @param {string} [opts.optionSelector='.theme-option'] - Individual theme option elements.
   * @param {string} [opts.storageKey='wikipedia-graph-theme'] - localStorage key.
   */
  constructor(opts = {}) {
    // Event emitter to notify about theme changes.
    this.emitter = new Emitter();
    this.buttonSel = opts.button || '#theme-button';
    this.dropdownSel = opts.dropdown || '#theme-dropdown';
    this.optionSel = opts.optionSelector || '.theme-option';
    this.storageKey = opts.storageKey || 'wikipedia-graph-theme';

    this.button = document.querySelector(this.buttonSel);
    this.dropdown = document.querySelector(this.dropdownSel);
    this.options = Array.from(document.querySelectorAll(this.optionSel));
    this.switcher = document.getElementById('theme-switcher');

    this._outsideClickHandler = (e) => {
      if (!this.switcher?.contains(e.target)) {
        this.dropdown?.classList.remove('visible');
      }
    };

    this._init();
  }

  _init() {
    // Wire events
    this.button?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dropdown?.classList.toggle('visible');
    });
    document.addEventListener('click', this._outsideClickHandler);

    this.options.forEach((opt) => {
      opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        this.set(theme);
        this.dropdown?.classList.remove('visible');
      });
    });

    // Apply saved or default theme
    const saved = localStorage.getItem(this.storageKey) || 'default';
    this.set(saved);
  }

  /** Set current theme. */
  set(theme) {
    const body = document.body;
    // Remove all theme classes
    body.classList.remove('dark-theme', 'ocean-theme');
    
    // Add the appropriate theme class
    if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else if (theme === 'ocean') {
      body.classList.add('ocean-theme');
    }
    // 'default' theme uses no additional class (uses :root variables)
    
    localStorage.setItem(this.storageKey, theme);
    this._updateIcon(theme);
    // Announce the theme change so other modules can react if needed.
    this.emitter.emit('theme:change', theme);
  }

  /** Get current theme string. */
  get() {
    return localStorage.getItem(this.storageKey) || 'default';
  }

  /** Subscribe to theme-related events. */
  on(type, handler) { return this.emitter.on(type, handler); }
  once(type, handler) { return this.emitter.once(type, handler); }

  /** Remove listeners (optional, for teardown). */
  destroy() {
    document.removeEventListener('click', this._outsideClickHandler);
  }

  _updateIcon(theme) {
    const svg = this.button?.querySelector('svg');
    if (!svg) return;
    
    switch (theme) {
      case 'dark':
        svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        break;
      case 'ocean':
        svg.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>';
        break;
      default: // 'default' theme
        svg.innerHTML = `
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
        break;
    }
  }
}
