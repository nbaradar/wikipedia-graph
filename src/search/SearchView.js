/**
 * SearchView
 * Manages search inputs (main + top), suggestions dropdowns, and emits submit events.
 *
 * Dev notes:
 * - UI-only. Suggestions are fetched via injected `fetchSuggestions(query)`.
 * - Debounced input to reduce API chatter.
 * - Emits: 'submit' with the final query string.
 */
export class SearchView extends EventTarget {
  /**
   * @param {Object} opts
   * @param {string|HTMLElement} opts.mainInput
   * @param {string|HTMLElement} opts.mainButton
   * @param {string|HTMLElement} opts.topInput
   * @param {string|HTMLElement} opts.topButton
   * @param {string|HTMLElement} opts.suggestionsMainEl
   * @param {string|HTMLElement} opts.suggestionsTopEl
   * @param {(q:string) => Promise<Array<{title:string, description:string}>>} opts.fetchSuggestions
   * @param {number} [opts.minChars=2]
   * @param {number} [opts.debounceMs=150]
   */
  constructor(opts) {
    super();
    this.mainInput = this._el(opts.mainInput);
    this.mainButton = this._el(opts.mainButton);
    this.topInput = this._el(opts.topInput);
    this.topButton = this._el(opts.topButton);
    this.suggMain = this._el(opts.suggestionsMainEl);
    this.suggTop = this._el(opts.suggestionsTopEl);
    this.fetchSuggestions = opts.fetchSuggestions;
    this.minChars = opts.minChars ?? 2;
    this.debounceMs = opts.debounceMs ?? 150;

    this._debouncedSuggest = this._debounce(this._handleSuggest.bind(this), this.debounceMs);
    this._outsideClick = (e) => this._handleOutsideClick(e);

    this._wire();
  }

  on(type, handler) { this.addEventListener(type, e => handler(e.detail)); }
  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  setQuery(value, { target = 'both' } = {}) {
    if (target === 'both' || target === 'main') this.mainInput && (this.mainInput.value = value);
    if (target === 'both' || target === 'top') this.topInput && (this.topInput.value = value);
  }

  hideSuggestions() {
    this.suggMain?.classList.remove('visible');
    this.suggTop?.classList.remove('visible');
  }

  destroy() { document.removeEventListener('click', this._outsideClick); }

  _wire() {
    // Main input
    if (this.mainInput) {
      this.mainInput.addEventListener('input', (e) => this._onInput(e, this.suggMain));
      this.mainInput.addEventListener('keydown', (e) => this._onKeyDown(e, 'main'));
    }
    this.mainButton?.addEventListener('click', () => this._submit(this.mainInput?.value || ''));

    // Top input
    if (this.topInput) {
      this.topInput.addEventListener('input', (e) => this._onInput(e, this.suggTop));
      this.topInput.addEventListener('keydown', (e) => this._onKeyDown(e, 'top'));
      this.topInput.addEventListener('focus', () => {
        const wrapper = this.topInput.closest('.search-input-wrapper');
        if (wrapper?.classList.contains('collapsed')) wrapper.classList.remove('collapsed');
      });
    }
    this.topButton?.addEventListener('click', () => this._submit(this.topInput?.value || ''));

    document.addEventListener('click', this._outsideClick);
  }

  async _onInput(event, suggestionsContainer) {
    const query = (event.target.value || '').trim();
    if (!suggestionsContainer) return;
    if (query.length < this.minChars) { suggestionsContainer.classList.remove('visible'); return; }
    this._debouncedSuggest(query, suggestionsContainer, event.target);
  }

  async _handleSuggest(query, suggestionsContainer, inputEl) {
    try {
      const suggestions = await this.fetchSuggestions(query);
      this._renderSuggestions(suggestions, suggestionsContainer, inputEl);
    } catch (err) {
      // Swallow errors; view should be resilient.
      suggestionsContainer.classList.remove('visible');
    }
  }

  _onKeyDown(event, which) {
    if (event.key === 'Enter') {
      const value = which === 'top' ? this.topInput?.value : this.mainInput?.value;
      this._submit(value || '');
    } else if (event.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  _handleOutsideClick(e) {
    const sw = document.querySelector('.search-wrapper');
    const sbTop = document.getElementById('search-bar-top');
    if (sw && !sw.contains(e.target)) this.suggMain?.classList.remove('visible');
    if (sbTop && !sbTop.contains(e.target)) this.suggTop?.classList.remove('visible');
  }

  _submit(raw) {
    const q = (raw || '').trim();
    if (!q) return;
    this.hideSuggestions();
    this._emit('submit', q);
  }

  _renderSuggestions(suggestions, container, inputEl) {
    container.innerHTML = '';
    if (!Array.isArray(suggestions) || suggestions.length === 0) { container.classList.remove('visible'); return; }
    suggestions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <div class="suggestion-title">${this._esc(s.title)}</div>
        <div class="suggestion-description">${this._esc(s.description)}</div>`;
      item.addEventListener('click', () => {
        if (inputEl) inputEl.value = s.title;
        container.classList.remove('visible');
        this._submit(s.title);
      });
      container.appendChild(item);
    });
    container.classList.add('visible');
  }

  _debounce(fn, ms) {
    let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  _esc(text) { const d = document.createElement('div'); d.textContent = String(text ?? ''); return d.innerHTML; }
  _el(selOrEl) { return typeof selOrEl === 'string' ? document.querySelector(selOrEl) : selOrEl; }
}

