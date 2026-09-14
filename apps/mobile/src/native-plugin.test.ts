import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve("expo/package.json"));
const xcode = expoRequire("xcode");
const withNative = require("../plugins/withOwndayNative.cjs");

describe("iOS widget project generation", () => {
  it("adds bridge sources and one embedded extension to an Expo project without a Plugins group", async () => {
    const project = xcode
      .project(fileURLToPath(new URL("./fixtures/expo-single-target.pbxproj", import.meta.url)))
      .parseSync();
    const config = withNative({
      name: "HelloWorld",
      slug: "ownday",
      version: "1.2.3",
      ios: { bundleIdentifier: "app.ownday.mobile", buildNumber: "7" },
      android: { package: "app.ownday.mobile" },
    });
    const apply = () =>
      config.mods.ios.xcodeproj({
        ...config,
        modResults: project,
        modRequest: { platform: "ios" },
      });
    await apply();
    const once = project.writeSync();
    await apply();
    expect(project.writeSync()).toBe(once);
    const main = project.getFirstTarget().firstTarget;
    expect(main.dependencies).toHaveLength(1);
    expect(
      main.buildPhases.some((phase: { comment: string }) => phase.comment === "Copy Files"),
    ).toBe(true);
    for (const name of ["OwndayWidgetBridge.swift", "OwndayWidgetBridge.m", "WidgetStorage.swift"])
      expect(project.hasFile(`HelloWorld/${name}`)).toBeTruthy();
    const builds = Object.values(project.pbxXCBuildConfigurationSection()).filter(
      (build: any) => build?.buildSettings?.PRODUCT_NAME === '"OwndayWidget"',
    ) as { buildSettings: Record<string, string> }[];
    expect(builds).toHaveLength(2);
    for (const { buildSettings } of builds) {
      expect(buildSettings.CURRENT_PROJECT_VERSION).toBe("7");
      expect(buildSettings.MARKETING_VERSION).toBe("1.2.3");
      expect(buildSettings.CODE_SIGN_ENTITLEMENTS).toBe("OwndayWidget/OwndayWidget.entitlements");
    }
  });
});
