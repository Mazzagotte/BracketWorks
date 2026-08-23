from fastapi import APIRouter

from app.api.v1 import admin, health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts, public, organizer_setup, tc_tournaments, tc_organizer_setup, tc_venues, tournament_activity, tournament_staff, tournament_lifecycle, tournament_snapshots, tournament_reconciliation

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(bowlers.router, prefix="/bowlers", tags=["bowlers"])
api_router.include_router(brackets.router, prefix="/brackets", tags=["brackets"])
api_router.include_router(tournaments.router, prefix="/tournaments", tags=["tournaments"])
api_router.include_router(tournament_activity.router, prefix="/tournament-activity", tags=["tournament-activity"])
api_router.include_router(tournament_staff.router, prefix="/tournament-staff", tags=["tournament-staff"])
api_router.include_router(tournament_lifecycle.router, prefix="/tournament-lifecycle", tags=["tournament-lifecycle"])
api_router.include_router(tournament_snapshots.router, prefix="/tournament-snapshots", tags=["tournament-snapshots"])
api_router.include_router(tournament_reconciliation.router, prefix="/tournament-reconciliation", tags=["tournament-reconciliation"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(squads.router, prefix="/squads", tags=["squads"])
api_router.include_router(bracket_settings.router, prefix="/bracket-settings", tags=["bracket-settings"])
api_router.include_router(scores.router, prefix="/scores", tags=["scores"])
api_router.include_router(payouts.router, prefix="/payouts", tags=["payouts"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(organizer_setup.router, prefix="/organizer-setup", tags=["organizer-setup"])
api_router.include_router(tc_tournaments.router, prefix="/tc/tournaments", tags=["tc-tournaments"])
api_router.include_router(tc_organizer_setup.router, prefix="/tc/organizer-setup", tags=["tc-organizer-setup"])
api_router.include_router(tc_venues.router, prefix="/tc/venues", tags=["tc-venues"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
