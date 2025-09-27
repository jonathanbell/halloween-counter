import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server configuration
const PORT = 3000;
const HOST = '0.0.0.0';

// In-memory state
let state = {
  currentCount: 0,
  candyRemaining: 300,
  initialCandyCount: 300,
  candyPerChild: 1
};

// SSE clients
const sseClients = new Set();

// Helper function to send SSE events to all clients
function broadcastState() {
  const data = JSON.stringify({
    currentCount: state.currentCount,
    candyRemaining: state.candyRemaining,
    initialCandyCount: state.initialCandyCount
  });
  
  const message = `data: ${data}\n\n`;
  
  sseClients.forEach(res => {
    res.write(message);
  });
}

// Helper function to serve static files
function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// Get MIME type
function getMimeType(ext) {
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return types[ext] || 'application/octet-stream';
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  
  // CORS headers for local network access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // SSE endpoint
  if (pathname === '/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });
    
    // Send initial state
    const initialData = JSON.stringify({
      currentCount: state.currentCount,
      candyRemaining: state.candyRemaining,
      initialCandyCount: state.initialCandyCount
    });
    res.write(`data: ${initialData}\n\n`);
    
    // Add client to set
    sseClients.add(res);
    console.log(`\x1b[32m✓\x1b[0m Client connected | Total: \x1b[1m${sseClients.size}\x1b[0m`);
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(':ping\n\n');
    }, 30000);

    // Remove client on disconnect
    req.on('close', () => {
      sseClients.delete(res);
      clearInterval(keepAlive);
      console.log(`\x1b[31m✗\x1b[0m Client disconnected | Total: \x1b[1m${sseClients.size}\x1b[0m`);
    });
    
    return;
  }
  
  // Increment endpoint
  if (pathname === '/increment' && method === 'POST') {
    state.currentCount++;
    state.candyRemaining = Math.max(0, state.candyRemaining - state.candyPerChild);
    
    console.log(`\x1b[35m🎃\x1b[0m Count: \x1b[1m${state.currentCount}\x1b[0m | Candy: \x1b[1m${state.candyRemaining}\x1b[0m/${state.initialCandyCount}`);
    
    // Broadcast to all SSE clients
    broadcastState();
    
    // Send response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      currentCount: state.currentCount,
      candyRemaining: state.candyRemaining
    }));
    return;
  }
  
  // Settings endpoint
  if (pathname === '/settings' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Update state with new settings
        if (typeof data.currentCount === 'number') {
          state.currentCount = data.currentCount;
        }
        if (typeof data.initialCandyCount === 'number') {
          state.initialCandyCount = data.initialCandyCount;
          // Recalculate candy remaining based on current count
          state.candyRemaining = Math.max(0, data.initialCandyCount - (state.currentCount * state.candyPerChild));
        }
        
        console.log(`\x1b[34m⚙\x1b[0m  Settings updated | Count: \x1b[1m${state.currentCount}\x1b[0m | Candy: \x1b[1m${state.candyRemaining}\x1b[0m/${state.initialCandyCount}`);
        
        // Broadcast to all SSE clients
        broadcastState();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state }));
      } catch (error) {
        console.error('Error updating settings:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid data' }));
      }
    });
    return;
  }
  
  // Get current state endpoint
  if (pathname === '/state' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }
  
  // Serve static files
  if (method === 'GET') {
    let filePath;
    
    // Route handling
    if (pathname === '/') {
      filePath = path.join(__dirname, 'dist', 'index.html');
    } else if (pathname === '/remote') {
      filePath = path.join(__dirname, 'public', 'remote.html');
    } else if (pathname === '/settings') {
      filePath = path.join(__dirname, 'public', 'settings.html');
    } else if (pathname.startsWith('/assets/')) {
      // Serve Vite build assets
      filePath = path.join(__dirname, 'dist', pathname);
    } else {
      // Try to serve from dist first, then public
      filePath = path.join(__dirname, 'dist', pathname);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'public', pathname);
      }
    }
    
    // Get file extension and MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = getMimeType(ext);
    
    // Serve the file
    serveStaticFile(res, filePath, mimeType);
    return;
  }
  
  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Get local IP address
async function getLocalIP() {
  try {
    const { networkInterfaces } = await import('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip internal and IPv6 addresses
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {
    return 'your-ip';
  }
  return 'your-ip';
}

// Helper function to create a padded line with proper alignment
function boxLine(content, width = 56) {
  // Strip ANSI color codes to calculate actual length
  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const actualLength = stripAnsi(content).length;
  const padding = width - actualLength - 2; // -2 for the borders
  return `║ ${content}${' '.repeat(Math.max(0, padding))} ║`;
}

// Helper to center text
function centerText(text, width = 56) {
  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const actualLength = stripAnsi(text).length;
  const totalPadding = width - actualLength - 2;
  const leftPad = Math.floor(totalPadding / 2);
  const rightPad = totalPadding - leftPad;
  return `║ ${' '.repeat(leftPad)}${text}${' '.repeat(rightPad)} ║`;
}

// Start server
server.listen(PORT, HOST, async () => {
  const localIP = await getLocalIP();
  const boxWidth = 56;
  const line = '═'.repeat(boxWidth);
  const divider = '─'.repeat(boxWidth);
  
  console.log('\n');
  console.log(centerText('🎃 \x1b[35m\x1b[1mHalloween Counter SSE Server\x1b[0m 🎃'));
  console.log();
  console.log(`╔${line}╗`);
  console.log(boxLine(''));
  console.log(boxLine(`🚀 Server: \x1b[36mhttp://${HOST}:${PORT}\x1b[0m`));
  console.log(boxLine(''));
  console.log(`╟${divider}╢`);
  console.log(boxLine('\x1b[33m📍 Access Points:\x1b[0m'));
  console.log(boxLine(''));
  console.log(boxLine(`  Main:     \x1b[32mhttp://localhost:${PORT}\x1b[0m`));
  console.log(boxLine(`  Remote:   \x1b[32mhttp://localhost:${PORT}/remote\x1b[0m`));
  console.log(boxLine(`  Settings: \x1b[32mhttp://localhost:${PORT}/settings\x1b[0m`));
  console.log(boxLine(''));
  console.log(`╟${divider}╢`);
  console.log(boxLine('\x1b[33m📱 Network Access:\x1b[0m'));
  console.log(boxLine(''));
  if (localIP !== 'your-ip') {
    console.log(boxLine(`  \x1b[36mhttp://${localIP}:${PORT}/remote\x1b[0m`));
  } else {
    console.log(boxLine(`  \x1b[36mhttp://<your-ip>:${PORT}/remote\x1b[0m`));
  }
  console.log(boxLine(''));
  console.log(`╟${divider}╢`);
  console.log(boxLine('\x1b[33m📊 Initial State:\x1b[0m'));
  console.log(boxLine(''));
  console.log(boxLine(`  Count:  \x1b[1m${String(state.currentCount).padEnd(8)}\x1b[0m    Candy: \x1b[1m${state.candyRemaining}/${state.initialCandyCount}\x1b[0m`));
  console.log(boxLine(''));
  console.log(`╚${line}╝`);
  console.log('\n\x1b[90mPress Ctrl+C to stop the server\x1b[0m\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m⚠\x1b[0m  Shutting down server...');
  sseClients.forEach(res => res.end());
  server.close(() => {
    console.log('\x1b[32m✓\x1b[0m Server stopped gracefully\n');
    process.exit(0);
  });
});