from __future__ import annotations

from fastapi import HTTPException

ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

ALLOWED_DOC_KINDS = {"rules", "flyer", "oil_pattern", "entry_form", "notice", "other"}


def validate_tournament_document_upload(content_type: str | None, content: bytes) -> None:
    normalized_content_type = (content_type or "").lower()
    if normalized_content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type. Use PDF, DOC, DOCX, PNG, or JPG.")

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=400, detail="Document exceeds 20MB size limit")


def normalize_document_kind(doc_type: str | None) -> str:
    normalized = (doc_type or "other").strip().lower()
    return normalized if normalized in ALLOWED_DOC_KINDS else "other"
