/**
 * SearchView
 * Manages search inputs (main + top), suggestions dropdowns, and emits submit events.
 *
 * Dev notes:
 * - UI-only. Suggestions are fetched via injected `fetchSuggestions(query)`.
 * - Debounced input to reduce API chatter.
 * - Emits: 'submit' with the final query string.
 */
import { Emitter } from '../utils/Emitter.js';

export class SearchView {
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
    // Use a dedicated emitter so consumers receive payload directly.
    this.emitter = new Emitter();
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
    this._state = {
      main: { list: [], index: -1 },
      top: { list: [], index: -1 },
    };

    this._wire();
  }

  on(type, handler) { return this.emitter.on(type, handler); }
  once(type, handler) { return this.emitter.once(type, handler); }
  emit(type, payload) { return this.emitter.emit(type, payload); }

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
    const which = this._whichForContainer(suggestionsContainer);
    this._state[which].index = -1;
    if (query.length < this.minChars) { suggestionsContainer.classList.remove('visible'); return; }
    this._debouncedSuggest(query, suggestionsContainer, event.target);
  }

  async _handleSuggest(query, suggestionsContainer, inputEl) {
    try {
      const suggestions = await this.fetchSuggestions(query);
      const which = this._whichForContainer(suggestionsContainer);
      this._state[which].list = suggestions || [];
      this._state[which].index = -1; // no preselection
      this._renderSuggestions(suggestions, suggestionsContainer, inputEl);
    } catch (err) {
      // Swallow errors; view should be resilient.
      suggestionsContainer.classList.remove('visible');
    }
  }

  _onKeyDown(event, which) {
    const container = which === 'top' ? this.suggTop : this.suggMain;
    const st = this._state[which];
    const hasList = container && container.classList.contains('visible') && st.list.length > 0;

    if (event.key === 'ArrowDown' && hasList) {
      event.preventDefault();
      st.index = st.index < 0 ? 0 : (st.index + 1) % st.list.length;
      this._applyHighlight(which);
    } else if (event.key === 'ArrowUp' && hasList) {
      event.preventDefault();
      st.index = st.index < 0 ? st.list.length - 1 : (st.index - 1 + st.list.length) % st.list.length;
      this._applyHighlight(which);
    } else if (event.key === 'Enter') {
      const inputEl = which === 'top' ? this.topInput : this.mainInput;
      if (hasList && st.index >= 0) {
        event.preventDefault();
        const sel = st.list[st.index];
        if (inputEl) inputEl.value = sel.title;
        this.hideSuggestions();
        this.emit('submit', sel.title);
      } else {
        const value = inputEl?.value || '';
        this._submit(value);
      }
    } else if (event.key === 'Escape') {
      this.hideSuggestions();
      st.index = -1;
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
    this.emit('submit', q);
  }

  _renderSuggestions(suggestions, container, inputEl) {
    container.innerHTML = '';
    if (!Array.isArray(suggestions) || suggestions.length === 0) { container.classList.remove('visible'); return; }
    const which = this._whichForContainer(container);
    const st = this._state[which];
    suggestions.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item' + (st.index === idx ? ' active' : '');
      item.innerHTML = `
        <div class="suggestion-title">${this._esc(s.title)}</div>
        <div class="suggestion-description">${this._esc(s.description)}</div>`;
      item.addEventListener('mouseenter', () => {
        st.index = idx;
        this._applyHighlight(which);
      });
      item.addEventListener('click', () => {
        if (inputEl) inputEl.value = s.title;
        container.classList.remove('visible');
        this._submit(s.title);
      });
      container.appendChild(item);
    });
    container.classList.add('visible');
  }

  _applyHighlight(which) {
    const container = which === 'top' ? this.suggTop : this.suggMain;
    const st = this._state[which];
    if (!container) return;
    const children = Array.from(container.querySelectorAll('.suggestion-item'));
    children.forEach((el, i) => {
      if (i === st.index) el.classList.add('active'); else el.classList.remove('active');
    });
    const activeEl = children[st.index];
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  _whichForContainer(container) {
    return container === this.suggTop ? 'top' : 'main';
  }

  _debounce(fn, ms) {
    let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  _esc(text) { const d = document.createElement('div'); d.textContent = String(text ?? ''); return d.innerHTML; }
  _el(selOrEl) { return typeof selOrEl === 'string' ? document.querySelector(selOrEl) : selOrEl; }
}
