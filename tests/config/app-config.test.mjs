/**
 * Build configuration tests: the settings that only surface at build time.
 *
 * These are cheap, offline checks for the mistakes that cost a build (or a Play
 * rejection) and are invisible in day-to-day development: a package name that no
 * longer matches google-services.json, a permission creeping back in, a missing
 * icon file, a production profile that quietly stopped producing an AAB.
 *
 * Nothing here needs a device, a network or the Supabase project.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = relative => JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8'));

const app = readJson('app.json').expo;
const eas = readJson('eas.json');

describe('app.json', () => {
  it('uses the decided application id', () => {
    assert.equal(app.android.package, 'com.MBKConnect');
  });

  it('has an application id that Android and Play accept', () => {
    const segments = app.android.package.split('.');
    assert.ok(segments.length >= 2, 'at least two segments');
    for (const segment of segments) {
      assert.match(segment, /^[A-Za-z][A-Za-z0-9_]*$/, `"${segment}" must start with a letter`);
    }
  });

  it('keeps the permission allow-list minimal', () => {
    assert.deepEqual([...app.android.permissions].sort(), [
      'android.permission.INTERNET',
      'android.permission.VIBRATE',
    ]);
  });

  it('blocks the permissions libraries try to add back', () => {
    // A disposable prebuild showed these arriving through library manifests; the
    // block is what keeps them out of the release artifact.
    for (const permission of [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]) {
      assert.ok(app.android.blockedPermissions.includes(permission), `${permission} must stay blocked`);
    }
  });

  it('turns device backup off', () => {
    // The stored session must not travel to another phone in a cloud backup.
    assert.equal(app.android.allowBackup, false);
  });

  it('seeds a versionCode for the remote version source', () => {
    assert.equal(typeof app.android.versionCode, 'number');
    assert.ok(app.android.versionCode >= 1);
  });

  it('references icon, splash and notification files that exist', () => {
    const referenced = [
      app.android.adaptiveIcon.foregroundImage,
      app.android.adaptiveIcon.backgroundImage,
      app.android.adaptiveIcon.monochromeImage,
      ...app.plugins
        .filter(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications')
        .map(([, config]) => config.icon),
      ...app.plugins
        .filter(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')
        .map(([, config]) => config.image),
    ];
    assert.ok(referenced.length >= 5, 'every referenced asset is collected');
    for (const relative of referenced) {
      assert.ok(existsSync(path.join(ROOT, relative)), `${relative} must exist`);
    }
  });

  it('declares the notification channel used by the app', () => {
    const config = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications');
    assert.ok(config, 'expo-notifications is configured, not just listed');
    assert.equal(config[1].defaultChannel, 'default');
    assert.match(config[1].color, /^#[0-9A-Fa-f]{6}$/);
  });
});

describe('eas.json', () => {
  it('lets EAS own the version numbers', () => {
    assert.equal(eas.cli.appVersionSource, 'remote');
  });

  it('produces a Play-ready bundle in production, with auto-increment', () => {
    assert.equal(eas.build.production.android.buildType, 'app-bundle');
    assert.equal(eas.build.production.autoIncrement, true);
    assert.equal(eas.build.production.distribution ?? 'store', 'store');
  });

  it('keeps an installable APK for internal testing', () => {
    assert.equal(eas.build.preview.android.buildType, 'apk');
    assert.equal(eas.build.preview.distribution, 'internal');
  });

  it('has no submit configuration, so nothing can publish by accident', () => {
    assert.equal(eas.submit, undefined);
  });
});

describe('legal configuration (constants/legal.ts)', () => {
  const source = readFileSync(path.join(ROOT, 'constants', 'legal.ts'), 'utf8');
  const value = name => {
    const match = source.match(new RegExp(`${name}\\s*:\\s*string \\| null\\s*=\\s*([^;]+);`));
    assert.ok(match, `${name} must be declared`);
    return match[1].trim();
  };

  it('points at the school’s published privacy policy', () => {
    const url = value('PRIVACY_POLICY_URL').replace(/['"]/g, '');
    assert.match(url, /^https:\/\//, 'Play requires an HTTPS policy URL');
    assert.match(url, /privacy-policy/, 'and it must be the policy page');
  });

  it('has no account-deletion URL, because accounts are created by the school', () => {
    // Play's account-deletion requirement is triggered by in-app account
    // creation, which this app does not have. Adding self-service sign-up means
    // revisiting this deliberately (docs/account-deletion.md).
    assert.equal(value('ACCOUNT_DELETION_URL'), 'null');
  });

  it('gives parents a contact address', () => {
    const email = value('SUPPORT_EMAIL').replace(/['"]/g, '');
    assert.match(email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'must be a usable email address');
  });
});

describe('.easignore (what EAS Build uploads)', () => {
  // EAS uses .easignore *instead of* .gitignore, so the entries that pull in the
  // git-ignored build inputs are what keeps the Android build working. Losing them
  // shows up as a confusing build failure, so they are asserted here.
  it('exists, and keeps its include entries last', () => {
    const file = path.join(ROOT, '.easignore');
    assert.ok(existsSync(file), '.easignore must exist for EAS builds');
    const lines = readFileSync(file, 'utf8').split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

    assert.ok(lines.includes('node_modules/'), 'dependencies must not be uploaded');

    for (const needed of ['!google-services.json', '!.env']) {
      assert.ok(lines.includes(needed), `${needed} must be present, or the build loses it`);
      const lastOtherRule = lines.map((line, index) => ({ line, index })).filter(l => !l.line.startsWith('!')).pop();
      assert.ok(
        lines.indexOf(needed) > lastOtherRule.index,
        `${needed} must come after the ignore rules, so it wins`,
      );
    }

    // Credentials that must never travel: service-account keys and the Play key.
    for (const never of ['google-play-service-account.json', '*-service-account*.json']) {
      assert.ok(lines.includes(never), `${never} must stay excluded`);
    }
    assert.ok(!lines.includes('!.gitignore'), 'the git history stays out of the upload');
  });
});

describe('push token logging stays in development', () => {
  // A push token identifies a physical device; logging one in a release build was
  // an audit finding. The app's only token output goes through `devLog`, which is
  // guarded by __DEV__ — this asserts that guard is still the only route.
  const source = readFileSync(path.join(ROOT, 'lib', 'notifications.ts'), 'utf8');
  const lines = source.split('\n');

  it('routes every console call through the __DEV__ guard', () => {
    const consoleLines = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /console\.(log|info|warn|debug)\(/.test(line));

    assert.ok(consoleLines.length > 0, 'the diagnostic output exists');
    for (const { line, index } of consoleLines) {
      const context = lines.slice(Math.max(0, index - 3), index + 1).join('\n');
      assert.match(
        context,
        /if \(__DEV__\)/,
        `console call outside a __DEV__ guard (line ${index + 1}): ${line.trim()}`,
      );
    }
  });

  it('exposes the diagnostic without logging it itself', () => {
    assert.match(source, /export async function logPushDiagnostics/, 'the helper exists');
    assert.match(source, /return report/, 'and returns the report instead of only printing it');
  });
});

describe('supabase/config.toml', () => {
  it('disables JWT verification for the webhook function', () => {
    // pg_net sends no Authorization header, so the default (verify) rejects the
    // trigger's call with 401 before the function body runs. Losing this line is
    // silent: pushes simply stop.
    const file = path.join(ROOT, 'supabase', 'config.toml');
    assert.ok(existsSync(file), 'supabase/config.toml must exist');
    const text = readFileSync(file, 'utf8');
    assert.match(text, /\[functions\.send-notification\]/, 'the function must have a block');
    assert.match(
      text,
      /\[functions\.send-notification\][\s\S]*?verify_jwt\s*=\s*false/,
      'and it must set verify_jwt = false, or the trigger gets a 401',
    );
  });
});

describe('google-services.json', () => {
  it('matches the android package in app.json (skipped when absent)', t => {
    const file = path.join(ROOT, 'google-services.json');
    if (!existsSync(file)) {
      t.skip('google-services.json is not on this machine (it is git-ignored)');
      return;
    }

    // Read only the package names: this file also holds keys, which stay unread
    // and unprinted.
    const contents = JSON.parse(readFileSync(file, 'utf8'));
    const packages = (contents.client ?? [])
      .map(client => client?.client_info?.android_client_info?.package_name)
      .filter(Boolean);

    assert.ok(packages.length > 0, 'the file must declare at least one Android app');
    assert.ok(
      packages.includes(app.android.package),
      `google-services.json declares ${JSON.stringify(packages)} but the app is ${app.android.package}; `
      + 'add an Android app for the new package in Firebase and download the file again, '
      + 'or the Google Services plugin fails the build',
    );
  });
});
