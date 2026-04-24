# 项目测试指南

## ✅ 已修复的问题

### 1. 核心模块方法缺失
**文件:** `core/opencode-manager.js`
- 添加了 `getAvailableAgents()` 方法
- 添加了 `getCurrentAgentName()` 方法

### 2. 打印语法错误
**文件:** `simple-server.py`
- 修复了 `print(f"[DEBUG] [BROADCAST: {msg}")` → `print(f"[DEBUG] [BROADCAST] {msg}")`
- 修复了 `[AGENT OUTPUT:` 和 `[AGENT READ ERROR:` 的括号问题

## 🚀 启动方式

### 方式 1: 使用 npm 启动（推荐）
```bash
npm start
```

### 方式 2: 直接启动
```bash
node server.js
```

## 📱 平台配置和测试

### 1. WebSocket 网页端（默认启用）
- **地址:** http://localhost:8765 或 http://你的IP:8765
- **测试:**
  1. 打开浏览器访问地址
  2. 点击 "Start" 按钮启动 Agent
  3. 发送消息测试

### 2. 飞书机器人（已配置）
- **状态:** ✅ 已配置，启用中
- **配置:**
  - App ID: `cli_a962d084ea7c9bef`
  - App Secret: 已设置
- **Webhook 地址:** `http://你的IP:8765/feishu/webhook`
- **飞书配置步骤:**
  1. 访问 https://open.feishu.cn/
  2. 进入应用管理 → 你的应用
  3. 事件订阅 → 请求地址填写上面的 Webhook
  4. 添加事件：`im.message.receive_v1`（接收消息）
  5. 发布版本 → 申请权限
- **测试命令:**
  - `/start` - 启动 Agent
  - `/stop` - 停止 Agent
  - `/agent` - 查看状态
  - `/agent opencode` - 切换 Agent
  - 直接发消息对话

### 3. 微信机器人
**方案 A: 企业微信群机器人（最简单）**
```json
{
  "wechat": {
    "enabled": true,
    "webhookUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key"
  }
}
```

**方案 B: 企业微信应用**
```json
{
  "wechat": {
    "enabled": true,
    "corpId": "你的企业ID",
    "secret": "你的应用Secret",
    "agentId": "应用ID"
  }
}
```

### 4. QQ 机器人（go-cqhttp）
```json
{
  "qq": {
    "enabled": true,
    "onebotUrl": "http://127.0.0.1:8080"
  }
}
```
- **配置 go-cqhttp:**
  1. 下载 go-cqhttp
  2. 配置 `config.yml`，设置上报地址：`http://127.0.0.1:8765/qq/webhook`
  3. 启动 go-cqhttp 登录 QQ

## 🔧 故障排除

### 问题: Python 桥接器启动失败
**检查:**
```bash
# 测试 Python 3
python3 --version

# 测试 bridge.py
python3 bridge.py
```

**解决方案:**
- 确保 Python 3.7+ 已安装
- 确保 `bridge.py` 文件存在且有执行权限

### 问题: OpenCode 命令找不到
**检查:**
```bash
opencode --version
```

**解决方案:**
```bash
npm install -g opencode-ai
```

### 问题: 飞书消息发不出去
**检查:**
1. Token 是否正确刷新
2. 机器人是否在群里
3. 是否已发布版本并申请权限

**需要的权限:**
- `im:message` - 发送消息
- `im:message.receive` - 接收消息

## 📊 项目状态

| 组件 | 状态 | 说明 |
|------|------|------|
| Node.js 服务 | ✅ 正常 | Express + HTTP 服务器 |
| Python 桥接器 | ✅ 正常 | 管理 OpenCode/Claude 子进程 |
| WebSocket 适配器 | ✅ 正常 | 手机网页端 |
| 飞书适配器 | ✅ 已配置 | 需要在飞书开放平台配置 Webhook |
| 微信适配器 | ✅ 代码完整 | 需要配置 Webhook 或企业微信应用 |
| QQ 适配器 | ✅ 代码完整 | 需要配置 go-cqhttp |
| Agent 管理器 | ✅ 已修复 | 新增缺失的两个方法 |

## 💡 使用建议

1. **先测试网页端** - 确保基础功能正常
2. **再配置飞书** - 飞书配置最简单，有官方 SDK 支持
3. **最后配置微信/QQ** - 需要额外的工具或配置
4. **多平台同步** - 所有平台的消息会实时同步，你可以在手机上继续电脑上的对话！

---

祝你使用愉快！🦆
