'use strict';

const {
  createRunOncePlugin,
  withAndroidManifest,
  withSettingsGradle,
} = require('expo/config-plugins');

const DEV_ONLY_ANDROID_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

function withProductionNativeExclusions(config) {
  if (process.env.EAS_BUILD_PROFILE !== 'production') return config;

  config = withSettingsGradle(config, gradleConfig => {
    const source = gradleConfig.modResults.contents;
    const call = 'expoAutolinking.useExpoModules()';
    const replacement = `expoAutolinking.useExpoModules([exclude: [${DEV_ONLY_ANDROID_MODULES.map(name => `'${name}'`).join(', ')}]])`;

    if (source.includes(replacement)) return gradleConfig;

    const occurrences = source.split(call).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `withProductionNativeExclusions expected one Expo autolinking setup call in settings.gradle; found ${occurrences}. Refusing to link development-only Android modules into the production build.`,
      );
    }

    gradleConfig.modResults.contents = source.replace(call, replacement);
    return gradleConfig;
  });

  // expo-dev-client has an SDK 54 auto-plugin path even when omitted explicitly.
  // Remove only its development URL scheme; keep the app's configured "mobile" scheme.
  config = withAndroidManifest(config, modConfig => {
    const activities = modConfig.modResults.manifest.application?.[0]?.activity ?? [];
    for (const activity of activities) {
      for (const filter of activity['intent-filter'] ?? []) {
        const data = filter.data ?? [];
        filter.data = data.filter(entry => !String(entry.$?.['android:scheme'] ?? '').startsWith('exp+'));
      }
      activity['intent-filter'] = (activity['intent-filter'] ?? []).filter(
        filter => (filter.data?.length ?? 0) > 0 || (filter.action?.length ?? 0) > 0 || (filter.category?.length ?? 0) > 0,
      );
    }
    return modConfig;
  });

  return config;
}

module.exports = createRunOncePlugin(
  withProductionNativeExclusions,
  'with-production-native-exclusions',
  '1.0.0',
);
