#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenCode Mobile Remote - Simplified & Reliable Version
A complete rewrite with focus on reliability
"""
import sys
import os
import subprocess
import threading
import json
import socket
import http.server
import socketserver
import time
from collections import deque

# Configuration
PORT = 8765
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

# Global state
message_queue = deque(maxlen=100)
next_msg_id = 1
opencode_process = None
stop_flag = False

def get_local_ip():
    """Get the local IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def broadcast(msg):
    """Add a message to the queue"""
    global next_msg_id
    msg_with_id = {**msg, 'id': next_msg_id}
    next_msg_id += 1
    message_queue.append(msg_with_id)
    print(f"[BROADCAST] {msg}")

def read_opencode_output():
    """Read output from OpenCode process"""
    global opencode_process, stop_flag
    
    print("[READER] Starting")
    
    while not stop_flag and opencode_process and opencode_process.poll() is None:
        try:
            line = opencode_process.stdout.readline()
            if not line:
                time.sleep(0.05)
                continue
            broadcast({'type': 'output', 'content': line})
        except Exception as e:
            print(f"[READER] Error: {e}")
            break
    
    print("[READER] Stopped")

def start_opencode():
    """Start OpenCode process"""
    global opencode_process, stop_flag
    
    if opencode_process:
        print("[START] Already running")
        return
    
    print("[START] Starting OpenCode...")
    
    try:
        env = dict(os.environ)
        env['PYTHONIOENCODING'] = 'utf-8'
        env['TERM'] = 'xterm'
        
        # Use 'opencode serve' for headless server mode
        # This is designed for remote access
        if sys.platform == 'win32':
            opencode_process = subprocess.Popen(
                'opencode serve',
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                env=env,
                shell=True
            )
        else:
            opencode_process = subprocess.Popen(
                ['opencode', 'serve'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                env=env
            )
        
        print(f"[START] OpenCode started, PID: {opencode_process.pid}")
        
        stop_flag = False
        threading.Thread(target=read_opencode_output, daemon=True).start()
        
        # Give it some time to initialize
        time.sleep(2)
        
        broadcast({'type': 'system', 'content': 'OpenCode 已启动！'})
        broadcast({'type': 'status', 'status': 'connected'})
        
    except Exception as e:
        print(f"[START] Error: {e}")
        import traceback
        traceback.print_exc()
        broadcast({'type': 'system', 'content': f'启动失败: {e}'})

def stop_opencode():
    """Stop OpenCode process"""
    global opencode_process, stop_flag
    
    if opencode_process:
        print("[STOP] Stopping OpenCode...")
        stop_flag = True
        opencode_process.terminate()
        try:
            opencode_process.wait(timeout=2)
        except:
            opencode_process.kill()
            opencode_process.wait()
        opencode_process = None
        broadcast({'type': 'status', 'status': 'disconnected'})
        print("[STOP] Stopped")

def send_to_opencode(message):
    """Send a message to OpenCode"""
    global opencode_process
    
    if opencode_process and opencode_process.stdin:
        try:
            print(f"[SEND] {message}")
            opencode_process.stdin.write(message + '\n')
            opencode_process.stdin.flush()
            broadcast({'type': 'input', 'content': message})
        except Exception as e:
            print(f"[SEND] Error: {e}")
    else:
        print("[SEND] OpenCode not running")

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/':
            self.path = '/index.html'
            return super().do_GET()
        elif self.path.startswith('/poll?since='):
            try:
                since_id = int(self.path.split('since=')[1])
            except:
                since_id = 0
            
            new_msgs = [m for m in message_queue if m['id'] > since_id]
            
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
            return super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            msg = json.loads(post_data.decode('utf-8'))
            print(f"[POST] Received: {msg}")
            
            if msg.get('type') == 'start':
                start_opencode()
            elif msg.get('type') == 'stop':
                stop_opencode()
            elif msg.get('type') == 'input':
                send_to_opencode(msg.get('content', ''))
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"success":true}')
        except Exception as e:
            print(f"[POST] Error: {e}")
            self.send_response(500)
            self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass

def main():
    """Main function"""
    local_ip = get_local_ip()
    
    print("=" * 60)
    print("  OpenCode Mobile Remote - Reliable Version")
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
        with socketserver.TCPServer(("0.0.0.0", PORT), RequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        if opencode_process:
            opencode_process.kill()

if __name__ == '__main__':
    main()
