// Expo config. EXPO_PUBLIC_BASE_PATH lets the web build live under a sub-path
// (GitHub Pages serves the app at /<repo>/); local dev leaves it empty.
const basePath = (process.env.EXPO_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

module.exports = {
  expo: {
    name: 'FitLens',
    slug: 'fitlens',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'fitlens',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.fitlens.app',
      infoPlist: {
        NSCameraUsageDescription: 'FitLens uses the camera to photograph meals you choose to log.',
        NSPhotoLibraryUsageDescription: 'FitLens lets you pick meal photos from your library.',
      },
    },
    android: {
      package: 'com.fitlens.app',
      adaptiveIcon: {
        backgroundColor: '#F4F1EA',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      // Single-page output: one index.html handles every route client side,
      // which static hosts can serve with a 404 fallback.
      output: 'single',
      bundler: 'metro',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      ['expo-splash-screen', { backgroundColor: '#F4F1EA', image: './assets/images/splash-icon.png', imageWidth: 76 }],
      [
        'expo-image-picker',
        {
          photosPermission: 'FitLens lets you pick meal photos from your library.',
          cameraPermission: 'FitLens uses the camera to photograph meals you choose to log.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      ...(basePath ? { baseUrl: basePath } : {}),
    },
  },
};
