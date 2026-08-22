import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Ownday",
  slug: "ownday",
  scheme: "ownday",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: { bundleIdentifier: "app.ownday.mobile", supportsTablet: true },
  android: { package: "app.ownday.mobile" },
  plugins: ["expo-router", "expo-secure-store", "./plugins/withOwndayNative.cjs"],
  experiments: { typedRoutes: true },
});
