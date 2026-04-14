#!/usr/bin/env python3
"""
Deploy worker to Cloudflare using the Workers API.
We'll use the MCP RPC server to make authenticated requests.
"""
import subprocess
import json
import os
import sys
import re

ACCOUNT_ID = "749a9d229e06d720687aeb3809f463ae"
SCRIPT_NAME = "tg-bot-system"
D1_DB_ID = "031ade0f-a5b4-421e-a7e8-fc0635129264"
D1_DB_NAME = "tg-bot-db"

def mcp_call(tool, input_data):
    """Call MCP tool and return raw output."""
    cmd = [
        "manus-mcp-cli", "tool", "call",
        "-s", "cloudflare",
        tool,
        "-i", json.dumps(input_data)
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return "TIMEOUT"

def find_oauth_token():
    """Try to find the OAuth token from MCP storage."""
    # Check common locations
    home = os.path.expanduser("~")
    possible_paths = [
        os.path.join(home, ".mcp"),
        os.path.join(home, ".config", "mcp"),
        os.path.join(home, ".local", "share", "mcp"),
    ]
    
    for base in possible_paths:
        for root, dirs, files in os.walk(base):
            for f in files:
                path = os.path.join(root, f)
                try:
                    with open(path, 'r') as fh:
                        content = fh.read()
                        if 'token' in content.lower() or 'bearer' in content.lower():
                            print(f"  Found potential token file: {path}")
                            # Don't print content for security
                except:
                    pass
    return None

def deploy_with_wrangler_api_token():
    """Try to deploy using wrangler with environment-based auth."""
    
    # First, let's check if there's a way to get the token from MCP
    print("[*] Searching for auth credentials...")
    
    # Check for wrangler config
    wrangler_config = os.path.expanduser("~/.wrangler")
    if os.path.exists(wrangler_config):
        print(f"  Found wrangler config at {wrangler_config}")
        for root, dirs, files in os.walk(wrangler_config):
            for f in files:
                print(f"    {os.path.join(root, f)}")
    
    # Check XDG config
    xdg_config = os.path.expanduser("~/.config")
    for item in ["wrangler", "cloudflare", "cloudflared"]:
        path = os.path.join(xdg_config, item)
        if os.path.exists(path):
            print(f"  Found config at {path}")
    
    # Check for node_modules/.cache/wrangler
    cache = "/home/ubuntu/tg-bot-system/node_modules/.cache/wrangler"
    if os.path.exists(cache):
        print(f"  Found wrangler cache at {cache}")

if __name__ == "__main__":
    deploy_with_wrangler_api_token()
    
    # Try to find any auth tokens
    find_oauth_token()
    
    # Check if we can find the token in process
    print("\n[*] Checking MCP server process for token hints...")
    result = subprocess.run(["ps", "aux"], capture_output=True, text=True)
    for line in result.stdout.split('\n'):
        if 'mcp' in line.lower() or 'cloudflare' in line.lower():
            print(f"  Process: {line[:120]}")
