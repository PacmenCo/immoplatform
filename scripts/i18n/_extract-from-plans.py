#!/usr/bin/env python3
"""
Parse the per-agent plan files at /Users/rl/.claude/plans/adaptive-shimmying-creek-agent-*.md
and extract their translation key→value pairs into a single applied patch
on messages/nl-BE/dashboard.json.

Plan files mix two formats:
  A) Markdown tables:  | `path.to.key` | `Translation` |
  B) Bullet lists with section context:
        ## `users.edit.*`            (or)         `passwordReset.*`:
        - `topbarTitle` — `"{name} bewerken"`
"""
import json
import re
from pathlib import Path

ROOT = Path("/Users/rl/Desktop/Jordan Projects/immoplatform")
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"
PLAN_DIR = Path("/Users/rl/.claude/plans")

# Plan ID → top-level section prefix (used as a fallback when bullet lists
# omit the namespace). Agents were given exclusive scopes so we trust this.
SCOPE_PREFIX = {
    "a7c08c22a1af45af1": "teams.detail.",        # teams detail
    "afc6509ac4f60e4b6": "teams.list.",          # teams list
    "a37f76e7798e38d0d": "",                     # teams edit + shared.* (mixed top levels — keep full path)
    "a908e5ccae13c9304": "teams.new.",           # teams new
    "a5e4f898bd4187bb4": "users.detail.",        # users detail
    "af8e1a696bea0b27d": "users.list.",          # users list
    "a2d802b626fbf30eb": "users.edit.",          # users edit
    "a5417286aeb1b7550": "",                     # users invite + pendingInvites (multi-namespace — keep full path)
    "afff59e98cc740396": "",                     # assignments list cluster (multi-namespace)
    "a9f2fc153183998f2": "assignments.newPage.", # assignments new
}


def strip_quotes(s: str) -> str:
    s = s.strip()
    # Remove a single layer of leading/trailing single or double quotes
    for q in ['"', "'"]:
        if s.startswith(q) and s.endswith(q) and len(s) >= 2:
            s = s[1:-1]
            break
    return s


def extract(plan_text: str, default_prefix: str) -> dict[str, str]:
    """Walk the plan file, tracking section context for bullet lists.

    Section state is set by:
      - `## `<path>`` headers
      - `### `<path>`` headers
      - `<path>.*:` inline (one-line) labels
      - lines like ``passwordReset.*`:`` or ``profile.*:``
    """
    patches: dict[str, str] = {}
    section: str = ""  # current dotted prefix, no trailing dot

    def section_prefix() -> str:
        return (section + ".") if section else ""

    def normalize(path: str) -> str:
        # Drop optional "dashboard." top-level
        if path.startswith("dashboard."):
            path = path[len("dashboard."):]
        return path

    for raw in plan_text.splitlines():
        line = raw.rstrip()

        # Header form 1: "## `path.to.section.*`" or "## `path.to.section`"
        m = re.match(r'^#{1,6}\s+`([a-z][a-zA-Z0-9._]*?)(?:\.\*)?`\s*$', line)
        if m:
            section = m.group(1)
            continue

        # Header form 2: "## `path.*` translations" (header with extra text after backticks)
        m = re.match(r'^#{1,6}\s+`([a-z][a-zA-Z0-9._]*?)\.\*`', line)
        if m:
            section = m.group(1)
            continue

        # Section label form: "`section.*`:" or "Section `<section>.*`:" inline
        m = re.match(r'^`([a-z][a-zA-Z0-9._]*?)\.\*`:?\s*$', line)
        if m:
            section = m.group(1)
            continue

        # Section label inline: "Top-level:" → section = "" (default)
        if re.match(r'^Top-?level\s*:?\s*$', line, re.IGNORECASE):
            section = ""
            continue

        # Markdown table row: | `path` | `value` |
        # Allow value with embedded backticks if no other backticks would terminate.
        m = re.match(r'^\|\s*`([^`|]+)`\s*\|\s*`(.+?)`\s*\|\s*$', line)
        if m:
            raw_key, raw_val = m.group(1).strip(), m.group(2)
            # Heuristic: treat as full path if it contains a dot AND looks like a key path
            if "." in raw_key and raw_key.replace(".", "").replace("_", "").replace("-", "").replace("[", "").replace("]", "").isalnum():
                full_path = normalize(raw_key)
            else:
                # Combine with section context; if no section, fall back to default_prefix
                full_path = (section_prefix() or default_prefix) + raw_key
                full_path = normalize(full_path)
            patches[full_path] = strip_quotes(raw_val)
            continue

        # Bullet entry: "- `key` — `value`" with em dash or hyphen separator
        m = re.match(r'^[-*]\s+`([^`]+)`\s+(?:—|--|–|-)\s+`(.+?)`\s*(?:—.*|\(.+?\))?\s*$', line)
        if m:
            raw_key, raw_val = m.group(1).strip(), m.group(2)
            if "." in raw_key:
                full_path = normalize(raw_key)
            else:
                full_path = (section_prefix() or default_prefix) + raw_key
                full_path = normalize(full_path)
            patches[full_path] = strip_quotes(raw_val)
            continue

        # Bullet entry without backticks on value: "- `key` — Some text"
        m = re.match(r'^[-*]\s+`([^`]+)`\s+(?:—|--|–|-)\s+(.+?)\s*$', line)
        if m:
            raw_key, raw_val = m.group(1).strip(), m.group(2).strip()
            # Skip if value contains comments / "matches…" prose
            if raw_val.startswith("(") or "matches" in raw_val.lower()[:20]:
                continue
            if "." in raw_key:
                full_path = normalize(raw_key)
            else:
                full_path = (section_prefix() or default_prefix) + raw_key
                full_path = normalize(full_path)
            # Heuristic: only add if value has no backticks (avoid quoted commentary)
            if "`" not in raw_val:
                patches[full_path] = strip_quotes(raw_val)
            continue

    return patches


def set_path(catalog: dict, path: str, value: str) -> bool:
    """Set the value at the dotted path. Returns True if set, False if path invalid."""
    parts = path.split(".")
    cur = catalog
    for p in parts[:-1]:
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    if not isinstance(cur, dict) or parts[-1] not in cur:
        return False
    cur[parts[-1]] = value
    return True


def main() -> None:
    catalog = json.loads(NL.read_text())
    total_applied = 0
    total_skipped = 0
    skipped_paths: list[str] = []

    for agent_id, prefix in SCOPE_PREFIX.items():
        plan = PLAN_DIR / f"adaptive-shimmying-creek-agent-{agent_id}.md"
        if not plan.exists():
            print(f"⚠ missing plan: {plan}")
            continue
        patches = extract(plan.read_text(), default_prefix=prefix)
        applied_in_file = 0
        for path, value in patches.items():
            if set_path(catalog, path, value):
                applied_in_file += 1
                total_applied += 1
            else:
                skipped_paths.append(f"{agent_id}: {path}")
                total_skipped += 1
        print(f"  {agent_id}: extracted {len(patches)}, applied {applied_in_file}")

    NL.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"\nTotal applied: {total_applied}, skipped (path not found): {total_skipped}")
    if skipped_paths:
        print("\nSkipped (first 20):")
        for p in skipped_paths[:20]:
            print(f"  {p}")


if __name__ == "__main__":
    main()
