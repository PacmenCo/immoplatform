#!/usr/bin/env python3
"""Extract section + bullet format errors plan into a patch script.

Format:
    ### `section`
    - `key`: "value"
    - `nested.key`: "value"
"""
import json
import re
from pathlib import Path

PLAN = Path("/Users/rl/.claude/plans/adaptive-shimmying-creek-agent-ae5443a515bf1dbb1.md")
OUT = Path("/Users/rl/Desktop/Jordan Projects/immoplatform/scripts/i18n/_translate-errors.py")


def extract(plan_text: str) -> dict[str, str]:
    patches: dict[str, str] = {}
    section = ""

    for raw in plan_text.splitlines():
        line = raw.rstrip()

        # Section header: "### `section`" — sets section prefix
        m = re.match(r"^#{1,6}\s+`([a-zA-Z0-9._]+)`\s*$", line)
        if m:
            section = m.group(1)
            continue

        # Bullet entry: "- `key`: \"value\""
        m = re.match(r'^[-*]\s+`([a-zA-Z0-9._]+)`\s*:\s*"((?:\\"|[^"])*)"\s*$', line)
        if m:
            key, val = m.group(1), m.group(2).replace('\\"', '"')
            full = f"{section}.{key}" if section else key
            patches[full] = val
            continue

    return patches


def main() -> None:
    plan_text = PLAN.read_text()
    patches = extract(plan_text)
    print(f"Extracted {len(patches)} entries from plan")

    # Write the script with the PATCHES dict baked in
    body = ",\n".join(
        f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}"
        for k, v in patches.items()
    )

    script = f'''#!/usr/bin/env python3
"""Translate errors.json to nl-BE. Idempotent.
Auto-generated from agent plan."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "errors.json"
HASHES = ROOT / "messages" / "_hashes.json"

PATCHES: dict[str, str] = {{
{body},
}}


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
    nl_errors = hashes.get("nl-BE", {{}}).get("errors", {{}})
    for path in PATCHES:
        if path in nl_errors:
            del nl_errors[path]
    HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\\n")

    print(f"Applied {{len(PATCHES)}} translations + cleared hashes.")


if __name__ == "__main__":
    main()
'''
    OUT.write_text(script)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
