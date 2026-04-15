#!/usr/bin/env python3
"""
Deploy worker to Cloudflare Workers via REST API.
Uses gRPC to communicate with the MCP RPC server to make authenticated HTTP requests.
"""
import subprocess
import json
import sys
import os
import base64
import re

ACCOUNT_ID = "749a9d229e06d720687aeb3809f463ae"
SCRIPT_NAME = "tg-bot-system"
D1_DB_ID = "031ade0f-a5b4-421e-a7e8-fc0635129264"

def mcp_call(tool, input_data, timeout=180):
    """Call MCP tool and return output."""
    cmd = [
        "manus-mcp-cli", "tool", "call",
        "-s", "cloudflare",
        tool,
        "-i", json.dumps(input_data)
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return (result.stdout + result.stderr).strip()
    except subprocess.TimeoutExpired:
        return "TIMEOUT"
    except Exception as e:
        return f"ERROR: {e}"

def try_wrangler_whoami():
    """Check if wrangler can authenticate."""
    result = subprocess.run(
        ["npx", "wrangler", "whoami"],
        capture_output=True, text=True,
        cwd="/home/ubuntu/tg-bot-system",
        timeout=30,
        env={**os.environ, "WRANGLER_SEND_METRICS": "false"}
    )
    return result.stdout + result.stderr

def try_wrangler_deploy():
    """Try wrangler deploy."""
    env = os.environ.copy()
    env["WRANGLER_SEND_METRICS"] = "false"
    env["CLOUDFLARE_ACCOUNT_ID"] = ACCOUNT_ID
    
    result = subprocess.run(
        ["npx", "wrangler", "deploy"],
        capture_output=True, text=True,
        cwd="/home/ubuntu/tg-bot-system",
        timeout=120,
        env=env
    )
    return result.stdout + result.stderr, result.returncode

if __name__ == "__main__":
    # Step 1: Check wrangler auth
    print("=" * 50)
    print("[1] Checking wrangler authentication...")
    whoami = try_wrangler_whoami()
    print(whoami)
    
    if "You are logged in" in whoami or "Account Name" in whoami:
        print("\n[2] Wrangler is authenticated! Deploying...")
        output, rc = try_wrangler_deploy()
        print(output)
        if rc == 0:
            print("\n✅ Deployment successful!")
        else:
            print(f"\n❌ Deployment failed (exit code {rc})")
    else:
        print("\n[2] Wrangler not authenticated. Trying MCP approach...")
        
        # Try to verify MCP still works
        print("\n[3] Verifying MCP connection...")
        workers = mcp_call("workers_list", {})
        print(f"Workers: {workers[:200]}")
        
        print("\n[4] MCP doesn't support worker deployment directly.")
        print("Need to find another way...")
