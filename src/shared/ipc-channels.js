/**
 * SoundSok - IPC Channel Name Constants
 *
 * Every IPC message between the main and renderer processes must use one of
 * these channel names.  Centralising them here prevents typo-induced bugs
 * and makes refactoring straightforward.
 */

// ── Sound CRUD ───────────────────────────────────────────────────────────────
const SOUND_ADD    = 'sound:add';
const SOUND_REMOVE = 'sound:remove';
const SOUND_LIST   = 'sound:list';
const SOUND_UPDATE = 'sound:update';

// ── Playback Controls ────────────────────────────────────────────────────────
const PLAYBACK_PLAY   = 'playback:play';
const PLAYBACK_STOP   = 'playback:stop';
const PLAYBACK_PAUSE  = 'playback:pause';
const PLAYBACK_SEEK   = 'playback:seek';
const PLAYBACK_VOLUME = 'playback:volume';

// ── Native Dialogs ───────────────────────────────────────────────────────────
const DIALOG_OPEN_FILES   = 'dialog:open-files';
const DIALOG_SELECT_IMAGE = 'dialog:select-image';
const DIALOG_PASTE_IMAGE  = 'dialog:paste-image';

// ── Window Controls (frameless title-bar buttons) ────────────────────────────
const APP_MINIMIZE = 'app:minimize';
const APP_MAXIMIZE = 'app:maximize';
const APP_CLOSE    = 'app:close';

// ── Category CRUD ────────────────────────────────────────────────────────────
const CATEGORY_ADD    = 'category:add';
const CATEGORY_REMOVE = 'category:remove';
const CATEGORY_LIST   = 'category:list';
const CATEGORY_UPDATE = 'category:update';

// ── Hotkeys & Settings ───────────────────────────────────────────────────────
const HOTKEY_ASSIGN   = 'hotkey:assign';
const HOTKEY_CHECK    = 'hotkey:check';
const APP_TOGGLE_STARTUP = 'app:toggle-startup';
const PTT_PRESS       = 'ptt:press';
const PTT_RELEASE     = 'ptt:release';
const HOTKEY_REGISTER_STOP = 'hotkey:register-stop';
const GET_REMOTE_URL       = 'settings:get-remote-url';

module.exports = {
  SOUND_ADD,
  SOUND_REMOVE,
  SOUND_LIST,
  SOUND_UPDATE,

  PLAYBACK_PLAY,
  PLAYBACK_STOP,
  PLAYBACK_PAUSE,
  PLAYBACK_SEEK,
  PLAYBACK_VOLUME,

  DIALOG_OPEN_FILES,
  DIALOG_SELECT_IMAGE,
  DIALOG_PASTE_IMAGE,

  APP_MINIMIZE,
  APP_MAXIMIZE,
  APP_CLOSE,

  CATEGORY_ADD,
  CATEGORY_REMOVE,
  CATEGORY_LIST,
  CATEGORY_UPDATE,
  
  HOTKEY_ASSIGN,
  HOTKEY_CHECK,
  APP_TOGGLE_STARTUP,
  PTT_PRESS,
  PTT_RELEASE,
  HOTKEY_REGISTER_STOP,
  GET_REMOTE_URL,
};
