/**
 * SoundSok - Shared Application Constants
 *
 * Central configuration values used across both main and renderer processes.
 */

/** Display name of the application */
const APP_NAME = 'SoundSok';

/** SQLite database filename stored in the user data directory */
const DB_NAME = 'soundsok.db';

/** Audio file extensions accepted by the application */
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.webm'];

/** Default volume level for newly added sounds (0.0 – 1.0) */
const DEFAULT_VOLUME = 0.8;

/**
 * Playback routing modes.
 * - SPEAKERS:    output to default speakers only
 * - MICROPHONE:  route audio through the virtual microphone
 * - BOTH:        output to speakers and microphone simultaneously
 */
const PLAY_MODES = {
  SPEAKERS: 'speakers',
  MICROPHONE: 'microphone',
  BOTH: 'both',
};

module.exports = {
  APP_NAME,
  DB_NAME,
  SUPPORTED_FORMATS,
  DEFAULT_VOLUME,
  PLAY_MODES,
};
