import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.resqnow1.app',
  appName: 'ResQNow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    // Keep backend callback navigation scoped to the current production host.
    allowNavigation: ['resqnowbackend-production-c392.up.railway.app']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#999999",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
