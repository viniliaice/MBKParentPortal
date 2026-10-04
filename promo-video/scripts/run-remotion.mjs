import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sparticuzChromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.join(projectRoot, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');
await inflate(archive);
setupLambdaEnvironment('/tmp/al2023/lib');
const executablePath = await sparticuzChromium.executablePath();

const userArgs = process.argv.slice(2);
if (userArgs.length === 0) {
  console.error('Usage: node scripts/run-remotion.mjs <studio|render|still> ...');
  process.exit(2);
}

const remotionCli = path.join(projectRoot, 'node_modules/@remotion/cli/remotion-cli.js');
const args = [
  remotionCli,
  ...userArgs,
  '--public-dir', 'assets',
  '--browser-executable', executablePath,
];

const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});
child.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
