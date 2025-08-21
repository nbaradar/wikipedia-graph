/**
 * Emitter
 * A tiny event bus used to decouple views from the app orchestrator.
 *
 * Why this exists:
 * - We want views (SearchView, GraphView, ThemeManager, etc.) to announce
 *   user interactions without knowing who listens.
 * - Using the browser's EventTarget directly works, but its ergonomics vary
 *   (handlers get Event objects). This wrapper normalizes the API so your
 *   handlers always receive the payload you emit.
 * - Tests can subscribe/unsubscribe deterministically via returned dispose fns.
 *
 * Design:
 * - Internally uses a real EventTarget for performance and compatibility.
 * - `on` returns an unsubscribe function to make cleanup explicit.
 * - `once` uses the native `{ once: true }` option for auto-cleanup.
 * - `emit` sends payload on `event.detail` but consumers never see the Event,
 *   only the payload, keeping call sites simple and consistent.
 */
export default class Emitter {
  constructor() {
    /** @private */
    this._target = new EventTarget();
  }

  /**
   * Subscribe to an event.
   * @template T
   * @param {string} type - Event name, e.g. 'submit' or 'node:select'
   * @param {(payload: T) => void} handler - Receives the payload emitted.
   * @returns {() => void} - Call to unsubscribe.
   */
  on(type, handler) {
    const wrapped = (e) => handler(e.detail);
    this._target.addEventListener(type, wrapped);
    return () => this._target.removeEventListener(type, wrapped);
  }

  /**
   * Subscribe once. The handler runs a single time then is removed.
   * @template T
   * @param {string} type
   * @param {(payload: T) => void} handler
   */
  once(type, handler) {
    const wrapped = (e) => handler(e.detail);
    this._target.addEventListener(type, wrapped, { once: true });
  }

  /**
   * Unsubscribe a previously added raw handler (rarely needed with returned disposer).
   * @param {string} type
   * @param {(e: Event) => void} rawHandler - The actual function bound to EventTarget.
   */
  off(type, rawHandler) {
    this._target.removeEventListener(type, rawHandler);
  }

  /**
   * Emit an event with a payload.
   * @template T
   * @param {string} type
   * @param {T} payload
   */
  emit(type, payload) {
    this._target.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }
}

