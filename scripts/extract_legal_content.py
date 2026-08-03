"""Extract the approved legal-document sections from the versioned DOCX source."""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "legal" / "BracketWorks_Legal_Documents_v2.4.docx"
OUTPUT = ROOT / "frontend" / "app" / "legal" / "legal-content.json"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
TARGETS = {
    "TERMS OF SERVICE": "terms",
    "PRIVACY POLICY": "privacy",
    "TOURNAMENT OPERATOR TERMS": "operatorTerms",
}


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS)).strip()


def paragraph_style(paragraph: ET.Element) -> str:
    node = paragraph.find("./w:pPr/w:pStyle", NS)
    return node.attrib.get(f"{{{NS['w']}}}val", "") if node is not None else ""


with zipfile.ZipFile(SOURCE) as archive:
    root = ET.fromstring(archive.read("word/document.xml"))

documents: dict[str, dict] = {}
active_key: str | None = None
active_section: dict | None = None

for paragraph in root.findall(".//w:body/w:p", NS):
    text = paragraph_text(paragraph)
    if not text:
        continue
    style = paragraph_style(paragraph)

    if style == "Heading1":
        active_key = TARGETS.get(text)
        active_section = None
        if active_key:
            documents[active_key] = {"title": text.title(), "version": "2.4", "intro": [], "sections": []}
        continue

    if not active_key:
        continue

    if style == "Heading2":
        active_section = {"heading": text, "paragraphs": []}
        documents[active_key]["sections"].append(active_section)
        continue

    destination = active_section["paragraphs"] if active_section else documents[active_key]["intro"]
    destination.append(text)

acceptable = next(
    section for section in documents["terms"]["sections"]
    if re.match(r"7\.\s+ACCEPTABLE USE", section["heading"], re.IGNORECASE)
)
documents["acceptableUse"] = {
    "title": "Acceptable Use",
    "version": "2.4",
    "intro": ["This policy is section 7 of the BracketWorks Terms of Service."],
    "sections": [acceptable],
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(documents, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Extracted {', '.join(documents)} to {OUTPUT}")
