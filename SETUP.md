# RemoteCoding 快速配置指南

## 📦 第一步：安装依赖

### 1.1 安装 Node.js 依赖
```bash
cd RemoteCoding
npm install
```

### 1.2 安装 OpenCode（必须）
OpenCode 是 AI 编程助手，负责执行你的命令。

**macOS / Linux:**
```bash
npm install -g opencode-ai
```

**Windows:**
```bash
npm install -g opencode-ai
# 或者使用 Chocolatey
choco install opencode
```

**或者使用安装脚本（推荐）：**
```bash
curl -fsSL https://opencode.ai/install | bash
```

### 1.3 验证安装
```bash
opencode --version
```

---

## 🔧 第二步：配置

### 2.1 复制配置文件
```bash
cp config.example.json config.json
```

### 2.2 编辑 config.json
根据你使用的平台，选择合适的配置：

#### 方案 A：只使用手机网页（最简单）
```json
{
  "port": 8765,
  "defaultAgent": "opencode",
  "websocket": { "enabled": true },
  "feishu": { "enabled": false },
  "wechat": { "enabled": false },
  "qq": { "enabled": false }
}
```

#### 方案 B：使用企业微信群机器人
```json
{
  "port": 8765,
  "defaultAgent": "opencode",
  "websocket": { "enabled": true },
  "feishu": { "enabled": false },
  "wechat": {
    "enabled": true,
    "webhookUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的webhook地址"
  },
  "qq": { "enabled": false }
}
```

#### 方案 C：使用飞书
```json
{
  "port": 8765,
  "defaultAgent": "opencode",
  "websocket": { "enabled": true },
  "feishu": {
    "enabled": true,
    "appId": "cli_xxxxxxxxxx",
    "appSecret": "xxxxxxxxxx"
  },
  "wechat": { "enabled": false },
  "qq": { "enabled": false }
}
```

---

## 🚀 第三步：启动

### 3.1 启动服务
```bash
npm start
```

你会看到：
```
╔═══════════════════════════════════════════════════════════════╗
║              OpenCode/Claude Multi-Platform Remote              ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on:                                             ║
║  - Local:    http://localhost:8765                            ║
║  - Network:  http://192.168.x.x:8765                          ║
║                                                                 ║
║  Default Agent:                                                 ║
║  ✓ OpenCode                                                    ║
║                                                                 ║
║  Enabled platforms:                                             ║
║  ✓ WebSocket (Mobile WiFi)                                      ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3.2 连接方式

#### 📱 手机网页（最简单）
确保手机和电脑在同一 WiFi 下，打开显示的网络地址。

#### 💬 微信（推荐）

**创建企业微信群机器人：**
1. 打开企业微信，创建一个群聊
2. 点击群设置 → 添加群机器人
3. 创建一个机器人，记下 Webhook 地址
4. 把 Webhook 地址填入 config.json

---

## 💡 使用方法

### 启动后发送命令：
- `/start` - 启动 OpenCode
- `/stop` - 停止 OpenCode
- `/help` - 显示帮助
- `/status` - 查看状态
- `/agent opencode` - 切换到 OpenCode
- `/agent claudecode` - 切换到 Claude Code

### 直接发送消息：
直接发送消息给 OpenCode，它会执行命令并返回结果。

---

## 🔒 安全提示

1. **只在信任的网络中使用** - 服务会暴露到局域网
2. **不要在公共 WiFi 下使用** - 可能被他人访问
3. **定期检查 config.json** - 不要泄露 Webhook 地址

---

## ❓ 常见问题

### Q: OpenCode 启动失败？
```bash
# 检查是否安装
opencode --version

# 如果没安装，重新安装
npm install -g opencode-ai
```

### Q: 微信收不到消息？
1. 检查 config.json 中 wechat.enabled 是否为 true
2. 检查 webhookUrl 是否正确
3. 检查企业微信群机器人是否正常

### Q: 手机打不开页面？
1. 确保手机和电脑在同一 WiFi
2. 检查电脑防火墙设置
3. 尝试用 http://localhost:8765 在本机测试

---

## 📞 获取帮助

查看 GitHub 仓库：
https://github.com/DrPepper8888/RemoteCoding
