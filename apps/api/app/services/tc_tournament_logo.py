from __future__ import annotations

from fastapi import HTTPException

ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/jpg"}
MAX_LOGO_BYTES = 5 * 1024 * 1024


def validate_tournament_logo_upload(content_type: str | None, content: bytes) -> None:
    normalized_content_type = (content_type or "").lower()
    if normalized_content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported logo type. Use PNG or JPG.")

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(content) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="Logo exceeds 5MB size limit")
