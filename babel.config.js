/**
 * `babel-preset-expo` automatically injects `react-native-worklets/plugin`
 * (Reanimated 4) when the package is installed, so it must NOT be listed here
 * as well — adding it twice breaks worklet compilation.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
