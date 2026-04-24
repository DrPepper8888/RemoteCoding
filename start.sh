#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              OpenCode/Claude Multi-Platform Remote              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装：https://nodejs.org/"
    exit 1
fi

# 检查 Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 未安装，请先安装：https://www.python.org/"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node.js 依赖..."
    npm install
fi

# 显示配置
echo ""
echo "📋 当前配置："
echo "   - 端口: 8765"
echo "   - 默认 Agent: OpenCode"
echo "   - WebSocket: 启用"
echo "   - 飞书: 启用"
echo ""

echo "🚀 启动服务器..."
echo ""
echo "   本机访问: http://localhost:8765"
echo "   网络访问: http://$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'):8765"
echo ""
echo "   按 Ctrl+C 停止"
echo ""

node server.js
