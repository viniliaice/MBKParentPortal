/*
 * A tiny, reusable sound-effect engine built on expo-audio. Framework-
 * generic — nothing here mentions toilets or Physics — any future lesson
 * (Biology, Chemistry) calls the exact same `playSound()`/`useSoundEffect()`
 * surface with its own sound name.
 *
 * IMPORTANT HONESTY NOTE (do not remove): the actual audio files under
 * assets/sounds/ are short procedurally-synthesized placeholder tones
 * (generated with Python's stdlib `wave` module — sine waves, filtered
 * noise, simple ADSR envelopes) because this sandbox has no network access
 * to license or download real recorded sound effects (flush recordings,
 * foley water sounds, etc.). They are real, valid, distinct audio cues —
 * a click, a whoosh, a chime, a buzz — and are wired up to genuinely
 * dynamic, state-driven triggers (never a fixed timer, never random), but
 * they are NOT professionally recorded sound design. Swap the files in
 * assets/sounds/ for licensed recordings whenever the team has them; every
 * call site here keys off a stable string ID and would not need to change.
 *
 * Design: expo-audio's `useAudioPlayer` hook ties a player to ONE React
 * component's lifecycle, which doesn't fit a shared cross-cutting sound
 * engine used by many unrelated components (sliders, buttons, activity
 * completions). Instead we lazily create one long-lived AudioPlayer per
 * named sound via `createAudioPlayer` and reuse it for every future play
 * of that sound (seeking to 0 first so rapid repeats — e.g. slider
 * detents — restart cleanly instead of queueing).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundId =
  | 'uiTick'
  | 'valveClick'
  | 'waterDrip'
  | 'flushWhoosh'
  | 'successChime'
  | 'discoveryPing'
  | 'mistakeBuzz'
  | 'ambientRoom';

// Static requires (Metro needs these literal, not dynamic template strings).
const SOUND_SOURCES: Record<SoundId, number> = {
  uiTick: require('@/assets/sounds/ui_tick.wav'),
  valveClick: require('@/assets/sounds/valve_click.wav'),
  waterDrip: require('@/assets/sounds/water_drip.wav'),
  flushWhoosh: require('@/assets/sounds/flush_whoosh.wav'),
  successChime: require('@/assets/sounds/success_chime.wav'),
  discoveryPing: require('@/assets/sounds/discovery_ping.wav'),
  mistakeBuzz: require('@/assets/sounds/mistake_buzz.wav'),
  ambientRoom: require('@/assets/sounds/ambient_room.wav'),
};

// Each sound gets its own sensible resting volume so quiet UI ticks don't
// compete with a success chime — set once here instead of at every call site.
const DEFAULT_VOLUME: Record<SoundId, number> = {
  uiTick: 0.35,
  valveClick: 0.7,
  waterDrip: 0.5,
  flushWhoosh: 0.55,
  successChime: 0.8,
  discoveryPing: 0.6,
  mistakeBuzz: 0.5,
  ambientRoom: 0.18,
};

let soundEnabled = true;
const players = new Map<SoundId, AudioPlayer>();
let audioModeConfigured = false;

function ensureAudioMode() {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  // Mix with other apps / silent-mode playback is appropriate for short UI
  // sound effects (never wants to interrupt a parent's music or a call).
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {
    // Non-fatal — sounds still play with platform defaults if this fails.
  });
}

function getPlayer(id: SoundId): AudioPlayer {
  let player = players.get(id);
  if (!player) {
    player = createAudioPlayer(SOUND_SOURCES[id]);
    player.volume = DEFAULT_VOLUME[id];
    players.set(id, player);
  }
  return player;
}

/** Global mute toggle — e.g. wired to a future Settings screen sound switch. */
export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  if (!enabled) {
    stopAmbient();
  }
}

export function isSoundEnabled() {
  return soundEnabled;
}

/**
 * Plays a one-shot sound effect immediately. Safe to call rapidly (e.g. on
 * every slider haptic detent) — restarts from the beginning each time
 * rather than layering overlapping copies of the same clip.
 *
 * Feedback sounds (success/mistake/discovery) get a small per-play pitch
 * wobble (+/- a few %, pitch NOT corrected so the wobble is audible) —
 * this is the fix for a real critique of the first pass: the exact same
 * chime playing dozens of times across a lesson reads as robotic/numbing.
 * A ±4% variance is small enough to still clearly read as "the same success
 * sound" while avoiding a note-for-note identical repeat every time.
 */
const VARIED_SOUNDS = new Set<SoundId>(['successChime', 'discoveryPing', 'mistakeBuzz', 'valveClick']);

export function playSound(id: SoundId, volumeOverride?: number) {
  if (!soundEnabled) return;
  ensureAudioMode();
  try {
    const player = getPlayer(id);
    player.volume = volumeOverride ?? DEFAULT_VOLUME[id];
    if (VARIED_SOUNDS.has(id)) {
      player.shouldCorrectPitch = false;
      player.playbackRate = 1 + (Math.random() * 0.08 - 0.04);
    } else {
      player.playbackRate = 1;
    }
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Audio is enhancement, never a hard dependency — a playback failure
    // (e.g. device audio session busy) must not break the lesson.
  }
}

/** Starts (or resumes) the soft looping room-tone ambient bed. */
export function playAmbient() {
  if (!soundEnabled) return;
  ensureAudioMode();
  try {
    const player = getPlayer('ambientRoom');
    player.loop = true;
    if (!player.playing) player.play();
  } catch {
    // see playSound
  }
}

export function stopAmbient() {
  const player = players.get('ambientRoom');
  if (player && player.playing) {
    try { player.pause(); } catch {}
  }
}

/**
 * Releases native players when the application root unmounts. The manager is
 * intentionally cached during a session for instant effects, but it must not
 * retain native resources beyond that session.
 */
export function disposeSoundEngine() {
  for (const player of players.values()) {
    try { player.pause(); } catch {}
    try { player.remove(); } catch {}
  }
  players.clear();
  audioModeConfigured = false;
}
