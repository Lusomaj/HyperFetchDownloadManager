import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { DownloadManager } from './engine/DownloadManager';
import { NewDownloadOptions } from '../shared/types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 38241;
const manager = new DownloadManager();

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // JSON helper
  const sendJson = (data: any, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const getBody = (): Promise<any> => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  };

  try {
    if (req.method === 'GET' && pathname === '/api/downloads') {
      return sendJson(manager.getAll());
    }

    if (req.method === 'GET' && pathname === '/api/stats') {
      return sendJson(manager.getStats());
    }

    if (req.method === 'GET' && pathname === '/api/settings') {
      return sendJson(manager.settings);
    }

    if (req.method === 'POST' && pathname === '/api/settings') {
      const body = await getBody();
      return sendJson(manager.saveSettings(body));
    }

    if (req.method === 'POST' && pathname === '/api/probe') {
      const body = await getBody();
      const result = await manager.probe(body.url, body.headers);
      return sendJson(result);
    }

    if (req.method === 'POST' && pathname === '/api/downloads') {
      const body: NewDownloadOptions = await getBody();
      const item = await manager.add(body);
      return sendJson(item, 201);
    }

    const matchAction = pathname.match(/^\/api\/downloads\/([^\/]+)\/([^\/]+)$/);
    if (matchAction) {
      const [, id, action] = matchAction;
      if (action === 'pause') {
        await manager.pause(id);
        return sendJson({ success: true });
      }
      if (action === 'resume') {
        await manager.resume(id);
        return sendJson({ success: true });
      }
    }

    const matchDelete = pathname.match(/^\/api\/downloads\/([^\/]+)$/);
    if (req.method === 'DELETE' && matchDelete) {
      const id = matchDelete[1];
      const deleteFile = parsedUrl.searchParams.get('deleteFile') === 'true';
      await manager.remove(id, deleteFile);
      return sendJson({ success: true });
    }

    if (req.method === 'POST' && pathname === '/api/downloads/pause-all') {
      await manager.pauseAll();
      return sendJson({ success: true });
    }

    if (req.method === 'POST' && pathname === '/api/downloads/resume-all') {
      await manager.resumeAll();
      return sendJson({ success: true });
    }

    sendJson({ error: 'Not found' }, 404);
  } catch (err: any) {
    sendJson({ error: err.message || 'Internal server error' }, 500);
  }
});

// Setup WebSocket server for real-time progress broadcast
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  // Send initial state
  ws.send(JSON.stringify({ type: 'ALL', payload: manager.getAll() }));
  ws.send(JSON.stringify({ type: 'STATS', payload: manager.getStats() }));

  const progressUnsub = manager.onDownloadProgress((item) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PROGRESS', payload: item }));
    }
  });

  const stateUnsub = manager.onStateChange(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'STATE_CHANGE', payload: manager.getAll() }));
      ws.send(JSON.stringify({ type: 'STATS', payload: manager.getStats() }));
    }
  });

  ws.on('close', () => {
    progressUnsub();
    stateUnsub();
  });
});

server.listen(PORT, () => {
  console.log(`[HyperFetch Server] Engine running at http://localhost:${PORT}`);
  console.log(`[HyperFetch Server] WebSocket listening at ws://localhost:${PORT}`);
});

export { manager, server };
