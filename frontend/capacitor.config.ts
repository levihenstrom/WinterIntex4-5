import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must be a unique reverse-DNS identifier — update to match your Apple Developer team's bundle ID
  appId: 'org.healingwings.app',
  appName: 'HealingWings',

  // Points at the Vite build output folder
  webDir: 'dist',

  // All API calls go to the Azure backend — same URL as the deployed web app.
  // Capacitor wraps the web bundle so it uses this as the native http origin.
  server: {
    // Leave androidScheme as https so cookies (SameSite=Strict) are sent correctly
    androidScheme: 'https',
    // On iOS the WKWebView loads files from capacitor://localhost by default.
    // Setting allowNavigation lets the webview reach the Azure backend for API calls.
    allowNavigation: [
      'intex-group4-5-backend-dna7b3ddfvf8dxgb.centralus-01.azurewebsites.net',
    ],
  },

  ios: {
    // The generated Xcode project will live at frontend/ios/
    // scheme: 'App' is the default — matches the Xcode target name
    scheme: 'HealingWings',
    // Allow the WKWebView to call the Azure HTTPS backend
    // (ATS — App Transport Security — allows all HTTPS by default, so no plist edits needed
    //  as long as the backend uses a valid TLS cert, which Azure does)
    contentInset: 'automatic',
  },

  plugins: {
    // Status bar: use the navy brand color so the status bar blends with the nav
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1E3A5F',
    },
    // Keyboard: push content up when soft keyboard appears (better UX for forms)
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
