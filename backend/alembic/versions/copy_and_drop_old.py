"""Copy data from old columns to new and drop old columns"""

revision = 'copy_and_drop_old'
down_revision = 'abc123entries'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Step 1: Copy data from old columns to new columns
    op.execute("""
        UPDATE bowler 
        SET handicap_entries = handicap, 
            scratch_entries = scratch
        WHERE handicap IS NOT NULL OR scratch IS NOT NULL
    """)
    
    # Step 2: Drop the old columns
    op.drop_column('bowler', 'handicap')
    op.drop_column('bowler', 'scratch')


def downgrade():
    # Re-add the old columns
    op.add_column('bowler', sa.Column('handicap', sa.Integer(), nullable=True))
    op.add_column('bowler', sa.Column('scratch', sa.Integer(), nullable=True))
    
    # Copy data back from new to old
    op.execute("""
        UPDATE bowler 
        SET handicap = handicap_entries, 
            scratch = scratch_entries
    """)
