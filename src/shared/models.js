/**
 * SoundSok - Data Model Definitions
 *
 * This module contains JSDoc type definitions for the core data structures
 * used throughout the application.  It exports no runtime values; import it
 * only for IDE autocompletion and documentation purposes.
 *
 *   const Types = require('./models');  // enables @type {Types.SoundItem}
 */

/**
 * A single sound entry stored in the database.
 *
 * @typedef {Object} SoundItem
 * @property {number}      id         - Auto-incrementing primary key.
 * @property {string}      name       - Human-readable display name.
 * @property {string}      filePath   - Absolute path to the audio file on disk.
 * @property {number}      volume     - Per-sound volume multiplier (0.0 – 1.0).
 * @property {number|null} category_id - Foreign key to the categories table, or null.
 * @property {string|null} hotkey     - Keyboard shortcut string (e.g. "Ctrl+Shift+1"), or null.
 * @property {string}      playMode   - One of PLAY_MODES values ('speakers' | 'microphone' | 'both').
 * @property {number}      sortOrder  - Position index for manual ordering within a list.
 * @property {string}      createdAt  - ISO-8601 timestamp of when the sound was added.
 * @property {number}      duration   - Duration of the audio file in seconds (0 if unknown).
 */

/**
 * A category used to group related sounds.
 *
 * @typedef {Object} Category
 * @property {number} id        - Auto-incrementing primary key.
 * @property {string} name      - Category display name.
 * @property {string} color     - Hex colour code for UI presentation (e.g. '#8b5cf6').
 * @property {string} icon      - Emoji or icon identifier shown alongside the name.
 * @property {number} sortOrder - Position index for manual ordering of categories.
 */

module.exports = {};
