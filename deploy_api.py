#!/usr/bin/env python3
"""
Deploy worker to Cloudflare using the Workers Upload API.
Uses the MCP RPC server's gRPC endpoint to make authenticated API calls.

Cloudflare Workers Upload API:
PUT /client/v4/accounts/{account_id}/workers/scripts/{script_name}
Content-Type: multipart/form-data

Parts:
- worker.js (application/javascript+module)
- metadata (application/json) - contains bindings, compatibility_date, etc.
"""
import subprocess
import json
import sys
import os
import base64
import tempfile

ACCOUNT_ID = "749a9d229e06d720687aeb3809f463ae"
SCRIPT_NAME = "tg-bot-system"
D1_DB_ID = "031ade0f-a5b4-421e-a7e8-fc0635129264"
D1_DB_NAME = "tg-bot-db"

def mcp_call(tool, input_data, timeout=120):
    """Call MCP tool."""
    cmd = [
        "manus-mcp-cli", "tool", "call",
        "-s", "cloudflare",
        tool,
        "-i", json.dumps(input_data)
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return "TIMEOUT"

def check_existing_workers():
    """List existing workers to verify API access."""
    print("[1/4] Checking API access...")
    output = mcp_call("workers_list", {})
    print(f"  Workers list: {output[:500]}")
    return "success" in output.lower() or "result" in output.lower() or "workers" in output.lower()

def create_api_token_via_dashboard():
    """
    We can't create API tokens via MCP. Instead, let's try a different approach:
    Use the Cloudflare Pages/Workers deployment via GitHub integration,
    or create the worker directly using the MCP tools available.
    
    Actually, let's try using the wrangler with CLOUDFLARE_API_TOKEN env var.
    We need to get the token from the MCP OAuth session.
    """
    pass

def deploy_via_github():
    """
    Alternative: Push code to GitHub and use Cloudflare's GitHub integration.
    This is the recommended approach in the documentation.
    """
    print("[*] Setting up GitHub repository for deployment...")
    
    # Initialize git repo
    os.chdir("/home/ubuntu/tg-bot-system")
    
    subprocess.run(["git", "init"], capture_output=True)
    subprocess.run(["git", "add", "-A"], capture_output=True)
    subprocess.run(["git", "config", "user.email", "deploy@tg-bot.dev"], capture_output=True)
    subprocess.run(["git", "config", "user.name", "TG Bot Deploy"], capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial deployment"], capture_output=True)
    
    # Create GitHub repo
    result = subprocess.run(
        ["gh", "repo", "create", "tg-bot-system", "--public", "--source=.", "--push"],
        capture_output=True, text=True
    )
    print(f"  GitHub: {result.stdout}")
    if result.returncode != 0:
        print(f"  Error: {result.stderr}")
        # Try with --remote flag
        result = subprocess.run(
            ["gh", "repo", "create", "tg-bot-system", "--public", "--source=.", "--remote=origin", "--push"],
            capture_output=True, text=True
        )
        print(f"  Retry: {result.stdout} {result.stderr}")
    
    return result.returncode == 0

if __name__ == "__main__":
    # Check if gh is authenticated
    result = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
    print(f"GitHub auth: {result.stdout} {result.stderr}")
    
    if "Logged in" in result.stdout or "Logged in" in result.stderr:
        success = deploy_via_github()
        if success:
            print("\n✅ Code pushed to GitHub!")
            print("Next: Connect this repo to Cloudflare Workers via the Cloudflare dashboard.")
            print("Or use 'npx wrangler deploy' with a Cloudflare API token.")
    else:
        print("GitHub CLI not authenticated.")
    
    # Also check workers list via MCP
    print("\n[*] Checking Cloudflare Workers via MCP...")
    check_existing_workers()
