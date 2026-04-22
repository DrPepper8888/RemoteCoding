#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import subprocess
import threading
import time

print("=" * 60)
print("  OpenCode Simple Test")
print("=" * 60)
print()

def read_output(proc):
    print("[TEST] Output reader started")
    while proc.poll() is None:
        try:
            line = proc.stdout.readline()
            if not line:
                time.sleep(0.05)
                continue
            print(f"[TEST] OpenCode OUTPUT: {repr(line)}")
        except Exception as e:
            print(f"[TEST] Read error: {e}")
            break
    print("[TEST] Output reader stopped")

print("[TEST] Starting OpenCode...")

try:
    proc = subprocess.Popen(
        'opencode',
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True,
        encoding='utf-8',
        shell=True
    )
    
    print(f"[TEST] OpenCode started, PID: {proc.pid}")
    
    threading.Thread(target=read_output, args=(proc,), daemon=True).start()
    
    print("[TEST] Waiting 2 seconds...")
    time.sleep(2)
    
    print("[TEST] Sending test message: 'hello'")
    proc.stdin.write('hello\n')
    proc.stdin.flush()
    
    print("[TEST] Waiting 5 seconds for response...")
    time.sleep(5)
    
    print()
    print("=" * 60)
    print("  Test complete!")
    print("=" * 60)
    
except Exception as e:
    print(f"[TEST] ERROR: {e}")
    import traceback
    traceback.print_exc()
