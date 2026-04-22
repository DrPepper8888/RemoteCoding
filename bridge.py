#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenCode/Claude Code Python Bridge
通过 stdin/stdout 与 Node.js 主服务通信
管理 OpenCode 或 Claude Code 进程的生命周期
"""
import sys
import os
import subprocess
import threading
import json
import time
import shutil

agent_process = None
stop_thread = False
current_agent = 'opencode'  # 'opencode' 或 'claudecode'

# Agent 配置
AGENT_CONFIGS = {
    'opencode': {
        'name': 'OpenCode',
        'command': 'opencode',
        'args': [],
        'install_hint': '运行: npm install -g opencode-ai'
    },
    'claudecode': {
        'name': 'Claude Code',
        'command': 'claude',
        'args': ['code'],
        'install_hint': '运行: npm install -g @anthropic-ai/claude-code'
    }
}

def send_to_node(msg):
    """发送消息给 Node.js 主服务"""
    json_str = json.dumps(msg, ensure_ascii=False)
    line = f"[MSG] {json_str}\n"
    sys.stdout.write(line)
    sys.stdout.flush()

def read_agent_output():
    """读取 Agent 进程的输出"""
    global agent_process, stop_thread
    
    print("[Bridge] Output reader started", file=sys.stderr)
    
    while not stop_thread and agent_process and agent_process.poll() is None:
        try:
            line = agent_process.stdout.readline()
            if not line:
                time.sleep(0.05)
                continue
            send_to_node({'type': 'output', 'content': line})
        except Exception as e:
            print(f"[Bridge] Read error: {e}", file=sys.stderr)
            break
    
    print("[Bridge] Output reader stopped", file=sys.stderr)

def read_node_input():
    """读取 Node.js 发送的消息"""
    print("[Bridge] Waiting for Node messages...", file=sys.stderr)
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            try:
                msg = json.loads(line.strip())
                handle_node_message(msg)
            except Exception as e:
                print(f"[Bridge] Parse error: {e}", file=sys.stderr)
                
        except Exception as e:
            print(f"[Bridge] Read error: {e}", file=sys.stderr)
            break

def handle_node_message(msg):
    """处理来自 Node.js 的消息"""
    global agent_process, current_agent
    
    msg_type = msg.get('type')
    
    if msg_type == 'start':
        start_agent(current_agent)
    elif msg_type == 'stop':
        stop_agent()
    elif msg_type == 'input':
        content = msg.get('content', '')
        send_to_agent(content)
    elif msg_type == 'switch':
        # 切换 Agent
        new_agent = msg.get('agent', 'opencode')
        if new_agent in AGENT_CONFIGS:
            was_running = agent_process is not None
            if was_running:
                stop_agent()
            current_agent = new_agent
            send_to_node({'type': 'system', 'content': f'已切换到 {AGENT_CONFIGS[new_agent]["name"]}'})
            if was_running:
                time.sleep(0.5)
                start_agent(current_agent)

def check_agent_available(agent_name):
    """检查 Agent 命令是否可用"""
    cmd = AGENT_CONFIGS[agent_name]['command']
    return shutil.which(cmd) is not None

def start_agent(agent_name='opencode'):
    """启动 Agent 进程"""
    global agent_process, stop_thread, current_agent
    
    if agent_process:
        print("[Bridge] Agent already running", file=sys.stderr)
        return
    
    config = AGENT_CONFIGS.get(agent_name, AGENT_CONFIGS['opencode'])
    cmd = config['command']
    
    # 检查命令是否存在
    if not check_agent_available(agent_name):
        error_msg = f'{config["name"]} 未安装！{config["install_hint"]}'
        print(f"[Bridge] {error_msg}", file=sys.stderr)
        send_to_node({'type': 'error', 'content': error_msg})
        send_to_node({'type': 'system', 'content': error_msg})
        return
    
    print(f"[Bridge] Starting {config['name']}...", file=sys.stderr)
    
    try:
        env = dict(os.environ)
        env['PYTHONIOENCODING'] = 'utf-8'
        env['TERM'] = 'xterm-256color'
        
        # 根据平台选择启动方式
        if sys.platform == 'win32':
            # Windows
            agent_process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                env=env,
                shell=True,
                cwd=os.path.expanduser('~')
            )
        else:
            # macOS / Linux
            agent_process = subprocess.Popen(
                [cmd] + config['args'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                env=env,
                cwd=os.path.expanduser('~')
            )
        
        current_agent = agent_name
        stop_thread = False
        threading.Thread(target=read_agent_output, daemon=True).start()
        
        time.sleep(2)
        send_to_node({
            'type': 'system', 
            'content': f'🚀 {config["name"]} 已启动！',
            'agent': agent_name
        })
        send_to_node({'type': 'status', 'status': 'connected', 'agent': agent_name})
        
        print(f"[Bridge] {config['name']} started OK (PID: {agent_process.pid})", file=sys.stderr)
        
    except FileNotFoundError:
        error_msg = f'{config["name"]} 命令未找到！请先安装：{config["install_hint"]}'
        print(f"[Bridge] {error_msg}", file=sys.stderr)
        send_to_node({'type': 'error', 'content': error_msg})
        send_to_node({'type': 'system', 'content': error_msg})
    except Exception as e:
        print(f"[Bridge] Start failed: {e}", file=sys.stderr)
        send_to_node({'type': 'system', 'content': f'启动失败: {e}'})

def stop_agent():
    """停止 Agent 进程"""
    global agent_process, stop_thread
    
    if agent_process:
        print("[Bridge] Stopping agent...", file=sys.stderr)
        stop_thread = True
        agent_process.terminate()
        try:
            agent_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            agent_process.kill()
            agent_process.wait()
        agent_process = None
        send_to_node({'type': 'status', 'status': 'disconnected'})
        print("[Bridge] Agent stopped", file=sys.stderr)

def send_to_agent(message):
    """发送消息给 Agent"""
    global agent_process
    
    if agent_process and agent_process.stdin:
        try:
            # OpenCode/Claude Code 通常通过 stdin 接收命令
            agent_process.stdin.write(message + '\n')
            agent_process.stdin.flush()
            print(f"[Bridge] Sent to agent: {message[:100]}", file=sys.stderr)
        except Exception as e:
            print(f"[Bridge] Send failed: {e}", file=sys.stderr)
            send_to_node({'type': 'error', 'content': f'发送失败: {e}'})
    else:
        print("[Bridge] Agent not running", file=sys.stderr)

def main():
    print("=" * 50, file=sys.stderr)
    print("  RemoteCoding Python Bridge", file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    print(file=sys.stderr)
    
    send_to_node({'type': 'system', 'content': '✅ Python 桥接器已启动！'})
    
    try:
        read_node_input()
    except KeyboardInterrupt:
        print("\n[Bridge] Shutting down...", file=sys.stderr)
        stop_agent()

if __name__ == '__main__':
    main()
