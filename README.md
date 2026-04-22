# OpenCode/Claude Multi-Platform Remote

让你用手机、微信、飞书或 QQ 操控电脑端的 **OpenCode** 或 **Claude Code** 进行 vibe coding！

## 功能特点

- 🤖 **双 Agent 支持** - OpenCode 和 Claude Code 任你选择
- 📱 **手机 WiFi 网页** - 无需安装 APP，浏览器即可
- 💬 **微信** - 企业微信机器人或 webhook
- 📘 **飞书** - 飞书机器人
- 🐧 **QQ** - 通过 OneBot 协议（go-cqhttp）
- 🔄 **多平台同步** - 所有平台消息实时同步
- 💻 **本地运行** - 代码不离开你的机器

## 快速开始

### 前置要求

1. 已安装 [Node.js](https://nodejs.org/) (v14 或更高版本)
2. 已安装 [Python 3](https://www.python.org/) (v3.7 或更高版本)
3. 已安装至少一个编码 agent：
   - [OpenCode](https://opencode.ai)
   - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)
4. （可选）对应平台的机器人配置

### 安装和启动

#### Windows 用户

双击运行 `start.bat` 文件即可！

#### 手动启动

1. 安装 Node.js 依赖：
```bash
npm install
```

2. 确保已安装 Python 3（必须！
```bash
python --version
```

3. 复制配置文件（如需要）：
```bash
copy config.example.json config.json
```

4. 根据需要编辑 `config.json`，设置默认 agent 和启用平台

5. 启动服务器：
```bash
npm start
```

## 配置文件

`config.json` 主要配置项：

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

- `defaultAgent`: 设置默认启动的 agent（`opencode` 或 `claudecode`）

## Agent 切换

### 手机网页端
直接在页面顶部的下拉菜单中选择 "OpenCode" 或 "Claude Code"。

### 所有平台通用命令
- `/agent` - 查看当前 agent 和可用列表
- `/agent opencode` - 切换到 OpenCode
- `/agent claudecode` - 切换到 Claude Code

切换 agent 时，如果当前 agent 正在运行，会自动重启。

## 通用命令

在任何平台都可以使用：

- `/start` - 启动当前选中的 agent
- `/stop` - 停止当前 agent
- `/agent` - 查看/切换 agent
- 直接发送消息与 agent 对话

## 平台配置

### 1. 手机 WiFi 网页（默认启用）

无需额外配置，启动后直接访问显示的网络地址即可。

### 2. 飞书机器人

1. 在[飞书开放平台](https://open.feishu.cn/)创建应用
2. 获取 App ID 和 App Secret
3. 开启事件订阅，请求地址填：`http://<your-ip>:8765/feishu/webhook`
4. 配置 `config.json`：
```json
{
  "feishu": {
    "enabled": true,
    "appId": "cli_xxxxxxxxxx",
    "appSecret": "xxxxxxxxxx"
  }
}
```

### 3. 微信

#### 方案 A：企业微信群机器人（最简单）

1. 在企业微信群添加群机器人
2. 获取 Webhook 地址
3. 配置 `config.json`：
```json
{
  "wechat": {
    "enabled": true,
    "webhookUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxxxx"
  }
}
```

#### 方案 B：企业微信应用

配置 `corpId`、`secret`、`agentId`。

### 4. QQ（使用 go-cqhttp）

1. 下载并配置 [go-cqhttp](https://github.com/Mrs4s/go-cqhttp)
2. 设置 HTTP 服务器和上报地址：`http://127.0.0.1:8765/qq/webhook`
3. 配置 `config.json`：
```json
{
  "qq": {
    "enabled": true,
    "onebotUrl": "http://127.0.0.1:8080"
  }
}
```

## 项目结构

```
opencode-mobile-remote/
├── server.js              # 主服务器
├── config.json            # 配置文件
├── config.example.json    # 配置示例
├── package.json           # 项目配置
├── start.bat              # Windows 启动脚本
├── README.md              # 说明文档
├── core/
│   └── opencode-manager.js  # Agent 管理核心（支持 OpenCode/Claude）
├── adapters/
│   ├── base-adapter.js    # 适配器基类
│   ├── websocket-adapter.js  # WiFi 网页适配器
│   ├── feishu-adapter.js  # 飞书适配器
│   ├── wechat-adapter.js  # 微信适配器
│   └── qq-adapter.js      # QQ 适配器
└── public/
    └── index.html         # 手机端 Web 界面
```

## 工作原理

```
┌─────────────┐
│  手机浏览器   │
└──────┬──────┘
       │
┌──────▼──────┐         ┌─────────────┐
│   微信机器人   │         │             │
└──────┬──────┘         │             │
       │                │             │
┌──────▼──────┐         │  适配器层    │         ┌─────────────┐
│   飞书机器人   │◀──────▶│             │◀──────▶│  OpenCode   │
└──────┬──────┘         │             │         │   /Claude   │
       │                │             │         │             │
┌──────▼──────┐         └─────────────┘         └─────────────┘
│   QQ 机器人   │
└─────────────┘
```

## 安全提示

- 仅在信任的网络中使用
- 不要在公共网络暴露服务
- 妥善保管机器人 token
- 所有代码和数据都在本地

## 故障排除

见原 README.md 的故障排除部分。

## 许可证

MIT License
