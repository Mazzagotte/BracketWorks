// Shared UI for BracketWorks and Tournament Central.
// Every component follows docs/ui-standards.md. Build pages from these, not local copies.

export { ICON_SIZE } from './iconSize';
export { useModalFocus } from './useModalFocus';

export { Button, ButtonLink, buttonClassName } from './components/Button';
export type { ButtonLinkProps, ButtonProps, ButtonSize, ButtonStyleOptions, ButtonVariant } from './components/Button';

export { Card, CardDivider, CardHeader, Page, PageColumns, PageHeader, StatGroup } from './components/Layout';
export type { CardHeaderProps, CardProps, PageHeaderProps, PageProps, StatGroupProps, StatItem } from './components/Layout';

export { Menu, MenuDivider, MenuItem, MenuNote, MenuStatus, menuItemClassName } from './components/Menu';
export type { MenuItemProps, MenuProps } from './components/Menu';

export { ActivityList, Avatar, Badge, EmptyState, Notice, ProgressBar } from './components/Feedback';
export type { ActivityItem, BadgeProps, EmptyStateProps, NoticeProps, ProgressBarProps, StatusTone } from './components/Feedback';

export { CheckboxField, FormGrid, PasswordField, SearchField, SegmentedControl, SelectField, TextAreaField, TextField } from './components/Form';
export type { CheckboxFieldProps, PasswordFieldProps, SearchFieldProps, SegmentedControlProps, SegmentedOption, SelectFieldProps, TextAreaFieldProps, TextFieldProps } from './components/Form';

export { DataTable, Pagination, SortableHeader, TableToolbar } from './components/Table';
export type { DataTableProps, PaginationProps, SortConfig, SortDirection, SortableHeaderProps, TableToolbarProps } from './components/Table';

export { ConfirmDialog, Modal } from './components/Overlay';
export type { ConfirmDialogProps, ModalProps } from './components/Overlay';

export { NavItem, SideNav, TopNav, TopNavBrand, topNavBrandClassName, navItemClassName, sideNavItemClassName } from './components/Nav';
export type { NavItemProps, SideNavItem, SideNavProps, SideNavSection, TopNavBrandProps, TopNavProps } from './components/Nav';

export function capitalizeFirstLetter(value: string): string {
  const firstLetterIndex = value.search(/\S/);
  if (firstLetterIndex === -1) {
    return value;
  }

  return `${value.slice(0, firstLetterIndex)}${value.charAt(firstLetterIndex).toLocaleUpperCase()}${value.slice(firstLetterIndex + 1)}`;
}

export { BracketChampion, BracketMatch, BracketTree, bracketWinningMargin } from './components/Bracket';
export type { BracketChampionData, BracketMatchData, BracketMatchProps, BracketPlayerData, BracketRoundData, BracketTreeProps } from './components/Bracket';

export { BracketLadder, BracketTwoSided, RoundRobinGrid, TWO_SIDED_MIN_FIRST_ROUND_MATCHES, ladderWaitingNote } from './components/FinalsBrackets';
export type { BracketLadderProps, BracketTwoSidedProps, RoundRobinGame, RoundRobinGridProps, RoundRobinPlayer } from './components/FinalsBrackets';

export { AuthShell } from './components/AuthShell';
export type { AuthFeature, AuthShellProps } from './components/AuthShell';
