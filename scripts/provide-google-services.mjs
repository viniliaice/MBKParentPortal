#!/usr/bin/env node
/**
 * EAS Build pre-install hook: supply and verify `google-services.json`.
 *
 * Wired via `eas-build-pre-install` in package.json, which EAS Build runs
 * before installing dependencies. It does nothing on a developer machine
 * except when invoked directly.
 *
 * Why this exists: `google-services.json` is git-ignored (it holds API keys),
 * but `app.json` points at it and the Google Services Gradle plugin fails the
 * Android build when it is missing or names another package. There are two
 * supported ways to supply it, in order of preference:
 *
 *   1. Local file — running `eas build` from a machine that has the file at
 *      the project root. `.easignore` carries a `!google-services.json` entry
 *      so the upload includes it. Remote-triggered builds (dashboard, GitHub
 *      trigger) have no local file, which is why path 2 exists.
 *   2. EAS secret — a project secret named `GOOGLE_SERVICES_JSON` holding the
 *      file's JSON (string secret), its base64 (`GOOGLE_SERVICES_JSON_BASE64`),
 *      or, for a file secret, the path EAS wrote it to. This hook writes it to
 *      the path `app.json` expects.
 *
 * Either way the file is then verified against the values this app belongs to:
 *
 *   Android package: com.MBKConnect             (read from app.json — no drift)
 *   Firebase project_id: mbkconnect             (pinned below)
 *   Firebase storage_bucket: mbkconnect.firebasestorage.app (pinned below)
 *
 * A mismatch fails the build here with a plain message instead of deep inside
 * Gradle. Only non-secret metadata is ever printed (project id, bucket, package
 * names) — keys in the file are read for validation and never logged.
 *
 * Setup (once, by someone with the Firebase download):
 *   eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
 *     --type string --value "$(cat google-services.json)"
 * See docs/notifications.md §2b.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The Firebase/Google project this app belongs to. If the school ever moves the
// app to a different Firebase project, update these two lines AND the matching
// assertions in tests/config/app-config.test.mjs together.
const EXPECTED_PROJECT_ID = 'mbkconnect';
const EXPECTED_STORAGE_BUCKET = 'mbkconnect.firebasestorage.app';

function info(message) {
  console.log(`[provide-google-services] ${message}`);
}

function fail(message) {
  console.error(`[provide-google-services] ERROR: ${message}`);
  process.exit(1);
}

// --- authoritative Expo config -------------------------------------------------
// app.json is the only Expo config in this project (there is no app.config.js/ts
// and no config plugin overriding android.package), so the expected package and
// the file location are read from it rather than duplicated here.
let expo;
try {
  expo = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
} catch (error) {
  fail(`cannot read app.json: ${error instanceof Error ? error.message : String(error)}`);
}
const expectedPackage = expo?.android?.package;
const googleServicesRef = expo?.android?.googleServicesFile ?? './google-services.json';
if (!expectedPackage) fail('app.json has no expo.android.package; refusing to guess.');
const targetPath = path.resolve(ROOT, googleServicesRef);
info(`expecting package "${expectedPackage}" at ${path.relative(ROOT, targetPath)}`);

// --- obtain the file ------------------------------------------------------------
function secretJsonFromEnv() {
  const raw = process.env.GOOGLE_SERVICES_JSON;
  if (raw) {
    const trimmed = raw.trim();
    // A string secret holds the JSON itself; a file secret holds the path EAS
    // wrote it to. Both are accepted so either secret type works.
    if (trimmed.startsWith('{')) return trimmed;
    if (existsSync(trimmed)) return readFileSync(trimmed, 'utf8');
    fail(
      'GOOGLE_SERVICES_JSON is set but is neither JSON nor a readable file path. ' +
        'Recreate the secret from the Firebase download (docs/notifications.md §2b).',
    );
  }
  const base64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
  if (base64) {
    const decoded = Buffer.from(base64.trim(), 'base64').toString('utf8');
    if (!decoded.trim().startsWith('{')) {
      fail('GOOGLE_SERVICES_JSON_BASE64 does not decode to JSON. Recreate the secret (docs/notifications.md §2b).');
    }
    return decoded;
  }
  return null;
}

if (!existsSync(targetPath)) {
  const fromSecret = secretJsonFromEnv();
  if (!fromSecret) {
    fail(
      `"${path.relative(ROOT, targetPath)}" is missing and no GOOGLE_SERVICES_JSON secret is set. ` +
        'Build from a machine that has the file (it uploads via .easignore), or create the ' +
        'project secret as described in docs/notifications.md §2b. ' +
        `The file must come from Firebase project "${EXPECTED_PROJECT_ID}".`,
    );
  }
  writeFileSync(targetPath, fromSecret.trim() + '\n', { mode: 0o600 });
  info('wrote google-services.json from the EAS secret.');
} else {
  info('using the google-services.json already on disk.');
}

// --- verify it is the right project's file ---------------------------------------
let parsed;
try {
  parsed = JSON.parse(readFileSync(targetPath, 'utf8'));
} catch {
  fail(`"${path.relative(ROOT, targetPath)}" is not valid JSON. Replace it with the Firebase download.`);
}

const projectId = parsed?.project_info?.project_id;
const storageBucket = parsed?.project_info?.storage_bucket;
const packages = (parsed?.client ?? [])
  .map(client => client?.client_info?.android_client_info?.package_name)
  .filter(Boolean);

// Non-secret metadata only: project id, bucket, package names. Keys stay unread.
info(`project_id: ${projectId ?? '(missing)'}`);
info(`storage_bucket: ${storageBucket ?? '(missing)'}`);
info(`android packages declared: ${packages.length > 0 ? packages.join(', ') : '(none)'}`);

const problems = [];
if (projectId !== EXPECTED_PROJECT_ID) {
  problems.push(
    `project_info.project_id is "${projectId ?? '(missing)'}" but this app belongs to Firebase project "${EXPECTED_PROJECT_ID}"`,
  );
}
if (storageBucket !== EXPECTED_STORAGE_BUCKET) {
  problems.push(
    `project_info.storage_bucket is "${storageBucket ?? '(missing)'}" but this app belongs to "${EXPECTED_STORAGE_BUCKET}"`,
  );
}
if (!packages.includes(expectedPackage)) {
  problems.push(
    `no Android client for package "${expectedPackage}" (declares: ${packages.length > 0 ? packages.join(', ') : 'none'})`,
  );
}
if (problems.length > 0) {
  fail(
    `${path.relative(ROOT, targetPath)} is for the wrong Firebase setup:\n` +
      problems.map(p => `  - ${p}`).join('\n') +
      `\nFix: in the Firebase console project "${EXPECTED_PROJECT_ID}", add an Android app with package ` +
      `"${expectedPackage}", download the new google-services.json, and use that file (locally and in the ` +
      'GOOGLE_SERVICES_JSON secret). Do not “fix” this by editing ids inside the file.',
  );
}

info(`verified: Firebase project "${projectId}", package "${expectedPackage}".`);
