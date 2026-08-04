from fastapi import APIRouter

from app.api.v1 import admin, health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts, public

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(bowlers.router, prefix="/bowlers", tags=["bowlers"])
api_router.include_router(brackets.router, prefix="/brackets", tags=["brackets"])
api_router.include_router(tournaments.router, prefix="/tournaments", tags=["tournaments"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(squads.router, prefix="/squads", tags=["squads"])
api_router.include_router(bracket_settings.router, prefix="/bracket-settings", tags=["bracket-settings"])
api_router.include_router(scores.router, prefix="/scores", tags=["scores"])
api_router.include_router(payouts.router, prefix="/payouts", tags=["payouts"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
