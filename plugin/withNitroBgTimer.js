const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('@expo/config-plugins')

const PKG_NAME = 'react-native-nitro-bg-timer'
const PKG_VERSION = '1.0.0'
const WAKE_LOCK = 'android.permission.WAKE_LOCK'

function ensureWakeLockPermission(config) {
  return withAndroidManifest(config, (mod) => {
    const permissions = AndroidConfig.Permissions.getPermissions(mod.modResults)
    if (!permissions.includes(WAKE_LOCK)) {
      AndroidConfig.Permissions.addPermission(mod.modResults, WAKE_LOCK)
    }
    return mod
  })
}

module.exports = createRunOncePlugin(
  ensureWakeLockPermission,
  PKG_NAME,
  PKG_VERSION
)
