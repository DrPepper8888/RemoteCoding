class BaseAdapter {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.agentManager = null;
  }

  setOpencodeManager(manager) {
    this.agentManager = manager;
  }

  setAgentManager(manager) {
    this.agentManager = manager;
  }

  async start() {
    throw new Error('start() must be implemented by subclass');
  }

  async stop() {
    throw new Error('stop() must be implemented by subclass');
  }

  sendMessage(message) {
    throw new Error('sendMessage() must be implemented by subclass');
  }

  handleInput(content) {
    if (this.agentManager) {
      this.agentManager.sendInput(content);
    }
  }

  handleStart() {
    if (this.agentManager) {
      this.agentManager.start();
    }
  }

  handleStop() {
    if (this.agentManager) {
      this.agentManager.stop();
    }
  }

  handleSwitchAgent(agentName) {
    if (this.agentManager) {
      try {
        return this.agentManager.switchAgent(agentName);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  getAvailableAgents() {
    if (this.agentManager) {
      return this.agentManager.getAvailableAgents();
    }
    return [];
  }

  getCurrentAgentName() {
    if (this.agentManager) {
      return this.agentManager.getCurrentAgentName();
    }
    return null;
  }
}

module.exports = BaseAdapter;
