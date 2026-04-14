#!/usr/bin/env python3
"""
Deploy the TG Bot System to Cloudflare Workers using the Cloudflare API.
Uses esbuild to bundle the code, then uploads via Workers API.
"""

import subprocess
import json
import sys
import os

ACCOUNT_ID = "749a9d229e06d720687aeb3809f463ae"
SCRIPT_NAME = "tg-bot-system"
D1_DATABASE_ID = "031ade0f-a5b4-421e-a7e8-fc0635129264"

def mcp_call(tool, input_json):
    """Call a Cloudflare MCP tool and return the result."""
    cmd = [
        "manus-mcp-cli", "tool", "call",
        "-s", "cloudflare",
        tool,
        "-i", json.dumps(input_json)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    output = result.stdout + result.stderr
    return output

def bundle_code():
    """Bundle the worker code into a single file using esbuild."""
    print("[1/3] Bundling worker code...")
    
    # Install esbuild
    subprocess.run(["npm", "install", "esbuild", "--save-dev"], 
                   capture_output=True, cwd="/home/ubuntu/tg-bot-system")
    
    # Bundle
    result = subprocess.run([
        "npx", "esbuild", "src/index.js",
        "--bundle",
        "--format=esm",
        "--outfile=dist/worker.js",
        "--platform=browser",
        "--target=es2022",
        "--minify"
    ], capture_output=True, text=True, cwd="/home/ubuntu/tg-bot-system")
    
    if result.returncode != 0:
        print(f"Bundle error: {result.stderr}")
        sys.exit(1)
    
    print("  ✅ Code bundled to dist/worker.js")
    
    with open("/home/ubuntu/tg-bot-system/dist/worker.js", "r") as f:
        return f.read()

def deploy_via_mcp(code):
    """
    Since MCP doesn't have a direct deploy tool, we'll use wrangler deploy
    with a workaround - pipe through the MCP's authenticated session.
    
    Actually, let's try using the Cloudflare REST API directly through
    a helper approach.
    """
    print("[2/3] Deploying worker via Cloudflare API...")
    
    # We'll create a deployment script that uses curl with the OAuth token
    # extracted from the MCP session
    
    # Alternative: use wrangler with OAuth
    # Let's try wrangler deploy directly since MCP is authenticated
    result = subprocess.run(
        ["npx", "wrangler", "deploy", "--dry-run", "--outdir=dist/deploy"],
        capture_output=True, text=True, 
        cwd="/home/ubuntu/tg-bot-system",
        timeout=60
    )
    print(f"Dry run output: {result.stdout}")
    print(f"Dry run errors: {result.stderr}")

def main():
    os.makedirs("/home/ubuntu/tg-bot-system/dist", exist_ok=True)
    code = bundle_code()
    print(f"  Bundle size: {len(code)} bytes")
    
    # Try wrangler deploy
    print("[2/3] Attempting wrangler deploy...")
    result = subprocess.run(
        ["npx", "wrangler", "deploy"],
        capture_output=True, text=True,
        cwd="/home/ubuntu/tg-bot-system",
        timeout=120,
        env={**os.environ, "CLOUDFLARE_ACCOUNT_ID": ACCOUNT_ID}
    )
    print(f"stdout: {result.stdout}")
    print(f"stderr: {result.stderr}")
    print(f"returncode: {result.returncode}")

if __name__ == "__main__":
    main()
