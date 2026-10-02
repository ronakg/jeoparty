import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';

function getLanIp(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function readJsonBody<T = unknown>(
  req: import('http').IncomingMessage
): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function jeopartySyncPlugin(): Plugin {
  let sharedState: unknown = null;
  const recentActionIds = new Set<string>();
  const actionIdQueue: string[] = [];

  function recordActionId(id: string): boolean {
    if (recentActionIds.has(id)) {
      return false;
    }
    recentActionIds.add(id);
    actionIdQueue.push(id);
    if (actionIdQueue.length > 200) {
      const oldest = actionIdQueue.shift();
      if (oldest) recentActionIds.delete(oldest);
    }
    return true;
  }

  return {
    name: 'jeoparty-sync',
    configureServer(server) {
      server.middlewares.use('/api/server-info', (_req, res) => {
        const lanIp = getLanIp();
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            lanIp,
            port: 5173,
            hostUrl: `http://${lanIp}:5173/?view=admin`,
            displayUrl: `http://${lanIp}:5173/?view=display`,
          })
        );
      });

      server.middlewares.use('/api/action', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const body = await readJsonBody<{
            action?: { type?: string; _actionId?: string };
            state?: unknown;
          }>(req);

          const actionId = body.action?._actionId;
          const isNew = actionId ? recordActionId(actionId) : true;

          if (isNew) {
            if (body.state) {
              sharedState = body.state;
            }
            if (body.action) {
              server.ws.send({
                type: 'custom',
                event: 'jeoparty:action',
                data: { action: body.action },
              });
            }
            if (body.state) {
              server.ws.send({
                type: 'custom',
                event: 'jeoparty:state-broadcast',
                data: { state: sharedState },
              });
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, state: sharedState }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      server.middlewares.use('/api/state', async (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, state: sharedState }));
          return;
        }

        if (req.method === 'POST') {
          try {
            const body = await readJsonBody<{ state?: unknown }>(req);
            if (body.state) {
              sharedState = body.state;
              server.ws.send({
                type: 'custom',
                event: 'jeoparty:state-broadcast',
                data: { state: sharedState },
              });
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, state: sharedState }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });

      server.ws.on(
        'jeoparty:action',
        (data: { action?: { _actionId?: string } }) => {
          const actionId = data?.action?._actionId;
          if (actionId && !recordActionId(actionId)) {
            return;
          }
          server.ws.send({
            type: 'custom',
            event: 'jeoparty:action',
            data,
          });
        }
      );

      server.ws.on(
        'jeoparty:state-sync',
        (data: { state?: unknown }) => {
          if (data && data.state) {
            sharedState = data.state;
            server.ws.send({
              type: 'custom',
              event: 'jeoparty:state-broadcast',
              data: { state: sharedState },
            });
          }
        }
      );

      server.ws.on('jeoparty:display-status', (data) => {
        server.ws.send({
          type: 'custom',
          event: 'jeoparty:display-status',
          data,
        });
      });

      server.ws.on('jeoparty:request-state', (_data, client) => {
        if (sharedState) {
          try {
            if (client && typeof client.send === 'function') {
              client.send({
                type: 'custom',
                event: 'jeoparty:state-broadcast',
                data: { state: sharedState },
              });
              return;
            }
          } catch {
            // Fall through to server-wide broadcast
          }
          server.ws.send({
            type: 'custom',
            event: 'jeoparty:state-broadcast',
            data: { state: sharedState },
          });
        } else {
          server.ws.send({
            type: 'custom',
            event: 'jeoparty:need-state',
            data: {},
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), jeopartySyncPlugin()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
