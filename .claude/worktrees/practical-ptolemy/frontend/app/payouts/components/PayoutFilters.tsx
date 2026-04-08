import { colors, spacing } from '../../lib/design-system'
import EnhancedButton from '../../components/EnhancedButton'

interface PayoutFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  sortBy: 'amount' | 'name' | 'brackets' | 'status'
  sortDirection: 'asc' | 'desc'
  onSortChange: (sortBy: 'amount' | 'name' | 'brackets' | 'status') => void
  onSortDirectionToggle: () => void
  filterType: 'all' | 'scratch' | 'handicap'
  onFilterTypeChange: (type: 'all' | 'scratch' | 'handicap') => void
  filterPaidStatus: 'all' | 'paid' | 'unpaid'
  onFilterPaidStatusChange: (status: 'all' | 'paid' | 'unpaid') => void
}

export function PayoutFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  sortDirection,
  onSortChange,
  onSortDirectionToggle,
  filterType,
  onFilterTypeChange,
  filterPaidStatus,
  onFilterPaidStatusChange
}: PayoutFiltersProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.md,
      marginBottom: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: '8px',
      border: `1px solid ${colors.border}`
    }}>
      {/* Search Bar */}
      <div>
        <input
          type="text"
          placeholder="Search by player name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '16px',
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            outline: 'none',
          }}
        />
      </div>

      {/* Sort Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: spacing.sm,
        alignItems: 'center'
      }}>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: colors.text.primary,
          marginRight: spacing.xs
        }}>
          Sort by:
        </span>
        
        <EnhancedButton
          variant={sortBy === 'amount' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSortChange('amount')}
        >
          Amount
        </EnhancedButton>
        
        <EnhancedButton
          variant={sortBy === 'name' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSortChange('name')}
        >
          Name
        </EnhancedButton>
        
        <EnhancedButton
          variant={sortBy === 'brackets' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSortChange('brackets')}
        >
          Brackets
        </EnhancedButton>
        
        <EnhancedButton
          variant={sortBy === 'status' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSortChange('status')}
        >
          Status
        </EnhancedButton>
        
        <EnhancedButton
          variant="secondary"
          size="sm"
          onClick={onSortDirectionToggle}
        >
          {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
        </EnhancedButton>
      </div>

      {/* Filter Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: spacing.md,
        paddingTop: spacing.sm,
        borderTop: `1px solid ${colors.border}`
      }}>
        {/* Bracket Type Filter */}
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            color: colors.text.primary 
          }}>
            Type:
          </span>
          
          <EnhancedButton
            variant={filterType === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onFilterTypeChange('all')}
          >
            All
          </EnhancedButton>
          
          <EnhancedButton
            variant={filterType === 'scratch' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onFilterTypeChange('scratch')}
          >
            Scratch
          </EnhancedButton>
          
          <EnhancedButton
            variant={filterType === 'handicap' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onFilterTypeChange('handicap')}
          >
            Handicap
          </EnhancedButton>
        </div>

        {/* Paid Status Filter */}
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            color: colors.text.primary 
          }}>
            Status:
          </span>
          
          <EnhancedButton
            variant={filterPaidStatus === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onFilterPaidStatusChange('all')}
          >
            All
          </EnhancedButton>
          
          <EnhancedButton
            variant={filterPaidStatus === 'unpaid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onFilterPaidStatusChange('unpaid')}
          >
            Unpaid
          </EnhancedButton>
          
          <EnhancedButton
            variant={filterPaidStatus === 'paid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onFilterPaidStatusChange('paid')}
          >
            Paid
          </EnhancedButton>
        </div>
      </div>
    </div>
  )
}
