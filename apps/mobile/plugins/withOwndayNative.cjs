const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const APP_GROUP = "group.app.ownday.mobile";
const SNAPSHOT_KEY = "ownday.widget.snapshot.v1";
const PENDING_KEY = "ownday.widget.pending.v1";

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

function tokenColors(projectRoot) {
  const file = path.join(projectRoot, "..", "..", "packages", "tokens", "dist", "tokens.json");
  return JSON.parse(fs.readFileSync(file, "utf8")).color;
}

function androidSource(pkg, colors) {
  return `package ${pkg}

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import org.json.JSONArray
import org.json.JSONObject

private const val SNAPSHOT_KEY = "${SNAPSHOT_KEY}"
private const val PENDING_KEY = "${PENDING_KEY}"
private const val PREFS = "ownday_widget"
private val HabitIdKey = ActionParameters.Key<String>("habitId")

private data class Habit(val id: String, val title: String, val done: Boolean, val value: Int, val target: Int?, val streak: Int)
private data class Snapshot(val date: String, val habits: List<Habit>)

private fun snapshot(context: Context): Snapshot {
  val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null)
    ?: return Snapshot("", emptyList())
  return runCatching {
    val root = JSONObject(raw)
    val values = root.getJSONArray("habits")
    Snapshot(root.getString("localDate"), (0 until values.length()).map { index ->
      val item = values.getJSONObject(index)
      Habit(item.getString("id"), item.getString("title"), item.getBoolean("done"), item.getInt("value"),
        if (item.isNull("target")) null else item.getInt("target"), item.getInt("streak"))
    })
  }.getOrDefault(Snapshot("", emptyList()))
}

private object Palette {
  val surface = ColorProvider(Color(android.graphics.Color.parseColor("${colors.light.surface}")), Color(android.graphics.Color.parseColor("${colors.dark.surface}")))
  val ink = ColorProvider(Color(android.graphics.Color.parseColor("${colors.light.ink}")), Color(android.graphics.Color.parseColor("${colors.dark.ink}")))
  val neutral = ColorProvider(Color(android.graphics.Color.parseColor("${colors.light["ink-3"]}")), Color(android.graphics.Color.parseColor("${colors.dark["ink-3"]}")))
  val done = ColorProvider(Color(android.graphics.Color.parseColor("${colors.light.done}")), Color(android.graphics.Color.parseColor("${colors.dark.done}")))
  val streak = ColorProvider(Color(android.graphics.Color.parseColor("${colors.light.streak}")), Color(android.graphics.Color.parseColor("${colors.dark.streak}")))
}

class OwndayWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    provideContent { WidgetContent(snapshot(context)) }
  }

  @Composable private fun WidgetContent(data: Snapshot) {
    Column(GlanceModifier.fillMaxSize().background(Palette.surface).padding(16.dp)) {
      Text((data.habits.maxOfOrNull { it.streak } ?: 0).toString(), style = TextStyle(color = Palette.streak, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.height(8.dp))
      data.habits.take(4).forEach { habit ->
        Row(
          GlanceModifier.fillMaxWidth().height(44.dp).clickable(actionRunCallback<ToggleHabitAction>(actionParametersOf(HabitIdKey to habit.id))),
          verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
          Text(if (habit.done) "✓" else "○", style = TextStyle(color = if (habit.done) Palette.done else Palette.neutral))
          Spacer(GlanceModifier.width(8.dp))
          Text(habit.title, style = TextStyle(color = if (habit.done) Palette.neutral else Palette.ink), maxLines = 1)
          if (habit.target != null) Text("  " + habit.value + "/" + habit.target, style = TextStyle(color = Palette.neutral))
        }
      }
    }
  }
}

class ToggleHabitAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val habitId = parameters[HabitIdKey] ?: return
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val root = JSONObject(prefs.getString(SNAPSHOT_KEY, null) ?: return)
    val habits = root.getJSONArray("habits")
    var status = "done"
    for (index in 0 until habits.length()) {
      val habit = habits.getJSONObject(index)
      if (habit.getString("id") == habitId) {
        status = if (habit.getBoolean("done")) "miss" else "done"
        habit.put("done", status == "done")
      }
    }
    val date = root.getString("localDate")
    val pending = JSONArray(prefs.getString(PENDING_KEY, "[]"))
    val clientId = "mobile:$habitId:$date"
    if ((0 until pending.length()).none { pending.getJSONObject(it).getString("clientId") == clientId })
      pending.put(JSONObject().put("habitId", habitId).put("localDate", date).put("status", status).put("clientId", clientId))
    prefs.edit().putString(SNAPSHOT_KEY, root.toString()).putString(PENDING_KEY, pending.toString()).apply()
    OwndayWidget().update(context, glanceId)
  }
}

class OwndayWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = OwndayWidget()
}
`;
}

function bridgeSource(pkg) {
  return `package ${pkg}

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager

class OwndayWidgetBridge(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "OwndayWidgetBridge"
  @ReactMethod fun writeSnapshot(value: String, promise: Promise) {
    reactApplicationContext.getSharedPreferences("ownday_widget", 0).edit().putString("${SNAPSHOT_KEY}", value).apply()
    promise.resolve(null)
  }
  @ReactMethod fun takePendingMutations(promise: Promise) {
    val prefs = reactApplicationContext.getSharedPreferences("ownday_widget", 0)
    val value = prefs.getString("${PENDING_KEY}", "[]") ?: "[]"
    prefs.edit().putString("${PENDING_KEY}", "[]").apply()
    promise.resolve(value)
  }
}

class OwndayWidgetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(OwndayWidgetBridge(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;
}

function withAndroidWidget(config) {
  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes("androidx.glance:glance-appwidget"))
      mod.modResults.contents = mod.modResults.contents.replace(
        /dependencies\s*\{/,
        'dependencies {\n    implementation("androidx.glance:glance-appwidget:1.1.1")',
      );
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    app.receiver ??= [];
    if (!app.receiver.some((item) => item.$["android:name"] === ".widget.OwndayWidgetReceiver"))
      app.receiver.push({
        $: { "android:name": ".widget.OwndayWidgetReceiver", "android:exported": "true" },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/ownday_widget_info",
            },
          },
        ],
      });
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const root = mod.modRequest.platformProjectRoot;
      const pkg = mod.android?.package ?? config.android.package;
      const java = path.join(root, "app", "src", "main", "java", ...pkg.split("."));
      write(
        path.join(java, "widget", "OwndayWidget.kt"),
        androidSource(`${pkg}.widget`, tokenColors(mod.modRequest.projectRoot)),
      );
      write(path.join(java, "widget", "OwndayWidgetBridge.kt"), bridgeSource(`${pkg}.widget`));
      write(
        path.join(root, "app", "src", "main", "res", "xml", "ownday_widget_info.xml"),
        `<?xml version="1.0" encoding="utf-8"?>\n<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="110dp" android:minHeight="110dp" android:minResizeWidth="110dp" android:minResizeHeight="110dp" android:resizeMode="horizontal|vertical" android:widgetCategory="home_screen" android:initialLayout="@layout/ownday_widget_loading" />\n`,
      );
      write(
        path.join(root, "app", "src", "main", "res", "layout", "ownday_widget_loading.xml"),
        `<?xml version="1.0" encoding="utf-8"?>\n<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" />\n`,
      );
      const main = path.join(java, "MainApplication.kt");
      let source = fs.readFileSync(main, "utf8");
      if (!source.includes("OwndayWidgetPackage")) {
        source = source.replace(
          /(package [^\n]+\n)/,
          `$1\nimport ${pkg}.widget.OwndayWidgetPackage\n`,
        );
        source = source.replace(
          /PackageList\(this\)\.packages\.apply \{/,
          "PackageList(this).packages.apply {\n              add(OwndayWidgetPackage())",
        );
        fs.writeFileSync(main, source);
      }
      return mod;
    },
  ]);
}

function iosWidgetSource(colors) {
  const encode = (value) => value.replace("#", "0x");
  return fs
    .readFileSync(path.join(__dirname, "OwndayWidget.swift"), "utf8")
    .replaceAll("__APP_GROUP__", APP_GROUP)
    .replaceAll("__SNAPSHOT_KEY__", SNAPSHOT_KEY)
    .replaceAll("__PENDING_KEY__", PENDING_KEY)
    .replaceAll("__LIGHT_SURFACE__", encode(colors.light.surface))
    .replaceAll("__DARK_SURFACE__", encode(colors.dark.surface))
    .replaceAll("__LIGHT_INK__", encode(colors.light.ink))
    .replaceAll("__DARK_INK__", encode(colors.dark.ink))
    .replaceAll("__LIGHT_NEUTRAL__", encode(colors.light["ink-3"]))
    .replaceAll("__DARK_NEUTRAL__", encode(colors.dark["ink-3"]))
    .replaceAll("__LIGHT_DONE__", encode(colors.light.done))
    .replaceAll("__DARK_DONE__", encode(colors.dark.done))
    .replaceAll("__LIGHT_STREAK__", encode(colors.light.streak))
    .replaceAll("__DARK_STREAK__", encode(colors.dark.streak));
}

function iosBridgeSource() {
  return `import Foundation\nimport React\nimport WidgetKit\n\n@objc(OwndayWidgetBridge)\nfinal class OwndayWidgetBridge: NSObject, RCTBridgeModule {\n  static func moduleName() -> String! { "OwndayWidgetBridge" }\n  static func requiresMainQueueSetup() -> Bool { false }\n\n  @objc func writeSnapshot(_ value: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {\n    let defaults = UserDefaults(suiteName: "${APP_GROUP}")!\n    defaults.set(value, forKey: "${SNAPSHOT_KEY}")\n    WidgetCenter.shared.reloadAllTimelines()\n    resolve(nil)\n  }\n\n  @objc func takePendingMutations(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {\n    let defaults = UserDefaults(suiteName: "${APP_GROUP}")!\n    let data = defaults.data(forKey: "${PENDING_KEY}")\n    defaults.removeObject(forKey: "${PENDING_KEY}")\n    resolve(data.flatMap { String(data: $0, encoding: .utf8) } ?? "[]")\n  }\n}\n`;
}

function withIosWidget(config) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults["com.apple.security.application-groups"] = [APP_GROUP];
    return mod;
  });
  config = withDangerousMod(config, [
    "ios",
    async (mod) => {
      const root = mod.modRequest.platformProjectRoot;
      const dir = path.join(root, "OwndayWidget");
      write(
        path.join(dir, "OwndayWidget.swift"),
        iosWidgetSource(tokenColors(mod.modRequest.projectRoot)),
      );
      write(
        path.join(dir, "Info.plist"),
        `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict></dict></plist>`,
      );
      write(
        path.join(dir, "OwndayWidget.entitlements"),
        `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${APP_GROUP}</string></array></dict></plist>`,
      );
      write(path.join(root, config.name, "OwndayWidgetBridge.swift"), iosBridgeSource());
      return mod;
    },
  ]);
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const mainTarget = project.getFirstTarget().uuid;
    project.addSourceFile(`${config.name}/OwndayWidgetBridge.swift`, {}, mainTarget);
    if (project.pbxTargetByName("OwndayWidget")) return mod;
    const target = project.addTarget(
      "OwndayWidget",
      "app_extension",
      "OwndayWidget",
      `${config.ios.bundleIdentifier}.widget`,
    );
    project.addBuildPhase(
      ["OwndayWidget/OwndayWidget.swift"],
      "PBXSourcesBuildPhase",
      "Sources",
      target.uuid,
    );
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);
    const group = project.addPbxGroup(
      ["OwndayWidget.swift", "Info.plist", "OwndayWidget.entitlements"],
      "OwndayWidget",
      "OwndayWidget",
    );
    const mainGroup = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroup);
    const settings = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(settings)) {
      const build = settings[key];
      if (typeof build === "object" && build.buildSettings?.PRODUCT_NAME === '"OwndayWidget"') {
        Object.assign(build.buildSettings, {
          APPLICATION_EXTENSION_API_ONLY: "YES",
          CODE_SIGN_ENTITLEMENTS: "OwndayWidget/OwndayWidget.entitlements",
          INFOPLIST_FILE: "OwndayWidget/Info.plist",
          IPHONEOS_DEPLOYMENT_TARGET: "17.0",
          LD_RUNPATH_SEARCH_PATHS:
            '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
          SKIP_INSTALL: "YES",
          SWIFT_VERSION: "5.0",
          TARGETED_DEVICE_FAMILY: '"1,2"',
        });
      }
    }
    project.addTargetDependency(mainTarget, [target.uuid]);
    return mod;
  });
}

module.exports = function withOwndayNative(config) {
  return withIosWidget(withAndroidWidget(config));
};
