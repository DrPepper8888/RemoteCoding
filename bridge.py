#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import subprocess
import threading
import json
import time

agent_process = None
stop_thread = False

def send_to_node(msg):
    json_str = json.dumps(msg, ensure_ascii=False)
    line = f"[MSG] {json_str}\n"
    sys.stdout.write(line)
    sys.stdout.flush()

def read_agent_output():
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
    global agent_process
    
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
    global agent_process
    
    msg_type = msg.get('type')
    
    if msg_type == 'start':
        start_agent()
    elif msg_type == 'stop':
        stop_agent()
    elif msg_type == 'input':
        content = msg.get('content', '')
        send_to_agent(content)

def start_agent():
    global agent_process, stop_thread
    
    if agent_process:
        print("[Bridge] Agent already running", file=sys.stderr)
        return
    
    print("[Bridge] Starting OpenCode...", file=sys.stderr)
    
    try:
        env = dict(os.environ)
        env['PYTHONIOENCODING'] = 'utf-8'
        env['TERM'] = 'xterm'
        
        agent_process = subprocess.Popen(
            'opencode',
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
            universal_newlines=True,
            encoding='utf-8',
            env=env,
            shell=True
        )
        
        stop_thread = False
        threading.Thread(target=read_agent_output, daemon=True).start()
        
        time.sleep(1.5)
        send_to_node({'type': 'system', 'content': 'OpenCode 已启动！'})
        send_to_node({'type': 'status', 'status': 'connected'})
        
        print("[Bridge] Agent started OK", file=sys.stderr)
        
    except Exception as e:
        print(f"[Bridge] Start failed: {e}", file=sys.stderr)
        send_to_node({'type': 'system', 'content': f'启动失败: {e}'})

def stop_agent():
    global agent_process, stop_thread
    
    if agent_process:
        print("[Bridge] Stopping agent...", file=sys.stderr)
        stop_thread = True
        agent_process.terminate()
        try:
            agent_process.wait(timeout=2)
        except:
            agent_process.kill()
            agent_process.wait()
        agent_process = None
        send_to_node({'type': 'status', 'status': 'disconnected'})

def send_to_agent(message):
    global agent_process
    
    if agent_process and agent_process.stdin:
        try:
            print(f"[Bridge] Sending to agent: {message}", file=sys.stderr)
            agent_process.stdin.write(message + '\n')
            agent_process.stdin.flush()
        except Exception as e:
            print(f"[Bridge] Send failed: {e}", file=sys.stderr)
    else:
        print("[Bridge] Agent not running", file=sys.stderr)

def main():
    print("=" * 50, file=sys.stderr)
    print("  OpenCode Python Bridge", file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    print(file=sys.stderr)
    
    send_to_node({'type': 'system', 'content': 'Python 桥接器已启动！'})
    
    try:
        read_node_input()
    except KeyboardInterrupt:
        print("\n[Bridge] Shutting down...", file=sys.stderr)
        stop_agent()

if __name__ == '__main__':
    main()
