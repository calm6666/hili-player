/**
 * dashjs stub module for testing
 * The real dashjs is not installed; this stub allows Vite to resolve the import.
 * Tests override this with vi.mock() for specific behavior.
 */
export class MediaPlayer {
  static create() {
    return new MediaPlayer();
  }
  initialize() {}
  attachView() {}
  setAutoPlay() {}
  getDuration() { return 0; }
  destroy() {}
}
export default MediaPlayer;
