export type AudioChannel = 'sfx' | 'music';

export interface AudioEntry {
  src: string[];
  channel: AudioChannel;
  volume?: number;
  loop?: boolean;
}

export interface AudioSpriteEntry extends AudioEntry {
  sprite: Record<string, [number, number]>;
}

export function isSpriteEntry(entry: AudioEntry): entry is AudioSpriteEntry {
  return 'sprite' in entry;
}

/**
 * Parses a dot-notation sound reference.
 * - `"buttonClick"` → `{ key: "buttonClick", sprite: undefined }`
 * - `"uiSprites.buttonClick"` → `{ key: "uiSprites", sprite: "buttonClick" }`
 */
export function resolveSoundRef(ref: string): { key: SoundId; sprite?: string } {
  const dotIndex = ref.indexOf('.');
  if (dotIndex === -1) {
    return { key: ref as SoundId };
  }
  return {
    key: ref.substring(0, dotIndex) as SoundId,
    sprite: ref.substring(dotIndex + 1),
  };
}

/**
 * Central audio manifest — every sound the game can play.
 *
 * Format: WebM (Opus) primary, MP3 fallback.
 * Sprite times are [offsetMs, durationMs].
 *
 * Files are not shipped yet — entries act as typed placeholders so the
 * rest of the audio system can reference them at compile time.
 */
export const AUDIO_MANIFEST: Record<string, AudioEntry> = {
  /* ── SFX sprites ──────────────────────────────────────── */
  uiSprites: {
    src: ['assets/audio/sfx/ui-sprites.webm', 'assets/audio/sfx/ui-sprites.mp3'],
    channel: 'sfx',
    sprite: {
      buttonClick: [0, 200],
      buttonHover: [300, 150],
      toggle: [600, 250],
    },
  } as AudioSpriteEntry,

  reelSprites: {
    src: ['assets/audio/sfx/reel-sprites.webm', 'assets/audio/sfx/reel-sprites.mp3'],
    channel: 'sfx',
    sprite: {
      reelSpin: [0, 500],
      reelStop: [600, 300],
      reelAnticipation: [1000, 1500],
    },
  } as AudioSpriteEntry,

  /* ── Standalone SFX ───────────────────────────────────── */
  lowWin: {
    src: ['assets/audio/sfx/low-win.mp3'],
    channel: 'sfx',
    volume: 0.3,
  },

  h1Sfx: {
    src: ['assets/audio/sfx/h1-sfx.mp3'],
    channel: 'sfx',
    volume: 0.5,
  },

  h2Sfx: {
    src: ['assets/audio/sfx/h2-sfx.mp3'],
    channel: 'sfx',
    volume: 0.5,
  },

  heartbeatSfx: {
    src: ['assets/audio/sfx/heartbeat-sfx.mp3'],
    channel: 'sfx',
    volume: 0.5,
  },

  wildPopSfx: {
    src: ['assets/audio/sfx/wild-pop-sfx.mp3'],
    channel: 'sfx',
    volume: 0.5,
  },

  chest: {
    src: ['assets/audio/sfx/chest.mp3'],
    channel: 'sfx',
    volume: 0.9,
  },

  skull: {
    src: ['assets/audio/sfx/skull.mp3'],
    channel: 'sfx',
    volume: 0.5,
  },

  bats: {
    src: ['assets/audio/sfx/bats.mp3'],
    channel: 'sfx',
    volume: 1.5,
  },

  wolfSfx: {
    src: ['assets/audio/sfx/wolf-sfx.mp3'],
    channel: 'sfx',
    volume: 0.4,
  },

  reelFast: {
    src: ['assets/audio/sfx/reel-fast.wav'],
    channel: 'sfx',
    volume: 0.15,
    loop: true,
  },

  totalWin: {
    src: ['assets/audio/sfx/total-win.wav'],
    channel: 'sfx',
    volume: 1,
  },

  normalWin: {
    src: ['assets/audio/sfx/normal-win.wav'],
    channel: 'sfx',
    volume: 0.5,
  },

  wildWin: {
    src: ['assets/audio/sfx/wild-win.wav'],
    channel: 'sfx',
    volume: 0.5,
  },

  winChime: {
    src: ['assets/audio/sfx/win-chime.webm', 'assets/audio/sfx/win-chime.mp3'],
    channel: 'sfx',
  },

  bigWin: {
    src: ['assets/audio/sfx/big-win.webm', 'assets/audio/sfx/big-win.mp3'],
    channel: 'sfx',
    volume: 0.8,
  },

  /* ── Music ────────────────────────────────────────────── */
  baseMusic: {
    src: ['assets/audio/music/base-theme.mp3'],
    channel: 'music',
    volume: 0.4,
    loop: true,
  },

  bonusMusic: {
    src: ['assets/audio/music/bonus-theme.mp3'],
    channel: 'music',
    volume: 0.4,
    loop: true,
  },
};

/** Valid sound keys from the manifest. */
export type SoundId = keyof typeof AUDIO_MANIFEST;
