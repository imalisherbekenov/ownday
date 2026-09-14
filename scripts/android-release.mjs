import { spawnSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
  constants,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = join(root, "apps/mobile");
const secrets = join(root, ".release-secrets");
const credentialsFile = join(secrets, "android-signing.json");
const keyFile = join(secrets, "android-upload.jks");
const windows = process.platform === "win32";
const { values } = parseArgs({
  options: {
    "init-key": { type: "boolean" },
    "api-url": { type: "string" },
    "version-code": { type: "string" },
    abis: { type: "string", default: "arm64-v8a,x86_64" },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(
    "JAVA_HOME and ANDROID_HOME are required. From the repository root:\n" +
      "node scripts/android-release.mjs --init-key\n" +
      "node scripts/android-release.mjs --api-url https://YOUR-SERVER --version-code 1 [--abis arm64-v8a,x86_64]\n" +
      "Builds signed candidate APK + AAB, verifies signatures, saves artifacts and a report. No upload or deployment.",
  );
  process.exit(0);
}
function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  requireCondition(
    !result.error && result.status === 0,
    `${command.split(/[\\/]/).at(-1)} failed (exit ${result.status}). ${result.error?.message ?? result.stderr ?? ""}`,
  );
  return result.stdout ?? "";
}
function privatePath(target, directory = false) {
  if (!windows) return; // POSIX paths are created with 0700/0600 below.
  const sid = run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
  ]).trim();
  requireCondition(
    /^S-1-\d+(?:-\d+)+$/.test(sid),
    "Cannot determine the current Windows identity.",
  );
  const owner = run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `(Get-Acl -LiteralPath '${root.replaceAll("'", "''")}').Owner`,
  ]).trim();
  requireCondition(owner.length > 0, "Cannot determine the workspace owner.");
  run("icacls.exe", [
    target,
    "/inheritance:r",
    "/grant:r",
    `*${sid}:${directory ? "(OI)(CI)" : ""}F`,
    `${owner}:${directory ? "(OI)(CI)" : ""}F`,
  ]);
}
async function main() {
  requireCondition(process.env.JAVA_HOME, "Set JAVA_HOME to JDK 17.");
  const java = join(process.env.JAVA_HOME, "bin", windows ? "java.exe" : "java");
  const keytool = join(process.env.JAVA_HOME, "bin", windows ? "keytool.exe" : "keytool");
  if (values["init-key"]) {
    requireCondition(
      !existsSync(credentialsFile) && !existsSync(keyFile),
      "Signing files already exist. Refusing to replace an existing key or partially created credentials.",
    );
    mkdirSync(secrets, { recursive: true, mode: 0o700 });
    privatePath(secrets, true);
    const password = randomBytes(32).toString("base64url");
    const credentials = {
      keyAlias: "ownday-upload",
      keystorePassword: password,
      keyPassword: password,
    };
    // Save the recovery credentials first. Any interrupted initialization fails closed on retry.
    writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const env = { ...process.env, OWNDAY_KEY_PASSWORD: password };
    run(
      keytool,
      [
        "-genkeypair",
        "-noprompt",
        "-storetype",
        "JKS",
        "-keyalg",
        "RSA",
        "-keysize",
        "3072",
        "-validity",
        "10000",
        "-alias",
        credentials.keyAlias,
        "-keystore",
        keyFile,
        "-storepass:env",
        "OWNDAY_KEY_PASSWORD",
        "-keypass:env",
        "OWNDAY_KEY_PASSWORD",
        "-dname",
        "CN=Alisher Bekenov, OU=Ownday",
      ],
      env,
    );
    run(
      keytool,
      [
        "-exportcert",
        "-rfc",
        "-keystore",
        keyFile,
        "-alias",
        credentials.keyAlias,
        "-storepass:env",
        "OWNDAY_KEY_PASSWORD",
        "-file",
        join(secrets, "android-upload-certificate.pem"),
      ],
      env,
    );
    console.log(
      "Upload key created in .release-secrets. Passwords were not printed. Back up this private directory securely.",
    );
    return;
  }
  requireCondition(
    values["api-url"],
    "Specify --api-url explicitly; the server address is embedded in the application.",
  );
  const api = new URL(values["api-url"]);
  requireCondition(
    api.protocol === "https:" &&
      !api.username &&
      !api.password &&
      !api.search &&
      !api.hash &&
      api.pathname === "/",
    "--api-url must be an HTTPS origin, without credentials, path or query.",
  );
  const versionCode = Number(values["version-code"]);
  requireCondition(
    Number.isInteger(versionCode) && versionCode > 0 && versionCode <= 2100000000,
    "Specify a positive --version-code, greater than the last uploaded version for a subsequent release.",
  );
  const abis = values.abis.split(",");
  requireCondition(
    abis.length &&
      new Set(abis).size === abis.length &&
      abis.every((a) => ["arm64-v8a", "x86_64", "armeabi-v7a", "x86"].includes(a)),
    "Invalid or duplicate Android ABI.",
  );
  requireCondition(abis.includes("arm64-v8a"), "The candidate must include ARM64.");
  requireCondition(
    existsSync(credentialsFile) && existsSync(keyFile),
    "Create the upload key with --init-key first.",
  );
  const credentials = JSON.parse(readFileSync(credentialsFile, "utf8"));
  requireCondition(
    ["keyAlias", "keystorePassword", "keyPassword"].every(
      (k) => typeof credentials[k] === "string" && credentials[k].length,
    ),
    "Invalid signing configuration.",
  );
  requireCondition(
    credentials.keyAlias !== "androiddebugkey",
    "A debug key cannot sign a release candidate.",
  );
  const sdk = process.env.ANDROID_HOME;
  requireCondition(
    sdk && existsSync(join(sdk, "build-tools/36.0.0/lib/apksigner.jar")),
    "Set ANDROID_HOME to an Android SDK with build-tools 36.0.0.",
  );
  const wrapper = join(mobile, "android/gradle/wrapper/gradle-wrapper.jar");
  requireCondition(
    existsSync(wrapper),
    "Generate the Android project first. Never run native generation concurrently with Gradle.",
  );
  const folder = join(
    root,
    ".release-builds",
    `android-${versionCode}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  mkdirSync(folder, { recursive: true });
  const env = {
    ...process.env,
    CI: "1",
    EXPO_NO_DOTENV: "1",
    EXPO_PUBLIC_API_URL: api.origin,
    OWNDAY_KEYSTORE: keyFile,
    OWNDAY_STORE_PASSWORD: credentials.keystorePassword,
    OWNDAY_KEY_ALIAS: credentials.keyAlias,
    OWNDAY_KEY_PASSWORD: credentials.keyPassword,
    OWNDAY_VERSION_CODE: String(versionCode),
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME ?? join(root, ".gradle-local"),
    ANDROID_USER_HOME: process.env.ANDROID_USER_HOME ?? join(root, ".android-user"),
  };
  console.log(`Building candidate ${versionCode}, ABIs ${abis.join(", ")}, API ${api.origin}.`);
  const args = [
    "-classpath",
    wrapper,
    "org.gradle.wrapper.GradleWrapperMain",
    "-p",
    join(mobile, "android"),
    "--init-script",
    join(root, "scripts/android-release.init.gradle"),
    ":app:assembleRelease",
    ":app:bundleRelease",
    "--no-daemon",
    "--max-workers=2",
    `-PreactNativeArchitectures=${abis.join(",")}`,
    "-Pkotlin.compiler.execution.strategy=in-process",
    "-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m",
  ];
  await new Promise((accept, reject) => {
    const child = spawn(java, args, { cwd: mobile, env, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? accept() : reject(new Error(`Gradle failed (exit ${code}).`)),
    );
  });
  const apk = join(mobile, "android/app/build/outputs/apk/release/app-release.apk");
  const aab = join(mobile, "android/app/build/outputs/bundle/release/app-release.aab");
  const certificate = run(
    keytool,
    [
      "-exportcert",
      "-rfc",
      "-alias",
      credentials.keyAlias,
      "-keystore",
      keyFile,
      "-storepass:env",
      "OWNDAY_STORE_PASSWORD",
    ],
    env,
  );
  const certificateBytes = Buffer.from(certificate.replace(/-----[^-]+-----|\s/g, ""), "base64");
  const digest = createHash("sha256").update(certificateBytes).digest("hex");
  const apkVerification = run(
    java,
    [
      "-jar",
      join(sdk, "build-tools/36.0.0/lib/apksigner.jar"),
      "verify",
      "--verbose",
      "--print-certs",
      apk,
    ],
    env,
  );
  requireCondition(
    apkVerification.toLowerCase().includes(`certificate sha-256 digest: ${digest}`),
    "APK signing certificate does not match the upload key.",
  );
  const badging = run(
    join(sdk, "build-tools/36.0.0", windows ? "aapt.exe" : "aapt"),
    ["dump", "badging", apk],
    env,
  );
  requireCondition(
    badging.includes(`package: name='app.ownday.mobile' versionCode='${versionCode}'`),
    "APK package/version mismatch.",
  );
  requireCondition(
    !/application-debuggable|android\.permission\.(READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|SYSTEM_ALERT_WINDOW)/.test(
      badging,
    ),
    "APK contains debug mode or an unexpected permission.",
  );
  const nativeAbis = [
    ...(badging.match(/^native-code: (.*)$/m)?.[1] ?? "").matchAll(/'([^']+)'/g),
  ].map((match) => match[1]);
  requireCondition(
    nativeAbis.length === abis.length && abis.every((abi) => nativeAbis.includes(abi)),
    "APK ABI mismatch.",
  );
  run(
    join(sdk, "build-tools/36.0.0", windows ? "zipalign.exe" : "zipalign"),
    ["-c", "-P", "16", "4", apk],
    env,
  );
  const jarsigner = join(process.env.JAVA_HOME, "bin", windows ? "jarsigner.exe" : "jarsigner");
  const aabVerification = run(jarsigner, ["-J-Duser.language=en", "-verify", aab], env);
  requireCondition(
    aabVerification.includes("jar verified.") && !aabVerification.includes("unsigned entries"),
    "AAB signature verification failed.",
  );
  const aabCertificate = run(keytool, ["-printcert", "-rfc", "-jarfile", aab], env);
  requireCondition(
    aabCertificate.includes(certificate.trim()),
    "AAB signing certificate does not match the upload key.",
  );
  const files = [];
  for (const [source, extension] of [
    [apk, "apk"],
    [aab, "aab"],
  ]) {
    const name = `ownday-${versionCode}-candidate.${extension}`;
    const target = join(folder, name);
    copyFileSync(source, target, constants.COPYFILE_EXCL);
    files.push({
      name,
      bytes: statSync(target).size,
      sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
    });
  }
  writeFileSync(
    join(folder, "verification.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        package: "app.ownday.mobile",
        versionCode,
        abis,
        apiUrl: api.origin,
        certificateSha256: digest,
        signing: "local-upload-key",
        signaturesVerified: true,
        apkMetadataVerified: true,
        apkZipAlignment16K: true,
        physicalDeviceTested: false,
        backendCompatibilityVerified: false,
        storeUploaded: false,
        files,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(join(folder, "apk-signature.txt"), apkVerification);
  writeFileSync(join(folder, "apk-metadata.txt"), badging);
  writeFileSync(join(folder, "aab-signature.txt"), aabVerification);
  console.log(
    `Verified candidate files saved to ${folder}. Device and backend checks are still required.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
