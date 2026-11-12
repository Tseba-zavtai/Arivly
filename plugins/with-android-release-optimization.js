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
    // Expo's default file disables R8 optimization even when minification is on.
    mod.modResults.contents = mod.modResults.contents.replace(
      /getDefaultProguardFile\((['"])proguard-android\.txt\1\)/,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    return mod;
  });
};
