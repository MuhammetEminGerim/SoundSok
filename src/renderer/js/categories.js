/* ════════════════════════════════════════════════════════════
   SoundSok — Category Manager
   Manages the sidebar category list: rendering, selection,
   inline creation, deletion, and IPC integration.
   ════════════════════════════════════════════════════════════ */

class CategoryManager {
  constructor() {
    /** @type {Array<Object>} */
    this.categories = [];

    /** @type {string|null} Active category ID (null = show all) */
    this.activeCategory = null;

    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {HTMLElement|null} */
    this.addBtn = null;

    /** @type {boolean} */
    this._isCreating = false;

    /** Predefined category colors */
    this.colors = [
      '#8b5cf6', // violet
      '#6366f1', // indigo
      '#3b82f6', // blue
      '#06b6d4', // cyan
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#ec4899', // pink
      '#f97316', // orange
      '#84cc16', // lime
    ];
  }

  /* ─────────────── Initialization ─────────────── */

  init() {
    this.container = document.getElementById('category-list');
    this.addBtn = document.getElementById('btn-add-category');

    if (this.addBtn) {
      this.addBtn.addEventListener('click', () => this.addCategory());
    }

    this.loadCategories();
  }

  /* ─────────────── Data Loading ─────────────── */

  /**
   * Load categories from the database via IPC.
   */
  async loadCategories() {
    try {
      if (window.soundsok && window.soundsok.categories) {
        const result = await window.soundsok.categories.getAll();
        this.categories = result || [];
      } else {
        // Fallback: no IPC yet, start with empty
        this.categories = [];
      }
    } catch (err) {
      console.error('[Categories] Failed to load categories:', err);
      this.categories = [];
    }

    this.render();
  }

  /* ─────────────── Rendering ─────────────── */

  /**
   * Render the category list in the sidebar.
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = '';

    // "Tüm Sesler" — always first
    const allItem = this._createCategoryItem({
      id: null,
      name: 'Tüm Sesler',
      color: '#8b5cf6',
      _isAll: true
    });
    this.container.appendChild(allItem);

    // User categories
    this.categories.forEach(cat => {
      const item = this._createCategoryItem(cat);
      this.container.appendChild(item);
    });
  }

  /**
   * Create a category DOM item.
   * @param {Object} category
   * @returns {HTMLElement}
   */
  _createCategoryItem(category) {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.dataset.categoryId = category.id || 'all';

    // Mark active
    if (
      (category._isAll && this.activeCategory === null) ||
      (category.id === this.activeCategory)
    ) {
      item.classList.add('active');
    }

    // Count sounds in this category
    const count = this._getSoundCount(category.id);

    const dotColor = category.color || this.colors[0];

    item.innerHTML = `
      <span class="category-dot" style="background: ${dotColor}; color: ${dotColor};"></span>
      <span class="category-name">${this._escapeHtml(category.name)}</span>
      <span class="category-count">${count}</span>
    `;

    // Click → set active
    item.addEventListener('click', () => {
      this.setActive(category._isAll ? null : category.id);
    });

    // Right-click → option to delete (not for "Tüm Sesler")
    if (!category._isAll) {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showCategoryContextMenu(category, e);
      });
    }

    return item;
  }

  /* ─────────────── Active State ─────────────── */

  /**
   * Set the active category and filter the sound list.
   * @param {string|null} categoryId
   */
  setActive(categoryId) {
    this.activeCategory = categoryId;

    // Update visual state
    if (this.container) {
      this.container.querySelectorAll('.category-item').forEach(el => {
        const cid = el.dataset.categoryId;
        const isMatch = (categoryId === null && cid === 'all') || cid === categoryId;
        el.classList.toggle('active', isMatch);
      });
    }

    // Filter sound list
    if (window.SoundList) {
      window.SoundList.filterByCategory(categoryId);
    }
  }

  /* ─────────────── Add Category ─────────────── */

  /**
   * Show inline input to create a new category.
   */
  addCategory() {
    if (this._isCreating || !this.container) return;
    this._isCreating = true;

    const inputWrapper = document.createElement('div');
    inputWrapper.style.padding = '4px 0';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'category-input';
    input.placeholder = 'Kategori adı...';
    input.maxLength = 40;

    inputWrapper.appendChild(input);
    this.container.appendChild(inputWrapper);

    // Focus after animation frame
    requestAnimationFrame(() => input.focus());

    const confirmCreate = async () => {
      const name = input.value.trim();
      if (name) {
        await this._createCategory(name);
      }
      inputWrapper.remove();
      this._isCreating = false;
    };

    const cancelCreate = () => {
      inputWrapper.remove();
      this._isCreating = false;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmCreate();
      } else if (e.key === 'Escape') {
        cancelCreate();
      }
    });

    input.addEventListener('blur', () => {
      // Short delay to allow Enter to fire first
      setTimeout(() => {
        if (this._isCreating) {
          confirmCreate();
        }
      }, 100);
    });
  }

  /**
   * Create a new category and persist via IPC.
   * @param {string} name
   */
  async _createCategory(name) {
    const color = this.colors[this.categories.length % this.colors.length];

    const newCategory = {
      id: this._generateId(),
      name,
      color,
      createdAt: new Date().toISOString()
    };

    try {
      if (window.soundsok && window.soundsok.categories) {
        const result = await window.soundsok.categories.add(newCategory);
        if (result && result.id) {
          newCategory.id = result.id;
        }
      }
    } catch (err) {
      console.error('[Categories] Failed to save category:', err);
    }

    this.categories.push(newCategory);
    this.render();
  }

  /* ─────────────── Remove Category ─────────────── */

  /**
   * Remove a category after confirmation.
   * @param {string} id
   */
  async removeCategory(id) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) return;

    // Simple confirmation
    const confirmed = confirm(`"${cat.name}" kategorisi silinsin mi?\nBu kategorideki sesler kaldırılmayacak.`);
    if (!confirmed) return;

    try {
      if (window.soundsok && window.soundsok.categories) {
        await window.soundsok.categories.remove(id);
      }
    } catch (err) {
      console.error('[Categories] Failed to delete category:', err);
    }

    this.categories = this.categories.filter(c => c.id !== id);

    // If the deleted category was active, revert to "all"
    if (this.activeCategory === id) {
      this.setActive(null);
    }

    this.render();
  }

  /* ─────────────── Category Context Menu ─────────────── */

  _showCategoryContextMenu(category, event) {
    // For now, use a simple approach: show native confirm for delete
    // A full custom context menu could be added later
    const action = confirm(`"${category.name}" kategorisini silmek ister misiniz?`);
    if (action) {
      this.removeCategory(category.id);
    }
  }

  /* ─────────────── Utility ─────────────── */

  /**
   * Count sounds that belong to a category.
   * @param {string|null} categoryId
   * @returns {number}
   */
  _getSoundCount(categoryId) {
    if (!window.SoundList) return 0;
    if (categoryId === null) {
      return window.SoundList.sounds.length;
    }
    return window.SoundList.sounds.filter(s => s.categoryId === categoryId).length;
  }

  /**
   * Update category counts display (call after sounds change).
   */
  updateCounts() {
    if (!this.container) return;
    this.container.querySelectorAll('.category-item').forEach(el => {
      const cid = el.dataset.categoryId;
      const count = this._getSoundCount(cid === 'all' ? null : cid);
      const countEl = el.querySelector('.category-count');
      if (countEl) countEl.textContent = count;
    });
  }

  /**
   * Generate a simple unique ID.
   * @returns {string}
   */
  _generateId() {
    return 'cat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  /**
   * Escape HTML.
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get category by ID.
   * @param {string} id
   * @returns {Object|undefined}
   */
  getCategoryById(id) {
    return this.categories.find(c => c.id === id);
  }
}


// ── Export Singleton ──
window.Categories = new CategoryManager();
