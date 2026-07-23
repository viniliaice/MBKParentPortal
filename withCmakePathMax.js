const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to add "-DCMAKE_OBJECT_PATH_MAX=1024" to android/app/build.gradle
 * under defaultConfig.externalNativeBuild.cmake.arguments.
 */
function withCmakePathMax(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;

      // We inject under defaultConfig
      const targetStr = 'defaultConfig {';
      const insertStr = `
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=1024"
            }
        }`;

      if (!contents.includes('CMAKE_OBJECT_PATH_MAX')) {
        contents = contents.replace(targetStr, `${targetStr}${insertStr}`);
      }

      config.modResults.contents = contents;
    }
    return config;
  });
}

module.exports = withCmakePathMax;
