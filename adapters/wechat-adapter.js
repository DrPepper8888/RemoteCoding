const axios = require('axios');
const BaseAdapter = require('./base-adapter');

class WeChatAdapter extends BaseAdapter {
  constructor(config, app) {
    super('wechat', config);
    this.app = app;
    this.conversations = new Set();
    this.messageQueue = [];
  }

  async start() {
    if (!this.enabled) {
      console.log('[WeChat] Adapter disabled');
      return;
    }

    if (this.config.webhookUrl) {
      this.setupWebhookMode();
    } else if (this.config.corpId && this.config.secret && this.config.agentId) {
      await this.setupCorpWeChatMode();
    } else {
      console.log('[WeChat] Missing configuration, adapter disabled');
      console.log('[WeChat] Please set either webhookUrl or corpId/secret/agentId');
      this.enabled = false;
      return;
    }

    console.log('[WeChat] Adapter started');
  }

  async stop() {
    console.log('[WeChat] Adapter stopped');
  }

  setupWebhookMode() {
    this.app.post('/wechat/webhook', async (req, res) => {
      try {
        const { text } = req.body;
        if (text) {
          await this.handleIncomingMessage(text);
        }
        res.json({ success: true });
      } catch (error) {
        console.error('[WeChat] Webhook error:', error);
        res.json({ success: false });
      }
    });
  }

  async setupCorpWeChatMode() {
    this.accessToken = '';
    await this.refreshAccessToken();
    setInterval(() => this.refreshAccessToken(), 7000000);

    this.app.post('/wechat/callback', async (req, res) => {
      try {
        const { ToUserName, FromUserName, MsgType, Content } = req.body;
        if (MsgType === 'text' && Content) {
          this.conversations.add(FromUserName);
          await this.handleIncomingMessage(Content);
        }
        res.send('success');
      } catch (error) {
        console.error('[WeChat] Callback error:', error);
        res.send('error');
      }
    });
  }

  async refreshAccessToken() {
    if (!this.config.corpId || !this.config.secret) return;
    try {
      const response = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/gettoken', {
        params: { corpid: this.config.corpId, corpsecret: this.config.secret }
      });
      if (response.data.errcode === 0) {
        this.accessToken = response.data.access_token;
      }
    } catch (error) {
      console.error('[WeChat] Failed to refresh token:', error.message);
    }
  }

  async handleIncomingMessage(text) {
    const message = text.trim();
    if (message === '/start') {
      this.handleStart();
      await this.sendToWeChat(`${this.getCurrentAgentName() || 'OpenCode'} 已启动！`);
    } else if (message === '/stop') {
      this.handleStop();
      await this.sendToWeChat('已停止！');
    } else if (message.startsWith('/agent')) {
      const parts = message.split(' ');
      if (parts.length === 2) {
        const agentName = this.handleSwitchAgent(parts[1]);
        if (agentName) {
          await this.sendToWeChat(`已切换到 ${agentName}！`);
        } else {
          const available = this.getAvailableAgents().join(', ');
          await this.sendToWeChat(`未知 agent！可用的 agent: ${available}`);
        }
      } else {
        const available = this.getAvailableAgents().join(', ');
        const current = this.getCurrentAgentName() || '未设置';
        await this.sendToWeChat(`当前 agent: ${current}\n可用: ${available}\n使用 /agent <name> 切换`);
      }
    } else if (!message.startsWith('/')) {
      this.handleInput(message);
    }
  }

  async sendToWeChat(content) {
    if (this.config.webhookUrl) {
      await this.sendViaWebhook(content);
    } else if (this.accessToken) {
      await this.sendViaCorpWeChat(content);
    }
  }

  async sendViaWebhook(content) {
    try {
      const chunks = this.splitMessage(content);
      for (const chunk of chunks) {
        await axios.post(this.config.webhookUrl, {
          msgtype: 'text',
          text: { content: chunk }
        });
      }
    } catch (error) {
      console.error('[WeChat] Failed to send via webhook:', error.message);
    }
  }

  async sendViaCorpWeChat(content) {
    try {
      const chunks = this.splitMessage(content);
      for (const chunk of chunks) {
        for (const userId of this.conversations) {
          await axios.post(
            'https://qyapi.weixin.qq.com/cgi-bin/message/send',
            {
              touser: userId,
              msgtype: 'text',
              agentid: this.config.agentId,
              text: { content: chunk }
            },
            { params: { access_token: this.accessToken } }
          );
        }
      }
    } catch (error) {
      console.error('[WeChat] Failed to send via corp:', error.message);
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
      this.sendToWeChat(content);
    }
  }
}

module.exports = WeChatAdapter;
