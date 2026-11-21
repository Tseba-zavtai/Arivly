const {
  AndroidConfig,
  withAppBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');

module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, mod => {
    for (const key of [
      'android.enableMinifyInReleaseBuilds',
      'android.enableShrinkResourcesInReleaseBuilds',
    ]) {
      AndroidConfig.BuildProperties.updateAndroidBuildProperty(mod.modResults, key, 'true');
    }
    return mod;
  });

  return withAppBuildGradle(config, mod => {
    // Keep Expo SDK 54's conservative preset. Aggressive R8 optimization can
    // break Kotlin reflection used to convert Expo Record options (including
    // OpenBrowserOptions when opening DAN). Shrinking remains enabled above.
    mod.modResults.contents = mod.modResults.contents.replace(
      /getDefaultProguardFile\((['"])proguard-android-optimize\.txt\1\)/,
      'getDefaultProguardFile("proguard-android.txt")',
    );
    return mod;
  });
};
