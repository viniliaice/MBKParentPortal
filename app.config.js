'use strict';

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

module.exports = ({ config }) => {
  // EAS injects EAS_BUILD_PROFILE for the selected build profile. Keep the dev client
  // available in development/preview builds, but omit its explicit config plugin from
  // the Google Play production build.
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const plugins = (config.plugins ?? []).filter(
    plugin => !isProductionBuild || pluginName(plugin) !== 'expo-dev-client',
  );

  return {
    ...config,
    orientation: 'default',
    plugins,
  };
};
