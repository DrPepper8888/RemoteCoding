#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import subprocess
import threading
import json
import socket
import http.server
import socketserver
import time
import traceback
from collections import deque

agent_process = None
stop_thread = False
message_queue = deque(maxlen=100)
last_client_msg_id = 0
next_msg_id = 1

PORT = 8766  # 注意：主服务器 server.js 用 8765，简化版用 8766 避免冲突

def broadcast(msg):
    global next_msg_id
    msg_with_id = {**msg, 'id': next_msg_id}
    next_msg_id += 1
    message_queue.append(msg_with_id)
    print(f"[DEBUG] [BROADCAST] {msg}")

def read_agent_output():
    global agent_process, stop_thread
    
    print("[DEBUG] [read_agent_output() STARTED")
    
    while not stop_thread and agent_process and agent_process.poll() is None:
        try:
            line = agent_process.stdout.readline()
            if not line:
                time.sleep(0.05)
                continue
            print(f"[DEBUG] [AGENT OUTPUT] {repr(line)}")
            broadcast({'type': 'output', 'content': line})
        except Exception as e:
            print(f"[DEBUG] [AGENT READ ERROR] {e}")
            traceback.print_exc()
            break
    
    print("[DEBUG] [read_agent_output() STOPPED")

class MyHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        print(f"[DEBUG] [GET] {self.path}")
        
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            html_path = os.path.join(os.path.dirname(__file__), 'public', 'index.html')
            print(f"[DEBUG] Reading HTML from: {html_path}")
            with open(html_path, 'rb') as f:
                self.wfile.write(f.read())
        elif self.path.startswith('/poll?since='):
            try:
                since_id = int(self.path.split('since=')[1])
            except:
                since_id = 0
            
            print(f"[DEBUG] [POLL] since_id={since_id}")
            
            new_msgs = []
            for msg in message_queue:
                if msg['id'] > since_id:
                    new_msgs.append(msg)
            
            print(f"[DEBUG] [POLL] Sending {len(new_msgs)} new messages")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'messages': new_msgs}).encode('utf-8'))
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        print(f"[DEBUG] [POST] {self.path}")
        
        try:
            content_length = int(self.headers['Content-Length'])
            print(f"[DEBUG] [POST] Content-Length: {content_length}")
            
            post_data = self.rfile.read(content_length)
            print(f"[DEBUG] [POST] Raw data: {repr(post_data)}")
            
            msg = json.loads(post_data.decode('utf-8'))
            print(f"[DEBUG] [POST] Parsed message: {msg}")
            
            if msg.get('type') == 'start':
                print(f"[DEBUG] [POST] Got START command!")
                self.start_agent()
            elif msg.get('type') == 'stop':
                print(f"[DEBUG] [POST] Got STOP command!")
                self.stop_agent()
            elif msg.get('type') == 'input':
                content = msg.get('content', '')
                print(f"[DEBUG] [POST] Got INPUT: {content}")
                self.send_input(content)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"success":true}')
            print(f"[DEBUG] [POST] Response sent OK")
        except Exception as e:
            print(f"[DEBUG] [POST] ERROR: {e}")
            traceback.print_exc()
            self.send_response(500)
            self.end_headers()
    
    def start_agent(self):
        global agent_process, stop_thread
        
        print(f"[DEBUG] [start_agent()] CALLED")
        
        if agent_process:
            print(f"[DEBUG] [start_agent()] Already running, PID: {agent_process.pid}")
            return
        
        print("[DEBUG] [start_agent()] Starting OpenCode...")
        
        try:
            env = dict(os.environ)
            env['PYTHONIOENCODING'] = 'utf-8'
            env['TERM'] = 'xterm'
            
            cmd = 'opencode'
            print(f"[DEBUG] [start_agent()] Command: {cmd}")
            
            agent_process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                env=env,
                shell=True
            )
            
            print(f"[DEBUG] [start_agent()] Popen OK, PID: {agent_process.pid}")
            
            stop_thread = False
            print(f"[DEBUG] [start_agent()] Starting output thread...")
            threading.Thread(target=read_agent_output, daemon=True).start()
            print(f"[DEBUG] [start_agent()] Output thread started")
            
            print(f"[DEBUG] [start_agent()] Sleeping 2s...")
            time.sleep(2)
            
            print(f"[DEBUG] [start_agent()] Sending initial newline...")
            try:
                agent_process.stdin.write('\n')
                agent_process.stdin.flush()
                time.sleep(1)
            except Exception as e:
                print(f"[DEBUG] [start_agent()] Initial newline failed: {e}")
            
            print(f"[DEBUG] [start_agent()] Broadcasting ready messages...")
            broadcast({'type': 'system', 'content': 'OpenCode 已启动！'})
            broadcast({'type': 'status', 'status': 'connected'})
            
            print("[DEBUG] [start_agent()] DONE OK")
        except Exception as e:
            print(f"[DEBUG] [start_agent()] FAILED: {e}")
            traceback.print_exc()
            broadcast({'type': 'system', 'content': f'启动失败: {e}'})
    
    def stop_agent(self):
        global agent_process, stop_thread
        
        print(f"[DEBUG] [stop_agent()] CALLED")
        
        if agent_process:
            print("[DEBUG] [stop_agent()] Stopping agent...")
            stop_thread = True
            agent_process.terminate()
            try:
                agent_process.wait(timeout=2)
            except:
                agent_process.kill()
                agent_process.wait()
            agent_process = None
            broadcast({'type': 'status', 'status': 'disconnected'})
            print("[DEBUG] [stop_agent()] DONE")
    
    def send_input(self, message):
        global agent_process
        
        print(f"[DEBUG] [send_input()] CALLED with: {repr(message)}")
        
        if agent_process and agent_process.stdin:
            try:
                print(f"[DEBUG] [send_input()] Writing to agent stdin...")
                agent_process.stdin.write(message + '\n')
                agent_process.stdin.flush()
                print(f"[DEBUG] [send_input()] Flushed OK")
                broadcast({'type': 'input', 'content': message})
                print(f"[DEBUG] [send_input()] Broadcasted OK")
            except Exception as e:
                print(f"[DEBUG] [send_input()] ERROR: {e}")
                traceback.print_exc()
        else:
            print("[DEBUG] [send_input()] Agent NOT running!")
    
    def log_message(self, format, *args):
        pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def main():
    local_ip = get_local_ip()
    
    print("=" * 60)
    print("  OpenCode Simple Polling Server (DEBUG)")
    print("=" * 60)
    print()
    print(f"Server running on:")
    print(f"  - Local:    http://localhost:{PORT}")
    print(f"  - Network:  http://{local_ip}:{PORT}")
    print()
    print("Connect your phone to the same WiFi and open:")
    print(f"  http://{local_ip}:{PORT}")
    print()
    print("Press Ctrl+C to stop")
    print()
    
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
            print(f"[DEBUG] Server listening on 0.0.0.0:{PORT}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        global agent_process
        if agent_process:
            agent_process.kill()

if __name__ == '__main__':
    main()
