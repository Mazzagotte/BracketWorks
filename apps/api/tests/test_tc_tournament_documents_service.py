from __future__ import annotations

import io
import zipfile

import pytest
from fastapi import HTTPException

from app.services.tc_tournament_documents import (
    MAX_DOCUMENT_BYTES,
    build_content_disposition,
    sanitize_document_filename,
    validate_tournament_document_upload,
)


def test_rejects_unsupported_type():
    with pytest.raises(HTTPException, match="Unsupported document type"):
        validate_tournament_document_upload("text/plain", b"hello")


def test_rejects_empty_file():
    with pytest.raises(HTTPException, match="Uploaded file is empty"):
        validate_tournament_document_upload("application/pdf", b"")


def test_rejects_oversized_file():
    with pytest.raises(HTTPException, match="exceeds 20MB"):
        validate_tournament_document_upload("application/pdf", b"%PDF-" + b"x" * MAX_DOCUMENT_BYTES)


def test_rejects_mime_type_that_does_not_match_content():
    with pytest.raises(HTTPException, match="does not match"):
        validate_tournament_document_upload("image/png", b"%PDF-1.7")


@pytest.mark.parametrize(
    ("content_type", "content"),
    [
        ("application/pdf", b"%PDF-1.7\n"),
        ("image/png", b"\x89PNG\r\n\x1a\ncontent"),
        ("image/jpeg", b"\xff\xd8\xffcontent"),
        ("application/msword", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1content"),
    ],
)
def test_accepts_matching_file_signatures(content_type, content):
    assert validate_tournament_document_upload(content_type, content) == content_type


def test_accepts_a_valid_docx_container():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr("word/document.xml", "<document />")
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert validate_tournament_document_upload(mime, buffer.getvalue()) == mime


def test_sanitizes_unsafe_filename_and_header_values():
    assert sanitize_document_filename('../../bad\r\n"name.pdf') == "bad_name.pdf"
    disposition = build_content_disposition('../../bad\r\n"name.pdf')
    assert "\r" not in disposition
    assert "\n" not in disposition
    assert "../" not in disposition
