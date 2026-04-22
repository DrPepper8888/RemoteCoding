const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const bodyParser = require('body-parser');

if (process.platform === 'win32') {
  process.chcp && process.chcp(65001);
}

const agentManager = require('./core/opencode-manager');
const WebSocketAdapter = require('./adapters/websocket-adapter');
const FeishuAdapter = require('./adapters/feishu-adapter');
const WeChatAdapter = require('./adapters/wechat-adapter');
const QQAdapter = require('./adapters/qq-adapter');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return require('./config.example.json');
}

const config = loadConfig();
const PORT = config.port || 8765;

const app = express();
const server = http.createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
}));

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function startAdapters() {
  const adapters = [];

  agentManager.setConfig(config);

  const websocketAdapter = new WebSocketAdapter(config.websocket, server);
  adapters.push(websocketAdapter);

  const feishuAdapter = new FeishuAdapter(config.feishu, app);
  adapters.push(feishuAdapter);

  const wechatAdapter = new WeChatAdapter(config.wechat, app);
  adapters.push(wechatAdapter);

  const qqAdapter = new QQAdapter(config.qq, app);
  adapters.push(qqAdapter);

  for (const adapter of adapters) {
    adapter.setAgentManager(agentManager);
    agentManager.registerAdapter(adapter);
    await adapter.start();
  }

  return adapters;
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  agentManager.stop();
  process.exit(0);
});

async function main() {
  await startAdapters();

  server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    const defaultAgentName = config.defaultAgent === 'opencode' ? 'OpenCode' : 'Claude Code';
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              OpenCode/Claude Multi-Platform Remote              ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  Server running on:                                             ║`);
    console.log(`║  - Local:    http://localhost:${PORT}                            ║`);
    console.log(`║  - Network:  http://${localIP}:${PORT}                           ║`);
    console.log('║                                                                 ║');
    console.log('║  Default Agent:                                                 ║');
    console.log(`║  ✓ ${defaultAgentName}${' '.repeat(55 - defaultAgentName.length)}║`);
    console.log('║                                                                 ║');
    console.log('║  Enabled platforms:                                             ║');
    
    if (config.websocket.enabled !== false) {
      console.log('║  ✓ WebSocket (Mobile WiFi)                                      ║');
    }
    if (config.feishu.enabled) {
      console.log('║  ✓ Feishu (飞书)                                                 ║');
    }
    if (config.wechat.enabled) {
      console.log('║  ✓ WeChat (微信)                                                 ║');
    }
    if (config.qq.enabled) {
      console.log('║  ✓ QQ                                                            ║');
    }
    
    console.log('║                                                                 ║');
    console.log('║  Commands:                                                      ║');
    console.log('║  /start       - Start agent                                     ║');
    console.log('║  /stop        - Stop agent                                      ║');
    console.log('║  /agent       - Show current agent                              ║');
    console.log('║  /agent NAME  - Switch agent (opencode/claudecode)             ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
  });
}

main().catch(console.error);
