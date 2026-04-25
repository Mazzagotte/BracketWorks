"""clean schema baseline

Revision ID: 0001_clean_schema_baseline
Revises:
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_clean_schema_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("organization", sa.String(), nullable=True),
        sa.Column("password", sa.String(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "tournaments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("start_date", sa.String(), nullable=True),
        sa.Column("end_date", sa.String(), nullable=True),
        sa.Column("squad_times", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index(op.f("ix_tournaments_user_id"), "tournaments", ["user_id"], unique=False)

    op.create_table(
        "tournament_squads",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.String(), nullable=False),
        sa.Column("time", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
    )
    op.create_index(op.f("ix_tournament_squads_tournament_id"), "tournament_squads", ["tournament_id"], unique=False)

    op.create_table(
        "user_squad_selections",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tournament_squad_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tournament_squad_id"], ["tournament_squads.id"]),
    )
    op.create_index(op.f("ix_user_squad_selections_user_id"), "user_squad_selections", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_squad_selections_tournament_squad_id"), "user_squad_selections", ["tournament_squad_id"], unique=False)

    op.create_table(
        "tournament_players",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("squad_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("average", sa.Integer(), nullable=True),
        sa.Column("handicap_pins", sa.Integer(), nullable=True),
        sa.Column("handicap_entry_count", sa.Integer(), nullable=True),
        sa.Column("scratch_entry_count", sa.Integer(), nullable=True),
        sa.Column("program_entry_counts", sa.JSON(), nullable=True),
        sa.Column("lane", sa.String(), nullable=True),
        sa.Column("division", sa.String(), nullable=True),
        sa.Column("usbc_number", sa.String(), nullable=True),
        sa.Column("amount_paid", sa.Float(), nullable=True, server_default="0"),
        sa.ForeignKeyConstraint(["squad_id"], ["tournament_squads.id"]),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index(op.f("ix_tournament_players_tournament_id"), "tournament_players", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_players_squad_id"), "tournament_players", ["squad_id"], unique=False)
    op.create_index(op.f("ix_tournament_players_user_id"), "tournament_players", ["user_id"], unique=False)

    op.create_table(
        "tournament_bracket_settings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("bracket_size", sa.Integer(), nullable=True),
        sa.Column("first_place_amount", sa.Float(), nullable=True),
        sa.Column("second_place_amount", sa.Float(), nullable=True),
        sa.Column("house_fee_amount", sa.Float(), nullable=True),
        sa.Column("default_entry_fee", sa.Float(), nullable=True),
        sa.Column("bracket_programs", sa.JSON(), nullable=True),
        sa.Column("handicap_percentage", sa.Float(), nullable=True, server_default="80"),
        sa.Column("handicap_base", sa.Float(), nullable=True, server_default="200"),
        sa.Column("allow_byes", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
    )
    op.create_index(op.f("ix_tournament_bracket_settings_tournament_id"), "tournament_bracket_settings", ["tournament_id"], unique=False)

    op.create_table(
        "player_scores",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("squad_id", sa.Integer(), nullable=False),
        sa.Column("game1_scratch", sa.Integer(), nullable=True),
        sa.Column("game1_with_handicap", sa.Integer(), nullable=True),
        sa.Column("game2_scratch", sa.Integer(), nullable=True),
        sa.Column("game2_with_handicap", sa.Integer(), nullable=True),
        sa.Column("game3_scratch", sa.Integer(), nullable=True),
        sa.Column("game3_with_handicap", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["tournament_players.id"]),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["tournament_squads.id"]),
    )
    op.create_index(op.f("ix_player_scores_player_id"), "player_scores", ["player_id"], unique=False)
    op.create_index(op.f("ix_player_scores_tournament_id"), "player_scores", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_player_scores_squad_id"), "player_scores", ["squad_id"], unique=False)

    op.create_table(
        "bracket_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("squad_id", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("bracket_size", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["tournament_squads.id"]),
    )
    op.create_index(op.f("ix_bracket_snapshots_tournament_id"), "bracket_snapshots", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_bracket_snapshots_squad_id"), "bracket_snapshots", ["squad_id"], unique=False)
    op.create_index(op.f("ix_bracket_snapshots_is_current"), "bracket_snapshots", ["is_current"], unique=False)

    op.create_table(
        "first_round_matchup_history",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("left_player_id", sa.Integer(), nullable=False),
        sa.Column("right_player_id", sa.Integer(), nullable=False),
        sa.Column("bracket_group_key", sa.String(length=50), nullable=False),
        sa.Column("bracket_number", sa.Integer(), nullable=True),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["left_player_id"], ["tournament_players.id"]),
        sa.ForeignKeyConstraint(["right_player_id"], ["tournament_players.id"]),
    )
    op.create_index(op.f("ix_first_round_matchup_history_tournament_id"), "first_round_matchup_history", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_first_round_matchup_history_left_player_id"), "first_round_matchup_history", ["left_player_id"], unique=False)
    op.create_index(op.f("ix_first_round_matchup_history_right_player_id"), "first_round_matchup_history", ["right_player_id"], unique=False)
    op.create_index(op.f("ix_first_round_matchup_history_bracket_group_key"), "first_round_matchup_history", ["bracket_group_key"], unique=False)

    op.create_table(
        "bracket_winners",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("squad_id", sa.Integer(), nullable=True),
        sa.Column("bracket_snapshot_id", sa.Integer(), nullable=True),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("bracket_group_key", sa.String(length=50), nullable=False),
        sa.Column("bracket_label", sa.String(length=100), nullable=False),
        sa.Column("placement", sa.Integer(), nullable=False),
        sa.Column("placement_text", sa.String(length=10), nullable=False),
        sa.Column("player_name", sa.String(length=100), nullable=False),
        sa.Column("winning_score", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["tournament_squads.id"]),
        sa.ForeignKeyConstraint(["bracket_snapshot_id"], ["bracket_snapshots.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["tournament_players.id"]),
    )
    op.create_index(op.f("ix_bracket_winners_tournament_id"), "bracket_winners", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_bracket_winners_squad_id"), "bracket_winners", ["squad_id"], unique=False)
    op.create_index(op.f("ix_bracket_winners_bracket_snapshot_id"), "bracket_winners", ["bracket_snapshot_id"], unique=False)
    op.create_index(op.f("ix_bracket_winners_player_id"), "bracket_winners", ["player_id"], unique=False)
    op.create_index(op.f("ix_bracket_winners_bracket_group_key"), "bracket_winners", ["bracket_group_key"], unique=False)
    op.create_index(op.f("ix_bracket_winners_placement"), "bracket_winners", ["placement"], unique=False)

    op.create_table(
        "bracket_payouts",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("squad_id", sa.Integer(), nullable=True),
        sa.Column("bracket_snapshot_id", sa.Integer(), nullable=True),
        sa.Column("bracket_winner_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("bracket_group_key", sa.String(length=50), nullable=False),
        sa.Column("bracket_label", sa.String(length=100), nullable=False),
        sa.Column("placement", sa.Integer(), nullable=False),
        sa.Column("player_name", sa.String(length=100), nullable=False),
        sa.Column("prize_pool_total", sa.Float(), nullable=False),
        sa.Column("payout_percentage", sa.Float(), nullable=False),
        sa.Column("payout_amount", sa.Float(), nullable=False),
        sa.Column("entry_fee", sa.Float(), nullable=False),
        sa.Column("bracket_size", sa.Integer(), nullable=False),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("paid_date", sa.String(), nullable=True),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["tournament_squads.id"]),
        sa.ForeignKeyConstraint(["bracket_snapshot_id"], ["bracket_snapshots.id"]),
        sa.ForeignKeyConstraint(["bracket_winner_id"], ["bracket_winners.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["tournament_players.id"]),
    )
    op.create_index(op.f("ix_bracket_payouts_tournament_id"), "bracket_payouts", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_bracket_payouts_squad_id"), "bracket_payouts", ["squad_id"], unique=False)
    op.create_index(op.f("ix_bracket_payouts_bracket_snapshot_id"), "bracket_payouts", ["bracket_snapshot_id"], unique=False)
    op.create_index(op.f("ix_bracket_payouts_bracket_winner_id"), "bracket_payouts", ["bracket_winner_id"], unique=False)
    op.create_index(op.f("ix_bracket_payouts_player_id"), "bracket_payouts", ["player_id"], unique=False)
    op.create_index(op.f("ix_bracket_payouts_bracket_group_key"), "bracket_payouts", ["bracket_group_key"], unique=False)
    op.create_index(op.f("ix_bracket_payouts_is_paid"), "bracket_payouts", ["is_paid"], unique=False)

    op.create_table(
        "tournament_payout_summaries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("squad_id", sa.Integer(), nullable=True),
        sa.Column("total_prize_pool", sa.Float(), nullable=False),
        sa.Column("total_scratch_pool", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_handicap_pool", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_paid_out", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_unpaid", sa.Float(), nullable=False, server_default="0"),
        sa.Column("scratch_brackets_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("handicap_brackets_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_winners", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scratch_entry_fee", sa.Float(), nullable=False),
        sa.Column("handicap_entry_fee", sa.Float(), nullable=False),
        sa.Column("house_percentage", sa.Float(), nullable=True, server_default="0"),
        sa.Column("house_fee_amount", sa.Float(), nullable=True, server_default="0"),
        sa.Column("is_finalized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("finalized_date", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["tournament_squads.id"]),
    )
    op.create_index(op.f("ix_tournament_payout_summaries_tournament_id"), "tournament_payout_summaries", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_payout_summaries_squad_id"), "tournament_payout_summaries", ["squad_id"], unique=False)
    op.create_index(op.f("ix_tournament_payout_summaries_is_finalized"), "tournament_payout_summaries", ["is_finalized"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tournament_payout_summaries_is_finalized"), table_name="tournament_payout_summaries")
    op.drop_index(op.f("ix_tournament_payout_summaries_squad_id"), table_name="tournament_payout_summaries")
    op.drop_index(op.f("ix_tournament_payout_summaries_tournament_id"), table_name="tournament_payout_summaries")
    op.drop_table("tournament_payout_summaries")

    op.drop_index(op.f("ix_bracket_payouts_is_paid"), table_name="bracket_payouts")
    op.drop_index(op.f("ix_bracket_payouts_bracket_group_key"), table_name="bracket_payouts")
    op.drop_index(op.f("ix_bracket_payouts_player_id"), table_name="bracket_payouts")
    op.drop_index(op.f("ix_bracket_payouts_bracket_winner_id"), table_name="bracket_payouts")
    op.drop_index(op.f("ix_bracket_payouts_bracket_snapshot_id"), table_name="bracket_payouts")
    op.drop_index(op.f("ix_bracket_payouts_squad_id"), table_name="bracket_payouts")
    op.drop_index(op.f("ix_bracket_payouts_tournament_id"), table_name="bracket_payouts")
    op.drop_table("bracket_payouts")

    op.drop_index(op.f("ix_bracket_winners_placement"), table_name="bracket_winners")
    op.drop_index(op.f("ix_bracket_winners_bracket_group_key"), table_name="bracket_winners")
    op.drop_index(op.f("ix_bracket_winners_player_id"), table_name="bracket_winners")
    op.drop_index(op.f("ix_bracket_winners_bracket_snapshot_id"), table_name="bracket_winners")
    op.drop_index(op.f("ix_bracket_winners_squad_id"), table_name="bracket_winners")
    op.drop_index(op.f("ix_bracket_winners_tournament_id"), table_name="bracket_winners")
    op.drop_table("bracket_winners")

    op.drop_index(op.f("ix_first_round_matchup_history_bracket_group_key"), table_name="first_round_matchup_history")
    op.drop_index(op.f("ix_first_round_matchup_history_right_player_id"), table_name="first_round_matchup_history")
    op.drop_index(op.f("ix_first_round_matchup_history_left_player_id"), table_name="first_round_matchup_history")
    op.drop_index(op.f("ix_first_round_matchup_history_tournament_id"), table_name="first_round_matchup_history")
    op.drop_table("first_round_matchup_history")

    op.drop_index(op.f("ix_bracket_snapshots_is_current"), table_name="bracket_snapshots")
    op.drop_index(op.f("ix_bracket_snapshots_squad_id"), table_name="bracket_snapshots")
    op.drop_index(op.f("ix_bracket_snapshots_tournament_id"), table_name="bracket_snapshots")
    op.drop_table("bracket_snapshots")

    op.drop_index(op.f("ix_player_scores_squad_id"), table_name="player_scores")
    op.drop_index(op.f("ix_player_scores_tournament_id"), table_name="player_scores")
    op.drop_index(op.f("ix_player_scores_player_id"), table_name="player_scores")
    op.drop_table("player_scores")

    op.drop_index(op.f("ix_tournament_bracket_settings_tournament_id"), table_name="tournament_bracket_settings")
    op.drop_table("tournament_bracket_settings")

    op.drop_index(op.f("ix_tournament_players_user_id"), table_name="tournament_players")
    op.drop_index(op.f("ix_tournament_players_squad_id"), table_name="tournament_players")
    op.drop_index(op.f("ix_tournament_players_tournament_id"), table_name="tournament_players")
    op.drop_table("tournament_players")

    op.drop_index(op.f("ix_user_squad_selections_tournament_squad_id"), table_name="user_squad_selections")
    op.drop_index(op.f("ix_user_squad_selections_user_id"), table_name="user_squad_selections")
    op.drop_table("user_squad_selections")

    op.drop_index(op.f("ix_tournament_squads_tournament_id"), table_name="tournament_squads")
    op.drop_table("tournament_squads")

    op.drop_index(op.f("ix_tournaments_user_id"), table_name="tournaments")
    op.drop_table("tournaments")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")