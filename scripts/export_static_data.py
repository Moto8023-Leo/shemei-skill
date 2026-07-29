"""Export API endpoints as static JSON for GitHub Pages fallback.

Fetches key API data from the live backend and writes JSON files
to web/dist/data/ that serve as offline fallback when ngrok is
unavailable.

Usage: python scripts/export_static_data.py
"""

import json
import os
import sys
import urllib.request

API_BASE = "http://localhost:8000"
DIST_DATA = r"D:\claude_code_projects\shemei_skill\web\dist\data"

ENDPOINTS = [
    "health",
    "bootstrap",
    "brands",
    "models?brand=ienyrid",
    "models?brand=kukirin",
    "events?country=GB",
    "events?country=DE",
    "events?country=FR",
    "events?country=ES",
    "events?country=IT",
    "events?country=NL",
    "events?country=BE",
    "calendar/year?country=GB&year=2026",
    "visual/style-pool?language=zh",
]


def fetch(endpoint: str) -> dict | list:
    url = f"{API_BASE}/api/{endpoint}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  WARN: {endpoint} -> {e}")
        return {"error": str(e), "endpoint": endpoint}


def main():
    if not os.path.isdir(DIST_DATA):
        os.makedirs(DIST_DATA, exist_ok=True)

    print(f"Exporting {len(ENDPOINTS)} endpoints to {DIST_DATA}/")
    for ep in ENDPOINTS:
        data = fetch(ep)
        # Safe filename
        fname = ep.split("?")[0].replace("/", "_") + ".json"
        fpath = os.path.join(DIST_DATA, fname)
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  OK  {fname}")

    # Also write a manifest
    manifest = {
        "exported_at": __import__("datetime").datetime.now().isoformat(),
        "source": API_BASE,
        "endpoints": ENDPOINTS,
    }
    with open(os.path.join(DIST_DATA, "_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\nDone. {len(ENDPOINTS)} files in {DIST_DATA}/")


if __name__ == "__main__":
    main()
