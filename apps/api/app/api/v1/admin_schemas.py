from datetime import datetime

from pydantic import BaseModel


class AdminUpdateUserPayload(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    organization: str | None = None


class AdminSetUserAdminPayload(BaseModel):
    is_admin: bool


class AdminSetUserActivePayload(BaseModel):
    is_active: bool


class AdminResetPasswordPayload(BaseModel):
    new_password: str


class AdminDeleteUserPayload(BaseModel):
    reason: str
    confirm_text: str


class AdminUpdateTournamentPayload(BaseModel):
    name: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_public: bool | None = None


class AdminReassignTournamentPayload(BaseModel):
    new_owner_user_id: int


class AdminArchiveTournamentPayload(BaseModel):
    reason: str | None = None


class AdminDeleteTournamentPayload(BaseModel):
    reason: str | None = None
    force: bool = False
    confirm_text: str | None = None


class AdminUserReviewPayload(BaseModel):
    kind: str
    category: str
    note: str


class AdminResolveUserReviewPayload(BaseModel):
    resolved: bool = True


class AdminTournamentNotePayload(BaseModel):
    category: str
    note: str


class AdminAnnouncementPayload(BaseModel):
    title: str
    message: str
    audience_type: str = "all"
    audience_user_id: int | None = None
    status: str = "draft"
    requires_acknowledgment: bool = False
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AdminFeedbackUpdatePayload(BaseModel):
    status: str
    admin_note: str | None = None
