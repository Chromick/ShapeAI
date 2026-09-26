const { withAndroidManifest } = require("@expo/config-plugins");

const PERMISSIONS = [
  "android.permission.health.READ_SLEEP",
  "android.permission.health.READ_RESTING_HEART_RATE",
  "android.permission.health.READ_HEART_RATE",
];

function withHealthPermissions(config) {
  return withAndroidManifest(config, (next) => {
    const manifest = next.modResults.manifest;
    const current = manifest["uses-permission"] ?? [];
    for (const name of PERMISSIONS) {
      const exists = current.some((item) => item.$["android:name"] === name);
      if (!exists) current.push({ $: { "android:name": name } });
    }
    manifest["uses-permission"] = current;
    return next;
  });
}

module.exports = withHealthPermissions;
