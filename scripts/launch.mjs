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
import { StringDecoder } from 'node:string_decoder';
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

const useColor = Boolean(process.stdout.isTTY);
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);

const title = 'TennoTools Profile Check - quick launch';
console.log(`\n${paint('1', title)}\n${'='.repeat(title.length)}\n`);

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

const apiTag = () => paint('36', '[api]');
const webTag = () => paint('35', '[web]');
const pendingRequests = new Map();

// Turn the server's logs into short one-liners: `[api]` for the server itself
// and API calls, `[web]` for page/asset requests. npm noise and the duplicate
// "incoming request" lines are dropped; successful /api/health polls stay
// quiet (the GUI polls them every 30 s).
function formatServerLine(raw) {
  const line = raw.replace(/\r$/, '').trim();
  if (!line) return null;
  if (line.startsWith('npm notice')) return null;
  if (/^npm error (code|Lifecycle script|path|workspace|location|command) /.test(line)) return null;

  if (line.startsWith('{')) {
    let entry = null;
    try {
      entry = JSON.parse(line);
    } catch {
      entry = null;
    }
    if (entry) {
      if (entry.msg === 'incoming request' && entry.req) {
        pendingRequests.set(entry.reqId, entry.req);
        return null;
      }
      if (entry.msg === 'request completed') {
        const request = pendingRequests.get(entry.reqId);
        pendingRequests.delete(entry.reqId);
        const url = request?.url ?? '?';
        const status = entry.res?.statusCode ?? '?';
        if (url === '/api/health' && status < 400) return null;
        const time = typeof entry.responseTime === 'number' ? ` (${entry.responseTime.toFixed(1)} ms)` : '';
        const rest = `${request?.method ?? 'GET'} ${url} -> ${status}${time}`;
        return `${url.startsWith('/api/') ? apiTag() : webTag()} ${status >= 400 ? paint('33', rest) : rest}`;
      }
      if (entry.msg) {
        return `${apiTag()} ${entry.level >= 40 ? paint('31', entry.msg) : entry.msg}`;
      }
      return null;
    }
  }
  return `${apiTag()} ${line}`;
}

function pipeServerOutput(stream) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += decoder.write(chunk);
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const formatted = formatServerLine(buffer.slice(0, newline));
      if (formatted) console.log(formatted);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  });
  stream.on('end', () => {
    buffer += decoder.end();
    const formatted = formatServerLine(buffer);
    if (formatted) console.log(formatted);
  });
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
  const server = spawnTool('npm', ['start'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  server.on('error', (error) => fail(`Could not start the app: ${error.message}`));
  pipeServerOutput(server.stdout);
  pipeServerOutput(server.stderr);

  let stopping = false;

  function shutdown() {
    if (server.pid && server.exitCode === null) {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        server.kill('SIGTERM');
      }
    }
  }

  function stop() {
    if (stopping) return;
    stopping = true;
    console.log(`\n${paint('1', 'Stopping Profile Check')} - see you next time!\n`);
    shutdown();
    setTimeout(() => process.exit(0), 300);
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(signal, () => stop());
  }

  // Press Q to stop cleanly (Ctrl+C works too). Only when a real terminal is attached.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      if (data.includes(0x03) || /q/i.test(data.toString())) stop();
    });
  }

  const startedAt = Date.now();
  let healthy = false;
  while (!healthy && server.exitCode === null && Date.now() - startedAt < healthTimeoutMs) {
    healthy = await isHealthy();
    if (!healthy) await sleep(500);
  }

  if (!healthy && !stopping && server.exitCode !== null) {
    fail(
      'The app stopped right after starting.',
      `The port ${port} may already be used by another program - close it or free the port, then try again.`,
    );
  }
  if (!healthy && !stopping) {
    shutdown();
    fail('The app did not answer within 60 seconds.', `Open ${appUrl} in your browser to see the details.`);
  }
  if (stopping) return;

  server.on('exit', (code) => process.exit(stopping ? 0 : code || 0));
  console.log(`\nThe app is ready: ${paint('1', appUrl)}`);
  openBrowser();
  console.log('Opening your browser - first time? Just follow the setup wizard on the page.');
  const stopHint = process.stdin.isTTY
    ? `Press ${paint('1', 'Q')} to stop - or simply close this window.`
    : 'Press Ctrl+C to stop.';
  console.log(`Keep this window open while you use Profile Check. ${stopHint}`);
  console.log('');
}

main().catch((error) => {
  fail(`Unexpected error: ${error?.message ? error.message : String(error)}`);
});
