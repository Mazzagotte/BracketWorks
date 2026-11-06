// Shared UI for BracketWorks and Tournament Central.
// Every component follows docs/ui-standards.md. Build pages from these, not local copies.

export { ICON_SIZE } from './iconSize';

export { Button, ButtonLink, buttonClassName } from './components/Button';
export type { ButtonLinkProps, ButtonProps, ButtonSize, ButtonStyleOptions, ButtonVariant } from './components/Button';

export { Card, CardDivider, CardHeader, PageHeader, StatGroup } from './components/Layout';
export type { CardHeaderProps, CardProps, PageHeaderProps, StatGroupProps, StatItem } from './components/Layout';

export { ActivityList, Avatar, Badge, EmptyState, Notice, ProgressBar } from './components/Feedback';
export type { ActivityItem, BadgeProps, EmptyStateProps, NoticeProps, ProgressBarProps, StatusTone } from './components/Feedback';

export { FormGrid, SegmentedControl, SelectField, TextAreaField, TextField } from './components/Form';
export type { SegmentedControlProps, SegmentedOption, SelectFieldProps, TextAreaFieldProps, TextFieldProps } from './components/Form';

export { DataTable, Pagination, TableToolbar } from './components/Table';
export type { DataTableProps, PaginationProps, TableToolbarProps } from './components/Table';

export { ConfirmDialog, Modal } from './components/Overlay';
export type { ConfirmDialogProps, ModalProps } from './components/Overlay';

export { NavItem, SideNav, TopNav, TopNavBrand, navItemClassName, sideNavItemClassName } from './components/Nav';
export type { NavItemProps, SideNavItem, SideNavProps, SideNavSection, TopNavBrandProps, TopNavProps } from './components/Nav';

export function capitalizeFirstLetter(value: string): string {
  const firstLetterIndex = value.search(/\S/);
  if (firstLetterIndex === -1) {
    return value;
  }

  return `${value.slice(0, firstLetterIndex)}${value.charAt(firstLetterIndex).toLocaleUpperCase()}${value.slice(firstLetterIndex + 1)}`;
}
