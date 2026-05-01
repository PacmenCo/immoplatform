#!/usr/bin/env python3
"""
Adds the assignment-status label namespace to both catalogs.
Idempotent — re-running is safe.

EN values mirror current STATUS_META.label strings in src/lib/mockData.ts.
nl-BE values use the v1 vocabulary (Concept, In afwachting, Ingepland, etc.).

Run: python3 scripts/i18n/_apply-status-translations.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EN = ROOT / "messages" / "en" / "dashboard.json"
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

EN_STATUSES = {
    "draft": "Draft",
    "awaiting": "Awaiting",
    "scheduled": "Scheduled",
    "in_progress": "In progress",
    "delivered": "Delivered",
    "completed": "Completed",
    "on_hold": "On hold",
    "cancelled": "Cancelled",
}

NL_STATUSES = {
    "draft": "Concept",
    "awaiting": "In afwachting",
    "scheduled": "Ingepland",
    "in_progress": "In uitvoering",
    "delivered": "Geleverd",
    "completed": "Voltooid",
    "on_hold": "Geparkeerd",
    "cancelled": "Geannuleerd",
}


def patch(path: Path, statuses: dict[str, str]) -> None:
    catalog = json.loads(path.read_text())
    catalog.setdefault("assignments", {})["statuses"] = statuses
    path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    patch(EN, EN_STATUSES)
    patch(NL, NL_STATUSES)
    print(f"Wrote {len(EN_STATUSES)} status labels to both catalogs.")


if __name__ == "__main__":
    main()
