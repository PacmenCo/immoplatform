#!/usr/bin/env python3
"""Translate dashboard.emails.* (admin email-preview tool) and refresh
the dashboard.admin.priceList.intro nl-BE value. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "emails.index.heading": "E-mailsjablonen",
    "emails.index.description": "Bekijk hoe elke transactionele en lifecycle-e-mail wordt opgemaakt. Pas de JSON-props aan om te zien hoe het sjabloon op verschillende invoer reageert. Enkel beheerders.",
    "emails.detail.backToList": "← Alle sjablonen",
    "emails.detail.subjectLabel": "Onderwerp:",
    "emails.detail.propsErrorPrefix": "Fout in props-JSON: {error} — standaardwaarden worden weergegeven.",
    "emails.detail.previewIframeTitle": "Voorvertoning {label}",
    "emails.detail.plainTextSummary": "Platte tekst-fallback",
    "emails.detail.editor.label": "Props (JSON)",
    "emails.detail.editor.apply": "Toepassen",
    "emails.detail.editor.reset": "Standaardwaarden herstellen",
    # Refresh stale priceList intro to match current EN — same intent, slight rewording
    "admin.priceList.intro": "Alleen-lezen weergave van prijslijsten in <db></db>. Bewerk in Odoo — wijzigingen verschijnen hier binnen enkele minuten.",
}


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
    NL.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"Applied {len(PATCHES)} translations to {NL.relative_to(ROOT)}.")


if __name__ == "__main__":
    main()
