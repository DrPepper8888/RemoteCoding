const WebSocket = require('ws');
const BaseAdapter = require('./base-adapter');

class WebSocketAdapter extends BaseAdapter {
  constructor(config, server) {
    super('websocket', config);
    this.server = server;
    this.wss = null;
    this.clients = new Set();
  }

  async start() {
    if (!this.enabled) {
      console.log('[WebSocket] Adapter disabled');
      return;
    }

    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected');
      this.clients.add(ws);

      ws.send(JSON.stringify({
        type: 'status',
        status: this.agentManager.isRunning() ? 'connected' : 'disconnected',
        agent: this.agentManager.getCurrentAgent()
      }));

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('[WebSocket] Received:', message);

          switch (message.type) {
            case 'input':
              this.handleInput(message.content);
              break;
            case 'start':
              this.handleStart();
              break;
            case 'stop':
              this.handleStop();
              break;
            case 'switch_agent':
              const name = this.handleSwitchAgent(message.agent);
              if (name) {
                this.sendMessage({
                  type: 'agent_switch',
                  agent: message.agent,
                  agentName: name
                });
              }
              break;
          }
        } catch (error) {
          console.error('[WebSocket] Error:', error);
        }
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocket] Adapter started');
  }

  async stop() {
    if (this.wss) {
      this.wss.close();
    }
    this.clients.clear();
    console.log('[WebSocket] Adapter stopped');
  }

  sendMessage(message) {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

module.exports = WebSocketAdapter;
