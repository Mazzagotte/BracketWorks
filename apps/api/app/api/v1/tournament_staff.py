from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tournament_access import require_tournament_permission
from ...services.tournament_audit import record_tournament_event
from ...services.email_service import sendTournamentStaffInviteEmail

router = APIRouter()
StaffRole = Literal["tournament_admin", "entries_manager", "scorer", "viewer"]


class StaffInviteRequest(BaseModel):
    email: EmailStr
    role: StaffRole


class StaffRoleUpdate(BaseModel):
    role: StaffRole


def _member_payload(member: models.TournamentStaffMember, user: models.User) -> dict:
    return {
        "id": member.id, "tournament_id": member.tournament_id, "user_id": member.user_id,
        "role": member.role, "display_name": f"{user.first_name} {user.last_name}".strip() or user.username,
        "email": user.email, "created_at": member.created_at,
    }


@router.get("/tournaments/{tournament_id}")
def list_staff(tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(db, tournament_id, user, "view")
    owner = db.get(models.User, tournament.user_id)
    result = [{
        "id": None, "tournament_id": tournament.id, "user_id": tournament.user_id, "role": "owner",
        "display_name": f"{owner.first_name} {owner.last_name}".strip() or owner.username,
        "email": owner.email, "created_at": None,
    }]
    rows = db.query(models.TournamentStaffMember, models.User).join(
        models.User, models.User.id == models.TournamentStaffMember.user_id
    ).filter(models.TournamentStaffMember.tournament_id == tournament_id).order_by(models.TournamentStaffMember.created_at).all()
    result.extend(_member_payload(member, member_user) for member, member_user in rows)
    return result


@router.post("/{tournament_id}/invitations", status_code=status.HTTP_201_CREATED)
def invite_staff(payload: StaffInviteRequest, tournament_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    tournament = require_tournament_permission(db, tournament_id, user, "manage_staff")
    email = str(payload.email).strip().lower()
    if email == user.email.lower() or email == db.get(models.User, tournament.user_id).email.lower():
        raise HTTPException(status_code=400, detail="That user already has tournament access")
    invited_user = db.query(models.User).filter(models.User.email == email).first()
    if invited_user and db.query(models.TournamentStaffMember).filter_by(tournament_id=tournament_id, user_id=invited_user.id).first():
        raise HTTPException(status_code=409, detail="That user is already on the tournament staff")
    existing = db.query(models.TournamentStaffInvitation).filter(
        models.TournamentStaffInvitation.tournament_id == tournament_id,
        models.TournamentStaffInvitation.email == email,
        models.TournamentStaffInvitation.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A pending invitation already exists for that email")
    invitation = models.TournamentStaffInvitation(
        tournament_id=tournament_id, email=email, role=payload.role,
        invited_by_user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    db.flush()
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="staff.invited", user=user,
        summary=f"Invited {email} as {payload.role.replace('_', ' ')}",
        after_values={"email": email, "role": payload.role}, entity_type="staff_invitation", entity_id=invitation.id,
    )
    db.commit()
    db.refresh(invitation)
    email_sent = sendTournamentStaffInviteEmail(email, tournament_name=tournament.name, role=invitation.role)
    return {"id": invitation.id, "email": invitation.email, "role": invitation.role, "status": invitation.status, "expires_at": invitation.expires_at, "email_sent": email_sent}


@router.get("/invitations/mine")
def my_invitations(db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    now = datetime.now(timezone.utc)
    rows = db.query(models.TournamentStaffInvitation, models.Tournament).join(
        models.Tournament, models.Tournament.id == models.TournamentStaffInvitation.tournament_id
    ).filter(
        models.TournamentStaffInvitation.email == user.email.lower(),
        models.TournamentStaffInvitation.status == "pending",
        models.TournamentStaffInvitation.expires_at > now,
    ).order_by(models.TournamentStaffInvitation.created_at.desc()).all()
    return [{"id": invite.id, "tournament_id": invite.tournament_id, "tournament_name": tournament.name, "role": invite.role, "expires_at": invite.expires_at} for invite, tournament in rows]


def _respond(invitation_id: int, decision: Literal["accepted", "declined"], db: Session, user: models.User):
    invitation = db.get(models.TournamentStaffInvitation, invitation_id)
    if not invitation or invitation.email != user.email.lower():
        raise HTTPException(status_code=404, detail="Invitation not found")
    now = datetime.now(timezone.utc)
    expires_at = invitation.expires_at.replace(tzinfo=timezone.utc) if invitation.expires_at.tzinfo is None else invitation.expires_at
    if invitation.status != "pending" or expires_at <= now:
        raise HTTPException(status_code=409, detail="Invitation is no longer available")
    invitation.status = decision
    invitation.responded_at = now
    if decision == "accepted":
        member = models.TournamentStaffMember(
            tournament_id=invitation.tournament_id, user_id=user.id, role=invitation.role,
            invited_by_user_id=invitation.invited_by_user_id,
        )
        db.add(member)
    record_tournament_event(
        db, tournament_id=invitation.tournament_id,
        event_type=f"staff.invitation_{decision}", user=user,
        summary=f"{user.first_name} {user.last_name} {decision} the staff invitation",
        after_values={"role": invitation.role}, entity_type="staff_invitation", entity_id=invitation.id,
    )
    db.commit()
    return {"ok": True, "status": decision}


@router.post("/invitations/{invitation_id}/accept")
def accept_invitation(invitation_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    return _respond(invitation_id, "accepted", db, user)


@router.post("/invitations/{invitation_id}/decline")
def decline_invitation(invitation_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    return _respond(invitation_id, "declined", db, user)


@router.patch("/{tournament_id}/members/{member_id}")
def change_member_role(tournament_id: int, member_id: int, payload: StaffRoleUpdate, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    require_tournament_permission(db, tournament_id, user, "manage_staff")
    member = db.query(models.TournamentStaffMember).filter_by(id=member_id, tournament_id=tournament_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Staff member not found")
    previous_role = member.role
    member.role = payload.role
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="staff.role_changed", user=user,
        summary="Changed a staff member role", before_values={"role": previous_role},
        after_values={"role": member.role, "user_id": member.user_id}, entity_type="staff_member", entity_id=member.id,
    )
    db.commit()
    return {"ok": True, "role": member.role}


@router.delete("/{tournament_id}/members/{member_id}")
def remove_member(tournament_id: int, member_id: int, db: Session = Depends(deps.get_db), user: models.User = Depends(deps.get_current_user)):
    require_tournament_permission(db, tournament_id, user, "manage_staff")
    member = db.query(models.TournamentStaffMember).filter_by(id=member_id, tournament_id=tournament_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Staff member not found")
    removed_user_id, role = member.user_id, member.role
    db.delete(member)
    record_tournament_event(
        db, tournament_id=tournament_id, event_type="staff.removed", user=user,
        summary="Removed a tournament staff member", before_values={"user_id": removed_user_id, "role": role},
        entity_type="staff_member", entity_id=member_id,
    )
    db.commit()
    return {"ok": True}
