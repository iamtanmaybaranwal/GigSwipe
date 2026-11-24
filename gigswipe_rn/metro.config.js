const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * On Windows, terminals (and VS Code) often report the drive letter in lower
 * case ("d:\…") while Node resolves modules with upper case ("D:\…"). Metro
 * then can't match its file map and fails with "Failed to get the SHA-1".
 * Normalising the project root to an upper-case drive letter fixes that.
 */
const normalizeDrive = p => p.replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);
const projectRoot = normalizeDrive(path.resolve(__dirname));

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  projectRoot,
  watchFolders: [projectRoot],
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
