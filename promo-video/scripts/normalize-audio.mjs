import { spawnSync } from 'node:child_process';
import { access, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [inputArg] = process.argv.slice(2);

if (!inputArg) {
  console.error('Usage: node scripts/normalize-audio.mjs <rendered-video.mp4>');
  process.exit(2);
}

const input = path.resolve(process.cwd(), inputArg);
const temporary = `${input}.normalized-tmp.mp4`;
const ffmpeg = path.join(projectRoot, 'node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg');

await access(input);
await access(ffmpeg);
await rm(temporary, { force: true });

const result = spawnSync(ffmpeg, [
  '-hide_banner',
  '-loglevel', 'warning',
  '-i', input,
  '-map', '0:v:0',
  '-map', '0:a:0',
  '-c:v', 'copy',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  '-y', temporary,
], { stdio: 'inherit' });

if (result.error || result.status !== 0) {
  await rm(temporary, { force: true });
  if (result.error) throw result.error;
  throw new Error(`FFmpeg audio normalization failed with exit code ${result.status}`);
}

await rename(temporary, input);
console.log(`Loudness-normalized ${path.relative(projectRoot, input)} to -16 LUFS / -1.5 dBTP target.`);
