import { Howl, Howler, type HowlOptions } from 'howler';
import {
  AUDIO_MANIFEST,
  isSpriteEntry,
  resolveSoundRef,
  type AudioChannel,
  type SoundId,
} from './audio-manifest';

const MUTE_STORAGE_KEY = 'slot_audio_muted';

class AudioManagerClass {
  private _howls: Map<SoundId, Howl> = new Map();
  private _channelVolumes: Record<AudioChannel, number> = { sfx: 1, music: 0.6 };
  private _isMuted: boolean = false;
  private _isUnlocked: boolean = false;
  private _pendingActions: Array<() => void> = [];
  private _currentMusic: SoundId | null = null;

  /* ── Public getters ─────────────────────────────────── */

  get isMuted(): boolean {
    return this._isMuted;
  }

  get isUnlocked(): boolean {
    return this._isUnlocked;
  }

  /* ── Lifecycle ──────────────────────────────────────── */

  init(): void {
    const stored = localStorage.getItem(MUTE_STORAGE_KEY);
    this._isMuted = stored === 'true';
    Howler.mute(this._isMuted);
    this._setupUnlockListener();
  }

  dispose(): void {
    for (const howl of this._howls.values()) {
      howl.unload();
    }
    this._howls.clear();
    this._currentMusic = null;
    this._pendingActions.length = 0;
  }

  /* ── Preloading ─────────────────────────────────────── */

  preload(keys: SoundId[]): Promise<void> {
    const promises = keys.map((key) => this._loadSound(key));
    return Promise.all(promises).then(() => undefined);
  }

  preloadAll(): Promise<void> {
    const keys = Object.keys(AUDIO_MANIFEST) as SoundId[];
    return this.preload(keys);
  }

  /* ── Playback ───────────────────────────────────────── */

  play(ref: string, overrideVolume?: number): number | undefined {
    const { key, sprite } = resolveSoundRef(ref);
    const howl = this._getOrLoad(key);
    const entry = AUDIO_MANIFEST[key];
    const entryVolume = overrideVolume ?? entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];
    const finalVolume = entryVolume * channelVolume;

    if (sprite) {
      const id = howl.play(sprite);
      howl.volume(finalVolume, id);
      return id;
    }

    const id = howl.play();
    howl.volume(finalVolume, id);
    return id;
  }

  stop(ref: string, instanceId?: number): void {
    const { key } = resolveSoundRef(ref);
    const howl = this._howls.get(key);
    if (howl) {
      instanceId !== undefined ? howl.stop(instanceId) : howl.stop();
    }
  }

  fade(ref: string, from: number, to: number, durationMs: number): void {
    const { key } = resolveSoundRef(ref);
    const howl = this._howls.get(key);
    if (howl) {
      howl.fade(from, to, durationMs);
    }
  }

  /* ── Music ──────────────────────────────────────────── */

  playMusic(key: SoundId): void {
    if (this._currentMusic === key) return;
    if (this._currentMusic) {
      this.stopMusic();
    }
    this._currentMusic = key;
    this.play(key);
  }

  stopMusic(fadeMs?: number): void {
    if (!this._currentMusic) return;
    const howl = this._howls.get(this._currentMusic);
    if (howl) {
      if (fadeMs && fadeMs > 0) {
        howl.fade(howl.volume() as number, 0, fadeMs);
        howl.once('fade', () => howl.stop());
      } else {
        howl.stop();
      }
    }
    this._currentMusic = null;
  }

  crossFadeMusic(newKey: SoundId, durationMs: number = 1000): void {
    const oldKey = this._currentMusic;
    if (oldKey === newKey) return;

    // Fade out old track
    if (oldKey) {
      const oldHowl = this._howls.get(oldKey);
      if (oldHowl) {
        oldHowl.fade(oldHowl.volume() as number, 0, durationMs);
        oldHowl.once('fade', () => oldHowl.stop());
      }
    }

    // Start new track at zero, fade up
    this._currentMusic = newKey;
    const entry = AUDIO_MANIFEST[newKey];
    const entryVolume = entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];
    const targetVolume = entryVolume * channelVolume;

    const howl = this._getOrLoad(newKey);
    const id = howl.play();
    howl.volume(0, id);
    howl.fade(0, targetVolume, durationMs, id);
  }

  /* ── Mute ───────────────────────────────────────────── */

  setMuted(muted: boolean): void {
    this._isMuted = muted;
    Howler.mute(muted);
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  }

  toggleMute(): boolean {
    this.setMuted(!this._isMuted);
    return this._isMuted;
  }

  /* ── Channel volume ─────────────────────────────────── */

  setChannelVolume(channel: AudioChannel, volume: number): void {
    this._channelVolumes[channel] = Math.max(0, Math.min(1, volume));
  }

  getChannelVolume(channel: AudioChannel): number {
    return this._channelVolumes[channel];
  }

  /* ── Unlock helper ──────────────────────────────────── */

  whenUnlocked(action: () => void): void {
    if (this._isUnlocked) {
      action();
    } else {
      this._pendingActions.push(action);
    }
  }

  /* ── Internals ──────────────────────────────────────── */

  private _getOrLoad(key: SoundId): Howl {
    let howl = this._howls.get(key);
    if (!howl) {
      howl = this._createHowl(key);
      this._howls.set(key, howl);
    }
    return howl;
  }

  private _loadSound(key: SoundId): Promise<void> {
    if (this._howls.has(key)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const howl = this._createHowl(key);
      howl.once('load', () => resolve());
      howl.once('loaderror', (_id, err) => {
        console.warn(`[AudioManager] Failed to load "${key}":`, err);
        resolve(); // resolve anyway — missing audio should not block the game
      });
      this._howls.set(key, howl);
    });
  }

  private _createHowl(key: SoundId): Howl {
    const entry = AUDIO_MANIFEST[key];
    const isMusic = entry.channel === 'music';
    const loop = entry.loop ?? isMusic;
    const entryVolume = entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];

    const opts: HowlOptions = {
      src: [...entry.src],
      volume: entryVolume * channelVolume,
      loop,
      preload: true,
      html5: isMusic, // stream music via HTML5 Audio to save memory
    };

    if (isSpriteEntry(entry)) {
      opts.sprite = entry.sprite as unknown as Record<string, [number, number] | [number, number, boolean]>;
    }

    return new Howl(opts);
  }

  private _setupUnlockListener(): void {
    // Check if already unlocked (e.g. desktop with autoplay allowed)
    if (Howler.ctx && Howler.ctx.state === 'running') {
      this._onUnlock();
      return;
    }

    const unlock = () => {
      // Resume suspended AudioContext
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume().then(() => this._onUnlock());
      } else {
        this._onUnlock();
      }
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };

    document.addEventListener('click', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  private _onUnlock(): void {
    if (this._isUnlocked) return;
    this._isUnlocked = true;
    for (const action of this._pendingActions) {
      action();
    }
    this._pendingActions.length = 0;
  }
}

export const AudioManager = new AudioManagerClass();
