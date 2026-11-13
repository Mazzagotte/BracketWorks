"""Which product an account email speaks for.

BracketWorks and Tournament Central share one account system, so the same account emails go out
for both. Each email is branded for the site the person used: its sender, product name, logo and
links. A user's ``signup_site`` decides that unless a request says otherwise (a password reset
asked for on Tournament Central is branded for Tournament Central).
"""

from __future__ import annotations

from dataclasses import dataclass

from ..core.config import settings

SITE_BRACKETWORKS = "bracketworks"
SITE_TOURNAMENT_CENTRAL = "tournament_central"
SITES = (SITE_BRACKETWORKS, SITE_TOURNAMENT_CENTRAL)


@dataclass(frozen=True)
class EmailBrand:
    site: str
    product_name: str
    site_url: str
    logo_path: str
    from_name: str
    from_email: str

    @property
    def from_address(self) -> str:
        return f"{self.from_name} <{self.from_email}>"

    @property
    def logo_url(self) -> str:
        return self.url(self.logo_path)

    def url(self, path: str) -> str:
        return f"{self.site_url.rstrip('/')}{path}"

    def template_variables(self) -> dict[str, str]:
        """The brand variables every account template takes."""
        return {
            "product_name": self.product_name,
            "site_url": self.site_url.rstrip("/"),
            "logo_url": self.logo_url,
        }


def normalize_site(value: str | None) -> str:
    """A known site key, or BracketWorks for anything else (including None)."""
    cleaned = (value or "").strip().lower().replace("-", "_")
    return cleaned if cleaned in SITES else SITE_BRACKETWORKS


def get_brand(site: str | None) -> EmailBrand:
    if normalize_site(site) == SITE_TOURNAMENT_CENTRAL:
        return EmailBrand(
            site=SITE_TOURNAMENT_CENTRAL,
            product_name="Tournament Central",
            site_url=settings.TC_FRONTEND_URL,
            logo_path="/TC_logo_No_Text.svg",
            from_name=settings.TC_FROM_NAME,
            from_email=settings.TC_FROM_EMAIL,
        )
    return EmailBrand(
        site=SITE_BRACKETWORKS,
        product_name="BracketWorks",
        site_url=settings.FRONTEND_URL,
        logo_path="/logo_no_text.svg",
        from_name=settings.FROM_NAME,
        from_email=settings.FROM_EMAIL,
    )
