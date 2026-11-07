import { useSyncExternalStore } from 'react';
import { storage } from './storage';

// Soft synthesized chimes (Web Audio), no audio files needed.

const KEY = 'wolfgatti:sound';
let enabled = storage.get(KEY) !== 'off';
const listeners = new Set<() => void>();

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  storage.set(KEY, on ? 'on' : 'off');
  listeners.forEach((l) => l());
  if (on) play('turn');
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers only allow audio after a user gesture; unlock on the first click or key press.
for (const event of ['pointerdown', 'keydown']) {
  window.addEventListener(event, () => void audio()?.resume(), { once: true, capture: true });
}

/** One bell-like note: sine with a soft attack and a long exponential fade. */
function note(ac: AudioContext, freq: number, at: number, length: number, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t = ac.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

const MELODIES = {
  // your turn: two rising notes (E5, B5)
  turn: [
    [659.25, 0, 0.5],
    [987.77, 0.13, 0.7],
  ],
  // round result: a gentle major arpeggio (C5, E5, G5)
  reveal: [
    [523.25, 0, 0.6],
    [659.25, 0.11, 0.6],
    [783.99, 0.22, 0.8],
  ],
  // game won: arpeggio up to the octave
  win: [
    [523.25, 0, 0.6],
    [659.25, 0.12, 0.6],
    [783.99, 0.24, 0.6],
    [1046.5, 0.36, 1.0],
  ],
  // game lost: falling minor notes (A4, F4, D4)
  lose: [
    [440, 0, 0.6],
    [349.23, 0.16, 0.6],
    [293.66, 0.32, 0.9],
  ],
} as const;

export type Sound = keyof typeof MELODIES;

export function play(sound: Sound) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  for (const [freq, at, length] of MELODIES[sound]) note(ac, freq, at, length, 0.06);
}
