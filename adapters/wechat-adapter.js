const axios = require('axios');
const BaseAdapter = require('./base-adapter');

class WeChatAdapter extends BaseAdapter {
  constructor(config, app) {
    super('wechat', config);
    this.app = app;
    this.conversations = new Set();
    this.messageQueue = [];
    this.lastSentTime = 0;
  }

  async start() {
    if (!this.enabled) {
      console.log('[WeChat] Adapter disabled');
      return;
    }

    if (this.config.webhookUrl) {
      this.setupWebhookMode();
      console.log('[WeChat] Using Webhook mode (群机器人)');
    } else if (this.config.corpId && this.config.secret && this.config.agentId) {
      await this.setupCorpWeChatMode();
      console.log('[WeChat] Using Corp mode (企业微信应用)');
    } else {
      console.log('[WeChat] Missing configuration, adapter disabled');
      console.log('[WeChat] Please set either:');
      console.log('[WeChat]   1. webhookUrl (群机器人，最简单)');
      console.log('[WeChat]   2. corpId + secret + agentId (企业微信应用)');
      this.enabled = false;
      return;
    }

    console.log('[WeChat] Adapter started successfully');
  }

  async stop() {
    console.log('[WeChat] Adapter stopped');
  }

  // ============================================
  // Webhook 模式（企业微信群机器人，最简单）
  // ============================================
  setupWebhookMode() {
    // 企业微信群机器人 webhook 接收消息
    this.app.post('/wechat/webhook', async (req, res) => {
      try {
        // 企业微信群机器人只支持发送，不支持接收
        // 这里主要是心跳检测，返回 success 即可
        res.json({ success: true });
      } catch (error) {
        console.error('[WeChat] Webhook error:', error);
        res.json({ success: false });
      }
    });

    // 同时监听一个自定义端口用于接收微信消息（通过内网穿透）
    if (this.config.listenPort) {
      this.setupMessageListener();
    }
  }

  setupMessageListener() {
    // 如果需要接收微信消息，需要配置内网穿透
    // 这里预留接口，实际使用时通过 ngrok/frp 等工具暴露
    this.app.post('/wechat/message', async (req, res) => {
      try {
        const { Content, FromUserName } = req.body;
        if (Content) {
          this.conversations.add(FromUserName || 'default');
          await this.handleIncomingMessage(Content);
        }
        res.send('success');
      } catch (error) {
        console.error('[WeChat] Message handler error:', error);
        res.send('error');
      }
    });
  }

  // ============================================
  // 企业微信应用模式（需要公网回调地址）
  // ============================================
  async setupCorpWeChatMode() {
    await this.refreshAccessToken();
    // 每 2 小时刷新一次 token
    setInterval(() => this.refreshAccessToken(), 2 * 60 * 60 * 1000);

    // 企业微信回调接口
    this.app.post('/wechat/callback', async (req, res) => {
      try {
        const { ToUserName, FromUserName, MsgType, Content, Event } = req.body;
        
        // 处理事件订阅
        if (Event === 'subscribe' || Event === 'unsubscribe') {
          console.log('[WeChat] User subscribe event:', Event);
          res.send('success');
          return;
        }

        // 处理文本消息
        if (MsgType === 'text' && Content) {
          this.conversations.add(FromUserName);
          await this.handleIncomingMessage(Content);
        } else if (MsgType === 'event') {
          // 点击菜单等事件
          console.log('[WeChat] Event:', Event);
        }
        
        // 微信服务器需要返回 success 才不会重复推送
        res.send('success');
      } catch (error) {
        console.error('[WeChat] Callback error:', error);
        res.send('error');
      }
    });

    // 获取企业微信回调 IP 验证（可选）
    this.app.get('/wechat/callback', (req, res) => {
      res.send(req.query.msg_signature || 'verify');
    });
  }

  async refreshAccessToken() {
    if (!this.config.corpId || !this.config.secret) return;
    try {
      const response = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/gettoken', {
        params: { 
          corpid: this.config.corpId, 
          corpsecret: this.config.secret 
        }
      });
      if (response.data.errcode === 0) {
        this.accessToken = response.data.access_token;
        console.log('[WeChat] Access token refreshed');
      } else {
        console.error('[WeChat] Token refresh failed:', response.data.errmsg);
      }
    } catch (error) {
      console.error('[WeChat] Failed to refresh token:', error.message);
    }
  }

  // ============================================
  // 消息处理
  // ============================================
  async handleIncomingMessage(text) {
    const message = text.trim();
    
    // 命令处理
    if (message === '/start') {
      this.handleStart();
      await this.sendToWeChat(`🚀 ${this.getCurrentAgentName() || 'OpenCode'} 已启动！`);
    } else if (message === '/stop') {
      this.handleStop();
      await this.sendToWeChat('⏹️ 已停止！');
    } else if (message === '/help') {
      await this.sendHelpMessage();
    } else if (message === '/status') {
      const status = this.isAgentRunning() ? '运行中' : '已停止';
      await this.sendToWeChat(`📊 Agent 状态：${status}\n当前 Agent：${this.getCurrentAgentName() || 'OpenCode'}`);
    } else if (message.startsWith('/agent')) {
      await this.handleAgentCommand(message);
    } else if (message.startsWith('/')) {
      await this.sendToWeChat(`❓ 未知命令：${message}\n发送 /help 查看所有命令`);
    } else {
      // 普通消息，发送给 Agent
      this.handleInput(message);
      // 发送确认
      await this.sendToWeChat(`📨 消息已发送，正在处理...`);
    }
  }

  async handleAgentCommand(message) {
    const parts = message.split(' ');
    
    if (parts.length === 1) {
      // 只输入 /agent，显示当前状态
      const available = this.getAvailableAgents().join(', ');
      const current = this.getCurrentAgentName() || 'OpenCode';
      await this.sendToWeChat(
        `🤖 当前 Agent：${current}\n\n可用 Agent：${available}\n\n切换：/agent <name>\n例如：/agent opencode`
      );
    } else if (parts.length === 2) {
      const agentName = this.handleSwitchAgent(parts[1]);
      if (agentName) {
        await this.sendToWeChat(`✅ 已切换到 ${agentName}！`);
      } else {
        const available = this.getAvailableAgents().join(', ');
        await this.sendToWeChat(`❌ 未知 Agent：${parts[1]}\n可用：${available}`);
      }
    } else {
      await this.sendToWeChat(`❓ 用法：/agent <name>\n例如：/agent opencode`);
    }
  }

  async sendHelpMessage() {
    const helpText = `
📚 **RemoteCoding 命令帮助**

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

⚠️ 注意：Agent 运行在您的电脑上，代码不会离开本地
    `.trim();
    
    await this.sendToWeChat(helpText);
  }

  // ============================================
  // 消息发送
  // ============================================
  async sendToWeChat(content) {
    if (!content || !content.trim()) return;

    // 防止发送过于频繁（微信限制）
    const now = Date.now();
    if (now - this.lastSentTime < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.config.webhookUrl) {
      await this.sendViaWebhook(content);
    } else if (this.accessToken) {
      await this.sendViaCorpWeChat(content);
    }
    
    this.lastSentTime = Date.now();
  }

  async sendViaWebhook(content) {
    try {
      // 分割长消息（微信限制 2000 字符）
      const chunks = this.splitMessage(content);
      
      for (const chunk of chunks) {
        await axios.post(this.config.webhookUrl, {
          msgtype: 'text',
          text: { content: chunk }
        }, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        // 每条消息间隔 0.5 秒
        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('[WeChat] Failed to send via webhook:', error.message);
    }
  }

  async sendViaCorpWeChat(content) {
    try {
      const chunks = this.splitMessage(content);
      
      for (const chunk of chunks) {
        // 发送给所有对话过的用户
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
        
        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('[WeChat] Failed to send via corp:', error.message);
    }
  }

  splitMessage(text, maxLength = 1800) {
    // 保留一些空间给格式字符
    const chunks = [];
    let current = '';
    const lines = text.split('\n');

    for (const line of lines) {
      // 如果单行本身就超过限制，需要拆分
      if (line.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        // 按字符数拆分
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
      this.sendToWeChat(content);
    }
  }
}

module.exports = WeChatAdapter;
