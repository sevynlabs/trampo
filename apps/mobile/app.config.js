const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "673ef4e1-aca7-4713-9e52-56f9b2b51eee";

export default {
  expo: {
    name: "Trampo",
    slug: "trampo",
    // EAS project @diegonet01/trampo (needed for Expo push tokens and builds)
    owner: "diegonet01",
    // Store version (X.Y.Z). Bump Y for a new store release, X for big changes.
    // Fixes that ship as quick updates (eas update) don't change it.
    version: "1.0.0",
    // Quick updates only reach builds with the same native "fingerprint":
    // any native change produces a new runtime and needs a store build.
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "trampo",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#041E42"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.sevynlabs.trampo",
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        NSCameraUsageDescription: "Precisamos da câmera para capturar documentos de verificação",
        NSLocationWhenInUseUsageDescription: "Precisamos da localização para mostrar trampos perto de você",
        NSPhotoLibraryUsageDescription: "Precisamos acessar suas fotos para upload de documentos"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      package: "com.sevynlabs.trampo",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION"
      ],
      // Not used by the app; keeps the Play Store permission list honest
      blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.READ_EXTERNAL_STORAGE"]
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission: "Permitir $(PRODUCT_NAME) acessar a câmera",
          microphonePermission: false,
          recordAudioAndroid: false
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Permitir $(PRODUCT_NAME) acessar sua localização"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Permitir $(PRODUCT_NAME) acessar suas fotos"
        }
      ],
      "expo-font",
      "expo-image",
      "expo-splash-screen",
      "expo-status-bar",
      // Uploads source maps to Sentry in EAS builds (needs SENTRY_AUTH_TOKEN there)
      ...(process.env.SENTRY_ORG
        ? [["@sentry/react-native/expo", { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT ?? "trampo-app" }]]
        : [])
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        // Public identifier (not a secret). Env var still overrides it.
        projectId: EAS_PROJECT_ID
      },
      // App Store page, filled once the app exists there (used by "Atualize o app")
      iosStoreUrl: process.env.EXPO_PUBLIC_IOS_STORE_URL,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
};
