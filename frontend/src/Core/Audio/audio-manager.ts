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
  private _currentMusicInstanceId: number | undefined = undefined;
  private _activeFades: Map<Howl, Map<number | undefined, ReturnType<typeof setInterval>>> = new Map();
  private _visibilityHandler?: () => void;
  private _unlockHandlers?: { handler: () => void; events: string[] };

  /* ── Public getters ─────────────────────────────────── */

  get isMuted(): boolean {
    return this._isMuted;
  }

  get isUnlocked(): boolean {
    return this._isUnlocked;
  }

  get isMusicPlaying(): boolean {
    if (!this._currentMusic) return false;
    const howl = this._howls.get(this._currentMusic);
    return !!howl && howl.playing();
  }

  /* ── Lifecycle ──────────────────────────────────────── */

  init(): void {
    const stored = localStorage.getItem(MUTE_STORAGE_KEY);
    this._isMuted = stored === 'true';
    Howler.mute(this._isMuted);
    this._setupUnlockListener();
    this._setupVisibilityListener();
  }

  dispose(): void {
    for (const fades of this._activeFades.values()) {
      for (const interval of fades.values()) {
        clearInterval(interval);
      }
    }
    this._activeFades.clear();
    for (const howl of this._howls.values()) {
      howl.unload();
    }
    this._howls.clear();
    this._currentMusic = null;
    this._currentMusicInstanceId = undefined;
    this._pendingActions.length = 0;

    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = undefined;
    }
    if (this._unlockHandlers) {
      for (const event of this._unlockHandlers.events) {
        document.removeEventListener(event, this._unlockHandlers.handler, true);
      }
      this._unlockHandlers = undefined;
    }
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

  play(ref: string, overrideVolume?: number, rate?: number): number | undefined {
    const { key, sprite } = resolveSoundRef(ref);
    const howl = this._getOrLoad(key);
    const entry = AUDIO_MANIFEST[key];
    const entryVolume = overrideVolume ?? entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];
    const finalVolume = entryVolume * channelVolume;

    const id = sprite ? howl.play(sprite) : howl.play();
    howl.volume(finalVolume, id);
    if (rate && rate !== 1) howl.rate(rate, id);
    return id;
  }

  /** Play a sound that automatically fades out before ending. */
  playFadeOut(ref: string, fadeOutMs: number = 300, rate: number = 1): number | undefined {
    const { key, sprite } = resolveSoundRef(ref);
    const howl = this._getOrLoad(key);
    const entry = AUDIO_MANIFEST[key];
    const entryVolume = entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];
    const finalVolume = entryVolume * channelVolume;

    const id = sprite ? howl.play(sprite) : howl.play();
    howl.volume(finalVolume, id);
    if (rate !== 1) howl.rate(rate, id);

    const duration = howl.duration(id) * 1000;
    if (duration > fadeOutMs) {
      setTimeout(() => {
        this._manualFade(howl, finalVolume, 0, fadeOutMs, id, () => {
          howl.stop(id);
          howl.volume(finalVolume, id);
        });
      }, duration - fadeOutMs);
    }
    return id;
  }

  stop(ref: string, instanceId?: number): void {
    const { key } = resolveSoundRef(ref);
    const howl = this._howls.get(key);
    if (howl) {
      instanceId !== undefined ? howl.stop(instanceId) : howl.stop();
    }
  }

  fade(ref: string, from: number, to: number, durationMs: number, instanceId?: number): void {
    const { key } = resolveSoundRef(ref);
    const howl = this._howls.get(key);
    if (howl) {
      this._manualFade(howl, from, to, durationMs, instanceId);
    }
  }

  private _manualFade(howl: Howl, from: number, to: number, durationMs: number, id?: number, onComplete?: () => void): void {
    // Cancel any existing fade on this howl+id pair
    const howlFades = this._activeFades.get(howl);
    if (howlFades) {
      const existing = howlFades.get(id);
      if (existing !== undefined) {
        clearInterval(existing);
        howlFades.delete(id);
      }
    }

    const steps = 20;
    const stepMs = durationMs / steps;
    let step = 0;
    if (id !== undefined) howl.volume(from, id); else howl.volume(from);
    const interval = setInterval(() => {
      step++;
      const t = step / steps;
      const vol = from + (to - from) * t;
      if (id !== undefined) howl.volume(vol, id); else howl.volume(vol);
      if (step >= steps) {
        clearInterval(interval);
        // Remove from tracking
        const fades = this._activeFades.get(howl);
        if (fades) {
          fades.delete(id);
          if (fades.size === 0) this._activeFades.delete(howl);
        }
        if (onComplete) {
          onComplete();
        } else if (to === 0) {
          howl.stop(id);
        }
      }
    }, stepMs);

    // Track the new interval
    if (!this._activeFades.has(howl)) {
      this._activeFades.set(howl, new Map());
    }
    this._activeFades.get(howl)!.set(id, interval);
  }

  /* ── Music ──────────────────────────────────────────── */

  playMusic(key: SoundId, fadeInMs: number = 500): void {
    if (this._currentMusic === key) return;
    if (this._currentMusic) {
      this.stopMusic();
    }
    this._currentMusic = key;
    this._startMusicTrack(key, fadeInMs);
  }

  restartMusic(key: SoundId, fadeInMs: number = 500): void {
    this.stopMusic();
    this._currentMusic = key;
    this._startMusicTrack(key, fadeInMs);
  }

  private _startMusicTrack(key: SoundId, fadeInMs: number): void {
    const entry = AUDIO_MANIFEST[key];
    const entryVolume = entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];
    const targetVolume = entryVolume * channelVolume;

    const howl = this._getOrLoad(key);
    const id = howl.play();
    howl.volume(0, id);
    this._currentMusicInstanceId = id;

    if (fadeInMs <= 0) {
      howl.volume(targetVolume, id);
    } else {
      this._manualFade(howl, 0, targetVolume, fadeInMs, id);
    }
  }

  stopMusic(fadeMs?: number): void {
    if (!this._currentMusic) return;
    const howl = this._howls.get(this._currentMusic);
    const id = this._currentMusicInstanceId;
    if (howl) {
      if (fadeMs && fadeMs > 0 && id !== undefined) {
        this._manualFade(howl, howl.volume(id) as number, 0, fadeMs, id);
      } else {
        id !== undefined ? howl.stop(id) : howl.stop();
      }
    }
    this._currentMusic = null;
    this._currentMusicInstanceId = undefined;
  }

  crossFadeMusic(newKey: SoundId, durationMs: number = 1000): void {
    const oldKey = this._currentMusic;
    if (oldKey === newKey) return;

    if (oldKey) {
      const oldHowl = this._howls.get(oldKey);
      const oldId = this._currentMusicInstanceId;
      if (oldHowl && oldId !== undefined) {
        this._manualFade(oldHowl, oldHowl.volume(oldId) as number, 0, durationMs, oldId);
      }
    }

    this._currentMusic = newKey;
    this._startMusicTrack(newKey, durationMs);
  }

  /**
   * Switches to a different music track.
   * The current track is faded out and paused (keeps position).
   * The new track is resumed from its previous position, or started fresh.
   */
  switchMusic(newKey: SoundId, fadeMs: number = 1000): void {
    const oldKey = this._currentMusic;
    if (oldKey === newKey) return;

    // Fade out and pause old track (preserves position)
    if (oldKey) {
      const oldHowl = this._howls.get(oldKey);
      const oldId = this._currentMusicInstanceId;
      if (oldHowl && oldId !== undefined) {
        this._manualFade(oldHowl, oldHowl.volume(oldId) as number, 0, fadeMs, oldId, () => {
          oldHowl.pause(oldId);
        });
      }
    }

    this._currentMusic = newKey;

    // Resume or start the new track
    const entry = AUDIO_MANIFEST[newKey];
    const entryVolume = entry.volume ?? 1;
    const channelVolume = this._channelVolumes[entry.channel];
    const targetVolume = entryVolume * channelVolume;

    const howl = this._getOrLoad(newKey);
    const id = howl.play(); // resumes from paused position, or starts fresh
    howl.volume(0, id);
    this._currentMusicInstanceId = id;

    this._manualFade(howl, 0, targetVolume, fadeMs, id);
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
    };

    if (isSpriteEntry(entry)) {
      opts.sprite = entry.sprite as unknown as Record<string, [number, number] | [number, number, boolean]>;
    }

    return new Howl(opts);
  }

  private _setupVisibilityListener(): void {
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
    this._visibilityHandler = () => {
      if (document.hidden) {
        Howler.mute(true);
      } else {
        Howler.mute(this._isMuted);
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  private _setupUnlockListener(): void {
    // Remove previous unlock handlers if init() is called again
    if (this._unlockHandlers) {
      for (const event of this._unlockHandlers.events) {
        document.removeEventListener(event, this._unlockHandlers.handler, true);
      }
      this._unlockHandlers = undefined;
    }

    // Check if already unlocked (e.g. desktop with autoplay allowed)
    if (Howler.ctx && Howler.ctx.state === 'running') {
      this._onUnlock();
      return;
    }

    const events = ['click', 'touchstart', 'keydown'];
    const unlock = () => {
      this._onUnlock();
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      for (const event of events) {
        document.removeEventListener(event, unlock, true);
      }
      this._unlockHandlers = undefined;
    };

    for (const event of events) {
      document.addEventListener(event, unlock, true);
    }
    this._unlockHandlers = { handler: unlock, events };
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
