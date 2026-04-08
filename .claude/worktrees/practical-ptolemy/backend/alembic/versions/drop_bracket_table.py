"""drop_unused_bracket_table"""

revision = 'drop_bracket_table'
down_revision = 'copy_and_drop_old'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Drop the unused bracket table
    op.drop_table('bracket')


def downgrade():
    # Recreate the table if needed (for rollback)
    op.create_table(
        'bracket',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('squad', sa.String(), nullable=True),
        sa.Column('game_count', sa.Integer(), nullable=False, server_default='3')
    )
