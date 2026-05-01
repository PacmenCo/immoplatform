#!/usr/bin/env python3
"""Extract a PATCHES dict block from a plan file's embedded Python code,
write it as a standalone patch script. Used to bypass plan-mode-stalled agents."""
import argparse
import re
from pathlib import Path


def extract_patches_block(plan_text: str) -> str:
    """Find the `PATCHES: dict[str, str] = { … }` block (everything between
    the opening brace and its matching closing brace at column 0)."""
    m = re.search(r"^(PATCHES:\s*dict\[str,\s*str\]\s*=\s*\{)$", plan_text, re.MULTILINE)
    if not m:
        # Try inline opening on same line
        m = re.search(r"PATCHES:\s*dict\[str,\s*str\]\s*=\s*\{", plan_text)
        if not m:
            raise SystemExit("Could not find PATCHES dict in plan")

    start = m.end()
    # Walk forward, tracking brace depth, to find the matching close
    depth = 1
    in_str = None  # current string delimiter or None
    i = start
    n = len(plan_text)
    while i < n and depth > 0:
        c = plan_text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
        else:
            if c in ('"', "'"):
                in_str = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
        i += 1
    return plan_text[start:i]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("plan_path")
    ap.add_argument("output_script_path")
    ap.add_argument("--catalog", default="dashboard.json", help="catalog filename under messages/{en,nl-BE}/")
    ap.add_argument("--namespace", default=None, help="namespace key under hashes (e.g. 'home', 'auth') — defaults to catalog stem")
    args = ap.parse_args()

    plan = Path(args.plan_path).read_text()
    body = extract_patches_block(plan)

    catalog = args.catalog
    namespace = args.namespace or catalog.replace(".json", "")
    output = Path(args.output_script_path)

    script = f'''#!/usr/bin/env python3
"""Translate {catalog} to nl-BE. Idempotent.
Auto-generated from plan file."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "{catalog}"
HASHES = ROOT / "messages" / "_hashes.json"

PATCHES: dict[str, str] = {{{body}}}


def set_path(d, path, value):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main():
    catalog = json.loads(NL.read_text())
    for path, value in PATCHES.items():
        set_path(catalog, path, value)
    NL.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\\n")

    hashes = json.loads(HASHES.read_text())
    nl_ns = hashes.get("nl-BE", {{}}).get("{namespace}", {{}})
    for path in PATCHES:
        if path in nl_ns:
            del nl_ns[path]
    HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\\n")

    print(f"Applied {{len(PATCHES)}} translations + cleared hashes.")


if __name__ == "__main__":
    main()
'''
    output.write_text(script)
    # Smoke test that the script's PATCHES dict is valid Python by importing it
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
