#!/usr/bin/env node
/**
 * Runs the React Native CLI with two fixes for Windows + USB debugging:
 *
 * 1. Upper-cases the drive letter of the working directory. Terminals and
 *    VS Code often report "d:\..." while Node resolves "D:\...", which makes Metro
 *    fail with "Failed to get the SHA-1 for ...".
 * 2. Before `run-android` (and for `npm run reverse`), forwards ports 3001
 *    (backend) and 8081 (Metro) over USB with `adb reverse`, so the phone can
 *    reach your PC at http://localhost — no Wi-Fi IP needed.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..').replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);
const args = process.argv.slice(2);

if (args[0] === 'run-android' || args[0] === 'reverse') {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const adb = sdk ? path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb';
  for (const port of ['3001', '8081']) {
    const r = spawnSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status === 0) console.log(`OK  adb reverse tcp:${port} -> your PC`);
    else console.warn(`WARN adb reverse tcp:${port} failed: ${(r.stderr || (r.error && r.error.message) || '').trim() || 'is the phone connected with USB debugging on?'}`);
  }
  if (args[0] === 'reverse') process.exit(0);
}

const cli = require.resolve('@react-native-community/cli/build/bin.js', { paths: [root] });
const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
