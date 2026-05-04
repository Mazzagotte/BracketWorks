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
    <div className="bw-payout-filters">
      <div>
        <input
          type="text"
          placeholder="Search by player name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bw-payout-filters-search"
        />
      </div>

      <div className="bw-payout-filters-row">
        <span className="bw-payout-filters-label bw-payout-filters-label-inline">
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

      <div className="bw-payout-filters-groups">
        <div className="bw-payout-filters-group">
          <span className="bw-payout-filters-label">
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

        <div className="bw-payout-filters-group">
          <span className="bw-payout-filters-label">
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
