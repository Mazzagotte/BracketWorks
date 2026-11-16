"""Reading Tournament Central emails in tests.

The emails are Resend templates, so a message carries a template name and values, not a body.
``email_text`` joins the values (unescaped) into one string to search, with the fixed label the
templates put before the total, so a test can check what a person would read.
"""

from __future__ import annotations

import html


def template_id(message: dict) -> str:
    return message.get("template", {}).get("id", "")


def email_vars(message: dict) -> dict[str, str]:
    return {key: html.unescape(value) for key, value in message.get("template", {}).get("variables", {}).items()}


def email_text(message: dict) -> str:
    values = email_vars(message)
    lines = [value for key, value in values.items() if key != "total_due"]
    if values.get("total_due"):
        lines.append(f"Total due at check-in: {values['total_due']}")
    return "\n".join(lines)
