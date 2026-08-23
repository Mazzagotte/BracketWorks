"""Canonical registry of authoritative BracketWorks tournament row models."""

from ..core import models

AUTHORITATIVE_TOURNAMENT_ROW_MODELS = (
    models.TournamentSquad,
    models.TournamentSetupState,
    models.TournamentPlayer,
    models.DuplicatePlayerResolution,
    models.TournamentBracketSettings,
    models.PlayerScore,
    models.ScoreCorrection,
    models.BracketSnapshot,
    models.BracketWinner,
    models.BracketPayout,
    models.TournamentPayoutSummary,
    models.PayoutAdjustment,
    models.FirstRoundMatchupHistory,
)
