const axios = require('axios');
const BaseAdapter = require('./base-adapter');

class FeishuAdapter extends BaseAdapter {
  constructor(config, app) {
    super('feishu', config);
    this.app = app;
    this.tenantAccessToken = '';
    this.tokenExpireTime = 0;
    this.messageQueue = [];
    this.isProcessing = false;
    this.conversations = new Map();
  }

  async start() {
    if (!this.enabled) {
      console.log('[Feishu] Adapter disabled');
      return;
    }

    if (!this.config.appId || !this.config.appSecret) {
      console.log('[Feishu] Missing appId or appSecret, adapter disabled');
      return;
    }

    this.setupWebhook();
    await this.refreshTenantAccessToken();
    setInterval(() => this.refreshTenantAccessToken(), 1800000);

    console.log('[Feishu] Adapter started');
  }

  async stop() {
    console.log('[Feishu] Adapter stopped');
  }

  setupWebhook() {
    this.app.post('/feishu/webhook', async (req, res) => {
      try {
        const { header, event } = req.body;

        if (header?.event_type === 'im.message.receive_v1') {
          await this.handleMessage(event);
        }

        res.json({ code: 0 });
      } catch (error) {
        console.error('[Feishu] Webhook error:', error);
        res.json({ code: 1 });
      }
    });
  }

  async handleMessage(event) {
    const message = event.message;
    const sender = event.sender;
    const chatId = message.chat_id;

    if (message.message_type === 'text') {
      const content = JSON.parse(message.content);
      const text = content.text.trim();

      if (text === '/start') {
        this.handleStart();
        await this.sendTextMessage(chatId, `${this.getCurrentAgentName() || 'OpenCode'} 已启动！`);
      } else if (text === '/stop') {
        this.handleStop();
        await this.sendTextMessage(chatId, '已停止！');
      } else if (text.startsWith('/agent')) {
        const parts = text.split(' ');
        if (parts.length === 2) {
          const agentName = this.handleSwitchAgent(parts[1]);
          if (agentName) {
            await this.sendTextMessage(chatId, `已切换到 ${agentName}！`);
          } else {
            const available = this.getAvailableAgents().join(', ');
            await this.sendTextMessage(chatId, `未知 agent！可用的 agent: ${available}`);
          }
        } else {
          const available = this.getAvailableAgents().join(', ');
          const current = this.getCurrentAgentName() || '未设置';
          await this.sendTextMessage(chatId, `当前 agent: ${current}\n可用: ${available}\n使用 /agent <name> 切换`);
        }
      } else if (!text.startsWith('/')) {
        this.conversations.set(chatId, true);
        this.handleInput(text);
      }
    }
  }

  async refreshTenantAccessToken() {
    try {
      const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: this.config.appId,
        app_secret: this.config.appSecret
      });

      if (response.data.code === 0) {
        this.tenantAccessToken = response.data.tenant_access_token;
        this.tokenExpireTime = Date.now() + (response.data.expire - 60) * 1000;
      }
    } catch (error) {
      console.error('[Feishu] Failed to refresh token:', error.message);
    }
  }

  async sendTextMessage(chatId, text) {
    try {
      const chunks = this.splitMessage(text);
      for (const chunk of chunks) {
        await axios.post(
          'https://open.feishu.cn/open-apis/im/v1/messages',
          {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: chunk })
          },
          {
            params: { receive_id_type: 'chat_id' },
            headers: { Authorization: `Bearer ${this.tenantAccessToken}` }
          }
        );
      }
    } catch (error) {
      console.error('[Feishu] Failed to send message:', error.message);
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
      for (const chatId of this.conversations.keys()) {
        this.sendTextMessage(chatId, content);
      }
    }
  }
}

module.exports = FeishuAdapter;
