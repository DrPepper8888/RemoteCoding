const axios = require('axios');
const BaseAdapter = require('./base-adapter');

class QQAdapter extends BaseAdapter {
  constructor(config, app) {
    super('qq', config);
    this.app = app;
    this.conversations = new Set();
    this.onebotUrl = config.onebotUrl || 'http://127.0.0.1:8080';
  }

  async start() {
    if (!this.enabled) {
      console.log('[QQ] Adapter disabled');
      return;
    }

    this.setupWebhook();
    console.log('[QQ] Adapter started (using OneBot protocol)');
    console.log('[QQ] Make sure go-cqhttp or similar is running at:', this.onebotUrl);
  }

  async stop() {
    console.log('[QQ] Adapter stopped');
  }

  setupWebhook() {
    this.app.post('/qq/webhook', async (req, res) => {
      try {
        const { post_type, message_type, user_id, group_id, raw_message, message } = req.body;

        if (post_type === 'message') {
          const text = raw_message || (Array.isArray(message) ? message.map(m => m.data?.text || '').join('') : '');
          
          if (text) {
            const conversationId = message_type === 'group' ? `group_${group_id}` : `private_${user_id}`;
            this.conversations.add(conversationId);
            this.conversationType = message_type;
            this.conversationTarget = message_type === 'group' ? group_id : user_id;
            
            await this.handleIncomingMessage(text.trim());
          }
        }

        res.json({ status: 'ok' });
      } catch (error) {
        console.error('[QQ] Webhook error:', error);
        res.json({ status: 'error' });
      }
    });
  }

  async handleIncomingMessage(text) {
    if (text === '/start') {
      this.handleStart();
      await this.sendToQQ(`${this.getCurrentAgentName() || 'OpenCode'} 已启动！`);
    } else if (text === '/stop') {
      this.handleStop();
      await this.sendToQQ('已停止！');
    } else if (text.startsWith('/agent')) {
      const parts = text.split(' ');
      if (parts.length === 2) {
        const agentName = this.handleSwitchAgent(parts[1]);
        if (agentName) {
          await this.sendToQQ(`已切换到 ${agentName}！`);
        } else {
          const available = this.getAvailableAgents().join(', ');
          await this.sendToQQ(`未知 agent！可用的 agent: ${available}`);
        }
      } else {
        const available = this.getAvailableAgents().join(', ');
        const current = this.getCurrentAgentName() || '未设置';
        await this.sendToQQ(`当前 agent: ${current}\n可用: ${available}\n使用 /agent <name> 切换`);
      }
    } else if (!text.startsWith('/')) {
      this.handleInput(text);
    }
  }

  async sendToQQ(content) {
    if (!this.conversationTarget) {
      console.log('[QQ] No active conversation, skipping message');
      return;
    }

    try {
      const chunks = this.splitMessage(content);
      for (const chunk of chunks) {
        const endpoint = this.conversationType === 'group' ? '/send_group_msg' : '/send_private_msg';
        const data = this.conversationType === 'group' 
          ? { group_id: this.conversationTarget, message: chunk }
          : { user_id: this.conversationTarget, message: chunk };

        await axios.post(`${this.onebotUrl}${endpoint}`, data);
      }
    } catch (error) {
      console.error('[QQ] Failed to send message:', error.message);
    }
  }

  splitMessage(text, maxLength = 2000) {
    const chunks = [];
    let current = '';
    const lines = text.split('\n');

    for (const line of lines) {
      if (current.length + line.length + 1 > maxLength) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }

  sendMessage(message) {
    if (!this.enabled) return;

    let content = '';
    switch (message.type) {
      case 'output':
        content = message.content;
        break;
      case 'input':
        content = `> ${message.content}`;
        break;
      case 'error':
        content = `❌ Error: ${message.content}`;
        break;
      case 'status':
        const agentName = message.agent === 'claudecode' ? 'Claude Code' : 'OpenCode';
        content = message.status === 'connected' ? `✅ ${agentName} 已连接` : `❌ ${agentName} 已断开`;
        break;
      case 'system':
        content = message.content;
        break;
      default:
        return;
    }

    if (content.trim()) {
      this.sendToQQ(content);
    }
  }
}

module.exports = QQAdapter;
