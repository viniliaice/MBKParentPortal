import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets', 'audio');
const sampleRate = 44_100;
const channels = 2;
const durationSeconds = 45;
const BPM = 85;
const beat = 60 / BPM;

await mkdir(output, { recursive: true });

function wavBuffer(left, right, sr = sampleRate) {
  const frameCount = left.length;
  const dataBytes = frameCount * channels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sr, 24);
  buffer.writeUInt32LE(sr * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < frameCount; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  return buffer;
}

const chordProgression = [
  [73.42, 146.83, 185.00, 220.00, 277.18], // Dmaj7
  [61.74, 123.47, 146.83, 185.00, 220.00], // Bm7
  [49.00, 98.00, 123.47, 146.83, 196.00],  // Gmaj7 / add9
  [55.00, 110.00, 138.59, 164.81, 220.00], // Aadd9
];
const chordLength = beat * 8;
const arpNotes = [587.33, 739.99, 880.00, 1108.73, 880.00, 739.99, 659.25, 880.00];

const left = new Float32Array(sampleRate * durationSeconds);
const right = new Float32Array(sampleRate * durationSeconds);

for (let i = 0; i < left.length; i += 1) {
  const t = i / sampleRate;
  const chordIndex = Math.floor(t / chordLength) % chordProgression.length;
  const chordPhase = (t % chordLength) / chordLength;
  const lfo = 0.78 + 0.22 * Math.sin(2 * Math.PI * t / 7.8);
  let padL = 0;
  let padR = 0;

  for (let n = 0; n < chordProgression[chordIndex].length; n += 1) {
    const f = chordProgression[chordIndex][n];
    const detune = n % 2 === 0 ? 0.997 : 1.003;
    const weight = n === 0 ? 0.33 : n === 4 ? 0.17 : 0.22;
    const phaseL = 2 * Math.PI * f * t;
    const phaseR = 2 * Math.PI * f * detune * t + 0.13;
    padL += Math.sin(phaseL) * weight;
    padR += Math.sin(phaseR) * weight;
    padL += Math.sin(phaseL * 2.005) * weight * 0.12;
    padR += Math.sin(phaseR * 1.997) * weight * 0.12;
  }

  // Sparse, glassy arpeggio on alternating eighth notes.
  const arpStep = beat / 2;
  const arpIndex = Math.floor(t / arpStep);
  const arpLocal = t - arpIndex * arpStep;
  const arpEnv = Math.exp(-arpLocal * 6.8) * Math.min(1, arpLocal / 0.012);
  const arpFrequency = arpNotes[arpIndex % arpNotes.length];
  const pan = ((arpIndex % 4) / 3) * 0.34 + 0.33;
  const pluck = (Math.sin(2 * Math.PI * arpFrequency * arpLocal) + 0.25 * Math.sin(2 * Math.PI * arpFrequency * 2.01 * arpLocal)) * arpEnv * 0.12;

  // A soft low pulse on the downbeat; no hard drum transient.
  const beatIndex = Math.floor(t / beat);
  const beatLocal = t - beatIndex * beat;
  const kickEnv = Math.exp(-beatLocal * 8) * Math.min(1, beatLocal / 0.018);
  const kick = Math.sin(2 * Math.PI * (54 + 16 * Math.exp(-beatLocal * 7)) * beatLocal) * kickEnv * (beatIndex % 4 === 0 ? 0.13 : 0.045);

  const fadeIn = Math.min(1, t / 1.5);
  const fadeOut = Math.min(1, (durationSeconds - t) / 2.0);
  const master = Math.max(0, fadeIn * fadeOut);
  left[i] = (padL * lfo * 0.054 + pluck * (1 - pan) + kick) * master;
  right[i] = (padR * lfo * 0.054 + pluck * pan + kick * 0.88) * master;
}

await writeFile(path.join(output, 'mbk-original-bed.wav'), wavBuffer(left, right));

function makeTransitionToneFile(name, duration, moments) {
  const frames = Math.round(sampleRate * duration);
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  const notePairs = [
    [523.25, 783.99],
    [587.33, 880.00],
    [659.25, 987.77],
    [493.88, 739.99],
    [587.33, 880.00],
    [659.25, 1046.5],
    [523.25, 783.99],
  ];
  for (let event = 0; event < moments.length; event += 1) {
    const start = Math.round(moments[event] * sampleRate);
    const length = Math.round(0.56 * sampleRate);
    const [low, high] = notePairs[event % notePairs.length];
    for (let j = 0; j < length; j += 1) {
      const idx = start + j;
      if (idx >= frames) break;
      const t = j / sampleRate;
      const p = j / length;
      const env = Math.pow(Math.sin(Math.PI * p), 1.45) * Math.exp(-p * 1.15);
      const sweep = 340 + 440 * p;
      const gliss = Math.sin(2 * Math.PI * sweep * t) * 0.052 + Math.sin(2 * Math.PI * high * t) * 0.028;
      const chime = Math.sin(2 * Math.PI * low * t) * 0.04 + Math.sin(2 * Math.PI * high * t) * 0.023;
      const value = (gliss + chime) * env;
      const pan = event % 2 === 0 ? 0.43 : 0.57;
      l[idx] += value * (1 - pan);
      r[idx] += value * pan;
    }
  }
  return writeFile(path.join(output, name), wavBuffer(l, r));
}

const shortDuration = 15;
await Promise.all([
  makeTransitionToneFile('mbk-transition-tones.wav', durationSeconds, [3.65, 8.62, 14.62, 20.62, 27.62, 34.62]),
  makeTransitionToneFile('mbk-transition-tones-short.wav', shortDuration, [2.28, 4.78, 7.28, 9.78, 12.28]),
]);

console.log(`Generated original, royalty-free ambient score and soft transitions (${sampleRate} Hz, stereo).`);
