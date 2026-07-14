/**
 * SoundSok - Database Layer
 *
 * Manages the SQLite database via better-sqlite3.  The database file is stored
 * inside Electron's `userData` directory so it persists across app updates.
 *
 * Usage:
 *   const Database = require('./database');
 *   const db = new Database();
 *   db.init();
 */

const path = require('path');
const { app } = require('electron');
const BetterSqlite3 = require('better-sqlite3');
const { DB_NAME, DEFAULT_VOLUME } = require('../shared/constants');

class Database {
  constructor() {
    /** @type {import('better-sqlite3').Database | null} */
    this.db = null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Open the database connection and create tables if they don't exist.
   * Enables WAL mode for better concurrent-read performance.
   */
  init() {
    const dbPath = path.join(app.getPath('userData'), DB_NAME);
    this.db = new BetterSqlite3(dbPath);

    // Enable WAL journal mode for improved read performance
    this.db.pragma('journal_mode = WAL');

    // Enable foreign key enforcement
    this.db.pragma('foreign_keys = ON');

    this._createTables();
  }

  /**
   * Gracefully close the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ── Table Creation ───────────────────────────────────────────────────────

  /** @private */
  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        color       TEXT    DEFAULT '#8b5cf6',
        icon        TEXT    DEFAULT '📁',
        sort_order  INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sounds (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        file_path   TEXT    NOT NULL UNIQUE,
        volume      REAL    DEFAULT ${DEFAULT_VOLUME},
        category_id INTEGER,
        hotkey      TEXT,
        play_mode   TEXT    DEFAULT 'speakers',
        sort_order  INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
        duration    REAL    DEFAULT 0,
        hotbar_slot INTEGER,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
    `);

    // Migration for existing database installations
    try {
      this.db.exec('ALTER TABLE sounds ADD COLUMN hotbar_slot INTEGER');
    } catch (e) {
      // Column already exists, safe to ignore
    }

    try {
      this.db.exec('ALTER TABLE sounds ADD COLUMN volume REAL DEFAULT 0.8');
    } catch (e) {
      // Column already exists, safe to ignore
    }
  }

  // ── Sound Methods ────────────────────────────────────────────────────────

  /**
   * Insert a new sound into the database.
   *
   * @param {Object} sound
   * @param {string} sound.name       - Display name for the sound.
   * @param {string} sound.filePath   - Absolute path to the audio file.
   * @param {number} [sound.volume]   - Volume level (0.0 – 1.0).
   * @param {number|null} [sound.category_id] - Optional category FK.
   * @param {string|null} [sound.hotkey]      - Optional hotkey binding.
   * @param {string} [sound.playMode]         - Playback routing mode.
   * @param {number} [sound.sortOrder]        - Sort position.
   * @param {number} [sound.duration]         - Audio duration in seconds.
   * @returns {Object} The newly created sound row.
   */
  addSound(sound) {
    const stmt = this.db.prepare(`
      INSERT INTO sounds (name, file_path, volume, category_id, hotkey, play_mode, sort_order, duration, hotbar_slot)
      VALUES (@name, @filePath, @volume, @categoryId, @hotkey, @playMode, @sortOrder, @duration, @hotbarSlot)
    `);

    const info = stmt.run({
      name: sound.name,
      filePath: sound.filePath,
      volume: sound.volume ?? DEFAULT_VOLUME,
      categoryId: sound.category_id ?? null,
      hotkey: sound.hotkey ?? null,
      playMode: sound.playMode ?? 'speakers',
      sortOrder: sound.sortOrder ?? 0,
      duration: sound.duration ?? 0,
      hotbarSlot: sound.hotbarSlot ?? null,
    });

    return this.getSoundById(info.lastInsertRowid);
  }

  /**
   * Delete a sound by its primary key.
   *
   * @param {number} id
   * @returns {{ deleted: boolean }} Whether a row was actually removed.
   */
  removeSound(id) {
    const stmt = this.db.prepare('DELETE FROM sounds WHERE id = ?');
    const info = stmt.run(id);
    return { deleted: info.changes > 0 };
  }

  /**
   * Retrieve every sound, ordered by sort_order then by creation date.
   *
   * @returns {Object[]} Array of sound objects with camelCase keys.
   */
  getAllSounds() {
    const stmt = this.db.prepare(
      'SELECT * FROM sounds ORDER BY sort_order ASC, created_at ASC'
    );
    return stmt.all().map(this._mapSoundRow);
  }

  /**
   * Fetch a single sound by its primary key.
   *
   * @param {number} id
   * @returns {Object|null}
   */
  getSoundById(id) {
    const stmt = this.db.prepare('SELECT * FROM sounds WHERE id = ?');
    const row = stmt.get(id);
    return row ? this._mapSoundRow(row) : null;
  }

  /**
   * Update one or more fields on an existing sound.
   *
   * @param {number} id        - Sound primary key.
   * @param {Object} data      - Key/value pairs to update.  Keys must use
   *                             camelCase (e.g. `playMode`); they are mapped
   *                             to the corresponding snake_case columns.
   * @returns {Object|null}    The updated sound, or null if the id was not found.
   */
  updateSound(id, data) {
    const allowedFields = {
      name: 'name',
      filePath: 'file_path',
      volume: 'volume',
      category_id: 'category_id',
      categoryId: 'category_id',
      hotkey: 'hotkey',
      playMode: 'play_mode',
      sortOrder: 'sort_order',
      duration: 'duration',
      hotbarSlot: 'hotbar_slot',
    };

    const setClauses = [];
    const values = {};

    for (const [camel, column] of Object.entries(allowedFields)) {
      if (camel in data) {
        setClauses.push(`${column} = @${camel}`);
        values[camel] = data[camel];
      }
    }

    if (setClauses.length === 0) {
      return this.getSoundById(id);
    }

    values.id = id;
    const stmt = this.db.prepare(
      `UPDATE sounds SET ${setClauses.join(', ')} WHERE id = @id`
    );
    stmt.run(values);

    return this.getSoundById(id);
  }

  /**
   * Retrieve all sounds belonging to a specific category.
   *
   * @param {number} categoryId
   * @returns {Object[]}
   */
  getSoundsByCategory(categoryId) {
    const stmt = this.db.prepare(
      'SELECT * FROM sounds WHERE category_id = ? ORDER BY sort_order ASC, created_at ASC'
    );
    return stmt.all(categoryId).map(this._mapSoundRow);
  }

  // ── Category Methods ─────────────────────────────────────────────────────

  /**
   * Insert a new category.
   *
   * @param {Object} category
   * @param {string} category.name
   * @param {string} [category.color]
   * @param {string} [category.icon]
   * @param {number} [category.sortOrder]
   * @returns {Object} The newly created category row.
   */
  addCategory(category) {
    const stmt = this.db.prepare(`
      INSERT INTO categories (name, color, icon, sort_order)
      VALUES (@name, @color, @icon, @sortOrder)
    `);

    const info = stmt.run({
      name: category.name,
      color: category.color ?? '#8b5cf6',
      icon: category.icon ?? '📁',
      sortOrder: category.sortOrder ?? 0,
    });

    return this.getCategoryById(info.lastInsertRowid);
  }

  /**
   * Delete a category by its primary key.
   * Sounds referencing this category will have their category_id set to NULL
   * (enforced by the ON DELETE SET NULL foreign key constraint).
   *
   * @param {number} id
   * @returns {{ deleted: boolean }}
   */
  removeCategory(id) {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    const info = stmt.run(id);
    return { deleted: info.changes > 0 };
  }

  /**
   * Retrieve all categories ordered by sort_order.
   *
   * @returns {Object[]}
   */
  getAllCategories() {
    const stmt = this.db.prepare(
      'SELECT * FROM categories ORDER BY sort_order ASC'
    );
    return stmt.all().map(this._mapCategoryRow);
  }

  /**
   * Fetch a single category by its primary key.
   *
   * @param {number} id
   * @returns {Object|null}
   */
  getCategoryById(id) {
    const stmt = this.db.prepare('SELECT * FROM categories WHERE id = ?');
    const row = stmt.get(id);
    return row ? this._mapCategoryRow(row) : null;
  }

  /**
   * Update one or more fields on an existing category.
   *
   * @param {number} id
   * @param {Object} data - Fields to update (camelCase keys).
   * @returns {Object|null}
   */
  updateCategory(id, data) {
    const allowedFields = {
      name: 'name',
      color: 'color',
      icon: 'icon',
      sortOrder: 'sort_order',
    };

    const setClauses = [];
    const values = {};

    for (const [camel, column] of Object.entries(allowedFields)) {
      if (camel in data) {
        setClauses.push(`${column} = @${camel}`);
        values[camel] = data[camel];
      }
    }

    if (setClauses.length === 0) {
      return this.getCategoryById(id);
    }

    values.id = id;
    const stmt = this.db.prepare(
      `UPDATE categories SET ${setClauses.join(', ')} WHERE id = @id`
    );
    stmt.run(values);

    return this.getCategoryById(id);
  }

  // ── Row Mappers ──────────────────────────────────────────────────────────

  /**
   * Convert a raw SQLite sound row (snake_case) into a camelCase object.
   * @private
   */
  _mapSoundRow(row) {
    return {
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      volume: row.volume,
      categoryId: row.category_id,
      hotkey: row.hotkey,
      playMode: row.play_mode,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      duration: row.duration,
      hotbarSlot: row.hotbar_slot,
    };
  }

  /**
   * Convert a raw SQLite category row (snake_case) into a camelCase object.
   * @private
   */
  _mapCategoryRow(row) {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      sortOrder: row.sort_order,
    };
  }
}

module.exports = Database;
