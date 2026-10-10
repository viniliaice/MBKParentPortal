#!/usr/bin/env node
/**
 * Somali (Awdal) audio replacement for the MBK Parent Portal promo.
 *
 * Replaces the existing English narration with a Somali voice track while
 * leaving the rendered picture untouched. The video stream is copied
 * bit-for-bit (`-c:v copy`), so resolution, aspect ratio, frame rate,
 * branding, on-screen text, transitions and visual quality stay identical
 * to the source master.
 *
 * Nothing in `assets/audio/`, `final-promo.mp4` or `short-version.mp4` is
 * ever modified: originals are read-only inputs and every result is written
 * to `somali-dub/out/`.
 *
 * Usage
 *   node scripts/build-somali-dub.mjs long      # 41 s master
 *   node scripts/build-somali-dub.mjs short     # 15 s social cut
 *   node scripts/build-somali-dub.mjs all       # both
 *   node scripts/build-somali-dub.mjs guide     # sync proof, no voice needed
 *   node scripts/build-somali-dub.mjs measure   # timing QC report
 *
 * Voice files are expected at `assets/audio/somali/`:
 *   somali-long-01.wav … somali-long-05.wav
 *   somali-short.wav
 * A 44.1/48 kHz mono or stereo WAV is ideal; MP3 and M4A also work.
 *
 * Environment
 *   FFMPEG_PATH   override the ffmpeg location (default: Remotion's bundled
 *                 binary, then PATH).
 *   VOICE_DIR     override the folder the voice clips are read from (default:
 *                 assets/audio/somali/).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const somaliAudioDir = process.env.VOICE_DIR
  ? path.resolve(process.env.VOICE_DIR)
  : path.join(projectRoot, 'assets', 'audio', 'somali');
const outDir = path.join(projectRoot, 'somali-dub', 'out');

/* ---------------------------------------------------------------- config */

/** Mirrors LONG_STORY / SHORT_STORY and LONG_VOICE_SEGMENTS in remotion/content.ts. */
const CUTS = {
  long: {
    source: path.join(projectRoot, 'final-promo.mp4'),
    duration: 41.1,
    bed: 'assets/audio/mbk-original-bed.wav',
    tones: 'assets/audio/mbk-transition-tones.wav',
    output: 'final-promo-somali-awdal.mp4',
    narration: 'somali-dub/final-promo-somali-awdal.m4a',
    segments: [
      { id: 1, from: 0, voice: 'somali-long-01.wav', next: 12 },
      { id: 2, from: 12, voice: 'somali-long-02.wav', next: 21 },
      { id: 3, from: 21, voice: 'somali-long-03.wav', next: 28 },
      { id: 4, from: 28, voice: 'somali-long-04.wav', next: 35 },
      { id: 5, from: 35, voice: 'somali-long-05.wav', next: 41.1 },
    ],
  },
  short: {
    source: path.join(projectRoot, 'short-version.mp4'),
    duration: 15.1,
    bed: 'assets/audio/mbk-original-bed.wav',
    tones: 'assets/audio/mbk-transition-tones-short.wav',
    output: 'short-version-somali-awdal.mp4',
    narration: 'somali-dub/short-version-somali-awdal.m4a',
    segments: [{ id: 1, from: 0, voice: 'somali-short.wav', next: 15.1 }],
  },
};

/** Music levels reproduce the Remotion mix exactly (see remotion/PromoVideo.tsx). */
const LEVELS = { bed: 0.18, tones: 0.34, voice: 1.0 };

/** Voice rides above the music; the music ducks underneath the voice. */
const DUCK = { threshold: 0.035, ratio: 7, attack: 12, release: 320, makeup: 1.1 };

const LOUDNORM = { I: -16, TP: -1.5, LRA: 11 };
const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_BITRATE = '192k';

/* ---------------------------------------------------------------- helpers */

function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const bundled = path.join(projectRoot, 'node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg');
  if (existsSync(bundled)) return bundled;
  return 'ffmpeg'; // fall back to PATH (e.g. the sandbox ffmpeg)
}

function ffmpeg(args) {
  const result = spawnSync(resolveFfmpeg(), args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, text: (result.stderr || '') + (result.stdout || '') };
}

function run(args, label) {
  const { status, text } = ffmpeg(args);
  if (status !== 0) throw new Error(`${label} failed (exit ${status}):\n${text}`);
  return text;
}

function parseDuration(text) {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** `ffmpeg -i` exits non-zero on a bare probe, so read the text rather than the status. */
function durationOf(file) {
  const parsed = parseDuration(ffmpeg(['-hide_banner', '-i', file]).text);
  if (parsed == null) throw new Error(`Could not read the duration of ${file}`);
  return parsed;
}

function loudnessOf(file) {
  const { text } = ffmpeg([
    '-hide_banner', '-nostats', '-i', file, '-map', '0:a:0',
    '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-',
  ]);
  const i = /\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS/.exec(text);
  const lra = /\bLRA:\s*(-?\d+(?:\.\d+)?)\s*LU/.exec(text);
  const tp = /Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/.exec(text);
  return {
    integratedLufs: i ? Number(i[1]) : null,
    loudnessRangeLu: lra ? Number(lra[1]) : null,
    truePeakDbfs: tp ? Number(tp[1]) : null,
  };
}

/** Pass 1 of EBU R128 mastering: measure the premix so pass 2 can stay linear. */
function measureLoudnorm(file) {
  const { text } = ffmpeg([
    '-hide_banner', '-nostats', '-i', file, '-map', '0:a:0',
    '-af', `loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA}:print_format=json`,
    '-f', 'null', '-',
  ]);
  const json = /\{[\s\S]*"input_i"[\s\S]*\}/.exec(text);
  if (!json) throw new Error(`loudnorm measurement produced no JSON for ${file}`);
  return JSON.parse(json[0]);
}

function exists(file) {
  return existsSync(file);
}

/* --------------------------------------------------------------------- QC */

function measure(cutName) {
  const cut = CUTS[cutName];
  const rows = [];
  let allOk = true;

  for (const segment of cut.segments) {
    const file = path.join(somaliAudioDir, segment.voice);
    const budget = segment.next - segment.from;
    if (!exists(file)) {
      rows.push(`  line ${segment.id}  in ${segment.from.toFixed(2)}s  budget ${budget.toFixed(2)}s   MISSING  ${segment.voice}`);
      allOk = false;
      continue;
    }
    const clipDuration = durationOf(file);
    const end = segment.from + clipDuration;
    const ok = end <= segment.next + 0.001;
    if (!ok) allOk = false;
    rows.push(
      `  line ${segment.id}  in ${segment.from.toFixed(2)}s  budget ${budget.toFixed(2)}s   actual ${clipDuration.toFixed(2)}s` +
        `  ends ${end.toFixed(2)}s  ${ok ? 'OK' : `RUNS ${(end - segment.next).toFixed(2)}s INTO THE NEXT BEAT`}`,
    );
  }

  console.log(`\nSomali dub timing QC — ${cutName} cut (source master ${durationOf(cut.source).toFixed(2)}s)`);
  console.log(rows.join('\n'));
  console.log(
    allOk
      ? '\n  Result: every line lands inside its own scene beat.\n'
      : '\n  Result: shorten the copy or re-record the flagged line(s) before publishing.\n',
  );
  return allOk;
}

/* ------------------------------------------------------------------ build */

/**
 * Voice + music premix. `base` is the input index of the music bed, so the
 * same graph works whether or not a video input precedes the audio inputs.
 */
function buildFiltergraph(cut, base = 0) {
  const count = cut.segments.length;
  const f = [];

  // Music: the original procedural bed + transition tones at documented levels.
  f.push(`[${base}:a]volume=${LEVELS.bed}[bed]`);
  f.push(`[${base + 1}:a]volume=${LEVELS.tones}[tones]`);
  f.push('[bed][tones]amix=inputs=2:duration=longest:normalize=0[musicRaw]');
  f.push(`[musicRaw]atrim=0:${cut.duration},asetpts=PTS-STARTPTS[music]`);

  // Voice: each Somali line pinned to its scene beat, then padded to full length.
  const voiceLabels = cut.segments.map((segment, index) => {
    const ms = Math.round(segment.from * 1000);
    f.push(
      `[${base + 2 + index}:a]aformat=sample_rates=${AUDIO_SAMPLE_RATE}:channel_layouts=stereo,` +
        `adelay=${ms}|${ms},volume=${LEVELS.voice}[v${index}]`,
    );
    return `[v${index}]`;
  });
  f.push(`${voiceLabels.join('')}amix=inputs=${count}:duration=longest:normalize=0[voiceRaw]`);
  f.push(`[voiceRaw]apad=whole_dur=${cut.duration},atrim=0:${cut.duration},asetpts=PTS-STARTPTS[voice]`);

  // Ducking keeps the narration clear and prominent above the music.
  f.push('[voice]asplit=2[voiceOut][voiceKey]');
  f.push(
    `[music][voiceKey]sidechaincompress=threshold=${DUCK.threshold}:ratio=${DUCK.ratio}` +
      `:attack=${DUCK.attack}:release=${DUCK.release}:makeup=${DUCK.makeup}[musicDucked]`,
  );

  f.push('[voiceOut][musicDucked]amix=inputs=2:duration=longest:normalize=0[preMaster]');
  return f.join(';');
}

async function build(cutName, { guide = false } = {}) {
  const cut = CUTS[cutName];
  await mkdir(outDir, { recursive: true });
  await mkdir(path.dirname(path.join(projectRoot, cut.narration)), { recursive: true });

  const voiceArgs = [];
  if (guide) {
    for (let i = 0; i < cut.segments.length; i += 1) {
      voiceArgs.push('-f', 'lavfi', '-t', '0.45', '-i', `sine=frequency=660:sample_rate=${AUDIO_SAMPLE_RATE}`);
    }
  } else {
    const missing = cut.segments.map((s) => s.voice).filter((v) => !exists(path.join(somaliAudioDir, v)));
    if (missing.length) {
      throw new Error(
        `Missing Somali voice file(s) in assets/audio/somali/: ${missing.join(', ')}\n` +
          `Run "node scripts/build-somali-dub.mjs guide" for a voice-free sync proof,\n` +
          `or place the recordings and re-run.`,
      );
    }
    for (const segment of cut.segments) {
      voiceArgs.push('-i', path.join(somaliAudioDir, segment.voice));
    }
  }

  const filtergraph = buildFiltergraph(cut, 0);
  // Guide builds are sync proofs, not deliverables: give them unmistakable
  // names so they can never be mistaken for the finished Somali cut.
  const suffix = guide ? '-GUIDE-PROOF' : '';
  const videoOut = path.join(outDir, cut.output.replace(/\.mp4$/, `${suffix}.mp4`));
  const narrationOut = path.join(projectRoot, cut.narration.replace(/\.m4a$/, `${suffix}.m4a`));
  const premixWav = path.join(outDir, `premix-${cutName}${suffix.toLowerCase()}.wav`);
  await rm(premixWav, { force: true });

  // 1. Voice + ducked music premix, unmastered, at full float-ish resolution.
  run(
    [
      '-hide_banner',
      '-i', path.join(projectRoot, cut.bed),
      '-i', path.join(projectRoot, cut.tones),
      ...voiceArgs,
      '-filter_complex', filtergraph,
      '-map', '[preMaster]',
      '-c:a', 'pcm_s24le',
      '-ar', String(AUDIO_SAMPLE_RATE),
      '-y', premixWav,
    ],
    'premix',
  );

  // 2. EBU R128 pass 1: measure, so pass 2 can apply linear gain instead of
  //    dynamic normalisation. This keeps the vocal dynamics natural.
  const measured = measureLoudnorm(premixWav);
  const linear = measured.input_i !== '-inf' && String(measured.input_i) !== '-inf';
  const loudnormPass2 = linear
    ? `loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA}` +
      `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}:linear=true`
    : `loudnorm=I=${LOUDNORM.I}:TP=${LOUDNORM.TP}:LRA=${LOUDNORM.LRA}`;

  // 3. Master the stem and encode it as the standalone audio deliverable.
  run(
    [
      '-hide_banner',
      '-i', premixWav,
      '-af', `${loudnormPass2},alimiter=limit=0.944:level=false,aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0`,
      '-c:a', 'aac',
      '-b:a', AUDIO_BITRATE,
      '-ar', String(AUDIO_SAMPLE_RATE),
      '-movflags', '+faststart',
      '-y', narrationOut,
    ],
    'narration stem',
  );

  // 4. Mux the new audio onto a bit-exact copy of the original picture.
  run(
    [
      '-hide_banner',
      '-i', cut.source,
      '-i', narrationOut,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      // No -shortest: the source masters carry a video stream of 40.93 s and an
      // audio stream of 41.10 s, and that relationship is preserved on purpose.
      '-y', videoOut,
    ],
    'final mux',
  );

  await rm(premixWav, { force: true });

  const sourceLoudness = loudnessOf(cut.source);
  const outputLoudness = loudnessOf(videoOut);
  const sourceDuration = durationOf(cut.source);
  const outputDuration = durationOf(videoOut);

  const report = {
    cut: cutName,
    mode: guide ? 'guide (sync proof, no voice)' : 'somali voiceover',
    source: path.relative(projectRoot, cut.source),
    video: path.relative(projectRoot, videoOut),
    narration: path.relative(projectRoot, narrationOut),
    sourceDurationSeconds: Number(sourceDuration.toFixed(3)),
    outputDurationSeconds: Number(outputDuration.toFixed(3)),
    videoStream: 'copied bit-for-bit (-c:v copy)',
    audioSpec: `aac, ${AUDIO_SAMPLE_RATE / 1000} kHz, stereo, ${AUDIO_BITRATE}`,
    loudnessTarget: `${LOUDNORM.I} LUFS / ${LOUDNORM.TP} dBTP / LRA ${LOUDNORM.LRA}`,
    loudnessMethod: linear ? 'EBU R128 two-pass, linear gain (dynamics preserved)' : 'EBU R128 single-pass',
    sourceLoudness,
    outputLoudness,
    lines: cut.segments.map((segment) => ({
      id: segment.id,
      startsAtSeconds: segment.from,
      sceneBeatEndsAtSeconds: segment.next,
      file: guide ? 'guide tone' : segment.voice,
    })),
  };

  await writeFile(path.join(outDir, `dub-report-${cutName}${suffix.toLowerCase()}.json`), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n  Built        ${report.video}`);
  console.log(`  Narration    ${report.narration}`);
  console.log(`  Duration     ${report.sourceDurationSeconds}s -> ${report.outputDurationSeconds}s`);
  console.log(
    `  Loudness     source ${sourceLoudness.integratedLufs} LUFS / TP ${sourceLoudness.truePeakDbfs} dBFS` +
      `  ->  output ${outputLoudness.integratedLufs} LUFS / TP ${outputLoudness.truePeakDbfs} dBFS`,
  );
  console.log(`  Mastering    ${report.loudnessMethod}`);
  console.log('  Video        copied bit-for-bit; only the audio track was replaced.\n');
  return report;
}

/* -------------------------------------------------------------------- cli */

const mode = (process.argv[2] || 'long').toLowerCase();

try {
  if (mode === 'measure') {
    const okLong = measure('long');
    const okShort = measure('short');
    process.exitCode = okLong && okShort ? 0 : 1;
  } else if (mode === 'guide') {
    await build('long', { guide: true });
    await build('short', { guide: true });
  } else if (mode === 'all') {
    await build('long');
    await build('short');
  } else if (mode === 'long' || mode === 'short') {
    await build(mode);
  } else {
    console.error('Usage: node scripts/build-somali-dub.mjs [long|short|all|guide|measure]');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exitCode = 1;
}
