from __future__ import annotations

import io
import re
import zipfile
from urllib.parse import quote

from fastapi import HTTPException, UploadFile

ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
DOCUMENT_READ_CHUNK_BYTES = 1024 * 1024

ALLOWED_DOC_KINDS = {"rules", "flyer", "oil_pattern", "entry_form", "notice", "other"}
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")


def sanitize_document_filename(filename: str | None) -> str:
    leaf = (filename or "document").replace("\\", "/").rsplit("/", 1)[-1]
    safe = _CONTROL_CHARACTERS.sub("", leaf).replace('"', "_").strip(" .")
    return safe[:255] or "document"


def build_content_disposition(filename: str) -> str:
    safe = sanitize_document_filename(filename)
    ascii_fallback = safe.encode("ascii", "ignore").decode("ascii") or "document"
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quote(safe)}'


def _matches_file_signature(content_type: str, content: bytes) -> bool:
    if content_type == "application/pdf":
        return content.startswith(b"%PDF-")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type in {"image/jpeg", "image/jpg"}:
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "application/msword":
        return content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        if not content.startswith(b"PK"):
            return False
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                return "[Content_Types].xml" in names and "word/document.xml" in names
        except (OSError, zipfile.BadZipFile):
            return False
    return False


def validate_tournament_document_upload(content_type: str | None, content: bytes) -> str:
    normalized_content_type = (content_type or "").lower().split(";", 1)[0].strip()
    if normalized_content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type. Use PDF, DOC, DOCX, PNG, or JPG.")

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=400, detail="Document exceeds 20MB size limit")

    if not _matches_file_signature(normalized_content_type, content):
        raise HTTPException(status_code=400, detail="Document content does not match its declared type")

    return "image/jpeg" if normalized_content_type == "image/jpg" else normalized_content_type


async def read_tournament_document_upload(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(DOCUMENT_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_DOCUMENT_BYTES:
            raise HTTPException(status_code=400, detail="Document exceeds 20MB size limit")
        chunks.append(chunk)
    return b"".join(chunks)


def normalize_document_kind(doc_type: str | None) -> str:
    normalized = (doc_type or "other").strip().lower()
    return normalized if normalized in ALLOWED_DOC_KINDS else "other"
