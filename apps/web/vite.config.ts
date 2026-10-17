import { createConnection } from 'node:net';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const API_HOST = '127.0.0.1';
const API_PORT = 8787;

/** True when something is listening on the local API port. */
const isApiUp = (): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = createConnection({ host: API_HOST, port: API_PORT });
    const settle = (up: boolean): void => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(750, () => settle(false));
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
  });

/**
 * Answers /api requests with a clean 503 JSON while the local API is not
 * listening yet — instead of http-proxy spamming ECONNREFUSED stacks in the
 * terminal during the first seconds of `npm run dev` (or if the api process
 * crashed). The GUI turns that JSON into a readable error + retry UI.
 */
const apiAvailabilityGuard: Plugin = {
  name: 'tennotools-api-availability-guard',
  configureServer(server) {
    server.middlewares.use('/api', (_request, response, next) => {
      void isApiUp().then((up) => {
        if (up) {
          next();
          return;
        }
        if (response.headersSent || response.writableEnded) return;
        response.statusCode = 503;
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            error:
              'Local API unreachable on 127.0.0.1:8787 — wait for "TennoTools API ready" in the api terminal (npm run dev).',
          }),
        );
      });
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), apiAvailabilityGuard],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // SSE-friendly proxy to the local API.
      '/api': {
        target: `http://${API_HOST}:${API_PORT}`,
        changeOrigin: true,
        // Safety net for the rare race where the API dies mid-request.
        configure: (proxy) => {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent && !response.writableEnded) {
              response.writeHead(503, { 'content-type': 'application/json' });
              response.end(JSON.stringify({ error: 'Local API connection lost mid-request — retry is safe.' }));
            }
          });
        },
      },
    },
  },
});
