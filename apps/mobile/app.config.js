export default {
  expo: {
    name: "TRAMPO",
    slug: "trampo",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "trampo",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#FAFAFA"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.sevynlabs.trampo",
      infoPlist: {
        NSCameraUsageDescription: "Precisamos da câmera para capturar documentos de verificação",
        NSLocationWhenInUseUsageDescription: "Precisamos da localização para mostrar trampos perto de você",
        NSPhotoLibraryUsageDescription: "Precisamos acessar suas fotos para upload de documentos"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FAFAFA"
      },
      package: "com.sevynlabs.trampo",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE"
      ]
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission: "Permitir $(PRODUCT_NAME) acessar a câmera"
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
      "expo-status-bar"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "your-project-id"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
};
