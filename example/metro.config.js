const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')
const fs = require('fs')
const pak = require('../package.json')

const root = path.resolve(__dirname, '..')
const modules = Object.keys({ ...pak.peerDependencies })

// Resolve each peer dependency to wherever Yarn hoisted it
// (could be example/node_modules or root/node_modules)
const extraNodeModules = modules.reduce((acc, name) => {
  const local = path.join(__dirname, 'node_modules', name)
  const hoisted = path.join(root, 'node_modules', name)
  acc[name] = fs.existsSync(local) ? local : hoisted
  return acc
}, {})

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules,
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
