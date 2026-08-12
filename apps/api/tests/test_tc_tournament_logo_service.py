from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services.tc_tournament_logo import MAX_LOGO_BYTES, validate_tournament_logo_upload


def test_validate_tournament_logo_upload_rejects_unsupported_type():
    with pytest.raises(HTTPException) as raised:
        validate_tournament_logo_upload("application/pdf", b"fake")

    assert raised.value.status_code == 400
    assert raised.value.detail == "Unsupported logo type. Use PNG, JPG, or SVG."


def test_validate_tournament_logo_upload_rejects_empty_content():
    with pytest.raises(HTTPException) as raised:
        validate_tournament_logo_upload("image/png", b"")

    assert raised.value.status_code == 400
    assert raised.value.detail == "Uploaded file is empty"


def test_validate_tournament_logo_upload_rejects_oversized_content():
    oversized = b"x" * (MAX_LOGO_BYTES + 1)

    with pytest.raises(HTTPException) as raised:
        validate_tournament_logo_upload("image/png", oversized)

    assert raised.value.status_code == 400
    assert raised.value.detail == "Logo exceeds 5MB size limit"


def test_validate_tournament_logo_upload_accepts_valid_logo():
    validate_tournament_logo_upload("image/jpeg", b"not-empty")
