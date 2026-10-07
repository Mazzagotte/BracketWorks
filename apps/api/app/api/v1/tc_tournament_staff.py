from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ...api import deps
from ...core import models
from ...services.tournament_access import (
    require_tc_tournament_permission,
    user_has_tc_tournament_permission,
)

router = APIRouter()
StaffRole = Literal["tournament_admin", "entries_manager", "scorer", "viewer"]


class StaffInviteRequest(BaseModel):
    email: EmailStr
    role: StaffRole


class StaffRoleUpdate(BaseModel):
    role: StaffRole


@router.get("/tournaments/{tournament_id}/staff")
def list_staff(
    tournament_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "view")
    include_email = user_has_tc_tournament_permission(db, tournament, user, "manage_staff")
    owner = db.get(models.User, tournament.user_id)
    owner_payload = {
        "id": None,
        "tournament_id": tournament.id,
        "user_id": tournament.user_id,
        "role": "owner",
        "display_name": f"{owner.first_name} {owner.last_name}".strip() or owner.username,
        "email": owner.email if include_email else None,
        "created_at": None,
    }
    rows = db.query(models.TcTournamentStaffMember, models.User).join(
        models.User, models.User.id == models.TcTournamentStaffMember.user_id
    ).filter(
        models.TcTournamentStaffMember.tournament_id == tournament_id
    ).order_by(models.TcTournamentStaffMember.created_at).all()
    result = [owner_payload]
    result.extend(
        {
            "id": member.id,
            "tournament_id": member.tournament_id,
            "user_id": member.user_id,
            "role": member.role,
            "display_name": f"{member_user.first_name} {member_user.last_name}".strip() or member_user.username,
            "email": member_user.email if include_email else None,
            "created_at": member.created_at,
        }
        for member, member_user in rows
    )
    return {"members": result, "can_manage_staff": include_email}


@router.post("/tournaments/{tournament_id}/staff-invitations", status_code=status.HTTP_201_CREATED)
def invite_staff(
    tournament_id: int,
    payload: StaffInviteRequest,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    tournament = require_tc_tournament_permission(db, tournament_id, user, "manage_staff")
    email = str(payload.email).strip().lower()
    owner = db.get(models.User, tournament.user_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="Tournament owner not found")
    if email == owner.email.lower():
        raise HTTPException(status_code=400, detail="That user already has tournament access")

    invited_user = db.query(models.User).filter(models.User.email == email).first()
    if invited_user and db.query(models.TcTournamentStaffMember).filter_by(
        tournament_id=tournament_id, user_id=invited_user.id
    ).first():
        raise HTTPException(status_code=409, detail="That user is already on the tournament staff")
    existing = db.query(models.TcTournamentStaffInvitation).filter(
        models.TcTournamentStaffInvitation.tournament_id == tournament_id,
        models.TcTournamentStaffInvitation.email == email,
        models.TcTournamentStaffInvitation.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A pending invitation already exists for that email")

    invitation = models.TcTournamentStaffInvitation(
        tournament_id=tournament_id,
        email=email,
        role=payload.role,
        invited_by_user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return {
        "id": invitation.id,
        "email": invitation.email,
        "role": invitation.role,
        "status": invitation.status,
        "expires_at": invitation.expires_at,
        "email_sent": False,
    }


@router.get("/staff-invitations/mine")
def list_my_invitations(
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    if user.email_verified_at is None:
        return []
    now = datetime.now(timezone.utc)
    rows = db.query(models.TcTournamentStaffInvitation, models.TournamentCentral).join(
        models.TournamentCentral,
        models.TournamentCentral.id == models.TcTournamentStaffInvitation.tournament_id,
    ).filter(
        models.TcTournamentStaffInvitation.email == user.email.lower(),
        models.TcTournamentStaffInvitation.status == "pending",
        models.TcTournamentStaffInvitation.expires_at > now,
    ).order_by(models.TcTournamentStaffInvitation.created_at.desc()).all()
    return [
        {
            "id": invitation.id,
            "tournament_id": invitation.tournament_id,
            "tournament_name": tournament.name,
            "role": invitation.role,
            "expires_at": invitation.expires_at,
        }
        for invitation, tournament in rows
    ]


def _respond_to_invitation(
    invitation_id: int,
    decision: Literal["accepted", "declined"],
    db: Session,
    user: models.User,
):
    if user.email_verified_at is None:
        raise HTTPException(status_code=403, detail="Verify your email before responding to staff invitations")
    invitation = db.get(models.TcTournamentStaffInvitation, invitation_id)
    if invitation is None or invitation.email != user.email.lower():
        raise HTTPException(status_code=404, detail="Invitation not found")
    now = datetime.now(timezone.utc)
    expires_at = invitation.expires_at.replace(tzinfo=timezone.utc) if invitation.expires_at.tzinfo is None else invitation.expires_at
    if invitation.status != "pending" or expires_at <= now:
        raise HTTPException(status_code=409, detail="Invitation is no longer available")
    tournament = db.get(models.TournamentCentral, invitation.tournament_id)
    if tournament is None:
        raise HTTPException(status_code=409, detail="Invitation cannot be accepted for a deleted tournament")

    if decision == "accepted":
        existing = db.query(models.TcTournamentStaffMember).filter_by(
            tournament_id=invitation.tournament_id, user_id=user.id
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="You already have tournament access")
    invitation.status = decision
    invitation.responded_at = now
    if decision == "accepted":
        db.add(models.TcTournamentStaffMember(
            tournament_id=invitation.tournament_id,
            user_id=user.id,
            role=invitation.role,
            invited_by_user_id=invitation.invited_by_user_id,
        ))
    db.commit()
    return {"ok": True, "status": decision}


@router.post("/staff-invitations/{invitation_id}/accept")
def accept_invitation(
    invitation_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    return _respond_to_invitation(invitation_id, "accepted", db, user)


@router.post("/staff-invitations/{invitation_id}/decline")
def decline_invitation(
    invitation_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    return _respond_to_invitation(invitation_id, "declined", db, user)


@router.patch("/tournaments/{tournament_id}/staff/{member_id}")
def change_member_role(
    tournament_id: int,
    member_id: int,
    payload: StaffRoleUpdate,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    require_tc_tournament_permission(db, tournament_id, user, "manage_staff")
    member = db.query(models.TcTournamentStaffMember).filter_by(
        id=member_id, tournament_id=tournament_id
    ).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    member.role = payload.role
    db.commit()
    return {"ok": True, "role": member.role}


@router.delete("/tournaments/{tournament_id}/staff/{member_id}")
def remove_member(
    tournament_id: int,
    member_id: int,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_user),
):
    require_tc_tournament_permission(db, tournament_id, user, "manage_staff")
    member = db.query(models.TcTournamentStaffMember).filter_by(
        id=member_id, tournament_id=tournament_id
    ).first()
    if member is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    db.delete(member)
    db.commit()
    return {"ok": True}
