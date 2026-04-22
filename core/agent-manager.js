const { spawn } = require('child_process');

const AGENTS = {
  opencode: {
    name: 'OpenCode',
    command: 'opencode',
    default: true
  },
  claudecode: {
    name: 'Claude Code',
    command: 'claude',
    default: false
  }
};

class AgentManager {
  constructor() {
    this.process = null;
    this.currentAgent = null;
    this.adapters = new Set();
  }

  registerAdapter(adapter) {
    this.adapters.add(adapter);
  }

  getAvailableAgents() {
    return Object.keys(AGENTS);
  }

  getCurrentAgentName() {
    return this.currentAgent ? AGENTS[this.currentAgent]?.name : null;
  }

  switchAgent(agentName) {
    if (!AGENTS[agentName]) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    if (this.process) {
      this.stop();
    }

    this.currentAgent = agentName;
    this.broadcast({ 
      type: 'agent_switch', 
      agent: agentName,
      agentName: AGENTS[agentName].name
    });
    
    return AGENTS[agentName].name;
  }

  start() {
    if (this.process) {
      console.log(`${this.getCurrentAgentName()} process already running`);
      return;
    }

    if (!this.currentAgent) {
      for (const [name, config] of Object.entries(AGENTS)) {
        if (config.default) {
          this.currentAgent = name;
          break;
        }
      }
    }

    const agentConfig = AGENTS[this.currentAgent];
    console.log(`Starting ${agentConfig.name}...`);
    
    this.process = spawn(agentConfig.command, [], {
      shell: true,
      cwd: process.cwd()
    });

    this.process.stdout.on('data', (data) => {
      const message = data.toString();
      console.log(`${agentConfig.name} output:`, message);
      this.broadcast({ type: 'output', content: message, agent: this.currentAgent });
    });

    this.process.stderr.on('data', (data) => {
      const message = data.toString();
      console.error(`${agentConfig.name} error:`, message);
      this.broadcast({ type: 'error', content: message, agent: this.currentAgent });
    });

    this.process.on('close', (code) => {
      console.log(`${agentConfig.name} process exited with code ${code}`);
      this.process = null;
      this.broadcast({ type: 'status', status: 'disconnected', agent: this.currentAgent });
    });

    this.broadcast({ 
      type: 'status', 
      status: 'connected', 
      agent: this.currentAgent,
      agentName: agentConfig.name
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  sendInput(message) {
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(message + '\n');
      this.broadcast({ type: 'input', content: message, agent: this.currentAgent });
    } else {
      console.error('Agent process not running or stdin not writable');
    }
  }

  isRunning() {
    return this.process !== null;
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
