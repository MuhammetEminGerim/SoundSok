/* ════════════════════════════════════════════════════════════
   SoundSok — Search Engine
   Debounced search with highlight support.
   Filters the sound list in real-time as the user types.
   ════════════════════════════════════════════════════════════ */

class SearchEngine {
  constructor() {
    /** @type {HTMLInputElement|null} */
    this.input = null;

    /** @type {HTMLElement|null} */
    this.clearBtn = null;

    /** @type {string} */
    this.currentQuery = '';

    /** @type {number|null} Debounce timer ID */
    this._debounceTimer = null;

    /** @type {number} Debounce delay in ms */
    this.debounceDelay = 200;
  }

  /* ─────────────── Initialization ─────────────── */

  init() {
    this.input = document.getElementById('search-input');
    this.clearBtn = document.getElementById('search-clear');

    if (!this.input) {
      console.warn('[Search] Search input not found');
      return;
    }

    // Input event with debounce
    this.input.addEventListener('input', (e) => {
      const query = e.target.value;
      this._debounceSearch(query);
      this._toggleClearButton(query);
    });

    // Clear button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.clear();
      });
    }

    // Escape key to clear
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.currentQuery) {
          e.stopPropagation(); // Prevent app-level Escape handler
          this.clear();
        }
      }
    });
  }

  /* ─────────────── Search Logic ─────────────── */

  /**
   * Debounce the search to avoid excessive filtering.
   * @param {string} query
   */
  _debounceSearch(query) {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this.search(query);
      this._debounceTimer = null;
    }, this.debounceDelay);
  }

  /**
   * Perform the search: filter sounds by name (case-insensitive).
   * @param {string} query
   */
  search(query) {
    this.currentQuery = query.trim();

    if (window.SoundList) {
      window.SoundList.filterByQuery(this.currentQuery);
    }
  }

  /**
   * Clear the search input and reset filter.
   */
  clear() {
    this.currentQuery = '';

    if (this.input) {
      this.input.value = '';
      this.input.focus();
    }

    this._toggleClearButton('');

    if (window.SoundList) {
      window.SoundList.filterByQuery('');
    }
  }

  /* ─────────────── UI Helpers ─────────────── */

  /**
   * Show/hide the clear button based on input content.
   * @param {string} query
   */
  _toggleClearButton(query) {
    if (!this.clearBtn) return;

    if (query && query.trim().length > 0) {
      this.clearBtn.classList.remove('hidden');
    } else {
      this.clearBtn.classList.add('hidden');
    }
  }

  /**
   * Highlight matching text by wrapping in <mark> tags.
   * Safe against XSS — escapes HTML first.
   * @param {string} text — The full text to search within.
   * @param {string} query — The search query to highlight.
   * @returns {string} — HTML string with <mark> tags.
   */
  highlight(text, query) {
    if (!query || query.trim() === '') {
      return this._escapeHtml(text);
    }

    const escaped = this._escapeHtml(text);
    const escapedQuery = this._escapeHtml(query.trim());

    // Case-insensitive replace
    const regex = new RegExp(`(${this._escapeRegex(escapedQuery)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Focus the search input (useful for keyboard shortcut).
   */
  focus() {
    if (this.input) {
      this.input.focus();
      this.input.select();
    }
  }

  /* ─────────────── Utility ─────────────── */

  /**
   * Escape HTML entities.
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape special regex characters.
   * @param {string} str
   * @returns {string}
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}


// ── Export Singleton ──
window.Search = new SearchEngine();
