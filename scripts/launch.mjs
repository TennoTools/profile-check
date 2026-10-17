#!/usr/bin/env node
/**
 * TennoTools Profile Check - friendly one-command launcher.
 *
 * Pure Node.js (no dependencies), so it works before `npm install` has ever
 * run. It checks Node, installs dependencies on first run, downloads the
 * Chromium helper for "Find my Account ID", rebuilds the web app when the
 * sources changed, starts the server in production mode and opens the browser.
 *
 * Escape hatches (tests / headless machines):
 *   TENNOTOOLS_NO_BROWSER=1   never open a browser
 *   TENNOTOOLS_PORT=<port>    use another port (default 8787)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = platform() === 'win32';
const port = process.env.TENNOTOOLS_PORT || '8787';
const appUrl = `http://127.0.0.1:${port}`;
const noBrowser = process.env.TENNOTOOLS_NO_BROWSER === '1';
const minNode = { major: 22, minor: 12 };
const healthTimeoutMs = 60_000;
const browsersDir =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  (isWindows
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ms-playwright')
    : platform() === 'darwin'
      ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : join(homedir(), '.cache', 'ms-playwright'));

const title = 'TennoTools Profile Check - quick launch';
console.log(`\n${title}\n${'='.repeat(title.length)}\n`);

function fail(message, hint) {
  console.error(`\nERROR: ${message}`);
  if (hint) console.error(`\n${hint}`);
  console.error('');
  process.exit(1);
}

// On Windows npm/npx are .cmd shims: run them through cmd.exe instead of `shell: true`
// (which triggers Node's DEP0190 warning).
const spawnTool = (command, args, options) =>
  isWindows
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command, ...args], options)
    : spawn(command, args, options);

const spawnToolSync = (command, args, options) =>
  isWindows
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command, ...args], options)
    : spawnSync(command, args, options);

const runSync = (command, args) => spawnToolSync(command, args, { cwd: root, stdio: 'inherit' });

const isHealthy = async () => {
  try {
    const response = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
};

function openBrowser() {
  if (noBrowser) return;
  const [command, args] = isWindows
    ? ['cmd', ['/c', 'start', '', appUrl]]
    : platform() === 'darwin'
      ? ['open', [appUrl]]
      : ['xdg-open', [appUrl]];
  const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
  child.on('error', () => {});
  child.unref();
}

const newestMtime = (path) => {
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.mtimeMs;
  let newest = 0;
  for (const entry of readdirSync(path, { recursive: true })) {
    const entryStats = statSync(join(path, entry));
    if (entryStats.isFile() && entryStats.mtimeMs > newest) newest = entryStats.mtimeMs;
  }
  return newest;
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function main() {
  // --- Node.js and npm ------------------------------------------------------

  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < minNode.major || (major === minNode.major && minor < minNode.minor)) {
    fail(
      `Node.js v${process.versions.node} is too old - v${minNode.major}.${minNode.minor} or newer is required.`,
      'Install the current LTS version from https://nodejs.org and run the launcher again.',
    );
  }
  console.log(`Node.js v${process.versions.node} - OK`);

  const npmCheck = spawnToolSync('npm', ['-v'], { cwd: root, encoding: 'utf8' });
  if (npmCheck.status !== 0) {
    fail('npm was not found.', 'Reinstall Node.js from https://nodejs.org (it includes npm), then try again.');
  }

  // --- Already running? -----------------------------------------------------

  if (await isHealthy()) {
    console.log(`\nThe app is already running on ${appUrl} - opening your browser.`);
    openBrowser();
    return;
  }

  // --- What needs to be done? -----------------------------------------------

  const webDir = join(root, 'apps', 'web');
  const distIndex = join(webDir, 'dist', 'index.html');
  const webSources = [
    join(webDir, 'src'),
    join(webDir, 'index.html'),
    join(webDir, 'vite.config.ts'),
    join(root, 'packages', 'core', 'src'),
  ].filter((path) => existsSync(path));
  const sourceMtime = Math.max(0, ...webSources.map(newestMtime));

  const needsInstall = !existsSync(join(root, 'node_modules'));
  const needsBrowser = !(
    existsSync(browsersDir) && readdirSync(browsersDir).some((name) => name.startsWith('chromium-'))
  );
  const needsBuild = !existsSync(distIndex) || sourceMtime > statSync(distIndex).mtimeMs;

  // --- Run ------------------------------------------------------------------

  let stepNumber = 0;
  const totalSteps = 1 + Number(needsInstall) + Number(needsBrowser) + Number(needsBuild);
  const step = (label) => {
    stepNumber += 1;
    console.log(`\n[${stepNumber}/${totalSteps}] ${label}`);
  };

  if (needsInstall) {
    step('Installing dependencies (first run only - this can take a few minutes)...');
    if (runSync('npm', ['install']).status !== 0) {
      fail('Dependency installation failed.', 'Check your internet connection, then run the launcher again.');
    }
  }

  if (needsBrowser) {
    step('Downloading the Chromium helper for "Find my Account ID" (one time, about 130 MB)...');
    if (runSync('npx', ['playwright', 'install', 'chromium']).status !== 0) {
      console.log(
        '\nWARNING: Chromium could not be downloaded - "Find my Account ID" will not work until it is.' +
          '\nYou can retry later with: npx playwright install chromium',
      );
    }
  }

  if (needsBuild) {
    step('Building the app...');
    if (runSync('npm', ['run', 'build']).status !== 0) {
      fail('The app failed to build.', 'Make sure you have a complete, up-to-date copy of the project.');
    }
  }

  step('Starting the app...');
  const server = spawnTool('npm', ['start'], { cwd: root, stdio: 'inherit' });
  server.on('error', (error) => fail(`Could not start the app: ${error.message}`));

  function shutdown() {
    if (server.pid && server.exitCode === null) {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        server.kill('SIGTERM');
      }
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      shutdown();
      process.exit(0);
    });
  }

  const startedAt = Date.now();
  let healthy = false;
  while (!healthy && server.exitCode === null && Date.now() - startedAt < healthTimeoutMs) {
    healthy = await isHealthy();
    if (!healthy) await sleep(500);
  }

  if (!healthy && server.exitCode !== null) {
    fail(
      'The app stopped right after starting.',
      `The port ${port} may already be used by another program - close it or free the port, then try again.`,
    );
  }
  if (!healthy) {
    shutdown();
    fail('The app did not answer within 60 seconds.', `Open ${appUrl} in your browser to see the details.`);
  }

  server.on('exit', (code) => process.exit(code || 0));
  console.log(`\nThe app is ready: ${appUrl}`);
  openBrowser();
  console.log('Opening your browser - first time? Just follow the setup wizard on the page.');
  console.log('Keep this window open while you use Profile Check - closing it (or Ctrl+C) stops the app.\n');
}

main().catch((error) => {
  fail(`Unexpected error: ${error?.message ? error.message : String(error)}`);
});
