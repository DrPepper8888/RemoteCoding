#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess
import time
import requests

print("=" * 60)
print("  OpenCode Serve Test")
print("=" * 60)
print()

print("[TEST] Starting 'opencode serve'...")

try:
    proc = subprocess.Popen(
        ['opencode', 'serve'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True,
        encoding='utf-8'
    )
    
    print(f"[TEST] opencode serve started, PID: {proc.pid}")
    
    def read_output():
        while proc.poll() is None:
            try:
                line = proc.stdout.readline()
                if not line:
                    time.sleep(0.1)
                    continue
                print(f"[TEST] OpenCode Serve: {line.rstrip()}")
            except:
                break
    
    import threading
    threading.Thread(target=read_output, daemon=True).start()
    
    print("[TEST] Waiting 5 seconds for server to start...")
    time.sleep(5)
    
    print("[TEST] Trying to connect to http://127.0.0.1:8766 (or whatever port it uses)...")
    
    print()
    print("=" * 60)
    print("  Check the output above for the server URL!")
    print("=" * 60)
    print()
    print("Press Ctrl+C to stop")
    print()
    
    while True:
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\n[TEST] Stopping...")
    proc.terminate()
except Exception as e:
    print(f"[TEST] ERROR: {e}")
    import traceback
    traceback.print_exc()
