const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Retrieve the active local IPv4 address (e.g. 192.168.1.X).
 * @returns {string}
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Start the HTTP remote control server.
 * @param {Database} db                Better-sqlite3 database instance.
 * @param {Function} sendToRenderer    Callback to dispatch IPC messages to renderer process.
 * @returns {{ ip: string, port: number, url: string }}
 */
function startRemoteServer(db, sendToRenderer) {
  const ip = getLocalIpAddress();
  const port = 5050;

  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // 1. Serve Remote Control HTML Interface
    if (req.method === 'GET' && url.pathname === '/') {
      const htmlPath = path.join(__dirname, 'remote.html');
      fs.readFile(htmlPath, 'utf8', (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Arayüz dosyası bulunamadı.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    // 2. Fetch categories and sounds list
    if (req.method === 'GET' && url.pathname === '/api/data') {
      try {
        const categories = db.getAllCategories();
        const sounds = db.getAllSounds();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, categories, sounds }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 3. Play sound command
    if (req.method === 'POST' && url.pathname === '/api/play') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const params = JSON.parse(body);
          const soundId = params.soundId;
          if (soundId) {
            sendToRenderer('cli:play-id', soundId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing soundId' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // 4. Stop playback command
    if (req.method === 'POST' && url.pathname === '/api/stop') {
      sendToRenderer('cli:stop');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 5. Serve Sound Cover Image
    if (req.method === 'GET' && url.pathname === '/api/cover') {
      const soundId = url.searchParams.get('id');
      if (soundId) {
        const sound = db.getSoundById(Number(soundId));
        if (sound && sound.coverImage && fs.existsSync(sound.coverImage)) {
          const ext = path.extname(sound.coverImage).toLowerCase();
          const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
          };
          const contentType = mimeMap[ext] || 'image/jpeg';
          res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'max-age=86400' });
          fs.createReadStream(sound.coverImage).pipe(res);
          return;
        }
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No cover');
      return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[RemoteServer] Running on http://${ip}:${port}`);
  });

  return { ip, port, url: `http://${ip}:${port}` };
}

module.exports = { startRemoteServer };
