'use strict';

const { createRunOncePlugin, withAppBuildGradle } = require('expo/config-plugins');

const LEGACY_DEFAULT_PROGUARD = /getDefaultProguardFile\s*\(\s*(["'])proguard-android\.txt\1\s*\)/g;
const OPTIMIZED_DEFAULT_PROGUARD = 'getDefaultProguardFile("proguard-android-optimize.txt")';

function withOptimizedR8(config) {
  return withAppBuildGradle(config, gradleConfig => {
    const contents = gradleConfig.modResults.contents;
    if (contents.includes('proguard-android-optimize.txt')) return gradleConfig;

    let replacements = 0;
    const updated = contents.replace(LEGACY_DEFAULT_PROGUARD, () => {
      replacements += 1;
      return OPTIMIZED_DEFAULT_PROGUARD;
    });

    if (replacements !== 1) {
      throw new Error(
        `withOptimizedR8 expected one legacy proguard-android.txt default in android/app/build.gradle; found ${replacements}. Refusing to silently build without optimized R8 defaults.`,
      );
    }

    gradleConfig.modResults.contents = updated;
    return gradleConfig;
  });
}

module.exports = createRunOncePlugin(withOptimizedR8, 'with-optimized-r8', '1.0.0');
