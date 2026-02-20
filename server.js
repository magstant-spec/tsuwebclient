const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { WebSocketServer } = require('ws');

const WS_PORT = Number(process.env.WS_PORT || 8080);
const DEFAULT_MUD_HOST = process.env.MUD_HOST || 'www.thebigwave.net';
const DEFAULT_MUD_PORT = Number(process.env.MUD_PORT || 23);
const MUD_IDLE_TIMEOUT_MS = Number(process.env.MUD_IDLE_TIMEOUT_MS || 0);
const WS_HEARTBEAT_INTERVAL_MS = Number(process.env.WS_HEARTBEAT_INTERVAL_MS || 30000);

const IAC = 255;
const DONT = 254;
const DO = 253;
const WONT = 252;
const WILL = 251;
const SB = 250;
const SE = 240;
const GMCP = 201;

function sendEvent(ws, event) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function sendStatus(ws, message) {
  sendEvent(ws, { type: 'status', message });
}

class TelnetParser {
  constructor(handlers) {
    this.handlers = handlers;
    this.state = 'data';
    this.pendingCmd = null;
    this.sbOption = null;
    this.sbData = [];
    this.textData = [];
  }

  flushText() {
    if (this.textData.length === 0) {
      return;
    }
    const chunk = Buffer.from(this.textData).toString('utf8');
    this.textData = [];
    if (chunk.length > 0) {
      this.handlers.onText(chunk);
    }
  }

  push(buffer) {
    for (const byte of buffer) {
      switch (this.state) {
        case 'data':
          if (byte === IAC) {
            this.flushText();
            this.state = 'iac';
          } else {
            this.textData.push(byte);
          }
          break;

        case 'iac':
          if (byte === IAC) {
            this.textData.push(IAC);
            this.state = 'data';
          } else if (byte === DO || byte === DONT || byte === WILL || byte === WONT) {
            this.pendingCmd = byte;
            this.state = 'cmd';
          } else if (byte === SB) {
            this.sbOption = null;
            this.sbData = [];
            this.state = 'sb_option';
          } else {
            this.state = 'data';
          }
          break;

        case 'cmd':
          this.handlers.onNegotiation(this.pendingCmd, byte);
          this.pendingCmd = null;
          this.state = 'data';
          break;

        case 'sb_option':
          this.sbOption = byte;
          this.sbData = [];
          this.state = 'sb';
          break;

        case 'sb':
          if (byte === IAC) {
            this.state = 'sb_iac';
          } else {
            this.sbData.push(byte);
          }
          break;

        case 'sb_iac':
          if (byte === IAC) {
            this.sbData.push(IAC);
            this.state = 'sb';
          } else if (byte === SE) {
            this.handlers.onSubnegotiation(this.sbOption, Buffer.from(this.sbData));
            this.sbOption = null;
            this.sbData = [];
            this.state = 'data';
          } else {
            this.state = 'sb';
          }
          break;

        default:
          this.state = 'data';
          break;
      }
    }

    this.flushText();
  }
}

function parseGmcp(message) {
  const space = message.indexOf(' ');
  if (space === -1) {
    return { module: message, payload: null };
  }

  const module = message.slice(0, space);
  const rawPayload = message.slice(space + 1).trim();

  if (!rawPayload) {
    return { module, payload: null };
  }

  try {
    return { module, payload: JSON.parse(rawPayload) };
  } catch {
    return { module, payload: rawPayload };
  }
}

function createMudSocket(ws, host, port) {
  const socket = net.createConnection({ host, port });
  socket.setKeepAlive(true, 30000);
  if (MUD_IDLE_TIMEOUT_MS > 0) {
    socket.setTimeout(MUD_IDLE_TIMEOUT_MS);
  } else {
    socket.setTimeout(0);
  }
  let gmcpReady = false;

  function sendIac(cmd, opt) {
    socket.write(Buffer.from([IAC, cmd, opt]));
  }

  function sendGmcp(command) {
    const payload = Buffer.from(command, 'utf8');
    const frame = Buffer.concat([
      Buffer.from([IAC, SB, GMCP]),
      payload,
      Buffer.from([IAC, SE]),
    ]);
    socket.write(frame);
  }

  function initGmcpIfReady() {
    if (gmcpReady) {
      return;
    }

    gmcpReady = true;
    sendGmcp('Core.Hello {"client":"browser-mud-gmcp","version":"0.1.0"}');
    sendGmcp('Core.Supports.Set ["Char 1","Core 1","Room 1"]');
    sendStatus(ws, 'GMCP initialized');
  }

  const parser = new TelnetParser({
    onText: (text) => {
      sendEvent(ws, { type: 'text', data: text });
    },
    onNegotiation: (cmd, opt) => {
      if (opt !== GMCP) {
        return;
      }

      if (cmd === WILL) {
        sendIac(DO, GMCP);
        initGmcpIfReady();
      } else if (cmd === DO) {
        initGmcpIfReady();
      } else if (cmd === DONT || cmd === WONT) {
        gmcpReady = false;
        sendStatus(ws, 'GMCP disabled by server');
      }
    },
    onSubnegotiation: (opt, data) => {
      if (opt !== GMCP) {
        return;
      }

      const raw = data.toString('utf8');
      const parsed = parseGmcp(raw);
      sendEvent(ws, {
        type: 'gmcp',
        raw,
        module: parsed.module,
        payload: parsed.payload,
      });
    },
  });

  socket.on('connect', () => {
    sendStatus(ws, `Connected to ${host}:${port}`);
    // Client announces GMCP support first; many servers will answer with DO GMCP.
    sendIac(WILL, GMCP);
  });

  socket.on('data', (chunk) => {
    parser.push(chunk);
  });

  socket.on('error', (err) => {
    sendStatus(ws, `Socket error: ${err.message}`);
    sendEvent(ws, { type: 'disconnect' });
  });

  socket.on('timeout', () => {
    sendStatus(ws, `Socket idle timeout (${MUD_IDLE_TIMEOUT_MS}ms) to ${host}:${port}`);
    sendEvent(ws, { type: 'disconnect' });
    socket.destroy();
  });

  socket.on('close', () => {
    sendStatus(ws, 'Disconnected from MUD');
    sendEvent(ws, { type: 'disconnect' });
  });

  return {
    writeInput(input) {
      if (!socket.destroyed) {
        socket.write(Buffer.from(input, 'utf8'));
      }
    },
    close() {
      if (!socket.destroyed) {
        socket.end();
        socket.destroy();
      }
    },
  };
}

const publicDir = path.join(__dirname, 'public');
const server = http.createServer((req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const cleanPath = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(publicDir, cleanPath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
    }[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
if (WS_HEARTBEAT_INTERVAL_MS > 0) {
  // Keep WebSocket sessions alive through proxies and drop stale peers quickly.
  const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }
  }, WS_HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  sendStatus(ws, 'WebSocket connected');
  let mud = null;

  ws.on('message', (msg) => {
    let event;
    try {
      event = JSON.parse(msg.toString('utf8'));
    } catch {
      sendStatus(ws, 'Invalid JSON message from client');
      return;
    }

    if (event.type === 'connect') {
      if (mud) {
        mud.close();
      }

      const host = event.host || DEFAULT_MUD_HOST;
      const port = Number(event.port || DEFAULT_MUD_PORT);
      sendStatus(ws, `Connecting to ${host}:${port}...`);

      mud = createMudSocket(ws, host, port);
      return;
    }

    if (event.type === 'input') {
      if (!mud) {
        sendStatus(ws, 'Not connected to MUD yet');
        return;
      }

      mud.writeInput(event.data || '');
      return;
    }

    if (event.type === 'disconnect') {
      if (mud) {
        mud.close();
        mud = null;
      }
    }
  });

  ws.on('close', () => {
    if (mud) {
      mud.close();
      mud = null;
    }
  });
});

server.listen(WS_PORT, () => {
  console.log(`Browser MUD GMCP proxy listening on http://localhost:${WS_PORT}`);
});
