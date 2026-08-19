"""add tc registration relational tables

Revision ID: 0029_tc_registration_tables
Revises: 0028_account_lifecycle
Create Date: 2026-08-16
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0029_tc_registration_tables"
down_revision = "0028_account_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tc_registrations",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("confirmation_code", sa.String(length=64), nullable=False),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("account_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("contact_first_name", sa.String(length=120), nullable=False),
        sa.Column("contact_last_name", sa.String(length=120), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("payment_status", sa.String(length=24), nullable=False, server_default="unpaid"),
        sa.Column("subtotal_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fees_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("terms_accepted_at", sa.DateTime(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="public"),
        sa.UniqueConstraint("confirmation_code", name="uq_tc_registrations_confirmation_code"),
    )
    op.create_index("ix_tc_registrations_id", "tc_registrations", ["id"], unique=False)
    op.create_index("ix_tc_registrations_confirmation_code", "tc_registrations", ["confirmation_code"], unique=True)
    op.create_index("ix_tc_registrations_tournament_id", "tc_registrations", ["tournament_id"], unique=False)
    op.create_index("ix_tc_registrations_account_user_id", "tc_registrations", ["account_user_id"], unique=False)
    op.create_index("ix_tc_registrations_contact_email", "tc_registrations", ["contact_email"], unique=False)
    op.create_index("ix_tc_registrations_status", "tc_registrations", ["status"], unique=False)
    op.create_index("ix_tc_registrations_payment_status", "tc_registrations", ["payment_status"], unique=False)
    op.create_index("ix_tc_registrations_submitted_at", "tc_registrations", ["submitted_at"], unique=False)
    op.create_index("ix_tc_registrations_created_at", "tc_registrations", ["created_at"], unique=False)
    op.create_index("ix_tc_registrations_updated_at", "tc_registrations", ["updated_at"], unique=False)

    op.create_table(
        "tc_registration_bowlers",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("registration_id", sa.Integer(), sa.ForeignKey("tc_registrations.id"), nullable=False),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("usbc_number", sa.String(length=40), nullable=True),
        sa.Column("average", sa.Integer(), nullable=True),
        sa.Column("date_of_birth", sa.String(length=40), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=60), nullable=True),
        sa.Column("zip_code", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tc_registration_bowlers_id", "tc_registration_bowlers", ["id"], unique=False)
    op.create_index("ix_tc_registration_bowlers_registration_id", "tc_registration_bowlers", ["registration_id"], unique=False)
    op.create_index("ix_tc_registration_bowlers_tournament_id", "tc_registration_bowlers", ["tournament_id"], unique=False)
    op.create_index("ix_tc_registration_bowlers_user_id", "tc_registration_bowlers", ["user_id"], unique=False)
    op.create_index("ix_tc_registration_bowlers_email", "tc_registration_bowlers", ["email"], unique=False)
    op.create_index("ix_tc_registration_bowlers_usbc_number", "tc_registration_bowlers", ["usbc_number"], unique=False)
    op.create_index("ix_tc_registration_bowlers_created_at", "tc_registration_bowlers", ["created_at"], unique=False)
    op.create_index("ix_tc_registration_bowlers_updated_at", "tc_registration_bowlers", ["updated_at"], unique=False)

    op.create_table(
        "tc_entries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("registration_id", sa.Integer(), sa.ForeignKey("tc_registrations.id"), nullable=False),
        sa.Column("tournament_id", sa.Integer(), sa.ForeignKey("tc_tournaments.id"), nullable=False),
        sa.Column("event_config_id", sa.String(length=120), nullable=False),
        sa.Column("event_name_snapshot", sa.String(length=255), nullable=False),
        sa.Column("division_config_id", sa.String(length=120), nullable=True),
        sa.Column("division_name_snapshot", sa.String(length=255), nullable=True),
        sa.Column("squad_config_id", sa.String(length=120), nullable=True),
        sa.Column("squad_name_snapshot", sa.String(length=255), nullable=True),
        sa.Column("squad_date_snapshot", sa.String(length=40), nullable=True),
        sa.Column("squad_time_snapshot", sa.String(length=40), nullable=True),
        sa.Column("entry_number", sa.Integer(), nullable=True),
        sa.Column("reentry_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("entry_fee_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tc_entries_id", "tc_entries", ["id"], unique=False)
    op.create_index("ix_tc_entries_registration_id", "tc_entries", ["registration_id"], unique=False)
    op.create_index("ix_tc_entries_tournament_id", "tc_entries", ["tournament_id"], unique=False)
    op.create_index("ix_tc_entries_event_config_id", "tc_entries", ["event_config_id"], unique=False)
    op.create_index("ix_tc_entries_division_config_id", "tc_entries", ["division_config_id"], unique=False)
    op.create_index("ix_tc_entries_squad_config_id", "tc_entries", ["squad_config_id"], unique=False)
    op.create_index("ix_tc_entries_status", "tc_entries", ["status"], unique=False)
    op.create_index("ix_tc_entries_created_at", "tc_entries", ["created_at"], unique=False)
    op.create_index("ix_tc_entries_updated_at", "tc_entries", ["updated_at"], unique=False)

    op.create_table(
        "tc_entry_bowlers",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("entry_id", sa.Integer(), sa.ForeignKey("tc_entries.id"), nullable=False),
        sa.Column("bowler_id", sa.Integer(), sa.ForeignKey("tc_registration_bowlers.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("role", sa.String(length=60), nullable=True),
        sa.UniqueConstraint("entry_id", "bowler_id", name="uq_tc_entry_bowler_pair"),
    )
    op.create_index("ix_tc_entry_bowlers_id", "tc_entry_bowlers", ["id"], unique=False)
    op.create_index("ix_tc_entry_bowlers_entry_id", "tc_entry_bowlers", ["entry_id"], unique=False)
    op.create_index("ix_tc_entry_bowlers_bowler_id", "tc_entry_bowlers", ["bowler_id"], unique=False)

    op.create_table(
        "tc_registration_answers",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("registration_id", sa.Integer(), sa.ForeignKey("tc_registrations.id"), nullable=False),
        sa.Column("entry_id", sa.Integer(), sa.ForeignKey("tc_entries.id"), nullable=True),
        sa.Column("bowler_id", sa.Integer(), sa.ForeignKey("tc_registration_bowlers.id"), nullable=True),
        sa.Column("question_config_id", sa.String(length=120), nullable=False),
        sa.Column("question_label_snapshot", sa.String(length=255), nullable=False),
        sa.Column("answer_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tc_registration_answers_id", "tc_registration_answers", ["id"], unique=False)
    op.create_index("ix_tc_registration_answers_registration_id", "tc_registration_answers", ["registration_id"], unique=False)
    op.create_index("ix_tc_registration_answers_entry_id", "tc_registration_answers", ["entry_id"], unique=False)
    op.create_index("ix_tc_registration_answers_bowler_id", "tc_registration_answers", ["bowler_id"], unique=False)
    op.create_index("ix_tc_registration_answers_question_config_id", "tc_registration_answers", ["question_config_id"], unique=False)
    op.create_index("ix_tc_registration_answers_created_at", "tc_registration_answers", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tc_registration_answers_created_at", table_name="tc_registration_answers")
    op.drop_index("ix_tc_registration_answers_question_config_id", table_name="tc_registration_answers")
    op.drop_index("ix_tc_registration_answers_bowler_id", table_name="tc_registration_answers")
    op.drop_index("ix_tc_registration_answers_entry_id", table_name="tc_registration_answers")
    op.drop_index("ix_tc_registration_answers_registration_id", table_name="tc_registration_answers")
    op.drop_index("ix_tc_registration_answers_id", table_name="tc_registration_answers")
    op.drop_table("tc_registration_answers")

    op.drop_index("ix_tc_entry_bowlers_bowler_id", table_name="tc_entry_bowlers")
    op.drop_index("ix_tc_entry_bowlers_entry_id", table_name="tc_entry_bowlers")
    op.drop_index("ix_tc_entry_bowlers_id", table_name="tc_entry_bowlers")
    op.drop_table("tc_entry_bowlers")

    op.drop_index("ix_tc_entries_updated_at", table_name="tc_entries")
    op.drop_index("ix_tc_entries_created_at", table_name="tc_entries")
    op.drop_index("ix_tc_entries_status", table_name="tc_entries")
    op.drop_index("ix_tc_entries_squad_config_id", table_name="tc_entries")
    op.drop_index("ix_tc_entries_division_config_id", table_name="tc_entries")
    op.drop_index("ix_tc_entries_event_config_id", table_name="tc_entries")
    op.drop_index("ix_tc_entries_tournament_id", table_name="tc_entries")
    op.drop_index("ix_tc_entries_registration_id", table_name="tc_entries")
    op.drop_index("ix_tc_entries_id", table_name="tc_entries")
    op.drop_table("tc_entries")

    op.drop_index("ix_tc_registration_bowlers_updated_at", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_created_at", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_usbc_number", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_email", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_user_id", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_tournament_id", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_registration_id", table_name="tc_registration_bowlers")
    op.drop_index("ix_tc_registration_bowlers_id", table_name="tc_registration_bowlers")
    op.drop_table("tc_registration_bowlers")

    op.drop_index("ix_tc_registrations_updated_at", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_created_at", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_submitted_at", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_payment_status", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_status", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_contact_email", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_account_user_id", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_tournament_id", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_confirmation_code", table_name="tc_registrations")
    op.drop_index("ix_tc_registrations_id", table_name="tc_registrations")
    op.drop_table("tc_registrations")
