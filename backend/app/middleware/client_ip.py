from __future__ import annotations

from fastapi import Request

from app.core.config import settings


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def extract_client_identifier(request: Request) -> str:
    trusted_proxies = set(_split_csv(settings.TRUSTED_PROXY_IPS))
    direct_client_ip = request.client.host if request.client else ""

    use_forwarded_header = bool(direct_client_ip and direct_client_ip in trusted_proxies)
    if use_forwarded_header:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
            return ip or direct_client_ip or "unknown"

        real_ip = (request.headers.get("x-real-ip") or "").strip()
        if real_ip:
            return real_ip

    ip = direct_client_ip if direct_client_ip else "unknown"
    return ip or "unknown"
