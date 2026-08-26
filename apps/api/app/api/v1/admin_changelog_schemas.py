from pydantic import BaseModel, Field, field_validator, model_validator


CHANGELOG_TAGS = {"New", "Improved", "Fixed", "Security", "Admin", "Reliability"}


def _clean_items(
    values: list[str],
    *,
    empty_message: str,
    length_message: str,
) -> list[str]:
    cleaned = [value.strip() for value in values]
    if any(not value for value in cleaned):
        raise ValueError(empty_message)
    if any(len(value) > 300 for value in cleaned):
        raise ValueError(length_message)
    return cleaned


class AdminChangelogSection(BaseModel):
    heading: str = Field(min_length=1, max_length=80)
    items: list[str] = Field(min_length=1, max_length=30)

    @field_validator("heading")
    @classmethod
    def clean_heading(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Section heading cannot be empty")
        return value

    @field_validator("items")
    @classmethod
    def clean_items(cls, values: list[str]) -> list[str]:
        return _clean_items(
            values,
            empty_message="Bullet items cannot be empty",
            length_message="Bullet items must be 300 characters or fewer",
        )


class AdminChangelogFields(BaseModel):
    changes: list[str] | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, max_length=120)
    summary: str | None = Field(default=None, max_length=500)
    sections: list[AdminChangelogSection] | None = Field(default=None, max_length=20)
    tags: list[str] | None = Field(default=None, max_length=6)

    @field_validator("changes")
    @classmethod
    def clean_changes(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return _clean_items(
            values,
            empty_message="Legacy changes cannot contain empty items",
            length_message="Changes must be 300 characters or fewer",
        )

    @field_validator("title", "summary")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        if len(values) != len(set(values)) or any(value not in CHANGELOG_TAGS for value in values):
            raise ValueError("Tags must be unique supported changelog categories")
        return values or None


class AdminChangelogContent(AdminChangelogFields):
    changes: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_content(self):
        if self.sections:
            if not self.title:
                raise ValueError("Title is required for structured changelog entries")
        elif not self.changes:
            raise ValueError("Provide at least one section or legacy change")
        elif self.title or self.summary or self.tags:
            raise ValueError("Structured metadata requires at least one section")
        return self


class AdminCreateChangelogPayload(AdminChangelogContent):
    version: str
    date: str


class AdminUpdateChangelogPayload(AdminChangelogFields):
    date: str | None = None
