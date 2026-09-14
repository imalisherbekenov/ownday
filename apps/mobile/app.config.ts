import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Ownday",
  slug: "ownday",
  scheme: "ownday",
  version: "1.0.0",
  icon: "./assets/icon.png",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: { bundleIdentifier: "app.ownday.mobile", supportsTablet: true, usesAppleSignIn: true },
  android: {
    package: "app.ownday.mobile",
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#FBF6ED" },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    ["expo-notifications", { icon: "./assets/notification.png", color: "#687A45" }],
    "expo-apple-authentication",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        imageWidth: 180,
        backgroundColor: "#FBF6ED",
        dark: { backgroundColor: "#202720" },
      },
    ],
    "./plugins/withOwndayNative.cjs",
  ],
  experiments: { typedRoutes: true },
  owner: "nevertheless",
  extra: {
    eas: {
      projectId: "318aeee0-e8ad-484c-ba27-b5b7d31859e0",
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: "OwndayWidget",
                bundleIdentifier: "app.ownday.mobile.widget",
                entitlements: {
                  "com.apple.security.application-groups": ["group.app.ownday.mobile"],
                },
              },
            ],
          },
        },
      },
    },
  },
});
