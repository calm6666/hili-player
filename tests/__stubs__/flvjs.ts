/**
 * flv.js stub module for testing
 * The real flv.js is not installed; this stub allows Vite to resolve the import.
 * Tests override this with vi.mock() for specific behavior.
 */
export default {
  createPlayer() {
    return {
      attachMediaElement() {},
      load() {},
      play() {},
      pause() {},
      unload() {},
      detachMediaElement() {},
      destroy() {},
      on() {},
      off() {},
      statisticsInfo: { speed: 0, decodedFrames: 0, droppedFrames: 0 },
    };
  },
  isSupported() { return true; },
  Events: {
    ERROR: 'error',
    LOADING_COMPLETE: 'loading_complete',
    STATISTICS_INFO: 'statistics_info',
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
  },
};
