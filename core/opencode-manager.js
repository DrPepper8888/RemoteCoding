const { spawn } = require('child_process');
const path = require('path');

const AGENT_CONFIGS = {
  opencode: {
    name: 'OpenCode',
    command: 'opencode',
    args: []
  },
  claudecode: {
    name: 'Claude Code',
    command: 'claude',
    args: ['code']
  }
};

class AgentManager {
  constructor() {
    this.bridgeProcess = null;
    this.adapters = new Set();
    this.currentAgent = 'opencode';
    this.config = null;
  }

  setConfig(config) {
    this.config = config;
    if (config.defaultAgent) {
      this.currentAgent = config.defaultAgent;
    }
  }

  registerAdapter(adapter) {
    this.adapters.add(adapter);
  }

  switchAgent(agentName) {
    if (!AGENT_CONFIGS[agentName]) {
      this.broadcast({ 
        type: 'system', 
        content: `❌ 未知的 agent: ${agentName}\n可用的 agent: ${Object.keys(AGENT_CONFIGS).join(', ')}`
      });
      return false;
    }

    const wasRunning = this.isRunning();
    if (wasRunning) {
      this.stop();
    }

    this.currentAgent = agentName;
    const agentConfig = AGENT_CONFIGS[agentName];
    
    this.broadcast({ 
      type: 'system', 
      content: `✅ 已切换到 ${agentConfig.name}`
    });

    if (wasRunning) {
      this.start();
    }

    return true;
  }

  start() {
    if (this.bridgeProcess) {
      console.log('Bridge already running');
      return;
    }

    console.log('Starting Python bridge...');
    
    const bridgePath = path.join(__dirname, '..', 'bridge.py');
    
    this.bridgeProcess = spawn('python', [bridgePath], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let bridgeReady = false;

    this.bridgeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('[MSG] ')) {
          try {
            const msg = JSON.parse(line.substring(6).trim());
            this.broadcast(msg);
            
            if (!bridgeReady && msg.type === 'system' && msg.content.includes('桥接器已启动')) {
              bridgeReady = true;
              console.log('Bridge ready, starting agent...');
              this.sendToBridge({ type: 'start' });
            }
          } catch (e) {
            console.log('[Bridge]', line);
          }
        } else if (line.trim()) {
          console.log('[Bridge]', line);
        }
      }
    });

    this.bridgeProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log('[Bridge]', line);
        }
      }
    });

    this.bridgeProcess.on('close', (code) => {
      console.log(`Bridge process exited with code ${code}`);
      this.bridgeProcess = null;
      this.broadcast({ type: 'status', status: 'disconnected' });
    });
  }

  stop() {
    if (this.bridgeProcess) {
      this.sendToBridge({ type: 'stop' });
      setTimeout(() => {
        if (this.bridgeProcess) {
          this.bridgeProcess.kill();
          this.bridgeProcess = null;
        }
      }, 1000);
    }
  }

  sendInput(message) {
    if (message.startsWith('/agent ')) {
      const agentName = message.substring(7).trim().toLowerCase();
      this.switchAgent(agentName);
      return;
    }

    if (message === '/agent') {
      const agentConfig = AGENT_CONFIGS[this.currentAgent];
      const available = Object.keys(AGENT_CONFIGS).map(k => 
        `${AGENT_CONFIGS[k].name} (${k})`
      ).join('\n');
      this.broadcast({ 
        type: 'system', 
        content: `当前 agent: ${agentConfig.name}\n\n可用的 agent:\n${available}`
      });
      return;
    }

    this.broadcast({ type: 'input', content: message });
    this.sendToBridge({ type: 'input', content: message });
  }

  sendToBridge(message) {
    if (this.bridgeProcess && this.bridgeProcess.stdin.writable) {
      this.bridgeProcess.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  isRunning() {
    return this.bridgeProcess !== null;
  }

  getCurrentAgent() {
    return this.currentAgent;
  }

  broadcast(message) {
    this.adapters.forEach((adapter) => {
      if (adapter.sendMessage) {
        adapter.sendMessage(message);
      }
    });
  }
}

module.exports = new AgentManager();
