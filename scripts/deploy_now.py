import base64, json, os, sys, urllib.request
from pathlib import Path

# Read token from env var
TOKEN = os.environ.get("GHPUSH_TOKEN")
if not TOKEN:
    # Read token from clipboard via PowerShell
    import subprocess
    try:
        raw = subprocess.check_output(
            ['powershell', '-Command', 'Get-Clipboard'],
            timeout=5
        ).decode().strip()
        if raw.startswith("ghp_"):
            TOKEN = raw
    except Exception:
        pass
if not TOKEN:
    print("ERROR: Set GHPUSH_TOKEN env var or ensure token is in clipboard")
    print("  powershell -Command 'Set-Clipboard -Value \"ghp_xxxx\"'")
    print("  then re-run this script")
    sys.exit(1)

REPO = "Moto8023-Leo/shemei-skill"
DIST = r"D:\claude_code_projects\shemei_skill\web\dist"
API  = f"https://api.github.com/repos/{REPO}"
H = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "shemei-skill-deploy/1.0",
}

def api(method, path, data=None):
    url = f"{API}{path}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=H, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            if not raw:
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        sys.exit(f"HTTP {e.code} at {method} {path}: {detail[:500]}")

# 1. Get base commit
print("1. Getting current gh-pages commit...")
ref = api("GET", "/git/refs/heads/gh-pages")
base_sha = ref["object"]["sha"]
print(f"   base: {base_sha[:12]}")

# 2. Get existing tree
base_tree = api("GET", f"/git/trees/{base_sha}?recursive=1")
existing_items = {}
for t in base_tree.get("tree", []):
    if t["type"] == "blob":
        existing_items[t["path"]] = {"path": t["path"], "mode": t["mode"], "type": t["type"], "sha": t["sha"]}

# 3. Upload new files
print("2. Uploading files...")
for root, dirs, files in os.walk(DIST):
    dirs[:] = [d for d in dirs if d != ".git"]
    for fname in sorted(files):
        fpath = os.path.join(root, fname)
        rel = os.path.relpath(fpath, DIST).replace("\\", "/")
        with open(fpath, "rb") as f:
            content = base64.b64encode(f.read()).decode()
        blob = api("POST", "/git/blobs", {"content": content, "encoding": "base64"})
        existing_items[rel] = {"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]}
        sz = os.path.getsize(fpath) / 1024
        print(f"   OK {rel} ({sz:.1f} KB)")

# 4. Create new tree
tree_entries = sorted(existing_items.values(), key=lambda x: x["path"])
print(f"3. Creating tree ({len(tree_entries)} items)...")
new_tree = api("POST", "/git/trees", {"tree": tree_entries})
print(f"   tree: {new_tree['sha'][:12]}")

# 5. Create commit
print("4. Creating commit...")
new_commit = api("POST", "/git/commits", {
    "message": "Deploy: ngrok API routing for live data",
    "tree": new_tree["sha"],
    "parents": [base_sha],
})
print(f"   commit: {new_commit['sha'][:12]}")

# 6. Update ref
print("5. Updating gh-pages ref...")
api("PATCH", "/git/refs/heads/gh-pages", {"sha": new_commit["sha"], "force": False})

print()
print("DONE: https://Moto8023-Leo.github.io/shemei-skill/")
print("(Wait ~1 min for GitHub Pages to refresh)")
