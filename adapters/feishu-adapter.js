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
    this.lastSentTime = 0;
  }

  async start() {
    if (!this.enabled) {
      console.log('[Feishu] Adapter disabled');
      return;
    }

    if (!this.config.appId || !this.config.appSecret) {
      console.log('[Feishu] Missing appId or appSecret, adapter disabled');
      console.log('[Feishu] Please set feishu.appId and feishu.appSecret in config.json');
      return;
    }

    this.setupWebhook();
    await this.refreshTenantAccessToken();
    // 每 2 小时刷新一次 token（token 有效期 2 小时）
    setInterval(() => this.refreshTenantAccessToken(), 2 * 60 * 60 * 1000);

    console.log('[Feishu] Adapter started successfully');
  }

  async stop() {
    console.log('[Feishu] Adapter stopped');
  }

  // ============================================
  // Webhook 设置
  // ============================================
  setupWebhook() {
    // 飞书事件订阅验证 URL（GET 请求）
    this.app.get('/feishu/webhook', (req, res) => {
      const { challenge } = req.query;
      if (challenge) {
        // 飞书配置验证
        res.json({ challenge });
      } else {
        res.send('Feishu Webhook OK');
      }
    });

    // 飞书消息接收（POST 请求）
    this.app.post('/feishu/webhook', async (req, res) => {
      try {
        // 飞书要求立即响应
        res.json({ code: 0 });

        const { header, event } = req.body;

        // 处理验证请求
        if (header?.event_type === 'im.message.receive_v1') {
          await this.handleMessage(event);
        }
      } catch (error) {
        console.error('[Feishu] Webhook error:', error);
        res.json({ code: 1 });
      }
    });
  }

  // ============================================
  // 消息处理
  // ============================================
  async handleMessage(event) {
    const message = event.message;
    const sender = event.sender;
    const chatId = message.chat_id;
    const userId = sender?.sender?.sender_id?.user_id;

    console.log(`[Feishu] Received: ${message.message_type} from ${userId || 'unknown'}`);

    if (message.message_type === 'text') {
      const content = JSON.parse(message.content);
      const text = content.text.trim();

      // 记录对话
      this.conversations.set(chatId, {
        userId,
        lastMessage: new Date().toISOString()
      });

      await this.processCommand(text, chatId);
    } else if (message.message_type === 'post') {
      // 图文消息，只记录不处理
      console.log('[Feishu] Received post message, ignored');
    } else {
      // 其他类型消息
      console.log(`[Feishu] Unsupported message type: ${message.message_type}`);
    }
  }

  async processCommand(text, chatId) {
    // 命令处理
    if (text === '/start') {
      this.handleStart();
      await this.sendTextMessage(chatId, `🚀 ${this.getCurrentAgentName() || 'OpenCode'} 已启动！`);
    } else if (text === '/stop') {
      this.handleStop();
      await this.sendTextMessage(chatId, '⏹️ 已停止！');
    } else if (text === '/help') {
      await this.sendHelpMessage(chatId);
    } else if (text === '/status') {
      const status = this.isAgentRunning() ? '运行中' : '已停止';
      await this.sendTextMessage(chatId, `📊 Agent 状态：${status}\n当前 Agent：${this.getCurrentAgentName() || 'OpenCode'}`);
    } else if (text.startsWith('/agent')) {
      await this.handleAgentCommand(text, chatId);
    } else if (text.startsWith('/')) {
      await this.sendTextMessage(chatId, `❓ 未知命令：${text}\n发送 /help 查看所有命令`);
    } else {
      // 普通消息，发送给 Agent
      this.handleInput(text);
      await this.sendTextMessage(chatId, `📨 消息已发送，正在处理...`);
    }
  }

  async handleAgentCommand(text, chatId) {
    const parts = text.split(' ');

    if (parts.length === 1) {
      // 只输入 /agent，显示当前状态
      const available = this.getAvailableAgents().join(', ');
      const current = this.getCurrentAgentName() || 'OpenCode';
      await this.sendTextMessage(chatId,
        `🤖 当前 Agent：${current}\n\n可用 Agent：${available}\n\n切换：/agent <name>\n例如：/agent opencode`
      );
    } else if (parts.length === 2) {
      const agentName = this.handleSwitchAgent(parts[1]);
      if (agentName) {
        await this.sendTextMessage(chatId, `✅ 已切换到 ${agentName}！`);
      } else {
        const available = this.getAvailableAgents().join(', ');
        await this.sendTextMessage(chatId, `❌ 未知 Agent：${parts[1]}\n可用：${available}`);
      }
    } else {
      await this.sendTextMessage(chatId, `❓ 用法：/agent <name>\n例如：/agent opencode`);
    }
  }

  async sendHelpMessage(chatId) {
    const helpText = `📚 **RemoteCoding 命令帮助**

**基础命令：**
/start - 启动 Agent
/stop - 停止 Agent
/status - 查看状态
/help - 显示此帮助

**Agent 管理：**
/agent - 查看当前 Agent
/agent opencode - 切换到 OpenCode
/agent claudecode - 切换到 Claude Code

**使用方式：**
直接发送消息与 Agent 对话
Agent 的输出会实时推送到这里

⚠️ 注意：Agent 运行在您的电脑上`;

    await this.sendTextMessage(chatId, helpText);
  }

  // ============================================
  // Token 管理
  // ============================================
  async refreshTenantAccessToken() {
    try {
      const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
          app_id: this.config.appId,
          app_secret: this.config.appSecret
        }
      );

      if (response.data.code === 0) {
        this.tenantAccessToken = response.data.tenant_access_token;
        this.tokenExpireTime = Date.now() + (response.data.expire - 60) * 1000;
        console.log('[Feishu] Token refreshed successfully');
      } else {
        console.error('[Feishu] Token refresh failed:', response.data.msg);
      }
    } catch (error) {
      console.error('[Feishu] Failed to refresh token:', error.message);
    }
  }

  // ============================================
  // 消息发送
  // ============================================
  async sendTextMessage(chatId, text) {
    if (!text || !text.trim()) return;

    // 防止发送过于频繁
    const now = Date.now();
    if (now - this.lastSentTime < 500) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      // 分割长消息（飞书限制 4000 字符）
      const chunks = this.splitMessage(text, 3500);

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

        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('[Feishu] Failed to send message:', error.message);
      
      // 如果是 token 过期，尝试刷新后重试
      if (error.response?.status === 401) {
        await this.refreshTenantAccessToken();
        await this.sendTextMessage(chatId, text);
      }
    }

    this.lastSentTime = Date.now();
  }

  splitMessage(text, maxLength = 3500) {
    const chunks = [];
    let current = '';
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
      } else if (current.length + line.length + 1 > maxLength) {
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

  // ============================================
  // 广播消息（接收 Agent 的输出）
  // ============================================
  sendMessage(message) {
    if (!this.enabled) return;

    let content = '';
    switch (message.type) {
      case 'output':
        content = message.content;
        break;
      case 'input':
        content = `📤 你：${message.content}`;
        break;
      case 'error':
        content = `❌ 错误：${message.content}`;
        break;
      case 'status':
        const agentName = message.agent === 'claudecode' ? 'Claude Code' : 'OpenCode';
        content = message.status === 'connected'
          ? `✅ ${agentName} 已连接`
          : `⚠️ ${agentName} 已断开`;
        break;
      case 'system':
        content = message.content;
        break;
      default:
        return;
    }

    if (content && content.trim()) {
      // 发送给所有对话过的用户
      for (const chatId of this.conversations.keys()) {
        this.sendTextMessage(chatId, content);
      }
    }
  }
}

module.exports = FeishuAdapter;
