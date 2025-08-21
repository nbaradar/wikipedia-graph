/**
 * ThemeManager
 * Manages theme state (light/dark), dropdown UI, and icon updates.
 *
 * Dev notes:
 * - UI-scoped: attaches listeners to the theme button/dropdown; no app logic.
 * - Persists theme in localStorage under 'wikipedia-graph-theme'.
 * - Exposes set/get for programmatic control. Call destroy() to remove listeners if needed.
 */
export class ThemeManager {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.button='#theme-button'] - Button that opens the dropdown.
   * @param {string} [opts.dropdown='#theme-dropdown'] - Dropdown container.
   * @param {string} [opts.optionSelector='.theme-option'] - Individual theme option elements.
   * @param {string} [opts.storageKey='wikipedia-graph-theme'] - localStorage key.
   */
  constructor(opts = {}) {
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
    body.classList.remove('dark-theme');
    if (theme === 'dark') body.classList.add('dark-theme');
    localStorage.setItem(this.storageKey, theme);
    this._updateIcon(theme);
  }

  /** Get current theme string. */
  get() {
    return localStorage.getItem(this.storageKey) || 'default';
  }

  /** Remove listeners (optional, for teardown). */
  destroy() {
    document.removeEventListener('click', this._outsideClickHandler);
  }

  _updateIcon(theme) {
    const svg = this.button?.querySelector('svg');
    if (!svg) return;
    if (theme === 'dark') {
      svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else {
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
    }
  }
}

