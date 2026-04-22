# 飞书机器人配置指南

## 📋 配置步骤

### 第一步：创建飞书应用

1. 打开 [飞书开放平台](https://open.feishu.cn/)
2. 点击「创建企业自建应用」
3. 填写应用信息：
   - 应用名称：`RemoteCoding`（或你喜欢的名字）
   - 应用描述：`远程操控 OpenCode/Claude Code`
4. 点击创建

### 第二步：获取凭证

1. 进入应用详情页
2. 点击「凭证与基础信息」
3. 复制 **App ID** 和 **App Secret**

### 第三步：配置机器人能力

1. 在左侧菜单点击「添加应用能力」
2. 找到「机器人」并添加
3. 开启机器人功能

### 第四步：配置事件订阅

1. 在左侧菜单点击「事件与回调」
2. 点击「添加事件」
3. 搜索并添加：`接收消息 im.message.receive_v1`
4. 请求地址填写：
   ```
   http://你的电脑IP:8765/feishu/webhook
   ```
   ⚠️ 注意：必须是公网可访问的地址！

### 第五步：发布应用

1. 点击「版本管理与发布」
2. 创建版本
3. 申请发布（如果是管理员可以直接发布）

---

## 🔧 配置 config.json

编辑项目中的 `config.json`：

```json
{
  "port": 8765,
  "defaultAgent": "opencode",
  "websocket": {
    "enabled": true
  },
  "feishu": {
    "enabled": true,
    "appId": "cli_xxxxxxxxxx",
    "appSecret": "xxxxxxxxxx"
  },
  "wechat": {
    "enabled": false
  },
  "qq": {
    "enabled": false
  }
}
```

把 `cli_xxxxxxxxxx` 和 `xxxxxxxxxx` 替换成你从飞书获取的 App ID 和 App Secret。

---

## 🚀 启动服务

```bash
cd RemoteCoding
npm start
```

---

## 📱 使用飞书

1. 在飞书里找到你的机器人
2. 发送 `/help` 查看帮助
3. 发送 `/start` 启动 OpenCode
4. 直接发送消息开始对话

---

## ⚠️ 重要提示：公网访问问题

飞书机器人需要公网可访问的回调地址。有两种解决方案：

### 方案 A：内网穿透（推荐 ngrok）

1. 安装 ngrok：
```bash
# macOS
brew install ngrok

# Windows
choco install ngrok
```

2. 配置 ngrok（需要注册账号）：
```bash
ngrok config add-authtoken 你的token
```

3. 启动内网穿透：
```bash
ngrok http 8765
```

4. 复制显示的 HTTPS 地址（如 `https://xxxx.ngrok.io`）

5. 在飞书事件订阅中填写：
   ```
   https://xxxx.ngrok.io/feishu/webhook
   ```

### 方案 B：使用服务器部署

如果你有公网服务器，可以把 RemoteCoding 部署在服务器上，回调地址直接填服务器地址。

---

## 💡 测试是否成功

1. 启动服务：`npm start`
2. 配置好 ngrok 或公网地址
3. 在飞书开放平台的事件订阅中保存地址
4. 给机器人发一条消息
5. 看控制台是否有 `[Feishu] Received:` 日志

---

## ❓ 常见问题

### Q: 飞书提示「请求地址不可访问」？
A: 确保：
1. ngrok 或服务器已启动
2. 飞书填的地址是 HTTPS（ngrok 给的就是 HTTPS）
3. 电脑防火墙没有阻止

### Q: 发送消息没有反应？
A: 检查：
1. config.json 中飞书配置是否正确
2. 控制台是否有 `[Feishu]` 相关日志
3. 应用是否已发布

### Q: 如何找到机器人？
A: 在飞书搜索应用名称，或者让管理员在应用管理里添加机器人到群聊

---

## 📞 帮助

如果遇到问题，查看控制台输出的日志，通常会有具体的错误信息。
